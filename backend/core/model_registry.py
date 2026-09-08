"""Catalogue of selectable LLMs and thinking-effort levels.

The product is a harness: the six agents are fixed, the model behind any one of
them is not. This module is the single place that knows which models exist,
which provider serves them, and which environment variable unlocks them.

Everything here is configuration, not agent output — the same category as path
category names and blurbs. No number in this file is presented to a user as a
measurement.

Adding a provider is one entry in PROVIDERS plus its models in MODELS; nothing
else in the codebase needs to change, because every provider below speaks the
OpenAI chat-completions wire protocol.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(frozen=True)
class Provider:
    id: str
    label: str
    api_key_env: str
    # None means "the SDK default" (OpenAI itself).
    base_url: Optional[str] = None
    # Only OpenAI enforces response_format={'type':'json_object'} the way our
    # JSON helper expects. Everything else relies on the prompt suffix.
    supports_json_mode: bool = False


PROVIDERS: Dict[str, Provider] = {
    "openai": Provider(
        id="openai",
        label="OpenAI",
        api_key_env="OPENAI_API_KEY",
        supports_json_mode=True,
    ),
    "anthropic": Provider(
        id="anthropic",
        label="Anthropic",
        api_key_env="ANTHROPIC_API_KEY",
        base_url="https://api.anthropic.com/v1",
    ),
    "google": Provider(
        id="google",
        label="Google",
        api_key_env="GEMINI_API_KEY",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
    ),
    "groq": Provider(
        id="groq",
        label="Groq",
        api_key_env="GROQ_API_KEY",
        base_url="https://api.groq.com/openai/v1",
    ),
    "openrouter": Provider(
        id="openrouter",
        label="OpenRouter",
        api_key_env="OPENROUTER_API_KEY",
        base_url="https://openrouter.ai/api/v1",
    ),
    # The on-device LoRA fine-tune. Unlocked by a base URL rather than a key.
    "local": Provider(
        id="local",
        label="Local fine-tune",
        api_key_env="",
        base_url=None,
    ),
}


@dataclass(frozen=True)
class Model:
    id: str
    label: str
    provider: str
    # Wire name sent to the provider. Differs from `id` only where two
    # providers would otherwise collide on the same key.
    model_name: str
    description: str
    # Models that accept OpenAI's `reasoning_effort` parameter directly.
    native_reasoning: bool = False
    max_output_tokens: int = 4096


MODELS: Dict[str, Model] = {
    m.id: m
    for m in [
        Model(
            id="gpt-4o-mini",
            label="GPT-4o mini",
            provider="openai",
            model_name="gpt-4o-mini",
            description="Fast and inexpensive. The default for onboarding.",
        ),
        Model(
            id="gpt-4o",
            label="GPT-4o",
            provider="openai",
            model_name="gpt-4o",
            description="Stronger general reasoning at higher cost.",
        ),
        Model(
            id="o4-mini",
            label="o4-mini",
            provider="openai",
            model_name="o4-mini",
            description="Reasoning model; honours thinking effort natively.",
            native_reasoning=True,
        ),
        Model(
            id="claude-sonnet",
            label="Claude Sonnet",
            provider="anthropic",
            model_name="claude-sonnet-4-20250514",
            description="Strong long-form planning and careful instructions.",
        ),
        Model(
            id="claude-opus",
            label="Claude Opus",
            provider="anthropic",
            model_name="claude-opus-4-20250514",
            description="Highest-capability Anthropic model.",
        ),
        Model(
            id="gemini-flash",
            label="Gemini Flash",
            provider="google",
            model_name="gemini-2.0-flash",
            description="Very fast, good for bulk suggestions.",
        ),
        Model(
            id="llama-groq",
            label="Llama 3.3 70B",
            provider="groq",
            model_name="llama-3.3-70b-versatile",
            description="Open-weight model served at low latency.",
        ),
        Model(
            id="local-fused",
            label="Local fine-tune",
            provider="local",
            model_name=os.getenv("LOCAL_LLM_MODEL", "") or "fused",
            description="Your LoRA fine-tune. Runs on your machine at no cost.",
        ),
    ]
}


# ---------- thinking effort ----------

@dataclass(frozen=True)
class Effort:
    id: str
    label: str
    description: str
    # Multiplies the caller's max_tokens budget.
    token_multiplier: float
    # Added to the caller's temperature, then clamped to [0, 1].
    temperature_delta: float


EFFORTS: Dict[str, Effort] = {
    e.id: e
    for e in [
        Effort(
            id="low",
            label="Low",
            description="Shortest, cheapest answers. Good for quick drafts.",
            token_multiplier=0.6,
            temperature_delta=-0.1,
        ),
        Effort(
            id="medium",
            label="Medium",
            description="Balanced depth and cost. The default.",
            token_multiplier=1.0,
            temperature_delta=0.0,
        ),
        Effort(
            id="high",
            label="High",
            description="Longer, more thorough reasoning. Slower and costlier.",
            token_multiplier=1.8,
            temperature_delta=0.05,
        ),
    ]
}

DEFAULT_EFFORT = "medium"


# The six agents a user can point at different models.
AGENT_IDS: List[str] = [
    "path_planning",
    "pattern_recognition",
    "tool_recommendation",
    "reflection_analysis",
    "adaptation",
    "calendar_optimization",
]

AGENT_LABELS: Dict[str, str] = {
    "path_planning": "Path Planning",
    "pattern_recognition": "Pattern Recognition",
    "tool_recommendation": "Tool Recommendation",
    "reflection_analysis": "Reflection Analysis",
    "adaptation": "Adaptation",
    "calendar_optimization": "Calendar Optimization",
}


def provider_credentials(provider_id: str) -> tuple[Optional[str], Optional[str]]:
    """Return (api_key, base_url) for a provider, or (None, None) if unset."""
    provider = PROVIDERS.get(provider_id)
    if provider is None:
        return (None, None)

    if provider.id == "local":
        base = os.getenv("LOCAL_LLM_BASE_URL", "").rstrip("/")
        if not base:
            return (None, None)
        # The local server needs no auth, but the OpenAI SDK rejects an empty key.
        return ("local-no-auth", base)

    key = os.getenv(provider.api_key_env, "")
    if not key:
        return (None, None)
    return (key, provider.base_url)


def is_model_available(model_id: str) -> bool:
    model = MODELS.get(model_id)
    if model is None:
        return False
    key, _base = provider_credentials(model.provider)
    return key is not None


def available_model_ids() -> List[str]:
    return [mid for mid in MODELS if is_model_available(mid)]


def resolve_effort(effort_id: Optional[str]) -> Effort:
    return EFFORTS.get((effort_id or "").lower(), EFFORTS[DEFAULT_EFFORT])


def default_model_id() -> Optional[str]:
    """The model used when a request expresses no preference.

    Order matters: the local fine-tune wins when it is running because it is
    free, which preserves the routing precedence this system already had.
    """
    if is_model_available("local-fused"):
        return "local-fused"

    # Honour an explicitly configured OpenAI model name when it is one we list.
    configured = os.getenv("OPENAI_MODEL", "").strip()
    if configured and configured in MODELS and is_model_available(configured):
        return configured

    for candidate in ("gpt-4o-mini", "gpt-4o", "claude-sonnet", "gemini-flash"):
        if is_model_available(candidate):
            return candidate

    available = available_model_ids()
    return available[0] if available else None


def catalogue() -> Dict[str, object]:
    """Everything the UI needs to render a picker, with availability."""
    return {
        "models": [
            {
                "id": m.id,
                "label": m.label,
                "provider": m.provider,
                "provider_label": PROVIDERS[m.provider].label,
                "description": m.description,
                "native_reasoning": m.native_reasoning,
                "available": is_model_available(m.id),
            }
            for m in MODELS.values()
        ],
        "efforts": [
            {"id": e.id, "label": e.label, "description": e.description}
            for e in EFFORTS.values()
        ],
        "agents": [
            {"id": a, "label": AGENT_LABELS[a]} for a in AGENT_IDS
        ],
        "default_model": default_model_id(),
        "default_effort": DEFAULT_EFFORT,
    }
