"""Shared starter models (Settings, Models: "Share my model" and "Community models"; STEP 96).

  GET    /api/adapters/status          { enabled }: SHARED_ADAPTERS=on
  GET    /api/adapters                 approved adapters: title, description, tags, base model, rating; never the owner
  GET    /api/adapters/mine            yours, in any state, with what the checks found
  POST   /api/adapters/check           the checks, sharing nothing (the page shows them before anything is uploaded)
  POST   /api/adapters                 the checks again; if they pass, a pending adapter and links to upload its files to
  POST   /api/adapters/{id}/publish    its files are there and are what they should be: approved, and public
  PATCH  /api/adapters/{id}            the owner changes the title, description or tags (checked again)
  DELETE /api/adapters/{id}            the owner takes it down, files and all
  GET    /api/adapters/{id}/download   links to its two files for ten minutes (approved, or your own)
  POST   /api/adapters/{id}/rating     1 to 5 stars, not for your own
  POST   /api/adapters/{id}/report     to ResourceHub's moderation queue (community_reports, target 'adapter')

Nothing is public until every check passes:
  scrub_review   the owner approved a scrubbed training set (Build my training set, STEP 95), and this names it
  memorization   given the start of each training answer, the tuned model didn't go on to say the rest closely. It runs
                 on the owner's computer, where the model is (frontend lib/sharedModels.ts), so it is their report of
                 the result, recorded as self-reported
  metadata       the title and description name no one and hold no contact details, addresses, schools, employers,
                 dates of birth, ID numbers or links (core/scrubber.py finds none); the tags and base model are on the lists
  files          checked here when it's published: an adapter (only LoRA weights, no hidden metadata) and a config with
                 nothing but the four settings the tools need, so no file path from the owner's computer goes out

Nobody's id is in a file's path (the folder is the adapter's id) or in anything public.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import struct
import uuid
from typing import Any, Callable, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth_guard import current_user_id, optional_user_id
from api.routes.training import known_names
from core import scrubber
from database.supabase_client import get_supabase

router = APIRouter()

BUCKET = "shared-adapters"
WEIGHTS, CONFIG = "adapters.safetensors", "adapter_config.json"
MAX_WEIGHTS_BYTES = 100 * 1024 * 1024
MAX_CONFIG_BYTES = 16 * 1024
# The Ollama model with the same chat format, for the scripts and the adopt instructions.
BASE_MODELS = {
    "mlx-community/Llama-3.2-1B-Instruct-bf16": "llama3.2:1b",
    "mlx-community/Llama-3.2-3B-Instruct-bf16": "llama3.2:3b",
}
COMMUNITY_TAGS = ["autism", "adhd", "dyslexia", "dyspraxia", "tourette", "ocd", "anxiety", "depression",
                  "learning-disability", "intellectual-disability", "chronic-illness", "physical-disability",
                  "caregivers", "students", "work"]
# On 24 training answers, the untuned Llama 3.2 1B's closest continuation was 0.40; the same model tuned for 10 steps
# said 13 of them back at 0.5 or more (31 October 2026). A failure only means training again with less repetition.
MEMORY_THRESHOLD = 0.5
MIN_PROBES = 3
MAX_PER_PERSON = 20
# What may be in a title or description. Diagnoses and medicines may: a starter model is for a community, and saying
# which one names no one.
METADATA_BLOCKS = {"name", "email", "link", "phone", "id_number", "address", "date_of_birth", "school", "employer"}
CONFIG_KEYS = {"fine_tune_type", "num_layers", "lora_parameters", "model"}
_TENSOR = re.compile(r"^(?:[a-z_]+\.)*layers\.\d{1,3}\.[a-z_.]+\.lora_[ab]$")


def enabled() -> bool:
    return os.getenv("SHARED_ADAPTERS", "").strip().lower() == "on"


def _require_enabled() -> None:
    if not enabled():
        raise HTTPException(status_code=404, detail="Sharing models isn't on yet.")


def _supabase():
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Sharing isn't available just now. Please try again later.")
    return sb


class MemoryCheck(BaseModel):
    model: str = Field(..., min_length=1, max_length=100)
    probes: int = Field(..., ge=0, le=1000)
    skipped: int = Field(0, ge=0, le=1000)
    failed: int = Field(..., ge=0, le=1000)
    maxCloseness: float = Field(..., ge=0, le=1)


class AdapterIn(BaseModel):
    title: str = Field(..., min_length=3, max_length=80)
    description: str = Field("", max_length=1000)
    tags: List[str] = Field(default_factory=list, max_length=6)
    baseModel: str = Field(..., max_length=120)
    consentId: str = Field(..., min_length=36, max_length=36)
    memoryCheck: MemoryCheck


class AdapterEdit(BaseModel):
    title: str = Field(..., min_length=3, max_length=80)
    description: str = Field("", max_length=1000)
    tags: List[str] = Field(default_factory=list, max_length=6)


class RatingIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)


class ReportIn(BaseModel):
    reason: str = Field(..., min_length=5, max_length=1000)


# ---- The checks ---------------------------------------------------------------------------------------------------

def metadata_check(title: str, description: str, tags: List[str], base_model: Optional[str] = None,
                   names: List[str] = ()) -> Dict[str, Any]:
    """`names`: the owner's own name and username, the likeliest name to end up in a title ("Priya's planner")."""
    found: Dict[str, int] = {}
    for text in (title, description):
        for kind, count in scrubber.scrub(text, names).found.items():
            if kind in METADATA_BLOCKS:
                found[kind] = found.get(kind, 0) + count
    why = []
    if found:
        kinds = ", ".join(k.replace("_", " ") for k in sorted(found))
        why.append(f"The title or description has personal information in it ({kinds}). Take it out and check again.")
    unknown = [t for t in tags if t not in COMMUNITY_TAGS]
    if unknown:
        why.append("Pick the community tags from the list.")
    if base_model is not None and base_model not in BASE_MODELS:
        why.append("Only adapters for Llama 3.2 1B or 3B (the models the training script uses) can be shared.")
    return {"passed": not why, "found": found, "why": " ".join(why)}


def memory_check(report: MemoryCheck, approved_items: Optional[int]) -> Dict[str, Any]:
    if report.probes < MIN_PROBES:
        why = f"The memory check needs at least {MIN_PROBES} of your training answers long enough to test."
    elif approved_items is not None and report.probes > approved_items:
        why = "The memory check tested more answers than the training set you approved has."
    elif report.failed or report.maxCloseness >= MEMORY_THRESHOLD:
        why = ("Your model says some of your training answers back almost word for word. Train it again with EPOCHS=1, "
               "or with more items, and check again.")
    else:
        why = ""
    return {"passed": not why, "selfReported": True, "model": report.model, "probes": report.probes,
            "skipped": report.skipped, "failed": report.failed, "maxCloseness": round(report.maxCloseness, 3),
            "threshold": MEMORY_THRESHOLD, "why": why}


def run_checks(sb, user_id: str, body: AdapterIn) -> Dict[str, Any]:
    rows = (sb.table("training_set_consents").select("id, created_at, item_count, scrubber_version")
            .eq("id", body.consentId).eq("user_id", user_id).limit(1).execute().data or [])
    consent = rows[0] if rows else None
    scrub = ({"passed": True, "consentId": consent["id"], "itemCount": consent["item_count"],
              "scrubberVersion": consent["scrubber_version"], "at": consent["created_at"], "why": ""} if consent else
             {"passed": False, "why": "Approve a scrubbed training set first (Build my training set), and choose it here."})
    return {
        "scrub_review": scrub,
        "memorization": memory_check(body.memoryCheck, consent["item_count"] if consent else None),
        "metadata": metadata_check(body.title, body.description, body.tags, body.baseModel, known_names(sb, user_id)),
    }


def passed(checks: Dict[str, Any]) -> bool:
    return all(c.get("passed") for c in checks.values())


def weights_problem(head: bytes) -> Optional[str]:
    """What's wrong with an adapter file, from its first bytes (the safetensors header), or None."""
    if len(head) < 8:
        return "The adapter file is empty."
    size = struct.unpack("<Q", head[:8])[0]
    if size > len(head) - 8 or size > 1_000_000:
        return "The adapter file isn't a safetensors file."
    try:
        header = json.loads(head[8:8 + size])
    except ValueError:
        return "The adapter file isn't a safetensors file."
    if not isinstance(header, dict):
        return "The adapter file isn't a safetensors file."
    meta = header.pop("__metadata__", None)
    if meta not in (None, {}) and not (isinstance(meta, dict) and set(meta) <= {"format"}
                                        and all(isinstance(v, str) and len(v) <= 20 for v in meta.values())):
        return "The adapter file has extra information in it. Use the file the training script made."
    if not header or len(header) > 4000 or not all(isinstance(k, str) and _TENSOR.match(k) for k in header):
        return "The file isn't a LoRA adapter (only adapter weights can be shared, not a whole model)."
    if any(not isinstance(v, dict) or v.get("dtype") not in ("F32", "F16", "BF16") for v in header.values()):
        return "The adapter file isn't a safetensors file."
    return None


def config_problem(config: Any, base_model: str) -> Optional[str]:
    if not isinstance(config, dict) or set(config) - CONFIG_KEYS:
        return "The adapter's settings file may only have fine_tune_type, num_layers, lora_parameters and model."
    params = config.get("lora_parameters")
    if (config.get("fine_tune_type") != "lora" or not isinstance(config.get("num_layers"), int)
            or not isinstance(params, dict) or not isinstance(params.get("rank"), int)
            or not 1 <= params["rank"] <= 64 or not isinstance(params.get("scale"), (int, float))):
        return "The adapter's settings file isn't a LoRA adapter's."
    if config.get("model") != base_model:
        return "The adapter's settings name a different base model."
    return None


def _first_bytes(url: str, limit: int = 1_048_576) -> bytes:
    """The start of a file in Storage, without downloading all of it."""
    out = b""
    with httpx.Client(timeout=30) as client:
        with client.stream("GET", url, headers={"Range": f"bytes=0-{limit - 1}"}) as res:
            res.raise_for_status()
            for chunk in res.iter_bytes():
                out += chunk
                if len(out) >= limit:
                    break
    return out[:limit]


def files_check(sb, adapter_id: str, base_model: str, fetch: Optional[Callable[[str], bytes]] = None) -> Dict[str, Any]:
    fetch = fetch or _first_bytes
    bucket = sb.storage.from_(BUCKET)
    listed = {f.get("name"): f for f in bucket.list(adapter_id) or []}
    for name, limit in ((WEIGHTS, MAX_WEIGHTS_BYTES), (CONFIG, MAX_CONFIG_BYTES)):
        if name not in listed:
            return {"passed": False, "why": f"{name} didn't arrive. Upload it again."}
        size = int(((listed[name] or {}).get("metadata") or {}).get("size") or 0)
        if not 0 < size <= limit:
            return {"passed": False, "why": f"{name} is empty or too big."}
    signed = lambda name: bucket.create_signed_url(f"{adapter_id}/{name}", 60).get("signedURL")
    problem = weights_problem(fetch(signed(WEIGHTS)))
    if not problem:
        try:
            problem = config_problem(json.loads(fetch(signed(CONFIG)).decode("utf-8")), base_model)
        except (ValueError, UnicodeDecodeError):
            problem = "The adapter's settings file isn't JSON."
    return {"passed": not problem, "why": problem or "",
            "weightsBytes": int(listed[WEIGHTS]["metadata"]["size"])}


# ---- Reading ------------------------------------------------------------------------------------------------------

PUBLIC_FIELDS = "id, title, description, community_tags, base_model, created_at"


def _public(row: Dict[str, Any], ratings: List[Dict[str, Any]], caller: Optional[str]) -> Dict[str, Any]:
    stars = [int(r["rating"]) for r in ratings if r.get("adapter_id") == row["id"]]
    mine = [int(r["rating"]) for r in ratings if r.get("adapter_id") == row["id"] and caller and r.get("user_id") == caller]
    checks = row.get("moderation_checks") or {}
    return {
        "id": row["id"], "title": row["title"], "description": row.get("description") or "",
        "tags": row.get("community_tags") or [], "baseModel": row["base_model"],
        "ollamaBase": BASE_MODELS.get(row["base_model"]), "createdAt": row.get("created_at"),
        "rating": {"average": round(sum(stars) / len(stars), 1) if stars else None, "count": len(stars)},
        "myRating": mine[0] if mine else None,
        "mine": bool(caller and row.get("owner_id") == caller),
        "checks": {"memoryCheck": (checks.get("memorization") or {}).get("maxCloseness"),
                   "trainedOn": (checks.get("scrub_review") or {}).get("itemCount")},
    }


def _owned(sb, adapter_id: str, user_id: str) -> Dict[str, Any]:
    rows = (sb.table("shared_adapters").select("*").eq("id", adapter_id).eq("owner_id", user_id)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(status_code=404, detail="That isn't one of your shared models.")
    return rows[0]


def _approved(sb, adapter_id: str) -> Dict[str, Any]:
    rows = (sb.table("shared_adapters").select("*").eq("id", adapter_id).eq("moderation_status", "approved")
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(status_code=404, detail="That model isn't shared any more.")
    return rows[0]


def _uuid(value: str) -> str:
    try:
        return str(uuid.UUID(value))
    except ValueError:
        raise HTTPException(status_code=404, detail="That model isn't shared any more.")


@router.get("/status")
async def status():
    return {"enabled": enabled(), "baseModels": BASE_MODELS, "tags": COMMUNITY_TAGS, "memoryThreshold": MEMORY_THRESHOLD}


@router.get("")
async def list_adapters(caller: Optional[str] = Depends(optional_user_id)):
    if not enabled():
        return {"enabled": False, "adapters": []}
    sb = _supabase()

    def read():
        rows = (sb.table("shared_adapters").select(f"{PUBLIC_FIELDS}, owner_id, moderation_checks")
                .eq("moderation_status", "approved").order("created_at", desc=True).limit(200).execute().data or [])
        ids = [r["id"] for r in rows]
        ratings = (sb.table("shared_adapter_ratings").select("adapter_id, user_id, rating").in_("adapter_id", ids)
                   .execute().data or []) if ids else []
        return [_public(r, ratings, caller) for r in rows]
    return {"enabled": True, "adapters": await asyncio.to_thread(read)}


@router.get("/mine")
async def my_adapters(user_id: str = Depends(current_user_id)):
    _require_enabled()
    sb = _supabase()
    rows = (sb.table("shared_adapters").select("id, title, description, community_tags, base_model, moderation_status, "
                                               "moderation_checks, created_at").eq("owner_id", user_id)
            .order("created_at", desc=True).limit(50).execute().data or [])
    return {"adapters": [{"id": r["id"], "title": r["title"], "description": r.get("description") or "",
                          "tags": r.get("community_tags") or [], "baseModel": r["base_model"],
                          "status": r["moderation_status"], "checks": r.get("moderation_checks") or {},
                          "createdAt": r.get("created_at")} for r in rows]}


# ---- Sharing ------------------------------------------------------------------------------------------------------

@router.post("/check")
async def check_adapter(body: AdapterIn, user_id: str = Depends(current_user_id)):
    _require_enabled()
    checks = await asyncio.to_thread(run_checks, _supabase(), user_id, body)
    return {"passed": passed(checks), "checks": checks}


@router.post("")
async def create_adapter(body: AdapterIn, user_id: str = Depends(current_user_id)):
    """A pending adapter (not public) and a link to upload each of its files to, once every check passes."""
    _require_enabled()
    sb = _supabase()
    checks = await asyncio.to_thread(run_checks, sb, user_id, body)
    if not passed(checks):
        raise HTTPException(status_code=422, detail={"message": "Not shared: a check didn't pass.", "checks": checks})
    unavailable = HTTPException(status_code=503, detail="Sharing isn't available yet. Please try again later.")
    try:
        existing = sb.table("shared_adapters").select("id").eq("owner_id", user_id).limit(MAX_PER_PERSON).execute().data or []
    except Exception as e:
        print(f"[adapters] not created: {type(e).__name__}")
        raise unavailable
    if len(existing) >= MAX_PER_PERSON:
        raise HTTPException(status_code=429, detail=f"You can share up to {MAX_PER_PERSON} models. Take one down first.")
    adapter_id = str(uuid.uuid4())
    try:
        sb.table("shared_adapters").insert({
            "id": adapter_id, "owner_id": user_id, "title": body.title.strip(), "description": body.description.strip(),
            "community_tags": body.tags, "base_model": body.baseModel, "file_path": adapter_id,
            "scrubber_version": checks["scrub_review"]["scrubberVersion"], "consent_id": body.consentId,
            "moderation_status": "pending", "moderation_checks": checks,
        }).execute()
        bucket = sb.storage.from_(BUCKET)
        uploads = []
        for name in (WEIGHTS, CONFIG):
            signed = bucket.create_signed_upload_url(f"{adapter_id}/{name}")
            uploads.append({"name": name, "path": signed["path"], "token": signed["token"]})
    except Exception as e:
        # Most likely STEP 96 (the table or the bucket) isn't applied yet.
        print(f"[adapters] not created: {type(e).__name__}")
        try:
            sb.table("shared_adapters").delete().eq("id", adapter_id).execute()
        except Exception:
            pass
        raise unavailable
    return {"id": adapter_id, "uploads": uploads, "checks": checks}


@router.post("/{adapter_id}/publish")
async def publish_adapter(adapter_id: str, user_id: str = Depends(current_user_id)):
    _require_enabled()
    sb = _supabase()
    row = _owned(sb, _uuid(adapter_id), user_id)
    if row["moderation_status"] != "pending":
        raise HTTPException(status_code=409, detail="That model has already been shared, or was taken down.")
    files = await asyncio.to_thread(files_check, sb, row["id"], row["base_model"])
    names = await asyncio.to_thread(known_names, sb, user_id)
    checks = {**(row.get("moderation_checks") or {}), "files": files,
              "metadata": metadata_check(row["title"], row.get("description") or "", row.get("community_tags") or [], None, names)}
    if not passed(checks):
        sb.table("shared_adapters").update({"moderation_checks": checks}).eq("id", row["id"]).execute()
        raise HTTPException(status_code=422, detail={"message": "Not shared: a check didn't pass.", "checks": checks})
    sb.table("shared_adapters").update({"moderation_status": "approved", "moderation_checks": checks}).eq("id", row["id"]).execute()
    return {"id": row["id"], "status": "approved", "checks": checks}


@router.patch("/{adapter_id}")
async def edit_adapter(adapter_id: str, body: AdapterEdit, user_id: str = Depends(current_user_id)):
    _require_enabled()
    sb = _supabase()
    row = _owned(sb, _uuid(adapter_id), user_id)
    meta = metadata_check(body.title, body.description, body.tags, None, await asyncio.to_thread(known_names, sb, user_id))
    if not meta["passed"]:
        raise HTTPException(status_code=422, detail={"message": meta["why"], "checks": {"metadata": meta}})
    checks = {**(row.get("moderation_checks") or {}), "metadata": meta}
    sb.table("shared_adapters").update({"title": body.title.strip(), "description": body.description.strip(),
                                        "community_tags": body.tags, "moderation_checks": checks}).eq("id", row["id"]).execute()
    return {"id": row["id"], "status": row["moderation_status"]}


@router.delete("/{adapter_id}")
async def delete_adapter(adapter_id: str, user_id: str = Depends(current_user_id)):
    _require_enabled()
    sb = _supabase()
    row = _owned(sb, _uuid(adapter_id), user_id)
    try:
        sb.storage.from_(BUCKET).remove([f"{row['id']}/{WEIGHTS}", f"{row['id']}/{CONFIG}"])
    except Exception as e:
        print(f"[adapters] files not removed: {type(e).__name__}")
    sb.table("shared_adapters").delete().eq("id", row["id"]).eq("owner_id", user_id).execute()
    return {"deleted": True}


# ---- Using one ----------------------------------------------------------------------------------------------------

def _slug(title: str) -> str:
    return (re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40] or "shared-model").strip("-")


@router.get("/{adapter_id}/download")
async def download_adapter(adapter_id: str, caller: Optional[str] = Depends(optional_user_id)):
    _require_enabled()
    sb = _supabase()
    adapter_id = _uuid(adapter_id)
    rows = sb.table("shared_adapters").select("*").eq("id", adapter_id).limit(1).execute().data or []
    row = rows[0] if rows else None
    if not row or not (row["moderation_status"] == "approved" or (caller and row["owner_id"] == caller)):
        raise HTTPException(status_code=404, detail="That model isn't shared any more.")
    bucket, slug = sb.storage.from_(BUCKET), _slug(row["title"])
    names = {WEIGHTS: f"{slug}.safetensors", CONFIG: f"{slug}.adapter_config.json"}
    links = [{"name": names[name], "url": bucket.create_signed_url(f"{row['id']}/{name}", 600, {"download": names[name]})["signedURL"]}
             for name in (WEIGHTS, CONFIG)]
    return {"files": links, "baseModel": row["base_model"], "ollamaBase": BASE_MODELS.get(row["base_model"]), "slug": slug}


@router.post("/{adapter_id}/rating")
async def rate_adapter(adapter_id: str, body: RatingIn, user_id: str = Depends(current_user_id)):
    _require_enabled()
    sb = _supabase()
    row = _approved(sb, _uuid(adapter_id))
    if row["owner_id"] == user_id:
        raise HTTPException(status_code=403, detail="You can't rate a model you shared.")
    sb.table("shared_adapter_ratings").upsert({"adapter_id": row["id"], "user_id": user_id, "rating": body.rating},
                                              on_conflict="adapter_id,user_id").execute()
    ratings = sb.table("shared_adapter_ratings").select("adapter_id, user_id, rating").eq("adapter_id", row["id"]).execute().data or []
    return {"saved": True, "rating": _public(row, ratings, user_id)["rating"], "myRating": body.rating}


@router.post("/{adapter_id}/report")
async def report_adapter(adapter_id: str, body: ReportIn, user_id: str = Depends(current_user_id)):
    """The same queue as ResourceHub's posts and answers (its /admin/community), where Remove takes it down."""
    _require_enabled()
    sb = _supabase()
    row = _approved(sb, _uuid(adapter_id))
    try:
        sb.table("community_reports").upsert({"reporter_id": user_id, "target_type": "adapter", "target_id": row["id"],
                                              "reason": body.reason.strip()},
                                             on_conflict="reporter_id,target_type,target_id").execute()
    except Exception as e:
        print(f"[adapters] report not saved: {type(e).__name__}")
        raise HTTPException(status_code=503, detail="Your report couldn't be sent just now. Please try again.")
    return {"reported": True}
