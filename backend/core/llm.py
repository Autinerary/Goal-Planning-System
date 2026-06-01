"""
Shared OpenAI client helper used by all agents.

Provides a singleton AsyncOpenAI client plus convenience methods for
text + JSON completions. Falls back gracefully if no API key is set
or the network call fails — callers should treat None as "use rules".
"""

import os
import json
import asyncio
from typing import Any, Dict, Optional

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

_client = None
_client_lock = asyncio.Lock()


def is_enabled() -> bool:
    return bool(OPENAI_API_KEY)


async def get_client():
    """Lazily construct and cache a single AsyncOpenAI client."""
    global _client
    if _client is not None:
        return _client
    if not OPENAI_API_KEY:
        return None
    async with _client_lock:
        if _client is None:
            try:
                from openai import AsyncOpenAI
                _client = AsyncOpenAI(api_key=OPENAI_API_KEY)
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
    """Return raw text completion, or None on failure / no key."""
    client = await get_client()
    if client is None:
        return None
    try:
        resp = await client.chat.completions.create(
            model=OPENAI_MODEL,
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
    """Return parsed JSON object, or None on failure / no key."""
    client = await get_client()
    if client is None:
        return None
    try:
        resp = await client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system + " Respond ONLY with valid JSON."},
                {"role": "user", "content": user},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        content = (resp.choices[0].message.content or "").strip()
        return json.loads(content) if content else None
    except Exception as e:
        print(f"   ⚠️  LLM JSON call failed: {e}")
        return None
