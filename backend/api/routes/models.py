"""Model catalogue and usage limits for the harness UI.

GET /api/models
  What the picker renders: every model we support, which provider serves it,
  and whether this server actually has credentials for it. A model with
  available=false is shown but not selectable — that is a deployment fact the
  user should see rather than a mysteriously missing option.

GET /api/models/usage
  What this account has used today against the configured limits. `usd_today`
  is null unless the operator configured MODEL_PRICING: tokens are measured,
  a dollar figure without real prices would be invented.
"""

from typing import Optional

from fastapi import APIRouter, Header

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
async def usage(x_user_id: Optional[str] = Header(None)):
    return budget.snapshot(x_user_id)
