"""
Memory API Routes

Surfaces the persistent agent memory we record after each generation/adaptation
run, so the frontend can show users that the agents are building on past plans.
"""

from fastapi import APIRouter, Depends

from api.auth_guard import current_user_id, require_self_or_guardian
from core import memory as mem

router = APIRouter()


@router.get("/{user_id}")
async def get_user_memory(user_id: str, caller_id: str = Depends(current_user_id)):
    """Return the compact memory object for a user.

    Always returns a valid shape (empty runs when there's nothing yet or
    Supabase isn't reachable) so the frontend can render unconditionally.

    Only for the person, or their guardian. It had no check: anyone with an
    account id could read that person's past goals and conditions.
    """
    require_self_or_guardian(user_id, caller_id)
    memory = mem.load_user_memory(user_id)
    return {
        "userId": user_id,
        "runCount": memory.get("runCount", 0),
        "recentRuns": memory.get("recentRuns", []),
        "lastGoals": memory.get("lastGoals", []),
        "lastBarriers": memory.get("lastBarriers", []),
        "promptSummary": mem.summarize_for_prompt(memory),
    }
