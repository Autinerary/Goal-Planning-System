"""Per-user, per-model spend and rate limits for the LLM harness.

Letting users pick the model makes cost a user-controlled variable: high effort
on a large model is a multiple of the default path, and nothing before this
stopped one account from running that repeatedly.

Three limits, checked in this order:

  1. Requests per minute — catches a runaway loop or a stuck retry.
  2. Tokens per day     — the real spend proxy. Effort and model size both
                          land here, so no separate "expensive model" rule is
                          needed: high effort simply consumes the budget faster.
  3. Dollars per day    — only when the operator has configured prices.

Prices are NOT hardcoded. Provider pricing is a real-world fact that changes
without notice, and a stale table would produce confident, wrong dollar
figures. Set MODEL_PRICING to opt in:

    MODEL_PRICING='{"gpt-4o":{"in":2.50,"out":10.00}}'   # USD per 1M tokens

With no pricing configured, token limits still apply and no dollar amount is
ever reported — the app says "not tracked" rather than inventing a number.

State lives in Supabase (public.llm_usage) so it survives a restart and is
shared across workers. In-memory counters are kept in front of it as a
per-process cache: the pre-call check must not add a database round trip to
every LLM call on a ~55s generation path. The cache is refreshed from the
ledger when it is cold, so a restart reloads the real total instead of
silently granting everyone a fresh allowance.

Without Supabase configured this degrades to memory only — still a runaway
guard, just not durable.
"""

from __future__ import annotations

import json
import os
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Deque, Dict, Optional, Tuple

from database.supabase_client import get_supabase

TABLE = "llm_usage"
DAY_SECONDS = 86_400
MINUTE_SECONDS = 60

# How long a per-user total is trusted before it is re-read from the ledger.
# Keeps the hot path in memory while bounding drift between workers.
CACHE_TTL_SECONDS = 60


def _int_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, "").strip() or default)
    except ValueError:
        return default
    return value if value > 0 else default


def _float_env(name: str) -> Optional[float]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return None
    try:
        value = float(raw)
    except ValueError:
        return None
    return value if value > 0 else None


REQUESTS_PER_MINUTE = _int_env("LLM_REQUESTS_PER_MINUTE", 30)
TOKENS_PER_DAY = _int_env("LLM_TOKENS_PER_DAY", 300_000)
SPEND_PER_DAY_USD = _float_env("LLM_SPEND_PER_DAY_USD")

# Anonymous callers share one bucket. Without it, a single unauthenticated
# client could mint a fresh identity per request and bypass the limit entirely.
ANONYMOUS = "anonymous"


# Set when MODEL_PRICING is present but unusable. A silently ignored env var
# looks identical to an unset one, which sends the operator looking for a bug
# in the app rather than a typo in their config.
PRICING_ERROR: Optional[str] = None


def _load_pricing() -> Dict[str, Dict[str, float]]:
    """USD per 1M tokens, keyed by model id. Empty when unconfigured."""
    global PRICING_ERROR
    raw = os.getenv("MODEL_PRICING", "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except ValueError:
        PRICING_ERROR = (
            "MODEL_PRICING is set but is not valid JSON. Expected "
            '{"model-id": {"in": 0.15, "out": 0.60}} in USD per 1M tokens.'
        )
        print(f"[budget] {PRICING_ERROR}")
        return {}

    prices: Dict[str, Dict[str, float]] = {}
    if not isinstance(parsed, dict):
        PRICING_ERROR = "MODEL_PRICING must be a JSON object keyed by model id."
        print(f"[budget] {PRICING_ERROR}")
        return prices
    for model_id, entry in parsed.items():
        if not isinstance(entry, dict):
            continue
        try:
            prices[str(model_id)] = {
                "in": float(entry.get("in", 0.0)),
                "out": float(entry.get("out", 0.0)),
            }
        except (TypeError, ValueError):
            continue

    if not prices:
        PRICING_ERROR = "MODEL_PRICING parsed but contained no usable model prices."
        print(f"[budget] {PRICING_ERROR}")
    return prices


PRICING = _load_pricing()


def pricing_configured() -> bool:
    return bool(PRICING)


class LimitExceeded(RuntimeError):
    """Raised when a call would exceed a configured limit."""

    def __init__(self, limit: str, message: str):
        super().__init__(message)
        self.limit = limit
        self.message = message


@dataclass
class _Usage:
    requests: Deque[float] = field(default_factory=deque)
    # (timestamp, tokens, usd) — this process's own calls only.
    spend: Deque[Tuple[float, int, float]] = field(default_factory=deque)
    # Totals loaded from the ledger, covering calls this process never saw.
    persisted_tokens: int = 0
    persisted_usd: float = 0.0
    loaded_at: float = 0.0
    # Only a session-verified id exists in auth.users, which the ledger's
    # foreign key requires. An unverified id is also a spoofing vector: it
    # would let a caller bill their spend to someone else's account.
    verified: bool = False

    def prune(self, now: float) -> None:
        while self.requests and now - self.requests[0] > MINUTE_SECONDS:
            self.requests.popleft()
        while self.spend and now - self.spend[0][0] > DAY_SECONDS:
            self.spend.popleft()

    def tokens_today(self) -> int:
        return self.persisted_tokens + sum(e[1] for e in self.spend)

    def usd_today(self) -> float:
        return self.persisted_usd + sum(e[2] for e in self.spend)


_usage: Dict[str, _Usage] = {}
_lock = threading.Lock()

# None = untried. Set from real read/write outcomes, because "Supabase is
# configured" is not the same claim as "the ledger works" — the table may not
# be migrated yet, and reporting durable counts that silently reset is worse
# than admitting they are volatile.
_ledger_ok: Optional[bool] = None


def _is_uuid(value: str) -> bool:
    """Onboarding can run before a session exists, so ids are not always UUIDs."""
    try:
        from uuid import UUID
        UUID(str(value))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _load_persisted(actor: str, verified: bool) -> Optional[Tuple[int, float]]:
    """Sum the last 24h from the ledger. None when it could not be read.

    None and (0, 0.0) must stay distinct: the first means "unknown, keep what
    this process counted", the second means "genuinely nothing used today".
    Conflating them let a failed read erase the in-memory total, which removed
    the limit entirely.
    """
    sb = get_supabase()
    if sb is None:
        return None

    global _ledger_ok
    since = (datetime.now(timezone.utc) - timedelta(seconds=DAY_SECONDS)).isoformat()
    try:
        q = sb.table(TABLE).select("total_tokens, cost_usd").gte("created_at", since)
        # Unverified and signed-out callers share the NULL-user rows.
        q = q.eq("user_id", actor) if verified else q.is_("user_id", "null")
        rows = q.execute().data or []
    except Exception as e:
        # A ledger read failure must not block generation; fall back to memory.
        _ledger_ok = False
        print(f"[budget] usage read failed: {type(e).__name__}: {e}")
        return None

    _ledger_ok = True
    tokens = sum(int(r.get("total_tokens") or 0) for r in rows)
    usd = sum(float(r.get("cost_usd") or 0.0) for r in rows)
    return (tokens, usd)


def _refresh(usage: _Usage, actor: str, now: float) -> None:
    """Reload the ledger total when the cached one is cold or stale."""
    if now - usage.loaded_at < CACHE_TTL_SECONDS:
        return
    loaded = _load_persisted(actor, usage.verified)
    if loaded is None:
        # Keep counting in memory rather than granting a fresh allowance.
        return
    usage.persisted_tokens, usage.persisted_usd = loaded
    usage.loaded_at = now
    # Locally recorded calls are now included in the ledger figure; keeping
    # them would double-count.
    usage.spend.clear()


def _persist(
    actor: str,
    verified: bool,
    model_id: str,
    agent_id: Optional[str],
    prompt_tokens: int,
    completion_tokens: int,
    usd: Optional[float],
) -> None:
    sb = get_supabase()
    if sb is None:
        return
    global _ledger_ok
    try:
        sb.table(TABLE).insert({
            "user_id": actor if verified else None,
            "model_id": model_id,
            "agent_id": agent_id,
            "prompt_tokens": max(0, int(prompt_tokens)),
            "completion_tokens": max(0, int(completion_tokens)),
            "cost_usd": usd,
        }).execute()
        _ledger_ok = True
    except Exception as e:
        # A dropped write costs one call's worth of accounting, not the total.
        _ledger_ok = False
        print(f"[budget] usage write failed: {type(e).__name__}: {e}")


def cost_usd(model_id: str, prompt_tokens: int, completion_tokens: int) -> Optional[float]:
    """Cost of one call, or None when this model has no configured price."""
    price = PRICING.get(model_id)
    if not price:
        return None
    return (prompt_tokens * price["in"] + completion_tokens * price["out"]) / 1_000_000


def check(actor: Optional[str], model_id: str, planned_tokens: int, verified: bool = False) -> None:
    """Raise LimitExceeded if this call should not proceed.

    `planned_tokens` is the caller's max output budget, so a request is
    rejected before it can push the account past the daily cap rather than
    after.
    """
    key = actor or ANONYMOUS
    now = time.time()

    with _lock:
        usage = _usage.setdefault(key, _Usage())
        usage.verified = usage.verified or verified
        usage.prune(now)
        _refresh(usage, key, now)

        if len(usage.requests) >= REQUESTS_PER_MINUTE:
            raise LimitExceeded(
                "requests_per_minute",
                "Too many requests in the last minute. Please wait a moment and try again.",
            )

        if usage.tokens_today() + planned_tokens > TOKENS_PER_DAY:
            raise LimitExceeded(
                "tokens_per_day",
                "You've reached today's usage limit for AI generation. "
                "It resets in 24 hours, or you can switch to a lower thinking effort.",
            )

        if SPEND_PER_DAY_USD is not None and usage.usd_today() >= SPEND_PER_DAY_USD:
            raise LimitExceeded(
                "spend_per_day",
                "You've reached today's AI budget. It resets in 24 hours.",
            )

        usage.requests.append(now)


def record(
    actor: Optional[str],
    model_id: str,
    prompt_tokens: int,
    completion_tokens: int,
    agent_id: Optional[str] = None,
    verified: bool = False,
) -> None:
    """Record real measured usage from a completed call."""
    key = actor or ANONYMOUS
    now = time.time()
    total = max(0, int(prompt_tokens)) + max(0, int(completion_tokens))
    usd = cost_usd(model_id, prompt_tokens, completion_tokens)

    with _lock:
        usage = _usage.setdefault(key, _Usage())
        usage.verified = usage.verified or verified
        usage.prune(now)
        usage.spend.append((now, total, usd or 0.0))
        is_verified = usage.verified

    _persist(key, is_verified, model_id, agent_id, prompt_tokens, completion_tokens, usd)


def snapshot(actor: Optional[str], verified: bool = False) -> Dict[str, object]:
    """What this account has used. `usd` is None when prices aren't configured."""
    key = actor or ANONYMOUS
    now = time.time()
    with _lock:
        usage = _usage.setdefault(key, _Usage())
        usage.verified = usage.verified or verified
        usage.prune(now)
        _refresh(usage, key, now)
        tokens = usage.tokens_today()
        usd = usage.usd_today() if PRICING else None
        requests = len(usage.requests)

    return {
        "requests_last_minute": requests,
        "requests_per_minute_limit": REQUESTS_PER_MINUTE,
        "tokens_today": tokens,
        "tokens_per_day_limit": TOKENS_PER_DAY,
        "tokens_remaining": max(0, TOKENS_PER_DAY - tokens),
        # 6dp, matching the column: a real call can cost $0.00004, and rounding
        # that to 0.0 reports "free" for something that was not.
        "usd_today": round(usd, 6) if usd is not None else None,
        "usd_per_day_limit": SPEND_PER_DAY_USD,
        "cost_tracking": bool(PRICING),
        # False means counts reset when the process restarts, so the UI can say
        # so instead of implying a durable total.
        "durable": bool(_ledger_ok),
    }


def limits() -> Dict[str, object]:
    return {
        "requests_per_minute": REQUESTS_PER_MINUTE,
        "tokens_per_day": TOKENS_PER_DAY,
        "usd_per_day": SPEND_PER_DAY_USD,
        "cost_tracking": bool(PRICING),
        "priced_models": sorted(PRICING.keys()),
        "pricing_error": PRICING_ERROR,
    }
