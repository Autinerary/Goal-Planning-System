"""Milestone ratings: how useful a step of someone's plan was (STEP 54).

  POST /api/milestone-ratings          { pathId, milestoneId, rating 1-5 }
  GET  /api/milestone-ratings/{pathId} the latest rating per milestone, and
                                       the path score

There are 0 reflections and the ratings table holds ResourceHub's place
ratings, so Reflection Analysis and Adaptation have no real signal about
plans. These ratings are one: asked on a milestone's page, stored as an
append-only log (the latest per milestone counts), and rolled up to a path
score in [0, 1], the mean of (rating - 1) / 4 over the rated milestones.

After each rating the person's profile vector is re-embedded with the path
score as its success_rate, through orchestrator.index_user, the same call
POST /api/reflections makes (step 6 there). Retrieval ranks similar people
partly by success_rate, so a plan people find useful counts for more. Note
that both writers set the same single success_rate: whichever ran last wins.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth_guard import current_user_id
from database.supabase_client import get_supabase

router = APIRouter()

# Strong references, so a background re-embed is not garbage-collected mid-run.
_BACKGROUND: set = set()


class RatingIn(BaseModel):
    pathId: str = Field(..., min_length=1, max_length=100)
    milestoneId: str = Field(..., min_length=1, max_length=200)
    rating: int = Field(..., ge=1, le=5)


def path_score(rows: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """The latest rating per milestone, and their mean as a score in [0, 1]."""
    latest: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        mid = row.get("milestone_id")
        if mid and (mid not in latest or str(row.get("created_at") or "") >= str(latest[mid].get("created_at") or "")):
            latest[mid] = row
    ratings = {mid: int(r["rating"]) for mid, r in latest.items()}
    score = round(sum((r - 1) / 4 for r in ratings.values()) / len(ratings), 3) if ratings else None
    return {"ratings": ratings, "rated": len(ratings), "score": score}


def milestone_ids(payload: Any) -> List[str]:
    """Every milestone id in a stored path (races first, then path planning's list)."""
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except ValueError:
            payload = {}
    payload = payload if isinstance(payload, dict) else {}
    ids: List[str] = []
    for race in payload.get("races") or []:
        milestones = race.get("milestones") if isinstance(race, dict) else None
        for m in milestones if isinstance(milestones, list) else []:
            if isinstance(m, dict) and isinstance(m.get("id"), str) and m["id"] not in ids:
                ids.append(m["id"])
    for response in payload.get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == "path_planning":
            for m in (response.get("result") or {}).get("milestones") or []:
                if isinstance(m, dict) and isinstance(m.get("id"), str) and m["id"] not in ids:
                    ids.append(m["id"])
    return ids


def _load_path(sb, user_id: str, path_id: str) -> Optional[Dict[str, Any]]:
    rows = (sb.table("user_paths").select("payload").eq("user_id", user_id).eq("path_id", path_id)
            .limit(1).execute().data or [])
    if not rows:
        return None
    payload = rows[0].get("payload")
    return json.loads(payload) if isinstance(payload, str) else payload


def _ratings(sb, user_id: str, path_id: str) -> List[Dict[str, Any]]:
    return (sb.table("milestone_ratings").select("milestone_id, rating, created_at")
            .eq("user_id", user_id).eq("path_id", path_id).execute().data or [])


async def reembed_with_score(user_id: str, payload: Dict[str, Any], score: float) -> bool:
    """The reflection trigger (api/routes/reflections.py, step 6): re-index the
    person's vector, with the path score as success_rate."""
    from api.routes.reflections import _get_orchestrator

    profile = (payload or {}).get("userProfile") or {}
    orchestrator = await _get_orchestrator()
    return await orchestrator.index_user(
        user_id=user_id,
        user_profile=profile,
        goals=list(profile.get("goals") or []),
        barriers=list(profile.get("barrierTypes") or []),
        agent_result={"path": (payload or {}).get("path"), "milestones": []},
        success_rate=max(0.0, min(1.0, score)),
    )


async def _reembed_quietly(user_id: str, payload: Dict[str, Any], score: float) -> None:
    try:
        ok = await reembed_with_score(user_id, payload, score)
        print(f"[milestone_ratings] re-embedded with success_rate {score}: {ok}")
    except Exception as e:
        print(f"[milestone_ratings] re-embed skipped: {e}")


@router.post("")
async def rate_milestone(body: RatingIn, user_id: str = Depends(current_user_id)):
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Ratings are not available just now.")
    payload = _load_path(sb, user_id, body.pathId)
    if payload is None or body.milestoneId not in milestone_ids(payload):
        raise HTTPException(status_code=404, detail="That step is not in your path.")
    try:
        sb.table("milestone_ratings").insert({
            "user_id": user_id, "path_id": body.pathId,
            "milestone_id": body.milestoneId, "rating": body.rating,
        }).execute()
        summary = path_score(_ratings(sb, user_id, body.pathId))
    except Exception:
        # Most likely STEP 54 is not applied yet.
        raise HTTPException(status_code=503, detail="Ratings are not available yet.")
    task = asyncio.create_task(_reembed_quietly(user_id, payload, summary["score"]))
    _BACKGROUND.add(task)
    task.add_done_callback(_BACKGROUND.discard)
    return {"saved": True, "rating": body.rating, "score": summary["score"], "rated": summary["rated"],
            "total": len(milestone_ids(payload)), "reembedding": True}


@router.get("/{path_id}")
async def get_ratings(path_id: str, user_id: str = Depends(current_user_id)):
    sb = get_supabase()
    if sb is None:
        raise HTTPException(status_code=503, detail="Ratings are not available just now.")
    try:
        summary = path_score(_ratings(sb, user_id, path_id))
    except Exception:
        return {"ratings": {}, "rated": 0, "score": None, "available": False}
    return {**summary, "available": True}
