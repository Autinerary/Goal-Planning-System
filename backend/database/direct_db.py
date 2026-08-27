"""Single place that opens a raw psycopg2 connection.

Memes, messaging and video calls use hand-written SQL rather than the Supabase
client, and each route file used to build its own connection with a localhost
fallback baked in:

    f"postgresql://{os.getenv('USER', 'aayushbhan')}:password@localhost:5432/…"

On Render there is no local Postgres and DATABASE_URL was unset, so all three
features returned 500 on every request — verified against production. The
fallback is what made it a silent failure: with no default the app would have
refused to serve those routes and said why, instead of trying localhost from
inside a container and reporting a connection error that reads like an outage.

Two rules here:
  * No default. A missing DATABASE_URL is a configuration fault and must say so.
  * Never let psycopg2's error text reach the client. It contains the host,
    port and user, which is information disclosure on a public API.
"""

from __future__ import annotations

import os
from typing import Optional

try:
    import psycopg2
    PSYCOPG2_AVAILABLE = True
except ImportError:  # pragma: no cover - environment dependent
    PSYCOPG2_AVAILABLE = False


class DirectDbUnavailable(RuntimeError):
    """Raised when the direct-SQL database is not configured or reachable."""


# Message shown to callers. Deliberately free of host, port, user and driver
# text — the detail belongs in the logs, not in an HTTP response body.
UNAVAILABLE_DETAIL = (
    "This feature is temporarily unavailable because its database is not "
    "configured. If you are the operator, set DATABASE_URL."
)


def is_configured() -> bool:
    return bool(os.getenv("DATABASE_URL") or os.getenv("DB_HOST")) and PSYCOPG2_AVAILABLE


def get_db_connection():
    """Open a connection, or raise DirectDbUnavailable with a safe message."""
    if not PSYCOPG2_AVAILABLE:
        raise DirectDbUnavailable("psycopg2 is not installed")

    url: Optional[str] = os.getenv("DATABASE_URL")
    host = os.getenv("DB_HOST")

    # Two shapes were in use: memes passed a DATABASE_URL, messaging and calls
    # passed discrete DB_HOST/DB_NAME/DB_USER kwargs. Accept both so neither
    # has to be rewritten, but require one of them to be set explicitly.
    if not url and not host:
        # No localhost guess. Guessing is what turned a config gap into three
        # features failing in production without a clear signal.
        raise DirectDbUnavailable("neither DATABASE_URL nor DB_HOST is set")

    try:
        if url:
            return psycopg2.connect(url)
        return psycopg2.connect(
            host=host,
            database=os.getenv("DB_NAME", "postgres"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", ""),
            port=os.getenv("DB_PORT", "5432"),
        )
    except Exception as e:
        # Log the real reason; hand the caller nothing exploitable.
        print(f"[direct_db] connection failed: {type(e).__name__}: {e}")
        raise DirectDbUnavailable("could not connect to the database") from e
