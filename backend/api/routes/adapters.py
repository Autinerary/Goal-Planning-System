"""Shared starter models (Settings, Models: "Share my model" and "Community models"; STEP 96).

  GET    /api/adapters/status            { enabled }: SHARED_ADAPTERS=on, and the lists the pages use
  GET    /api/adapters                   models shared with everyone, the best for you first (how much of each model's
                                         community you're part of, then ratings weighted towards people like you), and
                                         those shared with you by your people; never who shared one
  GET    /api/adapters/mine              yours, in any state, with what the checks found and who can see each
  GET    /api/adapters/people            your people (Hare World connections), to share with
  GET    /api/adapters/link/{key}        one shared by private link, for anyone who has the link
  POST   /api/adapters/check             the checks, sharing nothing (the page shows them before anything is uploaded)
  POST   /api/adapters                   the checks again; if they pass, a pending adapter and links to upload its files
  POST   /api/adapters/{id}/publish      its files are there and are what they should be: shared
  PATCH  /api/adapters/{id}              the owner changes the title, description, tags or who can see it (checked again)
  DELETE /api/adapters/{id}              the owner takes it down, files and all
  GET    /api/adapters/{id}/download     links to its two files for ten minutes (?key= for a private link)
  POST   /api/adapters/{id}/rating       1 to 5 stars, not for your own
  POST   /api/adapters/{id}/report       to ResourceHub's moderation queue (community_reports, target 'adapter')

Who can see one (visibility), the owner's choice, as with moments and Paths:
  everyone   listed in Community models, once every check passes
  people     only the people its owner picked from their connections, listed for them as shared with them
  link       anyone with its private link; never listed

Nothing is shared until every check passes:
  scrub_review   the owner approved a scrubbed training set (Build my training set, STEP 95), and this names it
  memorization   given the start of each training answer, the tuned model didn't go on to say the rest closely. It runs
                 on the owner's computer, where the model is (frontend lib/sharedModels.ts), so it is their report of
                 the result, recorded as self-reported
  metadata       the title and description name no one (the owner's own name from their profile included) and hold
                 no contact details, addresses, schools, employers, dates of birth, ID numbers or links; the tags and
                 base model are on the lists
  crowd          shared with everyone: at least 5 real people here share every one of its tags, so the tags together
                 can't point to the person who shared it (core/community_tags.py)
  audience       shared with people: each one is one of the owner's connections
  lineage        built on another model: that model is shared, and the owner could see it
  files          checked when it's published: an adapter (only LoRA weights, no hidden metadata) and a settings file
                 with only what the tools need, so no folder from the owner's computer goes out

Built on: a model tuned from a shared one names it (the training scripts copy the shared model's id into the new
adapter's settings), so Community models shows which models came from which: a graph of models, never of people.
Nobody's id is in a file's path (the folder is the adapter's id) or in anything public.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import secrets
import struct
import uuid
from collections import Counter
from typing import Any, Callable, Dict, Iterable, List, Literal, Optional, Set

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from api.auth_guard import current_user_id, optional_user_id
from api.routes.training import known_names
from core import community_tags as tags
from core import scrubber
from database.supabase_client import get_supabase

router = APIRouter()

BUCKET = "shared-adapters"
WEIGHTS, CONFIG = "adapters.safetensors", "adapter_config.json"
MAX_WEIGHTS_BYTES = 100 * 1024 * 1024
MAX_CONFIG_BYTES = 16 * 1024
# The models the training scripts tune, each with the Ollama model that has its chat format, and its family (for the
# memory check's prompt). Qwen3 4B, which thinks first, isn't one yet: tuned, it doesn't keep its thinking, and Ollama
# can't switch a tuned one's thinking off (1 November 2026). Coming soon.
BASE_MODELS = {
    "mlx-community/Llama-3.2-1B-Instruct-bf16": "llama3.2:1b",
    "mlx-community/Llama-3.2-3B-Instruct-bf16": "llama3.2:3b",
}
BASE_FAMILIES = {
    "mlx-community/Llama-3.2-1B-Instruct-bf16": "llama3",
    "mlx-community/Llama-3.2-3B-Instruct-bf16": "llama3",
}
VISIBILITIES = ("everyone", "people", "link")
# On 24 training answers, the untuned Llama 3.2 1B's closest continuation was 0.40; the same model tuned for 10 steps
# said 13 of them back at 0.5 or more (31 October 2026). A failure only means training again with less repetition.
MEMORY_THRESHOLD = 0.5
MIN_PROBES = 3
MAX_PER_PERSON = 20
MAX_PEOPLE = 50
# What may be in a title or description. Diagnoses and medicines may: a starter model is for a community, and saying
# which one names no one.
METADATA_BLOCKS = {"name", "email", "link", "phone", "id_number", "address", "date_of_birth", "school", "employer"}
# The settings file: what mlx-lm needs, the model's own id, and the one it was built on.
CONFIG_KEYS = {"fine_tune_type", "num_layers", "lora_parameters", "model", "shared_id", "built_on"}
_TENSOR = re.compile(r"^(?:[a-z_]+\.)*layers\.\d{1,3}\.[a-z_.]+\.lora_[ab]$")
_KEY = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
PAGE = 1000


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


def _uuid(value: Optional[str]) -> Optional[str]:
    try:
        return str(uuid.UUID(str(value)))
    except (TypeError, ValueError):
        return None


class MemoryCheck(BaseModel):
    model: str = Field(..., min_length=1, max_length=100)
    probes: int = Field(..., ge=0, le=1000)
    skipped: int = Field(0, ge=0, le=1000)
    failed: int = Field(..., ge=0, le=1000)
    maxCloseness: float = Field(..., ge=0, le=1)


class AdapterIn(BaseModel):
    title: str = Field(..., min_length=3, max_length=80)
    description: str = Field("", max_length=1000)
    tags: List[str] = Field(default_factory=list, max_length=tags.MAX_TAGS)
    baseModel: str = Field(..., max_length=120)
    consentId: str = Field(..., min_length=36, max_length=36)
    memoryCheck: MemoryCheck
    visibility: Literal["everyone", "people", "link"] = "everyone"
    people: List[str] = Field(default_factory=list, max_length=MAX_PEOPLE)
    builtOn: Optional[str] = Field(None, max_length=36)


class AdapterEdit(BaseModel):
    title: str = Field(..., min_length=3, max_length=80)
    description: str = Field("", max_length=1000)
    tags: List[str] = Field(default_factory=list, max_length=tags.MAX_TAGS)
    visibility: Optional[Literal["everyone", "people", "link"]] = None
    people: Optional[List[str]] = Field(None, max_length=MAX_PEOPLE)


class RatingIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)


class ReportIn(BaseModel):
    reason: str = Field(..., min_length=5, max_length=1000)


# ---- People's tags, from their onboarding answers ------------------------------------------------------------------

def _rows(sb, table: str, columns: str, key: Optional[str] = None, values: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Every row, a page at a time (the API returns at most 1,000 at once)."""
    out: List[Dict[str, Any]] = []
    for start in range(0, 100 * PAGE, PAGE):
        query = sb.table(table).select(columns)
        if key and values is not None:
            query = query.in_(key, values)
        page = query.range(start, start + PAGE - 1).execute().data or []
        out.extend(page)
        if len(page) < PAGE:
            break
    return out


def people_tags(sb, user_ids: Optional[Iterable[str]] = None, real_only: bool = False) -> Dict[str, Set[str]]:
    """Each person's tags (core/community_tags.py): their norms, who they're here for, and their goals' life areas.
    Everyone's when user_ids is None; real_only leaves out test, QA and seed accounts (profiles.internal_account)."""
    ids = None if user_ids is None else sorted({str(u) for u in user_ids if u})
    if ids == []:
        return {}
    barriers = _rows(sb, "user_barriers", "user_id, barrier_type", "user_id", ids)
    try:
        profiles = _rows(sb, "profiles", "id, internal_account, audience:preferences->>audience", "id", ids)
    except Exception:
        # Before STEP 93 there's no internal_account: everyone counts as real.
        profiles = _rows(sb, "profiles", "id, audience:preferences->>audience", "id", ids)
    plans = _rows(sb, "user_paths", "user_id, is_active, goals:payload->userProfile->goals, "
                                    "chosen:payload->userProfile->goalCategories", "user_id", ids)
    people: Dict[str, Dict[str, Any]] = {}
    for row in barriers:
        people.setdefault(row["user_id"], {}).setdefault("barriers", []).append(row.get("barrier_type"))
    internal = set()
    for row in profiles:
        people.setdefault(row["id"], {})["audience"] = row.get("audience")
        if row.get("internal_account"):
            internal.add(row["id"])
    # The active plan's goals last, so they win.
    for row in sorted(plans, key=lambda r: bool(r.get("is_active"))):
        person = people.setdefault(row["user_id"], {})
        person["goals"] = row.get("goals") if isinstance(row.get("goals"), list) else []
        person["chosen"] = row.get("chosen") if isinstance(row.get("chosen"), dict) else {}
    return {
        uid: tags.person_tags(p.get("barriers") or [], p.get("audience"), tags.goal_areas(p.get("goals") or [], p.get("chosen")))
        for uid, p in people.items()
        if not (real_only and uid in internal)
    }


def my_people(sb, user_id: str) -> Dict[str, str]:
    """The owner's connections (Hare World): both directions, connected, real accounts. Id to the name they show."""
    own = (sb.table("social_connections").select("target_user_id").eq("owner_id", user_id).eq("status", "connected")
           .execute().data or [])
    inbound = (sb.table("social_connections").select("owner_id").eq("target_user_id", user_id).eq("status", "connected")
               .execute().data or [])
    ids = sorted(({r.get("target_user_id") for r in own} | {r.get("owner_id") for r in inbound}) - {None, user_id})
    if not ids:
        return {}
    names = {r["id"]: (r.get("display_name") or r.get("username") or "Someone you know")
             for r in sb.table("profiles").select("id, display_name, username").in_("id", ids).execute().data or []}
    return {i: names.get(i, "Someone you know") for i in ids}


# ---- The checks ---------------------------------------------------------------------------------------------------

def metadata_check(title: str, description: str, chosen_tags: List[str], base_model: Optional[str] = None,
                   names: Iterable[str] = ()) -> Dict[str, Any]:
    """`names`: the owner's own name and username, the likeliest name to end up in a title ("Priya's planner")."""
    found: Dict[str, int] = {}
    for text in (title, description):
        for kind, count in scrubber.scrub(text, list(names)).found.items():
            if kind in METADATA_BLOCKS:
                found[kind] = found.get(kind, 0) + count
    why = []
    if found:
        kinds = ", ".join(k.replace("_", " ") for k in sorted(found))
        why.append(f"The title or description has personal information in it ({kinds}). Take it out and check again.")
    if [t for t in chosen_tags if t not in tags.TAG_IDS]:
        why.append("Pick the community tags from the list.")
    if base_model is not None and base_model not in BASE_MODELS:
        why.append("Only adapters for the models the training scripts use (Llama 3.2 1B or 3B) can be shared.")
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


def crowd_check(sb, chosen_tags: List[str], visibility: str) -> Dict[str, Any]:
    """Shared with everyone, a model's tags together mustn't narrow its owner down to a handful of people. Only whether
    enough people share them is said, never how many."""
    clean = tags.clean_tags(chosen_tags)
    if visibility != "everyone" or not clean:
        return {"passed": True, "applies": False, "why": ""}
    enough = tags.crowd(clean, people_tags(sb, None, real_only=True).values()) >= tags.MIN_CROWD
    return {"passed": enough, "why": "" if enough else (
        f"Fewer than {tags.MIN_CROWD} people here share all of these tags, so together they could point to you. "
        "Choose fewer tags, or share it only with people you pick.")}


def audience_check(sb, user_id: str, visibility: str, picked: List[str]) -> Dict[str, Any]:
    if visibility != "people":
        return {"passed": True, "applies": False, "why": ""}
    if not picked:
        return {"passed": False, "why": "Pick at least one person to share it with."}
    mine = my_people(sb, user_id)
    if any(p not in mine for p in picked):
        return {"passed": False, "why": "You can share it only with your people (your connections in Hare World)."}
    return {"passed": True, "why": "", "count": len(set(picked))}


def can_see(sb, row: Dict[str, Any], caller: Optional[str], key: Optional[str] = None) -> bool:
    """Its owner always; anyone else only once it's shared, and then as its owner chose."""
    if caller and row.get("owner_id") == caller:
        return True
    if row.get("moderation_status") != "approved":
        return False
    visibility = row.get("visibility") or "everyone"
    if visibility == "everyone":
        return True
    if visibility == "link":
        return bool(key) and secrets.compare_digest(str(key), str(row.get("link_token") or ""))
    if visibility == "people" and caller:
        return bool(sb.table("shared_adapter_access").select("user_id").eq("adapter_id", row["id"])
                    .eq("user_id", caller).limit(1).execute().data)
    return False


def lineage_check(sb, user_id: str, built_on: Optional[str]) -> Dict[str, Any]:
    if not built_on:
        return {"passed": True, "applies": False, "why": ""}
    parent_id = _uuid(built_on)
    rows = (sb.table("shared_adapters").select("*").eq("id", parent_id).limit(1).execute().data or []) if parent_id else []
    # A private link isn't kept with the person who used it, so a model shared by link counts as one they could see.
    if rows and (can_see(sb, rows[0], user_id) or (rows[0].get("moderation_status") == "approved" and rows[0].get("visibility") == "link")):
        return {"passed": True, "why": "", "builtOn": parent_id}
    return {"passed": False, "why": "The model this was built on isn't shared any more, so it can't be named."}


def run_checks(sb, user_id: str, body: AdapterIn) -> Dict[str, Any]:
    """Every check, each passed or not and why. A check that doesn't apply to this share (the crowd, unless it's shared
    with everyone; the people, unless it's shared with people picked; what it was built on, unless it was) says
    "applies": False, so it isn't shown as something that was checked."""
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
        "crowd": crowd_check(sb, body.tags, body.visibility),
        "audience": audience_check(sb, user_id, body.visibility, body.people),
        "lineage": lineage_check(sb, user_id, body.builtOn),
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


def config_problem(config: Any, base_model: str, adapter_id: Optional[str] = None, built_on: Optional[str] = None) -> Optional[str]:
    if not isinstance(config, dict) or set(config) - CONFIG_KEYS:
        return ("The adapter's settings file may only have fine_tune_type, num_layers, lora_parameters and model "
                "(and the ids the page adds).")
    params = config.get("lora_parameters")
    if (config.get("fine_tune_type") != "lora" or not isinstance(config.get("num_layers"), int)
            or not isinstance(params, dict) or not isinstance(params.get("rank"), int)
            or not 1 <= params["rank"] <= 64 or not isinstance(params.get("scale"), (int, float))):
        return "The adapter's settings file isn't a LoRA adapter's."
    if config.get("model") != base_model:
        return "The adapter's settings name a different base model."
    if adapter_id is not None and config.get("shared_id") != adapter_id:
        return "The adapter's settings file isn't the one this page made for it. Share it again."
    if adapter_id is not None and (config.get("built_on") or None) != (built_on or None):
        return "The adapter's settings name a different model it was built on."
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


def files_check(sb, row: Dict[str, Any], fetch: Optional[Callable[[str], bytes]] = None) -> Dict[str, Any]:
    fetch = fetch or _first_bytes
    adapter_id = row["id"]
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
            problem = config_problem(json.loads(fetch(signed(CONFIG)).decode("utf-8")), row["base_model"], adapter_id,
                                     row.get("built_on"))
        except (ValueError, UnicodeDecodeError):
            problem = "The adapter's settings file isn't JSON."
    return {"passed": not problem, "why": problem or "", "weightsBytes": int(listed[WEIGHTS]["metadata"]["size"])}


# ---- Reading ------------------------------------------------------------------------------------------------------

def _public(row: Dict[str, Any], ratings: List[Dict[str, Any]], caller: Optional[str], me: Set[str],
            raters: Dict[str, Set[str]], titles: Dict[str, str], children: Counter) -> Dict[str, Any]:
    own = [r for r in ratings if r.get("adapter_id") == row["id"]]
    stars = [int(r["rating"]) for r in own]
    mine = [int(r["rating"]) for r in own if caller and r.get("user_id") == caller]
    score, shared = tags.match(me, row.get("community_tags") or [])
    checks = row.get("moderation_checks") or {}
    parent = row.get("built_on")
    return {
        "id": row["id"], "title": row["title"], "description": row.get("description") or "",
        "tags": tags.clean_tags(row.get("community_tags") or []), "baseModel": row["base_model"],
        "ollamaBase": BASE_MODELS.get(row["base_model"]), "family": BASE_FAMILIES.get(row["base_model"]),
        "createdAt": row.get("created_at"), "visibility": row.get("visibility") or "everyone",
        "rating": {"average": round(sum(stars) / len(stars), 1) if stars else None, "count": len(stars)},
        "ratingForYou": tags.rating_for(me, [(raters.get(r.get("user_id"), set()), int(r["rating"])) for r in own]) if me and own else None,
        "match": {"score": round(score, 2), "shared": shared},
        "myRating": mine[0] if mine else None,
        "mine": bool(caller and row.get("owner_id") == caller),
        "builtOn": {"id": parent, "title": titles.get(parent)} if parent else None,
        "builtOnCount": children.get(row["id"], 0),
        "checks": {"memoryCheck": (checks.get("memorization") or {}).get("maxCloseness"),
                   "trainedOn": (checks.get("scrub_review") or {}).get("itemCount")},
    }


def _ranked(sb, rows: List[Dict[str, Any]], caller: Optional[str], titles: Optional[Dict[str, str]] = None,
            children: Optional[Counter] = None) -> List[Dict[str, Any]]:
    """Public views of the rows, best for the caller first: how much of each model's community they're part of, then
    the rating weighted towards people like them, then how many ratings, then the newest."""
    ids = [r["id"] for r in rows]
    ratings = (sb.table("shared_adapter_ratings").select("adapter_id, user_id, rating").in_("adapter_id", ids)
               .execute().data or []) if ids else []
    wanted = {r["user_id"] for r in ratings} | ({caller} if caller else set())
    known = people_tags(sb, wanted) if wanted else {}
    me = known.get(caller, set()) if caller else set()
    titles = {**(titles or {}), **{r["id"]: r["title"] for r in rows}}
    children = children if children is not None else Counter(r.get("built_on") for r in rows if r.get("built_on"))
    out = [_public(r, ratings, caller, me, known, titles, children) for r in rows]
    out.sort(key=lambda a: a["createdAt"] or "", reverse=True)
    out.sort(key=lambda a: (-a["match"]["score"], -(a["ratingForYou"] or a["rating"]["average"] or 0), -a["rating"]["count"]))
    return out


def _approved(sb, visibility: str) -> List[Dict[str, Any]]:
    return (sb.table("shared_adapters").select("*").eq("moderation_status", "approved").eq("visibility", visibility)
            .order("created_at", desc=True).limit(200).execute().data or [])


def _owned(sb, adapter_id: Optional[str], user_id: str) -> Dict[str, Any]:
    rows = (sb.table("shared_adapters").select("*").eq("id", adapter_id).eq("owner_id", user_id)
            .limit(1).execute().data or []) if adapter_id else []
    if not rows:
        raise HTTPException(status_code=404, detail="That isn't one of your shared models.")
    return rows[0]


def _visible(sb, adapter_id: Optional[str], caller: Optional[str], key: Optional[str] = None) -> Dict[str, Any]:
    rows = (sb.table("shared_adapters").select("*").eq("id", adapter_id).limit(1).execute().data or []) if adapter_id else []
    if not rows or not can_see(sb, rows[0], caller, key):
        raise HTTPException(status_code=404, detail="That model isn't shared with you, or isn't shared any more.")
    return rows[0]


@router.get("/status")
async def status():
    return {"enabled": enabled(), "baseModels": BASE_MODELS, "families": BASE_FAMILIES,
            "tags": [{"id": t, "label": label} for t, label in tags.COMMUNITY_TAGS], "maxTags": tags.MAX_TAGS,
            "minCrowd": tags.MIN_CROWD, "memoryThreshold": MEMORY_THRESHOLD}


@router.get("")
async def list_adapters(caller: Optional[str] = Depends(optional_user_id)):
    if not enabled():
        return {"enabled": False, "adapters": [], "sharedWithMe": [], "forYou": False}
    sb = _supabase()

    def read():
        public = _approved(sb, "everyone")
        shared: List[Dict[str, Any]] = []
        if caller:
            access = sb.table("shared_adapter_access").select("adapter_id").eq("user_id", caller).execute().data or []
            ids = [a["adapter_id"] for a in access]
            if ids:
                shared = (sb.table("shared_adapters").select("*").in_("id", ids).eq("moderation_status", "approved")
                          .eq("visibility", "people").execute().data or [])
        everything = public + shared
        titles = {r["id"]: r["title"] for r in everything}
        children = Counter(r.get("built_on") for r in everything if r.get("built_on"))
        ranked = _ranked(sb, public, caller, titles, children)
        return ranked, _ranked(sb, shared, caller, titles, children), bool(caller and any(a["match"]["score"] for a in ranked))
    adapters, shared, for_you = await asyncio.to_thread(read)
    return {"enabled": True, "adapters": adapters, "sharedWithMe": shared, "forYou": for_you}


@router.get("/link/{key}")
async def by_link(key: str, caller: Optional[str] = Depends(optional_user_id)):
    _require_enabled()
    if not _KEY.match(key or ""):
        raise HTTPException(status_code=404, detail="That link doesn't work any more.")
    sb = _supabase()
    rows = (sb.table("shared_adapters").select("*").eq("link_token", key).eq("visibility", "link")
            .eq("moderation_status", "approved").limit(1).execute().data or [])
    if not rows:
        raise HTTPException(status_code=404, detail="That link doesn't work any more.")
    return {"adapter": (await asyncio.to_thread(_ranked, sb, rows, caller))[0]}


@router.get("/people")
async def people(user_id: str = Depends(current_user_id)):
    _require_enabled()
    found = await asyncio.to_thread(my_people, _supabase(), user_id)
    return {"people": [{"id": i, "name": n} for i, n in sorted(found.items(), key=lambda kv: kv[1].lower())]}


@router.get("/mine")
async def my_adapters(user_id: str = Depends(current_user_id)):
    _require_enabled()
    sb = _supabase()
    rows = (sb.table("shared_adapters").select("*").eq("owner_id", user_id).order("created_at", desc=True)
            .limit(50).execute().data or [])
    ids = [r["id"] for r in rows]
    access = (sb.table("shared_adapter_access").select("adapter_id, user_id").in_("adapter_id", ids).execute().data or []) if ids else []
    names = my_people(sb, user_id) if access else {}
    return {"adapters": [{
        "id": r["id"], "title": r["title"], "description": r.get("description") or "",
        "tags": r.get("community_tags") or [], "baseModel": r["base_model"], "status": r["moderation_status"],
        "visibility": r.get("visibility") or "everyone", "linkKey": r.get("link_token"),
        "people": [{"id": a["user_id"], "name": names.get(a["user_id"], "Someone you know")} for a in access if a["adapter_id"] == r["id"]],
        "builtOn": r.get("built_on"), "checks": r.get("moderation_checks") or {}, "createdAt": r.get("created_at"),
    } for r in rows]}


# ---- Sharing ------------------------------------------------------------------------------------------------------

@router.post("/check")
async def check_adapter(body: AdapterIn, user_id: str = Depends(current_user_id)):
    _require_enabled()
    checks = await asyncio.to_thread(run_checks, _supabase(), user_id, body)
    return {"passed": passed(checks), "checks": checks}


@router.post("")
async def create_adapter(body: AdapterIn, user_id: str = Depends(current_user_id)):
    """A pending adapter (seen by nobody but its owner) and a link to upload each of its files to, once every check
    passes."""
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
    key = secrets.token_urlsafe(24) if body.visibility == "link" else None
    try:
        sb.table("shared_adapters").insert({
            "id": adapter_id, "owner_id": user_id, "title": body.title.strip(), "description": body.description.strip(),
            "community_tags": tags.clean_tags(body.tags), "base_model": body.baseModel, "file_path": adapter_id,
            "scrubber_version": checks["scrub_review"]["scrubberVersion"], "consent_id": body.consentId,
            "visibility": body.visibility, "link_token": key, "built_on": checks["lineage"].get("builtOn"),
            "moderation_status": "pending", "moderation_checks": checks,
        }).execute()
        if body.visibility == "people":
            sb.table("shared_adapter_access").insert([{"adapter_id": adapter_id, "user_id": p} for p in sorted(set(body.people))]).execute()
        bucket = sb.storage.from_(BUCKET)
        uploads = []
        for name in (WEIGHTS, CONFIG):
            signed = bucket.create_signed_upload_url(f"{adapter_id}/{name}")
            uploads.append({"name": name, "path": signed["path"], "token": signed["token"]})
    except Exception as e:
        # Most likely STEP 96 (the tables or the bucket) isn't applied yet.
        print(f"[adapters] not created: {type(e).__name__}")
        try:
            sb.table("shared_adapters").delete().eq("id", adapter_id).execute()
        except Exception:
            pass
        raise unavailable
    return {"id": adapter_id, "uploads": uploads, "checks": checks, "builtOn": checks["lineage"].get("builtOn")}


@router.post("/{adapter_id}/publish")
async def publish_adapter(adapter_id: str, user_id: str = Depends(current_user_id)):
    _require_enabled()
    sb = _supabase()
    row = _owned(sb, _uuid(adapter_id), user_id)
    if row["moderation_status"] != "pending":
        raise HTTPException(status_code=409, detail="That model has already been shared, or was taken down.")
    files = await asyncio.to_thread(files_check, sb, row)
    names = await asyncio.to_thread(known_names, sb, user_id)
    checks = {**(row.get("moderation_checks") or {}), "files": files,
              "metadata": metadata_check(row["title"], row.get("description") or "", row.get("community_tags") or [], None, names)}
    if not passed(checks):
        sb.table("shared_adapters").update({"moderation_checks": checks}).eq("id", row["id"]).execute()
        raise HTTPException(status_code=422, detail={"message": "Not shared: a check didn't pass.", "checks": checks})
    sb.table("shared_adapters").update({"moderation_status": "approved", "moderation_checks": checks}).eq("id", row["id"]).execute()
    return {"id": row["id"], "status": "approved", "checks": checks, "visibility": row.get("visibility") or "everyone",
            "linkKey": row.get("link_token")}


@router.patch("/{adapter_id}")
async def edit_adapter(adapter_id: str, body: AdapterEdit, user_id: str = Depends(current_user_id)):
    _require_enabled()
    sb = _supabase()
    row = _owned(sb, _uuid(adapter_id), user_id)
    visibility = body.visibility or row.get("visibility") or "everyone"
    picked = body.people if body.people is not None else [
        a["user_id"] for a in sb.table("shared_adapter_access").select("user_id").eq("adapter_id", row["id"]).execute().data or []]
    checks = {
        "metadata": metadata_check(body.title, body.description, body.tags, None, await asyncio.to_thread(known_names, sb, user_id)),
        "crowd": await asyncio.to_thread(crowd_check, sb, body.tags, visibility),
        "audience": await asyncio.to_thread(audience_check, sb, user_id, visibility, picked),
    }
    if not passed(checks):
        raise HTTPException(status_code=422, detail={"message": " ".join(c["why"] for c in checks.values() if c["why"]), "checks": checks})
    key = (row.get("link_token") or secrets.token_urlsafe(24)) if visibility == "link" else None
    sb.table("shared_adapters").update({
        "title": body.title.strip(), "description": body.description.strip(), "community_tags": tags.clean_tags(body.tags),
        "visibility": visibility, "link_token": key, "moderation_checks": {**(row.get("moderation_checks") or {}), **checks},
    }).eq("id", row["id"]).execute()
    sb.table("shared_adapter_access").delete().eq("adapter_id", row["id"]).execute()
    if visibility == "people":
        sb.table("shared_adapter_access").insert([{"adapter_id": row["id"], "user_id": p} for p in sorted(set(picked))]).execute()
    return {"id": row["id"], "status": row["moderation_status"], "visibility": visibility, "linkKey": key}


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
async def download_adapter(adapter_id: str, key: Optional[str] = Query(None, max_length=64),
                           caller: Optional[str] = Depends(optional_user_id)):
    _require_enabled()
    sb = _supabase()
    row = await asyncio.to_thread(_visible, sb, _uuid(adapter_id), caller, key)
    bucket, slug = sb.storage.from_(BUCKET), _slug(row["title"])
    names = {WEIGHTS: f"{slug}.safetensors", CONFIG: f"{slug}.adapter_config.json"}
    links = [{"name": names[name], "url": bucket.create_signed_url(f"{row['id']}/{name}", 600, {"download": names[name]})["signedURL"]}
             for name in (WEIGHTS, CONFIG)]
    return {"files": links, "baseModel": row["base_model"], "ollamaBase": BASE_MODELS.get(row["base_model"]), "slug": slug}


@router.post("/{adapter_id}/rating")
async def rate_adapter(adapter_id: str, body: RatingIn, key: Optional[str] = Query(None, max_length=64),
                       user_id: str = Depends(current_user_id)):
    _require_enabled()
    sb = _supabase()
    row = await asyncio.to_thread(_visible, sb, _uuid(adapter_id), user_id, key)
    if row["owner_id"] == user_id:
        raise HTTPException(status_code=403, detail="You can't rate a model you shared.")
    sb.table("shared_adapter_ratings").upsert({"adapter_id": row["id"], "user_id": user_id, "rating": body.rating},
                                              on_conflict="adapter_id,user_id").execute()
    view = (await asyncio.to_thread(_ranked, sb, [row], user_id))[0]
    return {"saved": True, "rating": view["rating"], "ratingForYou": view["ratingForYou"], "myRating": body.rating}


@router.post("/{adapter_id}/report")
async def report_adapter(adapter_id: str, body: ReportIn, key: Optional[str] = Query(None, max_length=64),
                         user_id: str = Depends(current_user_id)):
    """The same queue as ResourceHub's posts and answers (its /admin/community), where Remove takes it down."""
    _require_enabled()
    sb = _supabase()
    row = await asyncio.to_thread(_visible, sb, _uuid(adapter_id), user_id, key)
    try:
        sb.table("community_reports").upsert({"reporter_id": user_id, "target_type": "adapter", "target_id": row["id"],
                                              "reason": body.reason.strip()},
                                             on_conflict="reporter_id,target_type,target_id").execute()
    except Exception as e:
        print(f"[adapters] report not saved: {type(e).__name__}")
        raise HTTPException(status_code=503, detail="Your report couldn't be sent just now. Please try again.")
    return {"reported": True}
