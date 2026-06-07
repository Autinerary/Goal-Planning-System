"""
Onboarding API Routes
Step 0: Questionnaire → Agent Orchestration → Path Generation
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import os
import uuid
from datetime import datetime

from database.supabase_client import get_supabase
from core import memory as mem
from core.guardrails import validate_all_inputs

router = APIRouter()

SERVICE_HUB_URL = os.getenv("SERVICE_HUB_URL", "http://localhost:3001")

# In-memory cache for generated paths (write-through to Supabase user_paths).
# Acts as a fast lookup; Supabase is the source of truth.
generated_paths: Dict[str, Any] = {}


def _save_path(path_id: str, user_id: str, payload: Dict[str, Any]) -> None:
    """Cache locally and upsert to Supabase user_paths (no-op if unavailable)."""
    generated_paths[path_id] = payload
    if not user_id:
        return
    client = get_supabase()
    if client is None:
        return
    try:
        client.table("user_paths").upsert(
            {
                "user_id": user_id,
                "path_id": path_id,
                "payload": payload,
                "updated_at": datetime.utcnow().isoformat(),
            },
            on_conflict="user_id",
        ).execute()
    except Exception as e:
        print(f"[onboarding] user_paths upsert skipped: {e}")


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
    """Look up the most recent path for a user from Supabase."""
    if not user_id:
        return None
    client = get_supabase()
    if client is None:
        return None
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


class OnboardingRequest(BaseModel):
    email: str
    userId: Optional[str] = None  # Supabase auth.users UUID (shared with ServiceHub)
    demographics: Optional[dict] = None
    barrierTypes: List[str] = []  # can be empty — user may have no barriers
    motivationType: str
    goals: List[str]
    dreams: List[str] = []
    currentChallenges: List[str] = []


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


class OnboardingResponse(BaseModel):
    userId: str
    pathId: str
    message: str


@router.post("/", response_model=OnboardingResponse)
async def create_onboarding(request: OnboardingRequest):
    """
    Create user profile, run agent orchestration, and generate personalized path.
    This is the main entry point that connects onboarding → multi-agent system → path.
    """
    try:
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
            "createdAt": datetime.utcnow().isoformat()
        }

        # --- AGENT ORCHESTRATION ---
        # Import and invoke the multi-agent orchestrator
        from core.orchestrator import Orchestrator

        orchestrator = Orchestrator()
        await orchestrator.initialize()

        # Load this user's cross-session memory so agents build on past plans
        user_memory = mem.load_user_memory(user_id)

        # Run the 6-agent pipeline: Pattern → Path → Tools → Calendar → Synthesis
        agent_result = await orchestrator.generate_path(
            user_profile=user_profile,
            goals=request.goals,
            barriers=request.barrierTypes,
            memory=user_memory,
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
        _save_path(path_id, user_id, payload)

        return OnboardingResponse(
            userId=user_id,
            pathId=path_id,
            message="Path generated by AI agents successfully"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent orchestration failed: {str(e)}")


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
            )
            new_path_id = f"path_{uuid.uuid4().hex[:8]}"
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
async def get_user_path(user_id: str):
    """Retrieve the current path for a user (from Supabase user_paths)."""
    payload = _load_path_by_user(user_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="No path found for user.")
    return payload

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
