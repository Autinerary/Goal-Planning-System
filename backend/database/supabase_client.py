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

    _client = create_client(url, key)
    return _client
