"""
Shared agents (STEP 97): one of a person's own agents (frontend app/agents, lib/agents.ts), shared with everyone, with
people they pick from their connections, or by private link, so others can run it on their own plan: their plan looked
at the way the agent's owner looks at things. An agent is words, not a model: a name, what it's for, instructions, the
norms it looks through, and what it may see. Whoever uses one runs it on their own device or our cloud model, with our
rules first, and it only ever sees the user's own information, never its owner's.

Nothing is shared until every check passes:
  words      the name, what it's for and its instructions name no one: no names, contact details, addresses, schools,
             employers, dates of birth or ID numbers (core/scrubber.py, with the owner's own name and username). Norms
             and diagnoses are fine: that's what an agent is about.
  rules      it doesn't try to set our rules aside ("ignore the rules above").
  harm       OpenAI's moderation service finds no harassment, hate, self-harm, sexual content, violence or illegal
             activity in it. Only run once the words check passes, so what reaches OpenAI names no one; and it fails
             closed: if it can't run, nothing is shared.
  crowd      shared with everyone, at least MIN_CROWD real people share all of its norms (api/routes/adapters.py).
  audience   shared with people, only the owner's own connections.
  lineage    what it was built on is still shared, and it isn't a copy of it unchanged.
Reports go to ResourceHub's moderation queue (community_reports, target 'agent'), where Remove takes it down. Nothing
public says who shared one. On unless SHARED_AGENTS=off (the switch to turn it off in a hurry).
"""
from __future__ import annotations

import asyncio
import os
import re
import secrets
import uuid
from collections import Counter
from typing import Any, Callable, Dict, List, Literal, Optional, Set

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from api.auth_guard import current_user_id, optional_user_id
from api.routes.adapters import (METADATA_BLOCKS, RatingIn, ReportIn, audience_check, crowd_check, my_people, passed,
                                 people_tags)
from api.routes.training import known_names
from core import community_tags as tags
from core import scrubber
from database.supabase_client import get_supabase

router = APIRouter()

SCOPES = ("norms", "goals", "plan", "step")
MAX_PER_PERSON = 20
MAX_PEOPLE = 50
_KEY = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
MODERATION_URL = "https://api.openai.com/v1/moderations"
MODERATION_MODEL = "omni-moderation-latest"

# Telling an agent to step outside our rules. They come first whatever an agent says (api/routes/assistant.py), but an
# agent written to try is not one to share.
_SETS_RULES_ASIDE = re.compile(
    r"\b(ignore|disregard|forget|override|bypass|break)\b[^.\n]{0,40}\b(rules?|instructions?|guidelines?|polic(?:y|ies)|"
    r"safety|system prompt)\b"
    r"|\b(system prompt|jailbreak|developer mode|do anything now)\b"
    r"|\byou (?:are|have) no (?:rules|limits|restrictions)\b"
    r"|\bpretend (?:that )?(?:you are|to be) (?:not|an? (?:unfiltered|uncensored))",
    re.IGNORECASE)

# OpenAI's moderation categories, in plain words.
_HARM_WORDS = {"harassment": "harassment", "hate": "hate", "self-harm": "self-harm", "sexual": "sexual content",
               "violence": "violence", "illicit": "illegal activity"}


def enabled() -> bool:
    return os.getenv("SHARED_AGENTS", "on").strip().lower() != "off"


def _require_enabled() -> None:
    if not enabled():
        raise HTTPException(status_code=404, detail="Sharing agents isn't on yet.")


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


class AgentIn(BaseModel):
    """An agent as its owner shares it (or changes it), and who may see it."""
    name: str = Field(min_length=2, max_length=60)
    purpose: str = Field(default="", max_length=200)
    instructions: str = Field(default="", max_length=2000)
    lens: List[str] = Field(default_factory=list, max_length=tags.MAX_TAGS)
    sees: List[str] = Field(default_factory=list, max_length=len(SCOPES))
    visibility: Literal["everyone", "people", "link"] = "everyone"
    people: List[str] = Field(default_factory=list, max_length=MAX_PEOPLE)
    builtOn: Optional[str] = Field(default=None, max_length=40)


# ---- The checks ---------------------------------------------------------------------------------------------------

def words_check(agent: AgentIn, names: List[str]) -> Dict[str, Any]:
    found: Dict[str, int] = {}
    where: List[str] = []
    for label, text in (("its name", agent.name), ("what it's for", agent.purpose), ("its instructions", agent.instructions)):
        hits = {k: c for k, c in scrubber.scrub(text, list(names)).found.items() if k in METADATA_BLOCKS}
        if hits:
            where.append(label)
            for k, c in hits.items():
                found[k] = found.get(k, 0) + c
    why = []
    if found:
        kinds = ", ".join(k.replace("_", " ") for k in sorted(found))
        why.append(f"There's personal information ({kinds}) in {' and '.join(where)}. Take it out and check again.")
    if [t for t in agent.lens if t not in tags.TAG_IDS]:
        why.append("Pick the norms from the list.")
    if [s for s in agent.sees if s not in SCOPES]:
        why.append("Pick what it can see from the list.")
    return {"passed": not why, "found": found, "why": " ".join(why)}


def rules_check(agent: AgentIn) -> Dict[str, Any]:
    if _SETS_RULES_ASIDE.search("\n".join((agent.name, agent.purpose, agent.instructions))):
        return {"passed": False, "why": "An agent can't be told to set our rules aside. Take that out and check again."}
    return {"passed": True, "why": ""}


def _post(url: str, payload: Dict[str, Any], key: str) -> Dict[str, Any]:
    with httpx.Client(timeout=15) as client:
        response = client.post(url, json=payload, headers={"Authorization": f"Bearer {key}"})
        response.raise_for_status()
        return response.json()


def harm_check(agent: AgentIn, post: Optional[Callable[[str, Dict[str, Any], str], Dict[str, Any]]] = None) -> Dict[str, Any]:
    """OpenAI's moderation service (no charge). Fails closed: if it can't run, nothing is shared."""
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        return {"passed": False, "why": "We can't check agents for harmful content just now, so none can be shared yet."}
    try:
        result = (post or _post)(MODERATION_URL, {"model": MODERATION_MODEL,
                                                  "input": "\n\n".join((agent.name, agent.purpose, agent.instructions))}, key)
        verdict = result["results"][0]
    except Exception as e:
        print(f"[shared_agents] moderation unavailable: {type(e).__name__}")
        return {"passed": False, "why": "We couldn't check it for harmful content just now. Please try again in a moment."}
    if verdict.get("flagged"):
        flagged = sorted(k for k, v in (verdict.get("categories") or {}).items() if v)
        words = sorted({_HARM_WORDS.get(k.split("/")[0], k.split("/")[0]) for k in flagged})
        return {"passed": False, "flagged": flagged,
                "why": f"It may contain {', '.join(words) or 'harmful content'}, so it can't be shared. If that's a "
                       "mistake, change the wording and check again."}
    return {"passed": True, "why": ""}


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
        return bool(sb.table("shared_agent_access").select("user_id").eq("agent_id", row["id"])
                    .eq("user_id", caller).limit(1).execute().data)
    return False


def _same(a: str, b: str) -> bool:
    return re.sub(r"\s+", " ", (a or "").strip().lower()) == re.sub(r"\s+", " ", (b or "").strip().lower())


def lineage_check(sb, user_id: str, agent: AgentIn) -> Dict[str, Any]:
    if not agent.builtOn:
        return {"passed": True, "applies": False, "why": ""}
    parent_id = _uuid(agent.builtOn)
    rows = (sb.table("shared_agents").select("*").eq("id", parent_id).limit(1).execute().data or []) if parent_id else []
    # A private link isn't kept with the person who used it, so an agent shared by link counts as one they could see.
    if not rows or not (can_see(sb, rows[0], user_id)
                        or (rows[0].get("moderation_status") == "approved" and rows[0].get("visibility") == "link")):
        return {"passed": False, "why": "The agent this was built on isn't shared any more, so it can't be named."}
    parent = rows[0]
    if _same(parent.get("instructions", ""), agent.instructions) and _same(parent.get("purpose", ""), agent.purpose):
        return {"passed": False, "why": "It's the same as the agent it was built on. Change it to make it yours, or "
                                        "share the original with them instead."}
    return {"passed": True, "why": "", "builtOn": parent_id}


def run_checks(sb, user_id: str, agent: AgentIn, post=None) -> Dict[str, Any]:
    """Every check, each passed or not and why; one that doesn't apply to this share says "applies": False. Harmful
    content is checked only once the words and rules checks pass, so what goes to OpenAI names no one."""
    words = words_check(agent, known_names(sb, user_id))
    rules = rules_check(agent)
    harm = (harm_check(agent, post) if words["passed"] and rules["passed"]
            else {"passed": False, "waiting": True, "why": "Checked for harmful content once the checks above pass."})
    return {
        "words": words,
        "rules": rules,
        "harm": harm,
        "crowd": crowd_check(sb, agent.lens, agent.visibility),
        "audience": audience_check(sb, user_id, agent.visibility, agent.people),
        "lineage": lineage_check(sb, user_id, agent),
    }


# ---- What others see -----------------------------------------------------------------------------------------------

def _public(row: Dict[str, Any], ratings: List[Dict[str, Any]], caller: Optional[str], me: Set[str],
            raters: Dict[str, Set[str]], names: Dict[str, str], children: Counter) -> Dict[str, Any]:
    own = [r for r in ratings if r.get("agent_id") == row["id"]]
    stars = [int(r["rating"]) for r in own]
    mine = [int(r["rating"]) for r in own if caller and r.get("user_id") == caller]
    score, shared = tags.match(me, row.get("lens") or [])
    parent = row.get("built_on")
    return {
        "id": row["id"], "name": row["name"], "purpose": row.get("purpose") or "", "instructions": row.get("instructions") or "",
        "lens": tags.clean_tags(row.get("lens") or []), "sees": [s for s in (row.get("sees") or []) if s in SCOPES],
        "createdAt": row.get("created_at"), "visibility": row.get("visibility") or "everyone",
        "rating": {"average": round(sum(stars) / len(stars), 1) if stars else None, "count": len(stars)},
        "ratingForYou": tags.rating_for(me, [(raters.get(r.get("user_id"), set()), int(r["rating"])) for r in own]) if me and own else None,
        "match": {"score": round(score, 2), "shared": shared},
        "myRating": mine[0] if mine else None,
        "mine": bool(caller and row.get("owner_id") == caller),
        "builtOn": {"id": parent, "name": names.get(parent)} if parent else None,
        "builtOnCount": children.get(row["id"], 0),
    }


def _ranked(sb, rows: List[Dict[str, Any]], caller: Optional[str], names: Optional[Dict[str, str]] = None,
            children: Optional[Counter] = None) -> List[Dict[str, Any]]:
    """Best for the caller first: how much of each agent's community they're part of, then the rating weighted towards
    people like them, then how many ratings, then the newest (as Community models)."""
    ids = [r["id"] for r in rows]
    ratings = (sb.table("shared_agent_ratings").select("agent_id, user_id, rating").in_("agent_id", ids)
               .execute().data or []) if ids else []
    wanted = {r["user_id"] for r in ratings} | ({caller} if caller else set())
    known = people_tags(sb, wanted) if wanted else {}
    me = known.get(caller, set()) if caller else set()
    names = {**(names or {}), **{r["id"]: r["name"] for r in rows}}
    children = children if children is not None else Counter(r.get("built_on") for r in rows if r.get("built_on"))
    out = [_public(r, ratings, caller, me, known, names, children) for r in rows]
    out.sort(key=lambda a: a["createdAt"] or "", reverse=True)
    out.sort(key=lambda a: (-a["match"]["score"], -(a["ratingForYou"] or a["rating"]["average"] or 0), -a["rating"]["count"]))
    return out


def _owned(sb, agent_id: Optional[str], user_id: str) -> Dict[str, Any]:
    rows = (sb.table("shared_agents").select("*").eq("id", agent_id).eq("owner_id", user_id)
            .limit(1).execute().data or []) if agent_id else []
    if not rows:
        raise HTTPException(status_code=404, detail="That isn't one of your shared agents.")
    return rows[0]


def _visible(sb, agent_id: Optional[str], caller: Optional[str], key: Optional[str] = None) -> Dict[str, Any]:
    rows = (sb.table("shared_agents").select("*").eq("id", agent_id).limit(1).execute().data or []) if agent_id else []
    if not rows or not can_see(sb, rows[0], caller, key):
        raise HTTPException(status_code=404, detail="That agent isn't shared with you, or isn't shared any more.")
    return rows[0]


def _clean(agent: AgentIn) -> Dict[str, Any]:
    return {"name": agent.name.strip(), "purpose": agent.purpose.strip(), "instructions": agent.instructions.strip(),
            "lens": tags.clean_tags(agent.lens), "sees": [s for s in SCOPES if s in agent.sees]}


# ---- Endpoints ----------------------------------------------------------------------------------------------------

@router.get("/status")
async def status():
    return {"enabled": enabled(), "tags": [{"id": t, "label": label} for t, label in tags.COMMUNITY_TAGS],
            "maxTags": tags.MAX_TAGS, "minCrowd": tags.MIN_CROWD, "scopes": list(SCOPES)}


@router.get("")
async def list_agents(caller: Optional[str] = Depends(optional_user_id)):
    if not enabled():
        return {"enabled": False, "agents": [], "sharedWithMe": [], "forYou": False}
    sb = _supabase()

    def read():
        public = (sb.table("shared_agents").select("*").eq("moderation_status", "approved").eq("visibility", "everyone")
                  .order("created_at", desc=True).limit(200).execute().data or [])
        shared: List[Dict[str, Any]] = []
        if caller:
            ids = [a["agent_id"] for a in sb.table("shared_agent_access").select("agent_id").eq("user_id", caller).execute().data or []]
            if ids:
                shared = (sb.table("shared_agents").select("*").in_("id", ids).eq("moderation_status", "approved")
                          .eq("visibility", "people").execute().data or [])
        everything = public + shared
        names = {r["id"]: r["name"] for r in everything}
        children = Counter(r.get("built_on") for r in everything if r.get("built_on"))
        ranked = _ranked(sb, public, caller, names, children)
        return ranked, _ranked(sb, shared, caller, names, children), bool(caller and any(a["match"]["score"] for a in ranked))
    agents, shared, for_you = await asyncio.to_thread(read)
    return {"enabled": True, "agents": agents, "sharedWithMe": shared, "forYou": for_you}


@router.get("/link/{key}")
async def by_link(key: str, caller: Optional[str] = Depends(optional_user_id)):
    _require_enabled()
    if not _KEY.match(key or ""):
        raise HTTPException(status_code=404, detail="That link doesn't work any more.")
    sb = _supabase()
    rows = (sb.table("shared_agents").select("*").eq("link_token", key).eq("visibility", "link")
            .eq("moderation_status", "approved").limit(1).execute().data or [])
    if not rows:
        raise HTTPException(status_code=404, detail="That link doesn't work any more.")
    return {"agent": (await asyncio.to_thread(_ranked, sb, rows, caller))[0]}


@router.get("/people")
async def people(user_id: str = Depends(current_user_id)):
    _require_enabled()
    found = await asyncio.to_thread(my_people, _supabase(), user_id)
    return {"people": [{"id": i, "name": n} for i, n in sorted(found.items(), key=lambda kv: kv[1].lower())]}


@router.get("/mine")
async def my_agents(user_id: str = Depends(current_user_id)):
    _require_enabled()
    sb = _supabase()
    rows = (sb.table("shared_agents").select("*").eq("owner_id", user_id).order("created_at", desc=True)
            .limit(50).execute().data or [])
    ids = [r["id"] for r in rows]
    access = (sb.table("shared_agent_access").select("agent_id, user_id").in_("agent_id", ids).execute().data or []) if ids else []
    names = my_people(sb, user_id) if access else {}
    return {"agents": [{
        "id": r["id"], "name": r["name"], "purpose": r.get("purpose") or "", "lens": r.get("lens") or [],
        "status": r["moderation_status"], "visibility": r.get("visibility") or "everyone", "linkKey": r.get("link_token"),
        "people": [{"id": a["user_id"], "name": names.get(a["user_id"], "Someone you know")} for a in access if a["agent_id"] == r["id"]],
        "builtOn": r.get("built_on"), "createdAt": r.get("created_at"),
    } for r in rows]}


@router.post("/check")
async def check_agent(body: AgentIn, user_id: str = Depends(current_user_id)):
    _require_enabled()
    checks = await asyncio.to_thread(run_checks, _supabase(), user_id, body)
    return {"passed": passed(checks), "checks": checks}


@router.post("")
async def share_agent(body: AgentIn, user_id: str = Depends(current_user_id)):
    """Shared at once, if every check passes (an agent is words: nothing to upload)."""
    _require_enabled()
    sb = _supabase()
    checks = await asyncio.to_thread(run_checks, sb, user_id, body)
    if not passed(checks):
        raise HTTPException(status_code=422, detail={"message": "Not shared: a check didn't pass.", "checks": checks})
    unavailable = HTTPException(status_code=503, detail="Sharing isn't available yet. Please try again later.")
    try:
        existing = sb.table("shared_agents").select("id").eq("owner_id", user_id).limit(MAX_PER_PERSON).execute().data or []
    except Exception as e:
        print(f"[shared_agents] not shared: {type(e).__name__}")
        raise unavailable
    if len(existing) >= MAX_PER_PERSON:
        raise HTTPException(status_code=429, detail=f"You can share up to {MAX_PER_PERSON} agents. Take one down first.")
    agent_id = str(uuid.uuid4())
    key = secrets.token_urlsafe(24) if body.visibility == "link" else None
    try:
        sb.table("shared_agents").insert({
            "id": agent_id, "owner_id": user_id, **_clean(body), "visibility": body.visibility, "link_token": key,
            "built_on": checks["lineage"].get("builtOn"), "moderation_status": "approved", "moderation_checks": checks,
        }).execute()
        if body.visibility == "people":
            sb.table("shared_agent_access").insert([{"agent_id": agent_id, "user_id": p} for p in sorted(set(body.people))]).execute()
    except Exception as e:
        # Most likely STEP 97 isn't applied yet.
        print(f"[shared_agents] not shared: {type(e).__name__}")
        try:
            sb.table("shared_agents").delete().eq("id", agent_id).execute()
        except Exception:
            pass
        raise unavailable
    return {"id": agent_id, "status": "approved", "visibility": body.visibility, "linkKey": key, "checks": checks}


@router.patch("/{agent_id}")
async def change_agent(agent_id: str, body: AgentIn, user_id: str = Depends(current_user_id)):
    """Its owner changes it, or who can see it: every check again, and nothing changes unless they all pass."""
    _require_enabled()
    sb = _supabase()
    row = _owned(sb, _uuid(agent_id), user_id)
    body = body.model_copy(update={"builtOn": row.get("built_on")})
    checks = await asyncio.to_thread(run_checks, sb, user_id, body)
    if not passed(checks):
        raise HTTPException(status_code=422, detail={"message": "Not changed: a check didn't pass.", "checks": checks})
    key = (row.get("link_token") or secrets.token_urlsafe(24)) if body.visibility == "link" else None
    sb.table("shared_agents").update({**_clean(body), "visibility": body.visibility, "link_token": key,
                                      "moderation_checks": checks}).eq("id", row["id"]).execute()
    sb.table("shared_agent_access").delete().eq("agent_id", row["id"]).execute()
    if body.visibility == "people":
        sb.table("shared_agent_access").insert([{"agent_id": row["id"], "user_id": p} for p in sorted(set(body.people))]).execute()
    return {"id": row["id"], "status": row["moderation_status"], "visibility": body.visibility, "linkKey": key, "checks": checks}


@router.delete("/{agent_id}")
async def take_down(agent_id: str, user_id: str = Depends(current_user_id)):
    _require_enabled()
    sb = _supabase()
    row = _owned(sb, _uuid(agent_id), user_id)
    sb.table("shared_agents").delete().eq("id", row["id"]).eq("owner_id", user_id).execute()
    return {"deleted": True}


@router.post("/{agent_id}/rating")
async def rate_agent(agent_id: str, body: RatingIn, key: Optional[str] = Query(None, max_length=64),
                     user_id: str = Depends(current_user_id)):
    _require_enabled()
    sb = _supabase()
    row = await asyncio.to_thread(_visible, sb, _uuid(agent_id), user_id, key)
    if row["owner_id"] == user_id:
        raise HTTPException(status_code=403, detail="You can't rate an agent you shared.")
    sb.table("shared_agent_ratings").upsert({"agent_id": row["id"], "user_id": user_id, "rating": body.rating},
                                            on_conflict="agent_id,user_id").execute()
    view = (await asyncio.to_thread(_ranked, sb, [row], user_id))[0]
    return {"saved": True, "rating": view["rating"], "ratingForYou": view["ratingForYou"], "myRating": body.rating}


@router.post("/{agent_id}/report")
async def report_agent(agent_id: str, body: ReportIn, key: Optional[str] = Query(None, max_length=64),
                       user_id: str = Depends(current_user_id)):
    """The same queue as ResourceHub's posts and answers (its /admin/community), where Remove takes it down."""
    _require_enabled()
    sb = _supabase()
    row = await asyncio.to_thread(_visible, sb, _uuid(agent_id), user_id, key)
    try:
        sb.table("community_reports").upsert({"reporter_id": user_id, "target_type": "agent", "target_id": row["id"],
                                              "reason": body.reason.strip()},
                                             on_conflict="reporter_id,target_type,target_id").execute()
    except Exception as e:
        print(f"[shared_agents] report not saved: {type(e).__name__}")
        raise HTTPException(status_code=503, detail="Your report couldn't be sent just now. Please try again.")
    return {"reported": True}
