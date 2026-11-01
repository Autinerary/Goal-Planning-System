"""Building a training set from your own writing (Settings, Models, "Build my training set").

  GET  /api/training/items     your journal entries, reflections and plan notes, as the pieces a training example is
                               made of: a question and your answer; and the steps of your plan you put in your own
                               words, rated useful, loved or finished, each with your goal as the question
  POST /api/training/scrub     { items: [{kind, id}] }: each one before and after scrubbing (core/scrubber.py), or
                               { texts: [...] }: text you edited, scrubbed again so a name you typed back in is caught
  POST /api/training/consent   { items: [{kind, id}], scrubberVersion }: records which items you approved, when, and
                               with which scrubber (STEP 95), never their text
  GET  /api/training/consent   your records

Everything is read for the signed-in person only, scrubbed in memory and sent back. Nothing here stores, logs or
forwards the text: the training set is made in the person's browser and trained on their own laptop.
"""
from __future__ import annotations

import asyncio
import re
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth_guard import current_user_id
from core import scrubber
from database.supabase_client import get_supabase

router = APIRouter()

MAX_REFLECTIONS = 500
MAX_NOTES = 1000
MAX_TEXTS = 50

# The question each kind of plan note answers (future_notes.kind); the note is the answer.
NOTE_PROMPTS = {
    "note": ("Note to yourself", "Write a short note to your future self about your plan."),
    "do_better": ("Next time", "What would you do differently next time you work on a step like this?"),
    "keep_going": ("Keep doing", "What went well that's worth doing again?"),
    "remember_today": ("Remember today", "What do you want to remember about today?"),
}
FREE_TEXT_PROMPT = "Write about how things are going, in your own words."
REFLECTION_LABELS = {
    "task": "Reflection on a step",
    "milestone": "Reflection on a milestone",
    "race": "Reflection on a goal",
    "calendar": "Reflection on your week",
}
_UUID = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
ITEM_ID = {
    # One reflection gives one item per answered question ("<id>:0"), or its free text ("<id>:free").
    "reflection": re.compile(rf"^{_UUID}:(?:\d{{1,2}}|free)$"),
    "note": re.compile(rf"^{_UUID}$"),
    # A step of the plan: "<path id>:<milestone id>".
    "step": re.compile(r"^path_[A-Za-z0-9_-]{1,64}:[A-Za-z0-9_.-]{1,120}$"),
}
# Why a step is offered, strongest first: the person's own words beat a step they only finished.
STEP_LABELS = {
    "edited": "Step you put in your own words",
    "rated": "Step you rated useful",
    "loved": "Step you loved",
    "finished": "Step you finished",
}
STEP_PROMPT = "My goal: {goal}. What's one small, clear step toward it?"


class ItemRef(BaseModel):
    kind: Literal["reflection", "note", "step"]
    # Its shape is checked per kind (ITEM_ID).
    id: str = Field(..., min_length=3, max_length=200)


class ScrubIn(BaseModel):
    items: Optional[List[ItemRef]] = Field(None, max_length=MAX_REFLECTIONS * 3 + MAX_NOTES)
    texts: Optional[List[str]] = Field(None, max_length=MAX_TEXTS)


class ConsentIn(BaseModel):
    items: List[ItemRef] = Field(..., min_length=1, max_length=MAX_REFLECTIONS * 3 + MAX_NOTES)
    scrubberVersion: str = Field(..., min_length=1, max_length=120)


def reflection_items(row: Dict[str, Any]) -> List[Dict[str, Any]]:
    """A reflection's answered questions, each its own item. The Journal also saves the answers joined as its free
    text, so the free text is an item only when no question was answered."""
    rid = str(row.get("id") or "")
    context = str(row.get("context_type") or "path")
    label = REFLECTION_LABELS.get(context, "Journal")
    date = str(row.get("created_at") or "")[:10]
    items: List[Dict[str, Any]] = []
    questions = row.get("questions") if isinstance(row.get("questions"), list) else []
    for i, q in enumerate(questions[:20]):
        if not isinstance(q, dict):
            continue
        answer = str(q.get("answer") or "").strip()
        question = str(q.get("question") or "").strip()[:300]
        if answer and question:
            items.append({"kind": "reflection", "id": f"{rid}:{i}", "label": label, "date": date,
                          "prompt": question, "text": answer})
    free = str(row.get("free_form_text") or "").strip()
    if not items and free:
        items.append({"kind": "reflection", "id": f"{rid}:free", "label": label, "date": date,
                      "prompt": FREE_TEXT_PROMPT, "text": free})
    return items


def note_item(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    body = str(row.get("body") or "").strip()
    if not body:
        return None
    label, prompt = NOTE_PROMPTS.get(str(row.get("kind") or "note"), NOTE_PROMPTS["note"])
    return {"kind": "note", "id": str(row.get("id") or ""), "label": label,
            "date": str(row.get("created_at") or "")[:10], "prompt": prompt, "text": body}


def plan_milestones(payload: Any) -> List[Dict[str, Any]]:
    """Every step of a stored plan, once each (the path's list, then any only in the Race view's)."""
    payload = payload if isinstance(payload, dict) else {}
    seen: Dict[str, Dict[str, Any]] = {}
    lists = [(payload.get("path") or {}).get("milestones")] + [r.get("milestones") for r in payload.get("races") or [] if isinstance(r, dict)]
    for milestones in lists:
        for m in milestones if isinstance(milestones, list) else []:
            if isinstance(m, dict) and isinstance(m.get("id"), str) and m["id"] not in seen:
                seen[m["id"]] = m
    return list(seen.values())


def step_items(path_id: str, payload: Any, ratings: List[Dict[str, Any]], progress: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """The steps of the active plan the person made their own: put in their own words (payload.stepEdits, frontend
    app/api/me/path/step), rated 4 or 5 (milestone_ratings, the latest per step), loved or finished (race_progress).
    Each is one item: their goal as the question, the step (in their words where they wrote it) as the answer."""
    payload = payload if isinstance(payload, dict) else {}
    edits = payload.get("stepEdits") if isinstance(payload.get("stepEdits"), dict) else {}
    latest: Dict[str, Dict[str, Any]] = {}
    for r in ratings:
        mid = r.get("milestone_id")
        if mid and (mid not in latest or str(r.get("created_at") or "") >= str(latest[mid].get("created_at") or "")):
            latest[mid] = r
    loved = {r.get("milestone_id"): r for r in progress if r.get("kind") == "hearted"}
    finished = {r.get("milestone_id"): r for r in progress if r.get("kind") == "completed"}
    items = []
    for m in plan_milestones(payload):
        mid = m["id"]
        edit = edits.get(mid) if isinstance(edits.get(mid), dict) else None
        rated = latest.get(mid) if int((latest.get(mid) or {}).get("rating") or 0) >= 4 else None
        why = ("edited" if edit else "rated" if rated else "loved" if mid in loved else "finished" if mid in finished else None)
        if not why:
            continue
        name = str((edit or {}).get("name") or m.get("name") or "").strip()
        description = str(((edit or {}).get("description") if edit else m.get("description")) or "").strip()
        goal = str(m.get("goal") or (edit or {}).get("goal") or "").strip()[:300]
        text = f"{name}. {description}" if description and not name.endswith((".", "!", "?")) else f"{name} {description}".strip()
        if not name or not goal:
            continue
        when = ((edit or {}).get("editedAt") or (rated or {}).get("created_at") or (loved.get(mid) or {}).get("completed_at")
                or (finished.get(mid) or {}).get("completed_at") or "")
        items.append({"kind": "step", "id": f"{path_id}:{mid}", "label": STEP_LABELS[why], "date": str(when)[:10],
                      "prompt": STEP_PROMPT.format(goal=goal), "text": text})
    return items


def load_items(sb, user_id: str) -> List[Dict[str, Any]]:
    """Everything this person wrote, or made their own in their plan, that can go into a training set, newest first."""
    reflections = (sb.table("reflections").select("id, created_at, context_type, questions, free_form_text")
                   .eq("user_id", user_id).order("created_at", desc=True).limit(MAX_REFLECTIONS).execute().data or [])
    notes = (sb.table("future_notes").select("id, created_at, kind, body")
             .eq("user_id", user_id).order("created_at", desc=True).limit(MAX_NOTES).execute().data or [])
    items = [item for row in reflections for item in reflection_items(row)]
    items += [item for item in (note_item(row) for row in notes) if item]
    plans = (sb.table("user_paths").select("path_id, payload").eq("user_id", user_id)
             .order("is_active", desc=True).order("updated_at", desc=True).limit(1).execute().data or [])
    if plans:
        try:
            ratings = (sb.table("milestone_ratings").select("milestone_id, rating, created_at")
                       .eq("user_id", user_id).eq("path_id", plans[0]["path_id"]).execute().data or [])
        except Exception:
            ratings = []          # STEP 54 not applied: no ratings
        progress = (sb.table("race_progress").select("milestone_id, kind, completed_at")
                    .eq("user_id", user_id).execute().data or [])
        items += step_items(plans[0]["path_id"], plans[0].get("payload"), ratings, progress)
    return sorted(items, key=lambda item: item["date"], reverse=True)


def known_names(sb, user_id: str) -> List[str]:
    """The person's own name and username from their profile, which the scrubber always replaces."""
    rows = sb.table("profiles").select("display_name, username").eq("id", user_id).limit(1).execute().data or []
    row = rows[0] if rows else {}
    return [value for value in (row.get("display_name"), row.get("username")) if isinstance(value, str) and value.strip()]


def scrub_items(items: List[Dict[str, Any]], names: List[str]) -> List[Dict[str, Any]]:
    out = []
    for item in items:
        prompt, text = scrubber.scrub(item["prompt"], names), scrubber.scrub(item["text"], names)
        found = dict(text.found)
        for kind, count in prompt.found.items():
            found[kind] = found.get(kind, 0) + count
        out.append({**{k: item[k] for k in ("kind", "id", "label", "date")}, "prompt": prompt.text,
                    "before": item["text"], "after": text.text, "found": found})
    return out


def _supabase():
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Your writing can't be read just now. Please try again later.")
    return sb


@router.get("/items")
async def my_items(user_id: str = Depends(current_user_id)):
    sb = _supabase()
    try:
        items = await asyncio.to_thread(load_items, sb, user_id)
    except Exception as e:
        print(f"[training] items not read: {type(e).__name__}")
        raise HTTPException(status_code=503, detail="Your writing can't be read just now. Please try again later.")
    return {"items": items}


@router.post("/scrub")
async def scrub_mine(body: ScrubIn, user_id: str = Depends(current_user_id)):
    if (body.items is None) == (body.texts is None):
        raise HTTPException(status_code=422, detail="Send either items or texts.")
    sb = _supabase()
    names = await asyncio.to_thread(known_names, sb, user_id)
    if body.texts is not None:
        results = await asyncio.to_thread(lambda: [scrubber.scrub(t, names) for t in body.texts])
        return {"version": scrubber.version(), "names": scrubber.uses_ner(),
                "texts": [{"after": r.text, "found": r.found} for r in results]}
    wanted = {(ref.kind, ref.id) for ref in body.items or []}
    mine = await asyncio.to_thread(load_items, sb, user_id)
    chosen = [item for item in mine if (item["kind"], item["id"]) in wanted]
    scrubbed = await asyncio.to_thread(scrub_items, chosen, names)
    return {"version": scrubber.version(), "names": scrubber.uses_ner(), "items": scrubbed,
            "missing": len(wanted) - len(chosen)}


@router.post("/consent")
async def record_consent(body: ConsentIn, user_id: str = Depends(current_user_id)):
    """Which items the person approved, when, and with which scrubber. Only their own items, only with the scrubber
    that runs now (so the version recorded is the one that actually scrubbed them), and never any text."""
    if body.scrubberVersion != scrubber.version():
        raise HTTPException(status_code=409, detail="The scrubber has changed since you checked these. Please check them again.")
    keys: List[tuple] = []
    for ref in body.items:
        if not ITEM_ID[ref.kind].match(ref.id):
            raise HTTPException(status_code=422, detail="That isn't one of your items.")
        if (ref.kind, ref.id) not in keys:
            keys.append((ref.kind, ref.id))
    refs = [{"kind": kind, "id": item_id} for kind, item_id in keys]
    sb = _supabase()
    mine = {(item["kind"], item["id"]) for item in await asyncio.to_thread(load_items, sb, user_id)}
    if any(key not in mine for key in keys):
        raise HTTPException(status_code=422, detail="Some of those items aren't yours, or have been deleted.")
    try:
        rows = sb.table("training_set_consents").insert({
            "user_id": user_id, "item_refs": refs, "item_count": len(refs), "scrubber_version": body.scrubberVersion,
        }).execute().data or []
    except Exception as e:
        # Most likely STEP 95 isn't applied yet.
        print(f"[training] consent not recorded: {type(e).__name__}")
        raise HTTPException(status_code=503, detail="Your approval can't be recorded yet, so the file wasn't made.")
    row = rows[0] if rows else {}
    return {"saved": True, "id": row.get("id"), "createdAt": row.get("created_at"), "itemCount": len(refs),
            "scrubberVersion": body.scrubberVersion}


@router.get("/consent")
async def my_consents(user_id: str = Depends(current_user_id)):
    sb = _supabase()
    try:
        rows = (sb.table("training_set_consents").select("id, created_at, item_count, scrubber_version, item_refs")
                .eq("user_id", user_id).order("created_at", desc=True).limit(50).execute().data or [])
    except Exception:
        return {"records": [], "available": False}
    return {"available": True, "records": [
        {"id": r.get("id"), "createdAt": r.get("created_at"), "itemCount": r.get("item_count"),
         "scrubberVersion": r.get("scrubber_version"), "items": r.get("item_refs") or []} for r in rows]}
