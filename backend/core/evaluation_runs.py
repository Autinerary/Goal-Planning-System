"""A log of Pattern Recognition experiment runs (evaluation_runs, STEP 61).

The harness calls start() before it computes anything and finish() at the
end. Each row records what produces the result, so two runs can be compared
or one rerun:
  * the script and git commit;
  * start and end time;
  * inputs: how many stored embeddings and how many are stale, the
    anonymisation text version, a hash of the condition canonicalisation
    map, how many similarity labels there are, the match_threshold, and the
    run's own settings.
Counts and settings only: no user ids, no emails, no free text.

Where the row goes:
  * a Postgres database named by EVALUATION_RUNS_DSN, if set (for example
    a local one, so a run against production data writes nothing there);
  * otherwise the evaluation_runs table through the Supabase client, once
    STEP 61 is applied.
If neither works the run carries on and says it wasn't logged.
"""
from __future__ import annotations

import json
import os
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

TABLE = "evaluation_runs"


def git_commit() -> Optional[str]:
    """The commit the code ran at: git here, or Render's variable, or None."""
    try:
        out = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True,
                             cwd=Path(__file__).resolve().parent, timeout=5)
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    return (os.getenv("RENDER_GIT_COMMIT") or "").strip()[:12] or None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class _Postgres:
    def __init__(self, dsn: str):
        import psycopg2  # only needed when a DSN is given
        self.conn = psycopg2.connect(dsn)
        self.conn.autocommit = True

    def insert(self, row: Dict[str, Any]) -> None:
        with self.conn.cursor() as cur:
            cur.execute(f"INSERT INTO public.{TABLE} (run_id, script, git_commit, started_at, inputs) "
                        "VALUES (%s, %s, %s, %s, %s::jsonb)",
                        (row["run_id"], row["script"], row["git_commit"], row["started_at"],
                         json.dumps(row["inputs"])))

    def finish(self, run_id: str, ended_at: str) -> None:
        with self.conn.cursor() as cur:
            cur.execute(f"UPDATE public.{TABLE} SET ended_at = %s WHERE run_id = %s", (ended_at, run_id))


class _Supabase:
    def __init__(self, sb):
        self.sb = sb

    def insert(self, row: Dict[str, Any]) -> None:
        self.sb.table(TABLE).insert(row).execute()

    def finish(self, run_id: str, ended_at: str) -> None:
        self.sb.table(TABLE).update({"ended_at": ended_at}).eq("run_id", run_id).execute()


class RunLog:
    """One run: start() before the work, finish() after."""

    def __init__(self, sb=None, dsn: Optional[str] = None):
        dsn = dsn if dsn is not None else os.getenv("EVALUATION_RUNS_DSN")
        self.writer = None
        self.where = None
        try:
            if dsn:
                self.writer, self.where = _Postgres(dsn), "EVALUATION_RUNS_DSN"
            elif sb is not None:
                self.writer, self.where = _Supabase(sb), TABLE
        except Exception as e:
            print(f"[evaluation_runs] not logged: {str(e)[:120]}")
        self.run_id: Optional[str] = None

    def start(self, script: str, inputs: Dict[str, Any], started_at: Optional[str] = None) -> Optional[str]:
        if self.writer is None:
            return None
        row = {"run_id": str(uuid.uuid4()), "script": script, "git_commit": git_commit(),
               "started_at": started_at or _now(), "inputs": inputs}
        try:
            self.writer.insert(row)
        except Exception as e:
            print(f"[evaluation_runs] not logged ({self.where}): {str(e)[:120]}")
            self.writer = None
            return None
        self.run_id = row["run_id"]
        return self.run_id

    def finish(self) -> None:
        if self.writer is None or self.run_id is None:
            return
        try:
            self.writer.finish(self.run_id, _now())
        except Exception as e:
            print(f"[evaluation_runs] end time not saved: {str(e)[:120]}")
