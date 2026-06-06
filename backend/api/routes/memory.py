"""
Memory API Routes

Surfaces the persistent agent memory we record after each generation/adaptation
run, so the frontend can show users that the agents are building on past plans.
"""

from fastapi import APIRouter
from core import memory as mem

router = APIRouter()


@router.get("/{user_id}")
async def get_user_memory(user_id: str):
    """Return the compact memory object for a user.

    Always returns a valid shape (empty runs when there's nothing yet or
    Supabase isn't reachable) so the frontend can render unconditionally.
    """
    memory = mem.load_user_memory(user_id)
    return {
        "userId": user_id,
        "runCount": memory.get("runCount", 0),
        "recentRuns": memory.get("recentRuns", []),
        "lastGoals": memory.get("lastGoals", []),
        "lastBarriers": memory.get("lastBarriers", []),
        "promptSummary": mem.summarize_for_prompt(memory),
    }
