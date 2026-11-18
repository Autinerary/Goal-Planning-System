"""
Supabase client helper for the backend.
Used to share user state (barriers, profile) with the ServiceHub MVP via the
common Supabase project.
"""

import os
from typing import Optional

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except Exception:
    SUPABASE_AVAILABLE = False
    Client = None  # type: ignore


_client: Optional["Client"] = None

# How long one database request may take. supabase-py waits 120 s by default,
# and its calls are synchronous, so a stalled database held a request (and,
# where the call ran on the event loop, the whole server) for two minutes
# (bug audit, 17 November 2026, item 34). Sign-in checks have their own
# 5 s limit (httpx's default, in supabase_auth).
POSTGREST_TIMEOUT_SECONDS = 10


def _options():
    """Client options with the timeout above, or None (supabase-py's defaults)
    if this version of supabase-py doesn't take them."""
    try:
        from supabase import ClientOptions
        return ClientOptions(postgrest_client_timeout=POSTGREST_TIMEOUT_SECONDS)
    except Exception as e:  # pragma: no cover - depends on the installed version
        print(f"[supabase] default timeouts kept: {type(e).__name__}: {e}")
        return None


def get_supabase() -> Optional["Client"]:
    """Return a shared Supabase client using the service role key.

    Returns None if Supabase is not configured (e.g. simulation mode without
    env vars). Callers should treat None as "skip Supabase write/read".
    """
    global _client
    if not SUPABASE_AVAILABLE:
        return None
    if _client is not None:
        return _client

    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None

    options = _options()
    _client = create_client(url, key, options) if options is not None else create_client(url, key)
    return _client
