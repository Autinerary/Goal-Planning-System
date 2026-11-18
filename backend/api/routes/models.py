"""Model catalogue and usage limits for the harness UI.

GET /api/models
  What the picker renders: every model we support, which provider serves it,
  and whether this server actually has credentials for it. A model with
  available=false is shown but not selectable — that is a deployment fact the
  user should see rather than a mysteriously missing option.

GET /api/models/usage
  What this account has used today against the configured limits. Attributed
  to the verified session, so a caller cannot report or reset someone else's
  budget. `usd_today` is null unless the operator configured MODEL_PRICING:
  tokens are measured, a dollar figure without real prices would be invented.
"""

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends

from api.auth_guard import optional_user_id
from core import budget
from core import model_registry as registry

router = APIRouter()


@router.get("")
@router.get("/")
async def list_models():
    data = registry.catalogue()
    data["any_available"] = bool(registry.available_model_ids())
    data["limits"] = budget.limits()
    return data


@router.get("/usage")
async def usage(actor: Optional[str] = Depends(optional_user_id)):
    # In a worker thread: it can read the usage ledger, and supabase-py is synchronous.
    return await asyncio.to_thread(budget.snapshot, actor, actor is not None)
