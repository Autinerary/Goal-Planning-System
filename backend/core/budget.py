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

State is per-process and in memory: adding a database round trip to every LLM
call would cost more on the ~55s generation path than the limit saves. That
makes this a guard against runaway usage, not an accounting ledger — a restart
clears the counters, and multiple workers each hold their own.
"""

from __future__ import annotations

import json
import os
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, Optional, Tuple

DAY_SECONDS = 86_400
MINUTE_SECONDS = 60


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


def _load_pricing() -> Dict[str, Dict[str, float]]:
    """USD per 1M tokens, keyed by model id. Empty when unconfigured."""
    raw = os.getenv("MODEL_PRICING", "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except ValueError:
        print("[budget] MODEL_PRICING is not valid JSON — cost tracking disabled")
        return {}

    prices: Dict[str, Dict[str, float]] = {}
    if not isinstance(parsed, dict):
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
    # (timestamp, tokens, usd)
    spend: Deque[Tuple[float, int, float]] = field(default_factory=deque)

    def prune(self, now: float) -> None:
        while self.requests and now - self.requests[0] > MINUTE_SECONDS:
            self.requests.popleft()
        while self.spend and now - self.spend[0][0] > DAY_SECONDS:
            self.spend.popleft()

    def tokens_today(self) -> int:
        return sum(entry[1] for entry in self.spend)

    def usd_today(self) -> float:
        return sum(entry[2] for entry in self.spend)


_usage: Dict[str, _Usage] = {}
_lock = threading.Lock()


def cost_usd(model_id: str, prompt_tokens: int, completion_tokens: int) -> Optional[float]:
    """Cost of one call, or None when this model has no configured price."""
    price = PRICING.get(model_id)
    if not price:
        return None
    return (prompt_tokens * price["in"] + completion_tokens * price["out"]) / 1_000_000


def check(actor: Optional[str], model_id: str, planned_tokens: int) -> None:
    """Raise LimitExceeded if this call should not proceed.

    `planned_tokens` is the caller's max output budget, so a request is
    rejected before it can push the account past the daily cap rather than
    after.
    """
    key = actor or ANONYMOUS
    now = time.time()

    with _lock:
        usage = _usage.setdefault(key, _Usage())
        usage.prune(now)

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
) -> None:
    """Record real measured usage from a completed call."""
    key = actor or ANONYMOUS
    now = time.time()
    total = max(0, int(prompt_tokens)) + max(0, int(completion_tokens))
    usd = cost_usd(model_id, prompt_tokens, completion_tokens) or 0.0

    with _lock:
        usage = _usage.setdefault(key, _Usage())
        usage.prune(now)
        usage.spend.append((now, total, usd))


def snapshot(actor: Optional[str]) -> Dict[str, object]:
    """What this account has used. `usd` is None when prices aren't configured."""
    key = actor or ANONYMOUS
    now = time.time()
    with _lock:
        usage = _usage.setdefault(key, _Usage())
        usage.prune(now)
        tokens = usage.tokens_today()
        usd = usage.usd_today() if PRICING else None
        requests = len(usage.requests)

    return {
        "requests_last_minute": requests,
        "requests_per_minute_limit": REQUESTS_PER_MINUTE,
        "tokens_today": tokens,
        "tokens_per_day_limit": TOKENS_PER_DAY,
        "tokens_remaining": max(0, TOKENS_PER_DAY - tokens),
        "usd_today": round(usd, 4) if usd is not None else None,
        "usd_per_day_limit": SPEND_PER_DAY_USD,
        "cost_tracking": bool(PRICING),
    }


def limits() -> Dict[str, object]:
    return {
        "requests_per_minute": REQUESTS_PER_MINUTE,
        "tokens_per_day": TOKENS_PER_DAY,
        "usd_per_day": SPEND_PER_DAY_USD,
        "cost_tracking": bool(PRICING),
        "priced_models": sorted(PRICING.keys()),
    }
