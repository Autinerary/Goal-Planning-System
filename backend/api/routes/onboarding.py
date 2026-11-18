"""
Onboarding API Routes
Step 0: Questionnaire → Agent Orchestration → Path Generation
"""

import asyncio
import importlib
import json
from collections import OrderedDict

from fastapi import APIRouter, Depends, HTTPException

from api.auth_guard import current_user_id, onboarding_user_id, require_self_or_guardian
from core.path_privacy import other_people, without_other_people
from pydantic import BaseModel, Field
from typing import Any, Callable, Dict, List, Literal, Optional
import httpx
import os
import uuid
from datetime import datetime

from database.supabase_client import get_supabase
from core import memory as mem
from core.guardrails import validate_all_inputs
from core.path_storage import apply_adaptation
from core import jobs
from core import llm
from core import budget

router = APIRouter()

# asyncio holds only weak references to tasks, so a detached generation can be
# garbage-collected mid-run. Keeping a strong reference until completion is
# what stops that.
_BACKGROUND_TASKS: set = set()

# A generation is stopped after this long (core/jobs.py, GENERATION_DEADLINE),
# before its job could be taken for a dead one and a second started beside it.
GENERATION_DEADLINE_SECONDS = jobs.GENERATION_DEADLINE.total_seconds()

SERVICE_HUB_URL = os.getenv("SERVICE_HUB_URL", "http://localhost:3001")

# How many paths this process keeps a copy of.
CACHED_PATHS = 200


class _PathCache(OrderedDict):
    """The paths this process saved or read, at most CACHED_PATHS of them
    (the oldest go first). It used to keep every path it ever saw.

    Plans are read from Supabase whenever it's configured: the app's Next.js
    routes edit them there, and a copy kept here went stale without this
    process knowing (bug audit, 17 November 2026, item 34). Without Supabase
    (local runs) this is the only store.
    """

    def __setitem__(self, key, value):
        # Written from worker threads (asyncio.to_thread), so another may take
        # an entry out meanwhile: that is never an error here.
        super().__setitem__(key, value)
        try:
            self.move_to_end(key)
        except KeyError:
            pass
        while len(self) > CACHED_PATHS:
            try:
                self.popitem(last=False)
            except KeyError:
                break


generated_paths: Dict[str, Any] = _PathCache()


def _save_path(path_id: str, user_id: str, payload: Dict[str, Any], label: Optional[str] = None) -> None:
    """Save a path to Supabase user_paths as the person's active one, and
    keep a copy here.

    Multi-path aware: the new path is written first, then the person's other
    paths are made inactive. It used to be the other way round, with a
    fallback write that could never succeed (on_conflict "user_id", when the
    key is (user_id, path_id)), so a failed write left the person with no
    active path and the new one lost (bug audit, 17 November 2026, item 34).

    Raises when the path isn't saved, so a generation is marked failed
    instead of reporting a path that doesn't exist.
    """
    client = get_supabase() if user_id else None
    if client is None:
        generated_paths[path_id] = payload
        return

    # The people the plan was matched with go to plan_matches, which
    # only the server reads; the saved plan keeps how many (STEP 68).
    # Before STEP 68 there is no such table and the plan keeps them.
    stored = payload
    matches = other_people(payload)
    if matches is not None:
        try:
            client.table("plan_matches").upsert(
                {"user_id": user_id, "path_id": path_id, **matches,
                 "updated_at": datetime.utcnow().isoformat()},
                on_conflict="user_id,path_id",
            ).execute()
            stored = without_other_people(payload)
        except Exception:
            pass

    row: Dict[str, Any] = {
        "user_id": user_id,
        "path_id": path_id,
        "payload": stored,
        "updated_at": datetime.utcnow().isoformat(),
        "is_active": True,
    }
    if label is not None:
        row["label"] = label
    client.table("user_paths").upsert(row, on_conflict="user_id,path_id").execute()
    generated_paths[path_id] = payload

    # Then exactly one stays active. If this fails, the new path is still
    # saved and active, and the newest active path is the one shown.
    try:
        client.table("user_paths").update({"is_active": False}).eq(
            "user_id", user_id
        ).neq("path_id", path_id).execute()
    except Exception as e:
        print(f"[onboarding] other paths left active: {e}")


def _list_paths_by_user(user_id: str) -> List[Dict[str, Any]]:
    """Return metadata for all of a user's paths (newest first)."""
    if not user_id:
        return []
    client = get_supabase()
    if client is None:
        # Fall back to in-memory cache.
        return [
            {
                "path_id": pid,
                "is_active": True,
                "label": p.get("userProfile", {}).get("name"),
                "generatedAt": p.get("generatedAt"),
                "payload": p,
            }
            for pid, p in generated_paths.items()
            if p.get("userId") == user_id
        ]
    try:
        res = (
            client.table("user_paths")
            .select("path_id, payload, updated_at, is_active, label, created_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        # Pre-migration schema without is_active/label columns.
        try:
            res = (
                client.table("user_paths")
                .select("path_id, payload, updated_at")
                .eq("user_id", user_id)
                .execute()
            )
            return res.data or []
        except Exception as e:
            print(f"[onboarding] user_paths list skipped: {e}")
            return []


def _set_active_path(user_id: str, path_id: str) -> bool:
    """Mark one of the person's paths active, deactivating the rest.

    Only a path they have: an id that isn't theirs used to deactivate every
    path and activate nothing, leaving them with none.
    """
    if not user_id or not path_id:
        return False
    client = get_supabase()
    if client is None:
        return False
    try:
        found = (
            client.table("user_paths").select("path_id")
            .eq("user_id", user_id).eq("path_id", path_id).limit(1).execute()
        ).data or []
        if not found:
            return False
        client.table("user_paths").update({"is_active": False}).eq("user_id", user_id).neq(
            "path_id", path_id
        ).execute()
        client.table("user_paths").update({"is_active": True}).eq("user_id", user_id).eq(
            "path_id", path_id
        ).execute()
        return True
    except Exception as e:
        print(f"[onboarding] set active path skipped: {e}")
        return False


def _delete_path(user_id: str, path_id: str) -> bool:
    """Delete a single path for the user.

    Deleting the active path leaves their newest other path active; it used
    to leave none active.
    """
    # Only from the cache if it is theirs: the id comes from the request.
    cached = generated_paths.get(path_id)
    if cached is not None and str(cached.get("userId") or "") == str(user_id):
        generated_paths.pop(path_id, None)
    client = get_supabase()
    if client is None:
        return False
    try:
        client.table("user_paths").delete().eq("user_id", user_id).eq(
            "path_id", path_id
        ).execute()
    except Exception as e:
        print(f"[onboarding] delete path skipped: {e}")
        return False
    try:
        rest = (
            client.table("user_paths").select("path_id, is_active")
            .eq("user_id", user_id).order("updated_at", desc=True).execute()
        ).data or []
        if rest and not any(r.get("is_active") for r in rest):
            client.table("user_paths").update({"is_active": True}).eq("user_id", user_id).eq(
                "path_id", rest[0]["path_id"]
            ).execute()
    except Exception as e:
        print(f"[onboarding] no path made active after a delete: {e}")
    return True


def _load_path_by_id(path_id: str) -> Optional[Dict[str, Any]]:
    """Look up a path by id in Supabase (in this process's copies only when
    Supabase isn't configured: see _PathCache)."""
    client = get_supabase()
    if client is None:
        return generated_paths.get(path_id)
    try:
        res = (
            client.table("user_paths")
            .select("payload")
            .eq("path_id", path_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if rows:
            return rows[0]["payload"]
    except Exception as e:
        print(f"[onboarding] user_paths lookup skipped: {e}")
    return None


def _load_path_by_user(user_id: str) -> Optional[Dict[str, Any]]:
    """Look up the active (or most recent) path for a user from Supabase."""
    if not user_id:
        return None
    client = get_supabase()
    if client is None:
        return None
    # Prefer the active path; fall back to most recent.
    try:
        res = (
            client.table("user_paths")
            .select("payload")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if rows:
            return rows[0]["payload"]
    except Exception:
        pass  # is_active column may not exist yet (pre-migration)
    try:
        # The most recent, as the docstring says: without an order this was
        # whichever row the database returned first.
        res = (
            client.table("user_paths")
            .select("payload")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if rows:
            return rows[0]["payload"]
    except Exception as e:
        print(f"[onboarding] user_paths lookup by user skipped: {e}")
    return None


class RecommendationSupportContext(BaseModel):
    """Non-clinical support signals allowed into recommendation agents.

    Diagnosis status, subtype, and medication history are intentionally absent.
    """

    conditionSupportNotes: List[str] = Field(default_factory=list, max_length=20)
    therapyTypes: str = Field(default="", max_length=1000)
    sensoryNeeds: str = Field(default="", max_length=1000)
    strategiesWorked: str = Field(default="", max_length=1000)
    strategiesNotWorked: str = Field(default="", max_length=1000)
    schoolAccommodations: str = Field(default="", max_length=1000)
    workplaceAccommodations: str = Field(default="", max_length=1000)
    biggestChallenge: str = Field(default="", max_length=1000)
    biggestChallengeResponse: str = Field(default="", max_length=1000)
    recentChallenge: str = Field(default="", max_length=1000)
    recentChallengeResponse: str = Field(default="", max_length=1000)
    # How steps are written for them, from the optional personality
    # statements (frontend/lib/personality.ts, workingStyleFor).
    workingStyle: str = Field(default="", max_length=1000)
    # How they communicate (speaking, some speech, non-speaking), as a
    # sentence (frontend/lib/diagnostic-profile.ts, communicationSentence).
    communication: str = Field(default="", max_length=300)


PERSONALITY_TRAITS = ("extraversion", "agreeableness", "conscientiousness", "neuroticism", "openness")
PERSONALITY_BANDS = ("low", "middle", "high")


def clean_personality(value) -> dict:
    """The Big Five bands someone chose to give (frontend/lib/personality.ts):
    only the five traits and the three bands; anything else is dropped."""
    if not isinstance(value, dict):
        return {}
    return {t: value[t] for t in PERSONALITY_TRAITS if value.get(t) in PERSONALITY_BANDS}


class OnboardingRequest(BaseModel):
    # Accepted from the app, never stored: the caller chooses it, so it can't
    # stand for who they are (bug audit, 17 November 2026, item 10).
    email: Optional[str] = None
    userId: Optional[str] = None  # Supabase auth.users UUID (shared with ServiceHub)
    demographics: Optional[dict] = None
    barrierTypes: List[str] = []  # can be empty — user may have no barriers
    motivationType: str
    goals: List[str]
    dreams: List[str] = []
    currentChallenges: List[str] = []
    supportContext: Optional[RecommendationSupportContext] = None
    # View & interaction preferences (age range, tech savvy, view style). Optional
    # so older clients keep working. Recorded to learn from intersecting profiles.
    preferences: Optional[dict] = None
    # Which model runs the agents, and how hard it thinks. Optional: absent or
    # unrecognised values fall back to the server default.
    llmConfig: Optional[dict] = None
    # "Who are you here for?" (frontend/lib/audiences.ts). The planner writes a
    # parent's plan about supporting their child, not about the parent's own
    # career (Riipen Labs, Group 24). Optional, so older clients keep working.
    audience: Optional[str] = Field(default=None, max_length=20)
    # "Words we use" in Settings (frontend/lib/languageStyle.ts): "identity" or
    # "person", how the agents write about autism and ADHD (Riipen Labs,
    # Group 15). Optional; anything else is ignored.
    languageStyle: Optional[str] = Field(default=None, max_length=10)
    # Optional personality bands (Big Five: low, middle, high), from the
    # profile's personality statements. Pattern Recognition matches on them
    # with the norms; the planner gets them as supportContext.workingStyle.
    personality: Optional[dict] = None
    # The life area each goal was written under in setup ({goal: area}), so
    # the Race view shows a goal under its own area only (the team's notes,
    # October 2026). Kept as userProfile.goalCategories.
    goalCategories: Optional[Dict[str, str]] = None
    # Steps picked from a Path Market model, per goal ({goal: [step, ...]}):
    # the planner uses them as milestones where they fit (the team's notes,
    # October 2026: "smaller suggestions for milestones").
    stepIdeas: Optional[Dict[str, List[str]]] = None


GOAL_AREAS = ("education", "career", "relationships", "health", "barrier", "other")


def clean_step_ideas(value: Any, goals: List[str]) -> Dict[str, List[str]]:
    """Up to 8 short step ideas for each of the plan's goals; anything else is dropped."""
    if not isinstance(value, dict):
        return {}
    wanted = {str(g).strip().lower(): g for g in goals if isinstance(g, str)}
    out: Dict[str, List[str]] = {}
    for goal, steps in value.items():
        g = wanted.get(str(goal).strip().lower())
        if g is None or not isinstance(steps, list):
            continue
        kept: List[str] = []
        for step in steps:
            text = " ".join(str(step or "").split())[:120]
            if text and text.lower() not in {k.lower() for k in kept}:
                kept.append(text)
        if kept:
            out[g] = kept[:8]
    return out


def clean_goal_categories(value: Any, goals: List[str]) -> Dict[str, str]:
    """Each of the plan's goals with a known area; anything else is dropped."""
    if not isinstance(value, dict):
        return {}
    wanted = {str(g).strip().lower(): g for g in goals if isinstance(g, str)}
    out: Dict[str, str] = {}
    for goal, area in value.items():
        g = wanted.get(str(goal).strip().lower())
        if g is not None and area in GOAL_AREAS:
            out[g] = area
    return out


NO_ANSWER = "prefer not to share"


def _ensure_profile_row(client, user_id: str) -> None:
    """Make sure the person has a profiles row (user_barriers points at it),
    without changing one that exists.

    profiles.email is never written here. It was set from the email in the
    request body, which the caller chooses, and the apps use that column to
    find people and to send reminders (bug audit, 17 November 2026, item 10).
    It follows the sign-in email in the database itself (STEP 105).
    """
    client.table("profiles").upsert({"id": user_id}, on_conflict="id", ignore_duplicates=True).execute()


def _persist_barriers_to_supabase(user_id: str, barrier_types: List[str]) -> None:
    """Add the norms from setup to the shared public.user_barriers table.

    Only adds. It used to delete every norm the person had and write the new
    list, so making a new plan without answering the norms question replaced
    norms added since, in ResourceHub or the app, with "Prefer not to share",
    and lost their severity and any confirmation by an organisation. Setup no
    longer asks about norms at all (Riipen Labs, Groups 25 to 30: optional
    questions move into the app), which would have done that on every new
    plan. Norms are removed where they are shown, in ResourceHub's profile.

    "Prefer not to share" stands for no answer: it is added only when the
    person has no norms, and the placeholder goes once a real norm is added.

    No-op when Supabase isn't configured. Failures are swallowed so onboarding
    never breaks if the shared DB is unreachable.
    """
    client = get_supabase()
    if client is None or not user_id:
        return
    try:
        # Ensure a profile row exists (FK target for user_barriers)
        _ensure_profile_row(client, user_id)

        existing = getattr(client.table("user_barriers").select("id, barrier_type").eq("user_id", user_id).execute(), "data", None) or []
        have = {str(r.get("barrier_type") or "").strip().casefold() for r in existing}
        wanted: List[str] = []
        for b in barrier_types or []:
            name = str(b or "").strip()
            if name and name.casefold() not in {w.casefold() for w in wanted}:
                wanted.append(name)
        real = [b for b in wanted if b.casefold() != NO_ANSWER]
        if real:
            to_add = [b for b in real if b.casefold() not in have]
            # A real answer replaces the "no answer" placeholder, and nothing else.
            for r in existing:
                if str(r.get("barrier_type") or "").strip().casefold() == NO_ANSWER and r.get("id"):
                    client.table("user_barriers").delete().eq("id", r["id"]).execute()
        else:
            to_add = [b for b in wanted if not have]
        rows = [
            {
                "user_id": user_id,
                "barrier_category": "general",
                "barrier_type": b,
                "severity": 3,
            }
            for b in to_add
        ]
        if rows:
            client.table("user_barriers").insert(rows).execute()
    except Exception as e:
        print(f"[onboarding] Supabase barrier sync skipped: {e}")


# Setup's own answers about the plan it makes. Everything else in
# profiles.preferences belongs to the rest of the app.
SETUP_OWNED_PREFERENCES = {"pathModel", "ageRange"}


def _persist_preferences_to_supabase(user_id: str, preferences: Optional[dict]) -> None:
    """Store setup's view/interaction preferences on the shared profiles row.

    Merges into profiles.preferences (JSON). It used to write setup's object
    over the whole column, so making a second plan reset everything the
    person had set since: email and check-in choices, a paused account,
    spirit animals, their character, Dream Self goals, notes about people,
    ticked plan tasks. Now setup's own keys (SETUP_OWNED_PREFERENCES) are
    updated, an empty age band never erases one, and any other key is only
    filled in when the person has nothing saved for it, so a page still
    sending setup's old defaults cannot reset a choice made since.

    Never profiles.email (see _ensure_profile_row).

    No-op when Supabase isn't configured or preferences are empty. Failures
    are swallowed.
    """
    client = get_supabase()
    if client is None or not user_id or not preferences:
        return
    try:
        rows = getattr(client.table("profiles").select("preferences").eq("id", user_id).limit(1).execute(), "data", None) or []
        current = rows[0].get("preferences") if rows else None
        if isinstance(current, str):
            try:
                current = json.loads(current)
            except ValueError:
                current = None
        current = current if isinstance(current, dict) else {}
        merged = dict(current)
        for key, value in preferences.items():
            if key == "ageRange":
                if value:
                    merged[key] = value
            elif key in SETUP_OWNED_PREFERENCES:
                merged[key] = value
            elif key not in current:
                merged[key] = value
        client.table("profiles").upsert(
            {
                "id": user_id,
                "preferences": merged,
            },
            on_conflict="id",
        ).execute()
    except Exception as e:
        print(f"[onboarding] Supabase preferences sync skipped: {e}")


class OnboardingResponse(BaseModel):
    userId: str
    pathId: str
    message: str


async def _generate_path_for(
    request: "OnboardingRequest",
    job_id: Optional[str] = None,
    actor: Optional[str] = None,
    on_stage: Optional[Callable[[str], None]] = None,
) -> str:
    """Run the full pipeline and persist the path. Returns the path id.

    Shared by the synchronous endpoint, the async job worker and the run on the
    person's own device (api/routes/device.py) so they can never drift — the
    only difference is who waits for it.

    The database calls here run in worker threads (asyncio.to_thread):
    supabase-py is synchronous, and on the event loop each one held every
    other request on the server while it waited (bug audit, 17 November
    2026, item 34).
    """
    async def _stage(label: str) -> None:
        if job_id:
            await asyncio.to_thread(jobs.set_stage, job_id, label)
        if on_stage:
            on_stage(label)

    user_id = request.userId or f"user_{uuid.uuid4().hex[:8]}"
    path_id = f"path_{uuid.uuid4().hex[:8]}"

    # --- INPUT GUARDRAILS ---
    is_valid, rejection = validate_all_inputs(
        goals=request.goals,
        barriers=request.barrierTypes,
        dreams=request.dreams,
        challenges=request.currentChallenges,
    )
    if not is_valid:
        raise HTTPException(status_code=422, detail=rejection)

    # Sync barriers to the shared Supabase table so ServiceHub picks them up
    await asyncio.to_thread(_persist_barriers_to_supabase, user_id, request.barrierTypes)
    # Record view/interaction preferences for intersecting-profile insights
    await asyncio.to_thread(_persist_preferences_to_supabase, user_id, request.preferences)

    # Build user profile from onboarding data. No email: the one in the
    # request is whatever the caller sent (item 10), and nothing reads it here.
    user_profile = {
        "id": user_id,
        "demographics": request.demographics or {},
        "barrierTypes": request.barrierTypes,
        "motivationType": request.motivationType,
        "goals": request.goals,
        "goalCategories": clean_goal_categories(request.goalCategories, request.goals),
        "stepIdeas": clean_step_ideas(request.stepIdeas, request.goals),
        "dreams": request.dreams,
        "currentChallenges": request.currentChallenges,
        "supportContext": request.supportContext.model_dump() if request.supportContext else {},
        "personality": clean_personality(request.personality),
        # Unknown answers read as planning for themselves (core/agents/path_planning_agent.py).
        "audience": (request.audience or "").strip().lower() or None,
        # Carried so the app can render the user's own choices (spirit animals,
        # view style) from the stored path rather than a hardcoded default.
        "preferences": request.preferences or {},
        "createdAt": datetime.utcnow().isoformat()
    }

    # --- AGENT ORCHESTRATION ---
    # Import and invoke the multi-agent orchestrator. Imported in a worker
    # thread: the first time, it loads LangGraph and all six agents, which
    # the server no longer does at startup (main.py, _LazyOrchestrator).
    Orchestrator = (await asyncio.to_thread(importlib.import_module, "core.orchestrator")).Orchestrator

    await _stage("Starting the agents")
    orchestrator = Orchestrator()
    await orchestrator.initialize()

    # Load this user's cross-session memory so agents build on past plans
    user_memory = await asyncio.to_thread(mem.load_user_memory, user_id)

    # Spend is charged to the verified session when there is one. Falling back
    # to the request id keeps signed-out onboarding working, but only a
    # verified id is written to the ledger — an unverified one would let a
    # caller bill their spend to someone else's account.
    with llm.use_selection(
        llm.parse_selection(request.llmConfig),
        actor=actor or user_id,
        verified=actor is not None,
        # "Words we use" in Settings (Riipen Labs, Group 15): identity-first
        # or person-first, for every text the agents write about this person.
        language_style=request.languageStyle,
    ):
        # Run the 6-agent pipeline: Pattern → Path → Tools → Calendar → Synthesis
        await _stage("Mapping out your milestones")
        agent_result = await orchestrator.generate_path(
            user_profile=user_profile,
            goals=request.goals,
            barriers=request.barrierTypes,
            memory=user_memory,
            user_id=user_id,
        )

        # Index this user in the vector DB so future users get matched to them
        await _stage("Matching resources to your goals")
        await orchestrator.index_user(
            user_id=user_id,
            user_profile=user_profile,
            goals=request.goals,
            barriers=request.barrierTypes,
            agent_result=agent_result,
        )

    await orchestrator.cleanup()

    # Append this run to the user's persistent agent memory
    await asyncio.to_thread(
        mem.record_run,
        user_id=user_id,
        kind="generation",
        user_profile=user_profile,
        goals=request.goals,
        barriers=request.barrierTypes,
        agent_result=agent_result,
    )

    # Store the generated path (cache + Supabase user_paths). Raises when it
    # isn't saved, so the job is marked failed.
    payload = {
        "id": path_id,
        "userId": user_id,
        "userProfile": user_profile,
        "generatedAt": datetime.utcnow().isoformat(),
        **agent_result,
    }
    await _stage("Saving your path")
    await asyncio.to_thread(_save_path, path_id, user_id, payload)
    return path_id


@router.post("/", response_model=OnboardingResponse)
async def create_onboarding(
    request: OnboardingRequest,
    actor: str = Depends(onboarding_user_id),
):
    """
    Create user profile, run agent orchestration, and generate personalized path.
    This is the main entry point that connects onboarding → multi-agent system → path.
    """
    if request.userId and request.userId != actor:
        raise HTTPException(status_code=403, detail="Cannot create another account's path.")
    request.userId = actor
    # A generation already under way for this person (typically a /jobs
    # request that the browser gave up on while the server woke, then retried
    # here): wait for it instead of starting a second beside it, which would
    # meet the per-minute AI limit and fail (core/jobs.py, in_flight_for_user).
    running = await asyncio.to_thread(lambda: jobs.in_flight_for_user(actor) if jobs.enabled() else None)
    if running:
        path_id = await _wait_for_job(str(running.get("id")))
        return OnboardingResponse(
            userId=actor,
            pathId=path_id,
            message="Path generated by AI agents successfully",
        )
    try:
        path_id = await asyncio.wait_for(_generate_path_for(request, actor=actor), GENERATION_DEADLINE_SECONDS)
        return OnboardingResponse(
            userId=request.userId or "",
            pathId=path_id,
            message="Path generated by AI agents successfully",
        )
    except HTTPException:
        # A guardrail's 422 keeps its words, which can be the crisis lines.
        # The handler below turned it into a 500, and the app showed
        # "Your path couldn't be made" instead (bug audit, 17 November 2026,
        # item 17).
        raise
    except budget.LimitExceeded as e:
        raise HTTPException(status_code=429, detail=e.message)
    except asyncio.TimeoutError:
        print(f"[onboarding] generation passed its deadline ({GENERATION_DEADLINE_SECONDS:.0f} s)")
        raise HTTPException(status_code=504, detail=jobs.INTERNAL_ERROR)
    except Exception as e:
        # Full detail to the logs, a plain sentence to the person.
        print(f"[onboarding] generation failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=jobs.INTERNAL_ERROR)


class JobAccepted(BaseModel):
    jobId: str
    userId: str
    status: str


class JobStatus(BaseModel):
    jobId: str
    status: str
    stage: Optional[str] = None
    pathId: Optional[str] = None
    error: Optional[str] = None
    # Why it failed (core/jobs.py, ERROR_KINDS): for "guardrail" and "limit",
    # `error` is written for the person and is shown as it is; for
    # "internal" it's a plain sentence. None until it fails.
    errorKind: Optional[Literal["guardrail", "limit", "internal"]] = None


def _job_status(row: Dict[str, Any]) -> JobStatus:
    kind, error = jobs.failure(row)
    return JobStatus(
        jobId=str(row.get("id")),
        status=row.get("status") or "queued",
        stage=row.get("stage"),
        pathId=row.get("path_id"),
        error=error,
        errorKind=kind,
    )


# How each kind of failure is answered over HTTP: the app shows the words of a
# 422 and a 429 (frontend/app/onboarding/page.tsx, submitErrorMessage).
_FAILURE_STATUS = {"guardrail": 422, "limit": 429, "internal": 500}


async def _wait_for_job(job_id: str, timeout_s: float = 360.0) -> str:
    """Wait for a queued or running generation, and return its path id."""
    deadline = asyncio.get_running_loop().time() + timeout_s
    while asyncio.get_running_loop().time() < deadline:
        row = await asyncio.to_thread(jobs.get, job_id) or {}
        if row.get("status") == "succeeded" and row.get("path_id"):
            return str(row["path_id"])
        if row.get("status") == "failed":
            kind, error = jobs.failure(row)
            raise HTTPException(status_code=_FAILURE_STATUS.get(kind, 500), detail=error)
        await asyncio.sleep(2)
    raise HTTPException(status_code=504, detail="Path generation is taking longer than expected. Please try again.")


async def _run_job(
    job_id: str,
    request: "OnboardingRequest",
    actor: Optional[str] = None,
) -> None:
    """Background worker. Never raises — a job failure is data, not a crash.

    Each failure is recorded with its kind (core/jobs.py, ERROR_KINDS), so
    the page can show a guardrail's words, the crisis lines among them, as
    they are.
    """
    await asyncio.to_thread(jobs.mark_running, job_id)
    try:
        path_id = await asyncio.wait_for(
            _generate_path_for(request, job_id=job_id, actor=actor), GENERATION_DEADLINE_SECONDS)
    except HTTPException as e:
        if 400 <= e.status_code < 500:
            # Guardrail rejections carry a message meant for the user.
            await asyncio.to_thread(jobs.mark_failed, job_id, str(e.detail), "guardrail")
        else:
            print(f"[jobs] job {job_id} failed: HTTP {e.status_code}: {e.detail}")
            await asyncio.to_thread(jobs.mark_failed, job_id, None, "internal")
        return
    except budget.LimitExceeded as e:
        await asyncio.to_thread(jobs.mark_failed, job_id, e.message, "limit")
        return
    except asyncio.TimeoutError:
        print(f"[jobs] job {job_id} stopped at its deadline ({GENERATION_DEADLINE_SECONDS:.0f} s)")
        await asyncio.to_thread(jobs.mark_failed, job_id, jobs.DEADLINE_REASON, "internal")
        return
    except Exception as e:
        # Full detail to the logs, a usable sentence to the client.
        print(f"[jobs] job {job_id} failed: {type(e).__name__}: {e}")
        await asyncio.to_thread(jobs.mark_failed, job_id, None, "internal")
        return
    await asyncio.to_thread(jobs.mark_succeeded, job_id, path_id)


@router.post("/jobs", response_model=JobAccepted, status_code=202)
async def enqueue_onboarding(
    request: OnboardingRequest,
    actor: str = Depends(onboarding_user_id),
):
    """Start a generation and return immediately.

    The synchronous endpoint still works and is unchanged, but it holds a
    connection for the length of the run — ~55s alone, ~160s at five
    concurrent — which is what caps how many people can onboard at once. Here
    the request returns in milliseconds and the work continues server-side, so
    concurrency is bounded by what the box can process rather than by how long
    a browser is willing to wait. A client that reloads or drops off can find
    its job again instead of losing the work.
    """
    if request.userId and request.userId != actor:
        raise HTTPException(status_code=403, detail="Cannot create another account's path.")
    request.userId = actor
    if not jobs.enabled():
        raise HTTPException(
            status_code=503,
            detail="Job store unavailable. Use POST /api/onboarding/ instead.",
        )

    user_id = request.userId or f"user_{uuid.uuid4().hex[:8]}"

    def start():
        """The job store's part, in a worker thread (supabase-py is synchronous)."""
        # Opportunistic cleanup: a restart mid-run would otherwise leave a job
        # 'running' forever with a spinner and nothing behind it.
        jobs.reap_stale()

        # One generation per person at a time: a repeat (a retry, a reload, or a
        # request that timed out while the server woke) gets the one already
        # under way, so the browser polls it (core/jobs.py, in_flight_for_user).
        running = jobs.in_flight_for_user(user_id)
        if running:
            return running, None
        # The request is kept with the job, without the email it carries (item 10).
        return None, jobs.create(user_id, request.model_dump(exclude={"email"}))

    running, job_id = await asyncio.to_thread(start)
    if running:
        return JobAccepted(jobId=str(running.get("id")), userId=user_id, status=running.get("status") or "queued")
    if not job_id:
        raise HTTPException(status_code=503, detail="Could not queue the job")

    # Detached so the response is not waiting on it. Held in a module-level set
    # because asyncio only keeps a weak reference to tasks — without this the
    # garbage collector can cancel a running generation mid-flight.
    task = asyncio.create_task(_run_job(job_id, request, actor=actor))
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)

    return JobAccepted(jobId=job_id, userId=user_id, status="queued")


@router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job(job_id: str, caller_id: str = Depends(current_user_id)):
    """Poll a generation. Terminal states carry either pathId or error.

    Only for the person whose job it is, or their guardian, as for
    /jobs/latest: a job's error can be the crisis message shown when a goal
    mentions self-harm. Anyone else gets the same 404 as for a job that
    doesn't exist.

    A failed job says why in errorKind (JobStatus).
    """
    row = await asyncio.to_thread(jobs.get, job_id)
    try:
        if not row:
            raise HTTPException(status_code=404)
        await asyncio.to_thread(require_self_or_guardian, str(row.get("user_id") or ""), caller_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_status(row)


@router.get("/jobs/latest/{user_id}", response_model=Optional[JobStatus])
async def get_latest_job(user_id: str, caller_id: str = Depends(current_user_id)):
    """The user's most recent job — how a reloaded page reattaches to its work.

    Only for the person, or their guardian: a job's error can be the crisis
    message shown when a goal mentions self-harm.
    """
    await asyncio.to_thread(require_self_or_guardian, user_id, caller_id)
    row = await asyncio.to_thread(jobs.latest_for_user, user_id)
    if not row:
        return None
    return _job_status(row)


class UpdateOnboardingRequest(BaseModel):
    email: Optional[str] = None
    demographics: Optional[dict] = None
    barrierTypes: Optional[List[str]] = None
    motivationType: Optional[str] = None
    goals: Optional[List[str]] = None
    dreams: Optional[List[str]] = None
    currentChallenges: Optional[List[str]] = None
    # Optional progress signal so the Adaptation Agent can react meaningfully
    completionRate: Optional[float] = None
    reflectionText: Optional[str] = None


@router.patch("/{user_id}", response_model=OnboardingResponse)
async def update_onboarding(
    user_id: str,
    request: UpdateOnboardingRequest,
    # The same gate as generating a plan (age, guardian approval): this can
    # run a whole new generation.
    caller_id: str = Depends(onboarding_user_id),
):
    """
    Update onboarding answers for an existing user and evolve their path
    via the Adaptation Agent rather than regenerating from scratch.

    If the user has no prior path, falls back to a fresh generation.
    """
    # It had no check: anyone could rewrite anyone's answers, conditions,
    # profile email, vector and path by naming their account id.
    await asyncio.to_thread(require_self_or_guardian, user_id, caller_id)

    try:
        prior = await asyncio.to_thread(_load_path_by_user, user_id)
        prior_profile: Dict[str, Any] = (prior or {}).get("userProfile", {}) if prior else {}

        # Merge new onboarding answers over the prior profile. Not the email
        # in the request: the caller chooses it (item 10).
        merged_profile = {
            "id": user_id,
            "demographics":request.demographics if request.demographics is not None else prior_profile.get("demographics", {}),
            "barrierTypes": request.barrierTypes if request.barrierTypes is not None else prior_profile.get("barrierTypes", []),
            "motivationType": request.motivationType or prior_profile.get("motivationType", ""),
            "goals": request.goals if request.goals is not None else prior_profile.get("goals", []),
            "dreams": request.dreams if request.dreams is not None else prior_profile.get("dreams", []),
            "currentChallenges": request.currentChallenges if request.currentChallenges is not None else prior_profile.get("currentChallenges", []),
            "updatedAt": datetime.utcnow().isoformat(),
        }

        # --- INPUT GUARDRAILS ---
        is_valid, rejection = validate_all_inputs(
            goals=merged_profile["goals"],
            barriers=merged_profile["barrierTypes"],
            dreams=merged_profile["dreams"],
            challenges=merged_profile["currentChallenges"],
        )
        if not is_valid:
            raise HTTPException(status_code=422, detail=rejection)

        # Sync barriers to Supabase if they changed
        if request.barrierTypes is not None:
            await asyncio.to_thread(_persist_barriers_to_supabase, user_id, merged_profile["barrierTypes"])

        from core.orchestrator import Orchestrator
        orchestrator = Orchestrator()
        await orchestrator.initialize()

        # No prior path → cold start
        if not prior:
            user_memory = await asyncio.to_thread(mem.load_user_memory, user_id)
            agent_result = await orchestrator.generate_path(
                user_profile=merged_profile,
                goals=merged_profile["goals"],
                barriers=merged_profile["barrierTypes"],
                memory=user_memory,
                user_id=user_id,
            )
            new_path_id = f"path_{uuid.uuid4().hex[:8]}"
            await orchestrator.index_user(
                user_id=user_id,
                user_profile=merged_profile,
                goals=merged_profile["goals"],
                barriers=merged_profile["barrierTypes"],
                agent_result=agent_result,
            )
            await orchestrator.cleanup()
            await asyncio.to_thread(
                mem.record_run,
                user_id=user_id,
                kind="generation",
                user_profile=merged_profile,
                goals=merged_profile["goals"],
                barriers=merged_profile["barrierTypes"],
                agent_result=agent_result,
            )
            payload = {
                "id": new_path_id,
                "userId": user_id,
                "userProfile": merged_profile,
                "generatedAt": datetime.utcnow().isoformat(),
                **agent_result,
            }
            await asyncio.to_thread(_save_path, new_path_id, user_id, payload)
            return OnboardingResponse(
                userId=user_id,
                pathId=new_path_id,
                message="No prior path — generated fresh plan",
            )

        # Prior path exists → run Adaptation Agent over it
        prior_path_id = prior.get("id") or f"path_{uuid.uuid4().hex[:8]}"
        reflection_data = {
            "user_profile": merged_profile,
            "freeFormText": request.reflectionText or "User updated onboarding answers.",
            "questions": [
                {"question": "Updated goals", "answer": ", ".join(merged_profile["goals"])},
                {"question": "Updated barriers", "answer": ", ".join(merged_profile["barrierTypes"])},
                {"question": "Updated challenges", "answer": ", ".join(merged_profile["currentChallenges"])},
            ],
        }

        adaptation_result = await orchestrator.adapt_path(
            user_id=user_id,
            path_id=prior_path_id,
            reflection_data=reflection_data,
        )

        # Re-index with the real progress signal so similarity matches improve
        await orchestrator.index_user(
            user_id=user_id,
            user_profile=merged_profile,
            goals=merged_profile["goals"],
            barriers=merged_profile["barrierTypes"],
            agent_result=adaptation_result,
            success_rate=request.completionRate if request.completionRate is not None else 0.5,
        )

        await orchestrator.cleanup()

        # Append this adaptation to the user's persistent agent memory
        await asyncio.to_thread(
            mem.record_run,
            user_id=user_id,
            kind="adaptation",
            user_profile=merged_profile,
            goals=merged_profile["goals"],
            barriers=merged_profile["barrierTypes"],
            agent_result=adaptation_result,
        )

        # Merge adaptation output into the stored path
        updated_payload = dict(prior)
        updated_payload["userProfile"] = merged_profile
        updated_payload["updatedAt"] = datetime.utcnow().isoformat()
        updated_payload["lastAdaptation"] = adaptation_result

        # Apply updated milestones/tasks where the app reads them, and only for
        # milestones this path has (core/path_storage.py). They used to be
        # written to top-level "milestones"/"tasks": nothing reads tasks there,
        # and two pages read milestones there first, so the adaptation agent's
        # placeholder output ('updated_milestone_1') would have replaced the plan.
        updated_payload, applied = apply_adaptation(
            updated_payload,
            adaptation_result.get("updated_milestones") or [],
            adaptation_result.get("updated_tasks") or [],
        )
        if applied["ignored"]:
            print(f"[onboarding] adaptation: ignored {applied['ignored']} update(s) for milestones not in this path")

        await asyncio.to_thread(_save_path, prior_path_id, user_id, updated_payload)

        return OnboardingResponse(
            userId=user_id,
            pathId=prior_path_id,
            message="Path adapted to updated onboarding answers",
        )

    except HTTPException:
        # A guardrail's 422 keeps its words (the crisis lines among them), as
        # in create_onboarding (item 17).
        raise
    except Exception as e:
        print(f"[onboarding] adaptation failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=jobs.INTERNAL_ERROR)


@router.get("/path/{path_id}")
async def get_generated_path(path_id: str, caller_id: str = Depends(current_user_id)):
    """
    Retrieve the AI-generated path data after onboarding, from Supabase
    user_paths (_load_path_by_id).

    Only for the path's owner, or their guardian. It had no check, so anyone
    holding a path id could read the whole payload.
    """
    payload = await asyncio.to_thread(_load_path_by_id, path_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Path not found.")
    owner = str(payload.get("userId") or "")
    if not owner:
        raise HTTPException(status_code=404, detail="Path not found.")
    await asyncio.to_thread(require_self_or_guardian, owner, caller_id)
    return without_other_people(payload)


@router.get("/user/{user_id}/path")
async def get_user_path(user_id: str, caller_id: str = Depends(current_user_id)):
    """Retrieve the current path for a user (from Supabase user_paths).

    Requires a valid session, and that the caller is the user or their
    guardian. This endpoint previously had no auth at all and returned the
    full profile — barrierTypes and email included — to anyone holding a
    UUID.
    """
    await asyncio.to_thread(require_self_or_guardian, user_id, caller_id)
    payload = await asyncio.to_thread(_load_path_by_user, user_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="No path found for user.")
    return without_other_people(payload)


@router.get("/user/{user_id}/paths")
async def list_user_paths(user_id: str, caller_id: str = Depends(current_user_id)):
    """List all of a user's saved paths (metadata only) for the multi-path
    switcher / compare views. Returns a lightweight summary per path so the
    client can render a list without downloading every full payload."""
    await asyncio.to_thread(require_self_or_guardian, user_id, caller_id)
    rows = await asyncio.to_thread(_list_paths_by_user, user_id)
    summaries = []
    for row in rows:
        payload = row.get("payload") or {}
        races = payload.get("races") or []
        progresses = [r.get("progress", 0) or 0 for r in races]
        overall = round(sum(progresses) / len(progresses)) if progresses else 0
        summaries.append(
            {
                "pathId": row.get("path_id"),
                "label": row.get("label")
                or payload.get("userProfile", {}).get("ultimateDream")
                or "My Path",
                "isActive": bool(row.get("is_active", False)),
                "generatedAt": payload.get("generatedAt") or row.get("created_at"),
                "updatedAt": row.get("updated_at"),
                "ultimateDream": payload.get("userProfile", {}).get("ultimateDream"),
                "raceCount": len(races),
                "overallProgress": overall,
            }
        )
    return {"paths": summaries}


@router.post("/user/{user_id}/paths/{path_id}/activate")
async def activate_user_path(user_id: str, path_id: str, caller_id: str = Depends(current_user_id)):
    """Switch which path is active for the user (only to one of theirs)."""
    await asyncio.to_thread(require_self_or_guardian, user_id, caller_id)
    if not await asyncio.to_thread(_set_active_path, user_id, path_id):
        raise HTTPException(status_code=400, detail="Could not activate path.")
    return {"pathId": path_id, "isActive": True}


@router.delete("/user/{user_id}/paths/{path_id}")
async def delete_user_path(user_id: str, path_id: str, caller_id: str = Depends(current_user_id)):
    """Delete one of a user's paths."""
    await asyncio.to_thread(require_self_or_guardian, user_id, caller_id)
    if not await asyncio.to_thread(_delete_path, user_id, path_id):
        raise HTTPException(status_code=400, detail="Could not delete path.")
    return {"pathId": path_id, "deleted": True}


class GoalIdea(BaseModel):
    category: str
    text: str


class GoalHelperRequest(BaseModel):
    text: str = ""
    audience: Optional[str] = None
    # The goal ideas setup shows this person; suggestions come only from these
    # (plus one goal in their own words). core/goal_helper.py checks them.
    ideas: List[GoalIdea] = Field(default_factory=list)


@router.post("/goal-helper")
async def goal_helper(request: GoalHelperRequest, actor: str = Depends(onboarding_user_id)):
    """The optional AI goal helper on setup's goal step (Riipen Labs, Group 11)."""
    from core import goal_helper as helper
    audience = request.audience if isinstance(request.audience, str) else None
    try:
        return await helper.suggest(request.text, request.ideas[:helper.MAX_IDEAS],
                                    (audience or "")[:60] or None, actor)
    except budget.LimitExceeded as e:
        raise HTTPException(status_code=429, detail=e.message)


class AgentSetupRequest(BaseModel):
    text: str = ""


@router.post("/agent-setup")
async def agent_setup(request: AgentSetupRequest, actor: str = Depends(onboarding_user_id)):
    """My agents' "Tell Autinerary what you need": what each built-in agent will do for them, and a 7th agent drafted
    for the rest (core/agent_setup.py). Nothing is saved here."""
    from core import agent_setup as setup
    try:
        return await setup.set_up(request.text, actor)
    except budget.LimitExceeded as e:
        raise HTTPException(status_code=429, detail=e.message)


@router.get("/questions")
async def get_onboarding_questions():
    """
    Get onboarding questionnaire
    """
    return {
        "questions": [
            {
                "id": "q1",
                "question": "What types of systematic barriers do you face?",
                "type": "multiple_choice",
                "options": [
                    "Autism",
                    "ADHD",
                    "OCD",
                    "Bipolar Disorder",
                    "Sensory Impairment",
                    "Physical Impairment",
                    "Visible Minority",
                    "Other"
                ]
            },
            {
                "id": "q2",
                "question": "What are your main goals?",
                "type": "text",
                "placeholder": "Describe your goals..."
            },
            {
                "id": "q3",
                "question": "What are your dreams?",
                "type": "text",
                "placeholder": "Describe your dreams..."
            },
            {
                "id": "q4",
                "question": "What are the main things stopping you from your dreams?",
                "type": "text",
                "placeholder": "Describe your challenges..."
            },
            {
                "id": "q5",
                "question": "What type of motivation works best for you?",
                "type": "single_choice",
                "options": [
                    "Intrinsic (internal drive)",
                    "Extrinsic (external rewards)",
                    "Achievement-based",
                    "Social connection",
                    "Fear-based",
                    "Reward-based"
                ]
            }
        ]
    }
