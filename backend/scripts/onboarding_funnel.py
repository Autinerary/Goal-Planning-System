"""Onboarding funnel and post-setup survey report.

The success measures from Riipen Labs' onboarding review (Sept 2026):
  * the share of visitors who go on to create an account
  * where people leave during onboarding (drop-off per step)
  * the share who finish setup
  * the share who return within 7 days
broken down by acquisition channel (utm_source, e.g. tiktok / facebook), plus
the two-question survey shown after setup.

Reads public.onboarding_events and public.onboarding_feedback (STEP 45).
Counts only: no user ids, emails or visitor ids are printed. Survey comments
are free text and may contain personal details, so they are only printed with
--show-comments, for reading locally.

Run (from backend/):
  python -m scripts.onboarding_funnel                    # current version
  python -m scripts.onboarding_funnel --version all
  python -m scripts.onboarding_funnel --show-comments
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from statistics import median
from typing import Dict, Iterable, List, Optional

# Must match ONBOARDING_VERSION in frontend/lib/funnel.ts.
CURRENT_VERSION = "riipen-2026-10"

# Onboarding step ids in order, as in frontend/app/onboarding/page.tsx.
STEPS = [
    ("character", "Character & age"),
    ("barrierConnections", "Norms"),
    ("location", "Location (optional)"),
    ("goalsAndDreams", "Goals"),
    ("motivation", "Motivation (optional)"),
    ("profile", "Dream Self (optional)"),
    ("spiritAnimal", "Spirit animals (optional)"),
    ("personalize", "Personalize (optional)"),
    ("recommendations", "Resources"),
]

RETURN_WINDOW = timedelta(days=7)


def _ts(value: str) -> datetime:
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def keep_version(version: str, wanted: str) -> bool:
    """Test traffic ('qa-...') never counts; otherwise match the version."""
    if str(version).startswith("qa"):
        return False
    return wanted == "all" or version == wanted


def compute_funnel(events: Iterable[dict], wanted_version: str = CURRENT_VERSION) -> Dict:
    """Aggregate raw event rows into funnel counts. Pure: no I/O.

    A "person" is a visitor id (one browser). Stages count distinct visitors.
    Returned within 7 days: created an account, then an app_open on a later
    calendar day no more than 7 days after the account was created.
    """
    by_visitor: Dict[str, List[dict]] = defaultdict(list)
    for e in events:
        if keep_version(e.get("onboarding_version", ""), wanted_version):
            by_visitor[e["visitor_id"]].append(e)

    people = []
    for vid, evs in by_visitor.items():
        evs.sort(key=lambda e: e["created_at"])
        names = {e["event"] for e in evs}
        steps = {e.get("step") for e in evs if e["event"] == "onboarding_step_view"}
        channel = next((e.get("channel") for e in evs if e.get("channel")), None) or "(none)"
        signup_at = next((_ts(e["created_at"]) for e in evs if e["event"] == "signup_complete"), None)
        returned = False
        if signup_at is not None:
            for e in evs:
                if e["event"] != "app_open":
                    continue
                t = _ts(e["created_at"])
                if t.date() > signup_at.date() and t - signup_at <= RETURN_WINDOW:
                    returned = True
                    break
        people.append({
            "channel": channel,
            "landing": "landing_view" in names,
            "signup_view": "signup_view" in names,
            "account": signup_at is not None,
            "steps": steps,
            "finished": "onboarding_complete" in names,
            "returned": returned,
        })

    def stage_counts(group: List[dict]) -> Dict:
        return {
            "visitors": sum(p["landing"] for p in group),
            "signup_view": sum(p["signup_view"] for p in group),
            "accounts": sum(p["account"] for p in group),
            "steps": {sid: sum(sid in p["steps"] for p in group) for sid, _ in STEPS},
            "finished": sum(p["finished"] for p in group),
            "returned": sum(p["returned"] for p in group),
            "accounts_from_landing": sum(p["landing"] and p["account"] for p in group),
        }

    channels: Dict[str, List[dict]] = defaultdict(list)
    for p in people:
        channels[p["channel"]].append(p)

    all_times = [e["created_at"] for evs in by_visitor.values() for e in evs]
    return {
        "overall": stage_counts(people),
        "by_channel": {c: stage_counts(g) for c, g in sorted(channels.items(), key=lambda kv: -len(kv[1]))},
        "first_event": min(all_times) if all_times else None,
        "last_event": max(all_times) if all_times else None,
    }


def summarize_feedback(rows: Iterable[dict], wanted_version: str = CURRENT_VERSION) -> Dict:
    rows = [r for r in rows if keep_version(r.get("onboarding_version", ""), wanted_version)]
    eases = [r["setup_ease"] for r in rows if r.get("setup_ease")]
    return {
        "responses": len(rows),
        "info_before_signup": Counter(r["info_before_signup"] for r in rows if r.get("info_before_signup")),
        "ease": Counter(eases),
        "ease_median": median(eases) if eases else None,
        "comments": [r["comment"] for r in rows if r.get("comment")],
    }


def pct(n: int, d: int) -> str:
    return f"{100 * n / d:.0f}%" if d else "n/a"


def render(funnel: Dict, feedback: Dict, show_comments: bool) -> str:
    out: List[str] = []
    o = funnel["overall"]
    out.append(f"Events from {funnel['first_event'] or '-'} to {funnel['last_event'] or '-'}")
    out.append("")
    out.append("== Funnel (distinct browsers)")
    out.append(f"  visited the landing page        {o['visitors']}")
    out.append(f"  opened the sign-up form         {o['signup_view']}")
    out.append(f"  created an account              {o['accounts']}   "
               f"({pct(o['accounts_from_landing'], o['visitors'])} of landing visitors)")
    prev: Optional[int] = None
    for sid, label in STEPS:
        n = o["steps"][sid]
        drop = f"   (-{prev - n} from the step before)" if prev is not None and prev > n else ""
        out.append(f"  reached setup: {label:<27} {n}{drop}")
        prev = n
    out.append(f"  finished setup                  {o['finished']}   ({pct(o['finished'], o['accounts'])} of accounts)")
    out.append(f"  returned within 7 days          {o['returned']}   ({pct(o['returned'], o['accounts'])} of accounts)")
    out.append("")
    out.append("== By channel (utm_source of the first visit)")
    out.append(f"  {'channel':<14} {'visitors':>8} {'accounts':>9} {'finished':>9} {'returned 7d':>12}")
    for c, s in funnel["by_channel"].items():
        out.append(f"  {c[:14]:<14} {s['visitors']:>8} {s['accounts']:>9} {s['finished']:>9} {s['returned']:>12}")
    out.append("")
    out.append(f"== Post-setup survey: {feedback['responses']} responses")
    info = feedback["info_before_signup"]
    total_info = sum(info.values())
    for key, label in (("too_little", "not enough"), ("about_right", "about right"), ("too_much", "too much")):
        out.append(f"  information before sign-up: {label:<12} {info.get(key, 0)}  ({pct(info.get(key, 0), total_info)})")
    ease = feedback["ease"]
    out.append("  setup ease (1 very hard .. 5 very easy): " +
               "  ".join(f"{k}:{ease.get(k, 0)}" for k in range(1, 6)) +
               (f"   median {feedback['ease_median']}" if feedback["ease_median"] is not None else ""))
    out.append(f"  comments: {len(feedback['comments'])}" + ("" if show_comments else "  (use --show-comments to read them)"))
    if show_comments:
        for c in feedback["comments"]:
            out.append(f"    - {c}")
    return "\n".join(out)


def fetch_all(sb, table: str, cols: str) -> List[dict]:
    rows, start = [], 0
    while True:
        batch = sb.table(table).select(cols).range(start, start + 999).execute().data or []
        rows.extend(batch)
        if len(batch) < 1000:
            return rows
        start += 1000


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default=CURRENT_VERSION, help=f"onboarding version, or 'all' (default {CURRENT_VERSION})")
    ap.add_argument("--show-comments", action="store_true", help="print survey comments (free text)")
    args = ap.parse_args()

    from dotenv import load_dotenv
    load_dotenv()
    from database.supabase_client import get_supabase

    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return 1
    try:
        events = fetch_all(sb, "onboarding_events",
                           "visitor_id, event, step, channel, onboarding_version, created_at")
        feedback = fetch_all(sb, "onboarding_feedback",
                             "info_before_signup, setup_ease, comment, onboarding_version")
    except Exception as e:
        print(f"Could not read the funnel tables ({str(e)[:90]}). Has STEP 45 been applied?")
        return 1
    print(render(compute_funnel(events, args.version), summarize_feedback(feedback, args.version), args.show_comments))
    return 0


if __name__ == "__main__":
    sys.exit(main())
