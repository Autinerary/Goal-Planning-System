"""
Shared OpenAI-compatible client helper used by all agents.

Provides a singleton AsyncOpenAI client plus convenience methods for
text + JSON completions. Falls back gracefully if no API key is set
or the network call fails — callers should treat None as "use rules".

Routing precedence (first one configured wins):

  1. Local mlx_lm.server (LOCAL_LLM_BASE_URL set)
     A LoRA-fine-tuned Llama 3.2 3B served on the developer's Mac. Costs $0.
     Standing up:
         scripts/export_reflections_for_lora.py   # dataset
         scripts/local_finetune.sh                # LoRA training
         scripts/local_fuse.sh                    # merge adapters
         scripts/local_serve.sh                   # OpenAI-compat server
     Then:
         export LOCAL_LLM_BASE_URL=http://127.0.0.1:8080/v1
         export LOCAL_LLM_MODEL=fused

  2. OpenAI (OPENAI_API_KEY set)
     Default gpt-4o-mini, configurable via OPENAI_MODEL.

  3. Neither — every helper returns None; agents fall back to rule-based behavior.

The two backends speak the same chat-completions wire protocol, so the only
delta is the AsyncOpenAI(api_key=..., base_url=...) construction. Every agent
in the system inherits the swap for free because they all call this module.
"""

import os
import json
import asyncio
from typing import Any, Dict, Optional, Tuple

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Local mlx_lm.server (or any OpenAI-compatible local server: vLLM, llama.cpp
# in OpenAI mode, etc.). When base URL is set, the foundation model is YOUR
# fine-tune running on YOUR machine — the only path in this codebase that
# actually updates real model weights at $0 marginal cost.
LOCAL_LLM_BASE_URL = os.getenv("LOCAL_LLM_BASE_URL", "").rstrip("/")
LOCAL_LLM_MODEL = os.getenv("LOCAL_LLM_MODEL", "")

_client = None
_client_lock = asyncio.Lock()


def _resolve_backend() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Return (api_key, model, base_url). Local fine-tune wins if configured."""
    if LOCAL_LLM_BASE_URL:
        # mlx_lm.server doesn't require auth but the openai SDK insists on a
        # non-empty key — any string works.
        return ("local-no-auth", LOCAL_LLM_MODEL or "fused", LOCAL_LLM_BASE_URL)
    if OPENAI_API_KEY:
        return (OPENAI_API_KEY, OPENAI_MODEL, None)
    return (None, None, None)


def _active_model() -> str:
    _key, model, _base = _resolve_backend()
    return model or OPENAI_MODEL


def is_enabled() -> bool:
    """True if EITHER the local fine-tune OR OpenAI is configured."""
    return bool(LOCAL_LLM_BASE_URL or OPENAI_API_KEY)


def is_local() -> bool:
    """True if the active backend is the on-device fine-tune."""
    return bool(LOCAL_LLM_BASE_URL)


async def get_client():
    """Lazily construct and cache a single AsyncOpenAI-compatible client."""
    global _client
    if _client is not None:
        return _client
    key, _model, base_url = _resolve_backend()
    if key is None:
        return None
    async with _client_lock:
        if _client is None:
            try:
                from openai import AsyncOpenAI
                kwargs: Dict[str, Any] = {"api_key": key}
                if base_url:
                    kwargs["base_url"] = base_url
                _client = AsyncOpenAI(**kwargs)
            except Exception as e:
                print(f"   ⚠️  LLM client init failed: {e}")
                return None
    return _client


async def complete_text(
    system: str,
    user: str,
    temperature: float = 0.7,
    max_tokens: int = 600,
) -> Optional[str]:
    """Return raw text completion, or None on failure / no backend."""
    client = await get_client()
    if client is None:
        return None
    try:
        resp = await client.chat.completions.create(
            model=_active_model(),
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception as e:
        print(f"   ⚠️  LLM text call failed: {e}")
        return None


async def complete_json(
    system: str,
    user: str,
    temperature: float = 0.4,
    max_tokens: int = 1200,
) -> Optional[Dict[str, Any]]:
    """Return parsed JSON object, or None on failure / no backend.

    Note: mlx_lm.server doesn't enforce response_format={'type':'json_object'}
    the way OpenAI does, so when running against the local model we strip the
    flag and instead rely on the strengthened "Respond ONLY with valid JSON"
    suffix in the system prompt. Most Llama-3.2-Instruct fine-tunes produce
    valid JSON reliably with that hint alone.
    """
    client = await get_client()
    if client is None:
        return None
    try:
        kwargs: Dict[str, Any] = {
            "model": _active_model(),
            "messages": [
                {"role": "system", "content": system + " Respond ONLY with valid JSON."},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if not is_local():
            kwargs["response_format"] = {"type": "json_object"}
        resp = await client.chat.completions.create(**kwargs)
        content = (resp.choices[0].message.content or "").strip()
        if not content:
            return None
        # Some local models wrap the JSON in ```json fences — strip them.
        if content.startswith("```"):
            content = content.strip("`")
            if content.lower().startswith("json"):
                content = content[4:].lstrip()
        return json.loads(content)
    except Exception as e:
        print(f"   ⚠️  LLM JSON call failed: {e}")
        return None
