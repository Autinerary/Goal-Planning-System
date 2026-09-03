"""
Onboarding API Routes
Step 0: Questionnaire → Agent Orchestration → Path Generation
"""

import asyncio

from fastapi import APIRouter, Depends, HTTPException

from api.auth_guard import current_user_id, require_self_or_guardian
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import httpx
import os
import uuid
from datetime import datetime

from database.supabase_client import get_supabase
from core import memory as mem
from core.guardrails import validate_all_inputs
from core import jobs

router = APIRouter()

# asyncio holds only weak references to tasks, so a detached generation can be
# garbage-collected mid-run. Keeping a strong reference until completion is
# what stops that.
_BACKGROUND_TASKS: set = set()

SERVICE_HUB_URL = os.getenv("SERVICE_HUB_URL", "http://localhost:3001")

# In-memory cache for generated paths (write-through to Supabase user_paths).
# Acts as a fast lookup; Supabase is the source of truth.
generated_paths: Dict[str, Any] = {}


def _save_path(path_id: str, user_id: str, payload: Dict[str, Any], label: Optional[str] = None) -> None:
    """Cache locally and upsert to Supabase user_paths (no-op if unavailable).

    Multi-path aware: a newly generated path becomes the active one and any
    other paths for the same user are deactivated. Upserts on (user_id,
    path_id) so existing paths are kept rather than overwritten.
    """
    generated_paths[path_id] = payload
    if not user_id:
        return
    client = get_supabase()
    if client is None:
        return
    try:
        # Deactivate the user's other paths so exactly one stays active.
        try:
            client.table("user_paths").update({"is_active": False}).eq(
                "user_id", user_id
            ).execute()
        except Exception:
            pass  # is_active column may not exist yet (pre-migration) — ignore

        row: Dict[str, Any] = {
            "user_id": user_id,
            "path_id": path_id,
            "payload": payload,
            "updated_at": datetime.utcnow().isoformat(),
        }
        # Only send new columns when we have values; tolerate pre-migration DBs.
        row["is_active"] = True
        if label is not None:
            row["label"] = label
        try:
            client.table("user_paths").upsert(row, on_conflict="user_id,path_id").execute()
        except Exception:
            # Fallback for pre-migration schema (user_id PK, no is_active/label).
            legacy = {k: v for k, v in row.items() if k not in ("is_active", "label")}
            client.table("user_paths").upsert(legacy, on_conflict="user_id").execute()
    except Exception as e:
        print(f"[onboarding] user_paths upsert skipped: {e}")


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
    """Mark one path active for the user, deactivating the rest."""
    if not user_id or not path_id:
        return False
    client = get_supabase()
    if client is None:
        return False
    try:
        client.table("user_paths").update({"is_active": False}).eq("user_id", user_id).execute()
        client.table("user_paths").update({"is_active": True}).eq("user_id", user_id).eq(
            "path_id", path_id
        ).execute()
        return True
    except Exception as e:
        print(f"[onboarding] set active path skipped: {e}")
        return False


def _delete_path(user_id: str, path_id: str) -> bool:
    """Delete a single path for the user."""
    generated_paths.pop(path_id, None)
    client = get_supabase()
    if client is None:
        return False
    try:
        client.table("user_paths").delete().eq("user_id", user_id).eq(
            "path_id", path_id
        ).execute()
        return True
    except Exception as e:
        print(f"[onboarding] delete path skipped: {e}")
        return False


def _load_path_by_id(path_id: str) -> Optional[Dict[str, Any]]:
    """Look up a path by id from memory, falling back to Supabase."""
    if path_id in generated_paths:
        return generated_paths[path_id]
    client = get_supabase()
    if client is None:
        return None
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
            payload = rows[0]["payload"]
            generated_paths[path_id] = payload
            return payload
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
        res = (
            client.table("user_paths")
            .select("payload")
            .eq("user_id", user_id)
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


class OnboardingRequest(BaseModel):
    email: str
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


def _persist_barriers_to_supabase(user_id: str, email: str, barrier_types: List[str]) -> None:
    """Write barriers to the shared public.user_barriers table.

    No-op when Supabase isn't configured. Failures are swallowed so onboarding
    never breaks if the shared DB is unreachable.
    """
    client = get_supabase()
    if client is None or not user_id:
        return
    try:
        # Ensure a profile row exists (FK target for user_barriers)
        client.table("profiles").upsert(
            {"id": user_id, "email": email},
            on_conflict="id",
        ).execute()

        # Replace any existing barriers for this user so re-onboarding is idempotent
        client.table("user_barriers").delete().eq("user_id", user_id).execute()
        rows = [
            {
                "user_id": user_id,
                "barrier_category": "general",
                "barrier_type": b,
                "severity": 3,
            }
            for b in barrier_types
            if b
        ]
        if rows:
            client.table("user_barriers").insert(rows).execute()
    except Exception as e:
        print(f"[onboarding] Supabase barrier sync skipped: {e}")


def _persist_preferences_to_supabase(user_id: str, email: str, preferences: Optional[dict]) -> None:
    """Store view/interaction preferences on the shared profiles row.

    Writes into profiles.preferences (JSON). No-op when Supabase isn't
    configured or preferences are empty. Failures are swallowed.
    """
    client = get_supabase()
    if client is None or not user_id or not preferences:
        return
    try:
        client.table("profiles").upsert(
            {
                "id": user_id,
                "email": email,
                "preferences": preferences,
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
) -> str:
    """Run the full pipeline and persist the path. Returns the path id.

    Shared by the synchronous endpoint and the async job worker so the two
    can never drift — the only difference is who waits for it.
    """
    def _stage(label: str) -> None:
        if job_id:
            jobs.set_stage(job_id, label)

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
    _persist_barriers_to_supabase(user_id, request.email, request.barrierTypes)
    # Record view/interaction preferences for intersecting-profile insights
    _persist_preferences_to_supabase(user_id, request.email, request.preferences)

    # Build user profile from onboarding data
    user_profile = {
        "id": user_id,
        "email": request.email,
        "demographics": request.demographics or {},
        "barrierTypes": request.barrierTypes,
        "motivationType": request.motivationType,
        "goals": request.goals,
        "dreams": request.dreams,
        "currentChallenges": request.currentChallenges,
        "supportContext": request.supportContext.model_dump() if request.supportContext else {},
        "createdAt": datetime.utcnow().isoformat()
    }

    # --- AGENT ORCHESTRATION ---
    # Import and invoke the multi-agent orchestrator
    from core.orchestrator import Orchestrator

    _stage("Starting the agents")
    orchestrator = Orchestrator()
    await orchestrator.initialize()

    # Load this user's cross-session memory so agents build on past plans
    user_memory = mem.load_user_memory(user_id)

    # Run the 6-agent pipeline: Pattern → Path → Tools → Calendar → Synthesis
    _stage("Mapping out your milestones")
    agent_result = await orchestrator.generate_path(
        user_profile=user_profile,
        goals=request.goals,
        barriers=request.barrierTypes,
        memory=user_memory,
        user_id=user_id,
    )

    # Index this user in the vector DB so future users get matched to them
    _stage("Matching resources to your goals")
    await orchestrator.index_user(
        user_id=user_id,
        user_profile=user_profile,
        goals=request.goals,
        barriers=request.barrierTypes,
        agent_result=agent_result,
    )

    await orchestrator.cleanup()

    # Append this run to the user's persistent agent memory
    mem.record_run(
        user_id=user_id,
        kind="generation",
        user_profile=user_profile,
        goals=request.goals,
        barriers=request.barrierTypes,
        agent_result=agent_result,
    )

    # Store the generated path (cache + Supabase user_paths)
    payload = {
        "id": path_id,
        "userId": user_id,
        "userProfile": user_profile,
        "generatedAt": datetime.utcnow().isoformat(),
        **agent_result,
    }
    _stage("Saving your path")
    _save_path(path_id, user_id, payload)
    return path_id


@router.post("/", response_model=OnboardingResponse)
async def create_onboarding(request: OnboardingRequest):
    """
    Create user profile, run agent orchestration, and generate personalized path.
    This is the main entry point that connects onboarding → multi-agent system → path.
    """
    try:
        path_id = await _generate_path_for(request)
        return OnboardingResponse(
            userId=request.userId or "",
            pathId=path_id,
            message="Path generated by AI agents successfully",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent orchestration failed: {str(e)}")


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


async def _run_job(job_id: str, request: "OnboardingRequest") -> None:
    """Background worker. Never raises — a job failure is data, not a crash."""
    jobs.mark_running(job_id)
    try:
        path_id = await _generate_path_for(request, job_id=job_id)
        jobs.mark_succeeded(job_id, path_id)
    except HTTPException as e:
        # Guardrail rejections carry a message meant for the user.
        jobs.mark_failed(job_id, str(e.detail))
    except Exception as e:
        # Full detail to the logs, a usable sentence to the client.
        print(f"[jobs] job {job_id} failed: {type(e).__name__}: {e}")
        jobs.mark_failed(job_id, "Path generation failed. Please try again.")


@router.post("/jobs", response_model=JobAccepted, status_code=202)
async def enqueue_onboarding(request: OnboardingRequest):
    """Start a generation and return immediately.

    The synchronous endpoint still works and is unchanged, but it holds a
    connection for the length of the run — ~55s alone, ~160s at five
    concurrent — which is what caps how many people can onboard at once. Here
    the request returns in milliseconds and the work continues server-side, so
    concurrency is bounded by what the box can process rather than by how long
    a browser is willing to wait. A client that reloads or drops off can find
    its job again instead of losing the work.
    """
    if not jobs.enabled():
        raise HTTPException(
            status_code=503,
            detail="Job store unavailable. Use POST /api/onboarding/ instead.",
        )

    user_id = request.userId or f"user_{uuid.uuid4().hex[:8]}"

    # Opportunistic cleanup: a restart mid-run would otherwise leave a job
    # 'running' forever with a spinner and nothing behind it.
    jobs.reap_stale()

    job_id = jobs.create(user_id, request.model_dump())
    if not job_id:
        raise HTTPException(status_code=503, detail="Could not queue the job")

    # Detached so the response is not waiting on it. Held in a module-level set
    # because asyncio only keeps a weak reference to tasks — without this the
    # garbage collector can cancel a running generation mid-flight.
    task = asyncio.create_task(_run_job(job_id, request))
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)

    return JobAccepted(jobId=job_id, userId=user_id, status="queued")


@router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job(job_id: str):
    """Poll a generation. Terminal states carry either pathId or error."""
    row = jobs.get(job_id)
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatus(
        jobId=str(row.get("id")),
        status=row.get("status") or "queued",
        stage=row.get("stage"),
        pathId=row.get("path_id"),
        error=row.get("error"),
    )


@router.get("/jobs/latest/{user_id}", response_model=Optional[JobStatus])
async def get_latest_job(user_id: str):
    """The user's most recent job — how a reloaded page reattaches to its work."""
    row = jobs.latest_for_user(user_id)
    if not row:
        return None
    return JobStatus(
        jobId=str(row.get("id")),
        status=row.get("status") or "queued",
        stage=row.get("stage"),
        pathId=row.get("path_id"),
        error=row.get("error"),
    )


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
async def update_onboarding(user_id: str, request: UpdateOnboardingRequest):
    """
    Update onboarding answers for an existing user and evolve their path
    via the Adaptation Agent rather than regenerating from scratch.

    If the user has no prior path, falls back to a fresh generation.
    """
    try:
        prior = _load_path_by_user(user_id)
        prior_profile: Dict[str, Any] = (prior or {}).get("userProfile", {}) if prior else {}

        # Merge new onboarding answers over the prior profile
        merged_profile = {
            "id": user_id,
            "email": request.email or prior_profile.get("email", ""),
            "demographics": request.demographics if request.demographics is not None else prior_profile.get("demographics", {}),
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
            _persist_barriers_to_supabase(user_id, merged_profile["email"], merged_profile["barrierTypes"])

        from core.orchestrator import Orchestrator
        orchestrator = Orchestrator()
        await orchestrator.initialize()

        # No prior path → cold start
        if not prior:
            user_memory = mem.load_user_memory(user_id)
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
            mem.record_run(
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
            _save_path(new_path_id, user_id, payload)
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
        mem.record_run(
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

        # Apply updated milestones/tasks if the adaptation agent produced any
        new_milestones = adaptation_result.get("updated_milestones") or []
        new_tasks = adaptation_result.get("updated_tasks") or []
        if new_milestones:
            updated_payload["milestones"] = new_milestones
        if new_tasks:
            updated_payload["tasks"] = new_tasks

        _save_path(prior_path_id, user_id, updated_payload)

        return OnboardingResponse(
            userId=user_id,
            pathId=prior_path_id,
            message="Path adapted to updated onboarding answers",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Path adaptation failed: {str(e)}")


@router.get("/path/{path_id}")
async def get_generated_path(path_id: str):
    """
    Retrieve the AI-generated path data after onboarding.
    Looks up the in-memory cache first, then Supabase user_paths.
    """
    payload = _load_path_by_id(path_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Path not found.")
    return payload


@router.get("/user/{user_id}/path")
async def get_user_path(user_id: str, caller_id: str = Depends(current_user_id)):
    """Retrieve the current path for a user (from Supabase user_paths).

    Requires a valid session, and that the caller is the user or their
    guardian. This endpoint previously had no auth at all and returned the
    full profile — barrierTypes and email included — to anyone holding a
    UUID.
    """
    require_self_or_guardian(user_id, caller_id)
    payload = _load_path_by_user(user_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="No path found for user.")
    return payload


@router.get("/user/{user_id}/paths")
async def list_user_paths(user_id: str, caller_id: str = Depends(current_user_id)):
    """List all of a user's saved paths (metadata only) for the multi-path
    switcher / compare views. Returns a lightweight summary per path so the
    client can render a list without downloading every full payload."""
    require_self_or_guardian(user_id, caller_id)
    rows = _list_paths_by_user(user_id)
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
    """Switch which path is active for the user."""
    require_self_or_guardian(user_id, caller_id)
    if not _set_active_path(user_id, path_id):
        raise HTTPException(status_code=400, detail="Could not activate path.")
    return {"pathId": path_id, "isActive": True}


@router.delete("/user/{user_id}/paths/{path_id}")
async def delete_user_path(user_id: str, path_id: str, caller_id: str = Depends(current_user_id)):
    """Delete one of a user's paths."""
    require_self_or_guardian(user_id, caller_id)
    if not _delete_path(user_id, path_id):
        raise HTTPException(status_code=400, detail="Could not delete path.")
    return {"pathId": path_id, "deleted": True}

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
