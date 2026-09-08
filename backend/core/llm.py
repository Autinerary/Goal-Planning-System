"""
Shared OpenAI-compatible client helper used by all agents.

This module is the harness: the six agents are fixed, the model behind any one
of them is not. Callers keep using complete_text / complete_json /
complete_chat exactly as before; what changed is that each call now resolves
which model and thinking effort to use, in this order:

  1. A per-agent choice for the calling agent, if the request set one.
  2. The request's default model + effort.
  3. The server default — the local fine-tune when it is running (it is free),
     otherwise the configured cloud model.

Selection travels on a ContextVar rather than a function argument, so a request
handler can scope an entire orchestrator run with `use_selection(...)` without
threading the choice through every agent signature.

When no provider is configured every helper returns None and agents fall back
to rule-based behavior — unchanged from before.

Local fine-tune (free, runs on the developer's Mac):
    scripts/export_reflections_for_lora.py   # dataset
    scripts/local_finetune.sh                # LoRA training
    scripts/local_fuse.sh                    # merge adapters
    scripts/local_serve.sh                   # OpenAI-compat server
Then:
    export LOCAL_LLM_BASE_URL=http://127.0.0.1:8080/v1
    export LOCAL_LLM_MODEL=fused
"""

import os
import json
import asyncio
import contextlib
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple

from core import model_registry as registry
from core import budget

# Read at call time, never captured at import: this module is imported before
# main.py calls load_dotenv(), so module-level os.getenv would see nothing.

# One client per provider — they differ only by api_key and base_url.
_clients: Dict[str, Any] = {}
_client_lock = asyncio.Lock()

# Reasoning tokens are billed against the same cap as the visible answer, so a
# budget sized for prose leaves nothing to reply with.
REASONING_MIN_TOKENS = 2000


@dataclass(frozen=True)
class Selection:
    """Which model answers, and how hard it thinks."""
    model: Optional[str] = None
    effort: str = registry.DEFAULT_EFFORT
    # agent_id -> {"model": str, "effort": str}
    per_agent: Dict[str, Dict[str, str]] = field(default_factory=dict)


_selection: ContextVar[Optional[Selection]] = ContextVar("llm_selection", default=None)
# Who the spend is charged to. None means the shared anonymous bucket.
_actor: ContextVar[Optional[str]] = ContextVar("llm_actor", default=None)


def parse_selection(raw: Optional[Dict[str, Any]]) -> Optional[Selection]:
    """Build a Selection from untrusted request JSON.

    Unknown ids and unconfigured providers are dropped rather than rejected: a
    stale preference in someone's browser must not break planning, it should
    quietly fall back to the server default.
    """
    if not isinstance(raw, dict):
        return None

    def clean_model(value: Any) -> Optional[str]:
        if not isinstance(value, str):
            return None
        value = value.strip()
        return value if registry.is_model_available(value) else None

    def clean_effort(value: Any) -> str:
        return registry.resolve_effort(value if isinstance(value, str) else None).id

    per_agent: Dict[str, Dict[str, str]] = {}
    raw_agents = raw.get("agents")
    if isinstance(raw_agents, dict):
        for agent_id, choice in raw_agents.items():
            if agent_id not in registry.AGENT_IDS or not isinstance(choice, dict):
                continue
            entry: Dict[str, str] = {}
            model = clean_model(choice.get("model"))
            if model:
                entry["model"] = model
            if choice.get("effort") is not None:
                entry["effort"] = clean_effort(choice.get("effort"))
            if entry:
                per_agent[agent_id] = entry

    if raw.get("model") is None and raw.get("effort") is None and not per_agent:
        return None

    return Selection(
        model=clean_model(raw.get("model")),
        effort=clean_effort(raw.get("effort")),
        per_agent=per_agent,
    )


@contextlib.contextmanager
def use_selection(selection: Optional[Selection], actor: Optional[str] = None):
    """Scope a model selection, and whose budget it spends, to this block."""
    tokens = []
    if selection is not None:
        tokens.append((_selection, _selection.set(selection)))
    if actor is not None:
        tokens.append((_actor, _actor.set(actor)))
    try:
        yield
    finally:
        for var, token in reversed(tokens):
            var.reset(token)


def _legacy_default_model() -> Optional[str]:
    """Pre-harness behavior, still honoured when it names a listed model."""
    if os.getenv("LOCAL_LLM_BASE_URL", "").strip():
        return "local-fused"
    configured = os.getenv("OPENAI_MODEL", "").strip()
    if os.getenv("OPENAI_API_KEY", "").strip() and configured in registry.MODELS:
        return configured
    return None


def resolve(agent: Optional[str] = None) -> Tuple[Optional[registry.Model], registry.Effort]:
    """Resolve the model and effort for one call, honouring per-agent overrides."""
    selection = _selection.get()
    model_id: Optional[str] = None
    effort_id: Optional[str] = None

    if selection is not None:
        if agent and agent in selection.per_agent:
            choice = selection.per_agent[agent]
            model_id = choice.get("model")
            effort_id = choice.get("effort")
        model_id = model_id or selection.model
        effort_id = effort_id or selection.effort

    model_id = model_id or _legacy_default_model() or registry.default_model_id()
    model = registry.MODELS.get(model_id) if model_id else None
    if model is not None and not registry.is_model_available(model.id):
        fallback = registry.default_model_id()
        model = registry.MODELS.get(fallback) if fallback else None

    return (model, registry.resolve_effort(effort_id))


def is_enabled() -> bool:
    """True if any provider is configured."""
    return bool(registry.available_model_ids())


def is_local() -> bool:
    """True if the currently resolved backend is the on-device fine-tune."""
    model, _effort = resolve()
    return bool(model and model.provider == "local")


def active_model_id(agent: Optional[str] = None) -> Optional[str]:
    model, _effort = resolve(agent)
    return model.id if model else None


async def _client_for(model: registry.Model):
    """Lazily construct and cache one client per provider."""
    cached = _clients.get(model.provider)
    if cached is not None:
        return cached

    key, base_url = registry.provider_credentials(model.provider)
    if key is None:
        return None

    async with _client_lock:
        if model.provider not in _clients:
            try:
                from openai import AsyncOpenAI
                kwargs: Dict[str, Any] = {"api_key": key}
                if base_url:
                    kwargs["base_url"] = base_url
                _clients[model.provider] = AsyncOpenAI(**kwargs)
            except Exception as e:
                print(f"   ⚠️  LLM client init failed ({model.provider}): {e}")
                return None
    return _clients.get(model.provider)


async def get_client():
    """Client for the currently resolved model. Kept for existing callers."""
    model, _effort = resolve()
    if model is None:
        return None
    return await _client_for(model)


def _tuned(
    model: registry.Model,
    effort: registry.Effort,
    temperature: float,
    max_tokens: int,
) -> Tuple[Dict[str, Any], int]:
    """Apply the chosen effort to the caller's budget. Returns (kwargs, planned)."""
    token_budget = max(64, min(int(max_tokens * effort.token_multiplier), model.max_output_tokens))
    kwargs: Dict[str, Any] = {
        "model": registry.wire_name(model),
        "temperature": max(0.0, min(1.0, temperature + effort.temperature_delta)),
        "max_tokens": token_budget,
    }
    if model.native_reasoning:
        # Reasoning models set their own sampling, reject max_tokens, and spend
        # part of the budget on hidden reasoning — too small a cap returns an
        # empty message rather than an error.
        kwargs.pop("temperature")
        token_budget = max(token_budget, REASONING_MIN_TOKENS)
        kwargs.pop("max_tokens")
        kwargs["max_completion_tokens"] = token_budget
        kwargs["reasoning_effort"] = effort.id
    return kwargs, token_budget


def _guard(model: registry.Model, planned_tokens: int) -> None:
    """Refuse the call if it would push this account past a configured limit."""
    budget.check(_actor.get(), model.id, planned_tokens)


def _record(model: registry.Model, resp, agent: Optional[str] = None) -> None:
    """Charge real measured tokens. Providers that omit usage cost nothing."""
    usage = getattr(resp, "usage", None)
    if usage is None:
        return
    budget.record(
        _actor.get(),
        model.id,
        int(getattr(usage, "prompt_tokens", 0) or 0),
        int(getattr(usage, "completion_tokens", 0) or 0),
        agent_id=agent,
    )


async def complete_text(
    system: str,
    user: str,
    temperature: float = 0.7,
    max_tokens: int = 600,
    agent: Optional[str] = None,
) -> Optional[str]:
    """Return raw text completion, or None on failure / no backend."""
    model, effort = resolve(agent)
    if model is None:
        return None
    client = await _client_for(model)
    if client is None:
        return None
    tuned, planned = _tuned(model, effort, temperature, max_tokens)
    _guard(model, planned)
    try:
        resp = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            **tuned,
        )
        _record(model, resp, agent)
        return (resp.choices[0].message.content or "").strip()
    except Exception as e:
        print(f"   ⚠️  LLM text call failed ({model.id}): {e}")
        return None


async def complete_chat(
    messages: list,
    temperature: float = 0.7,
    max_tokens: int = 700,
    agent: Optional[str] = None,
) -> Optional[str]:
    """Multi-turn chat completion. `messages` is a list of
    {"role": "system"|"user"|"assistant", "content": str}. Returns the reply
    text, or None on failure / no backend (used by the assistant chatbot)."""
    model, effort = resolve(agent)
    if model is None:
        return None
    client = await _client_for(model)
    if client is None:
        return None
    tuned, planned = _tuned(model, effort, temperature, max_tokens)
    _guard(model, planned)
    try:
        resp = await client.chat.completions.create(
            messages=messages,
            **tuned,
        )
        _record(model, resp, agent)
        return (resp.choices[0].message.content or "").strip()
    except Exception as e:
        print(f"   ⚠️  LLM chat call failed ({model.id}): {e}")
        return None


async def complete_json(
    system: str,
    user: str,
    temperature: float = 0.4,
    max_tokens: int = 1200,
    agent: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Return parsed JSON object, or None on failure / no backend.

    Only OpenAI enforces response_format={'type':'json_object'} the way this
    helper expects. Every other provider — including the local fine-tune —
    relies on the strengthened "Respond ONLY with valid JSON" suffix, so the
    fenced-block cleanup below applies to all of them.
    """
    model, effort = resolve(agent)
    if model is None:
        return None
    client = await _client_for(model)
    if client is None:
        return None
    tuned, planned = _tuned(model, effort, temperature, max_tokens)
    _guard(model, planned)
    try:
        kwargs: Dict[str, Any] = {
            "messages": [
                {"role": "system", "content": system + " Respond ONLY with valid JSON."},
                {"role": "user", "content": user},
            ],
            **tuned,
        }
        if registry.PROVIDERS[model.provider].supports_json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = await client.chat.completions.create(**kwargs)
        _record(model, resp, agent)
        content = (resp.choices[0].message.content or "").strip()
        if not content:
            return None
        # Some models wrap the JSON in ```json fences — strip them.
        if content.startswith("```"):
            content = content.strip("`")
            if content.lower().startswith("json"):
                content = content[4:].lstrip()
        return json.loads(content)
    except Exception as e:
        print(f"   ⚠️  LLM JSON call failed ({model.id}): {e}")
        return None
