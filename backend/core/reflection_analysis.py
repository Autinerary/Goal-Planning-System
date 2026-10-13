"""Reflection Analysis, the deterministic version: what a person's own records
say, computed when it is read (docs/reports/reflection-analysis-2026-10-13.md).

For one person, from their journal entries (`reflections`), milestone ratings
(`milestone_ratings`) and milestone completions (`race_progress`):
  * ratings per milestone and per path: the latest rating of each milestone
    counts, and a path's score is the mean of (rating - 1) / 4, as in
    path_rating_scores (STEP 54);
  * milestones rated low: a latest rating of LOW_RATING or less, that is
    "Not useful" (1) or "A little" (2) on the milestone page;
  * completion over time: completions per week for the last WEEKS weeks and
    their trend, and how the active path stands against its own estimates
    (the rate Adaptation used to get as a constant 0.65);
  * counts of outcomes recorded: the answer given with each journal entry
    ("Did this suggestion help you?") and adaptation outcomes;
  * concerns in the last RECENT_DAYS days of journal entries, by keyword, each
    with what the entry was about.

No model is called, and nothing is stored: it is computed from tables that
already exist each time it is read, so it can't go stale and needs no
migration. Adaptation receives exactly this structure (core/orchestrator.py).

No data: someone with no journal entries and no ratings gets status
"no_data" and counts only, never a score.

Structure, version "reflection-analysis/1" (keys after `counts` only when
status is "ok"):
  version      "reflection-analysis/1"
  status       "ok" | "no_data"
  computed_at  ISO 8601, UTC
  counts       {reflections, ratings, completions}
  explanation  one sentence of what it was computed from (counts, never a score)
  ratings      {low_threshold, by_path: [{path_id, rated, score, milestones: {id: rating}}],
                low: [{path_id, milestone_id, rating, rated_at}]}           newest first
  completion   {path_id, milestones, completed, expected_by_now, rate, rate_status,
                behind: [milestone_id], next_up: milestone_id | None,
                by_week: [{week_start, completed}], trend}
  outcomes     {reflections: {helped, no_change, made_worse, not_sure, unrecorded},
                adaptations: {recorded}}
  concerns     [{type, severity, at, context_type, context_id}]           newest first
  themes       None (filled only by the optional theme step, behind a flag)
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

VERSION = "reflection-analysis/1"
LOW_RATING = 2          # 1 "Not useful", 2 "A little" (frontend/app/components/MilestoneRating.tsx)
WEEKS = 8               # completions per week, for this many weeks
RECENT_DAYS = 14        # concerns from journal entries this recent
MIN_EXPECTED = 2        # the completion rate is "unknown" until the path expects 2 milestones done
DEFAULT_DAYS = 7        # a milestone with no estimate, as path planning's placeholder
OUTCOMES = ("helped", "no_change", "made_worse", "not_sure")

# Keyword concerns, the same rules as the journal analysis
# (core/agents/reflection_analysis_agent.py, _identify_concerns).
CONCERNS: List[Tuple[str, str, Tuple[str, ...]]] = [
    ("burnout_risk", "high", ("burnout", "exhausted", "can't anymore", "giving up", "too much", "overwhelmed")),
    ("negative_self_talk", "medium", ("i'm stupid", "i'm useless", "i can't do anything", "i'm a failure",
                                      "what's wrong with me")),
    ("isolation", "medium", ("alone", "no one understands", "isolated", "by myself", "nobody")),
]
NEGATIVE_WORDS = (
    "struggling", "difficult", "hard", "exhausted", "tired", "burnout", "overwhelmed", "anxious", "worried",
    "stressed", "frustrated", "angry", "failed", "can't", "impossible", "hopeless", "stuck", "lost", "sad",
    "depressed", "lonely", "scared", "nervous", "confused",
)
SUSTAINED_NEGATIVE = 6   # more than 5 negative words in one entry


# ---- small helpers ------------------------------------------------------------

def parse_ts(value: Any) -> Optional[datetime]:
    """Supabase timestamps, on Python 3.9 (whose fromisoformat wants 6-digit fractions)."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    m = re.match(r"^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}:\d{2})(\.\d+)?)?(.*)$",
                 str(value or "").strip().replace("Z", "+00:00"))
    if not m:
        return None
    frac = (m.group(3) or ".0")[1:7].ljust(6, "0")
    try:
        dt = datetime.fromisoformat(f"{m.group(1)}T{m.group(2) or '00:00:00'}.{frac}{m.group(4) or ''}")
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _payload(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            return {}
    return raw if isinstance(raw, dict) else {}


def entry_text(entry: Dict[str, Any]) -> str:
    """A journal entry's own words: its free text and its answers, lowercased."""
    parts = [str(entry.get("free_form_text") or entry.get("freeFormText") or "")]
    for q in entry.get("questions") or []:
        if isinstance(q, dict) and q.get("answer"):
            parts.append(str(q["answer"]))
    return " ".join(p for p in parts if p).lower()


def concerns_in(text: str) -> List[Tuple[str, str]]:
    """(type, severity) for each concern the entry's words show."""
    found = [(kind, severity) for kind, severity, words in CONCERNS if any(w in text for w in words)]
    if sum(1 for w in NEGATIVE_WORDS if w in text) >= SUSTAINED_NEGATIVE:
        found.append(("sustained_negative_mood", "medium"))
    return found


def entry_outcome(entry: Dict[str, Any]) -> str:
    """The answer given with a journal entry, or 'unrecorded'."""
    feedback = entry.get("learningFeedback") or _payload(entry.get("reflection_response")).get("explicitFeedback")
    outcome = str((feedback or {}).get("outcome") or "")
    return outcome if outcome in OUTCOMES else "unrecorded"


def week_start(dt: datetime) -> str:
    return (dt - timedelta(days=dt.weekday())).date().isoformat()


# ---- the parts ------------------------------------------------------------------

def ratings_part(ratings: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    latest: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for r in ratings:
        key = (str(r.get("path_id")), str(r.get("milestone_id")))
        if key not in latest or str(r.get("created_at") or "") >= str(latest[key].get("created_at") or ""):
            latest[key] = r
    by_path: Dict[str, Dict[str, int]] = defaultdict(dict)
    for (path_id, milestone_id), r in latest.items():
        by_path[path_id][milestone_id] = int(r["rating"])
    low = [{"path_id": p, "milestone_id": m, "rating": int(r["rating"]), "rated_at": r.get("created_at")}
           for (p, m), r in latest.items() if int(r["rating"]) <= LOW_RATING]
    low.sort(key=lambda x: str(x["rated_at"] or ""), reverse=True)
    return {
        "low_threshold": LOW_RATING,
        "by_path": [{"path_id": p, "rated": len(ms),
                     "score": round(sum((v - 1) / 4 for v in ms.values()) / len(ms), 3),
                     "milestones": dict(sorted(ms.items()))}
                    for p, ms in sorted(by_path.items())],
        "low": low,
    }


def active_path(paths: List[Dict[str, Any]], path_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """The path asked for, else the active one, else the newest."""
    if path_id:
        for p in paths:
            if str(p.get("path_id")) == str(path_id):
                return p
    active = [p for p in paths if p.get("is_active")]
    pool = active or paths
    return max(pool, key=lambda p: str(p.get("created_at") or ""), default=None)


def completion_part(path: Optional[Dict[str, Any]], completions: List[Dict[str, Any]], now: datetime) -> Dict[str, Any]:
    done_at: Dict[str, datetime] = {}
    for c in completions:
        at = parse_ts(c.get("completed_at"))
        if c.get("milestone_id") and at:
            done_at[str(c["milestone_id"])] = at

    # Completions per week, oldest first, and the last 4 weeks against the 4 before.
    this_week = datetime.fromisoformat(week_start(now)).replace(tzinfo=timezone.utc)
    weeks = [(this_week - timedelta(weeks=i)).date().isoformat() for i in range(WEEKS - 1, -1, -1)]
    per_week = Counter(week_start(at) for at in done_at.values())
    by_week = [{"week_start": w, "completed": per_week.get(w, 0)} for w in weeks]
    recent, before = sum(x["completed"] for x in by_week[-4:]), sum(x["completed"] for x in by_week[:-4])
    trend = "unknown" if recent == before == 0 else "up" if recent > before else "down" if recent < before else "flat"

    out: Dict[str, Any] = {"path_id": None, "milestones": 0, "completed": 0, "expected_by_now": None,
                           "rate": None, "rate_status": "unknown", "behind": [], "next_up": None,
                           "by_week": by_week, "trend": trend}
    if not path:
        return out
    payload = _payload(path.get("payload"))
    start = parse_ts(path.get("created_at"))
    milestones = [m for race in payload.get("races") or [] if isinstance(race, dict)
                  for m in race.get("milestones") or [] if isinstance(m, dict) and m.get("id")]
    out.update({"path_id": str(path.get("path_id")), "milestones": len(milestones),
                "completed": sum(1 for m in milestones if str(m["id"]) in done_at)})
    if not milestones or start is None:
        return out

    # Each life area of each goal is a lane, done in order; a milestone is
    # expected done once its lane's estimates, added up from the day the
    # path was made, have passed.
    lanes: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    for m in milestones:
        lanes[(str(m.get("raceId") or ""), str(m.get("dimension") or ""))].append(m)
    due: List[Tuple[datetime, str]] = []
    for lane in lanes.values():
        elapsed = 0.0
        for m in sorted(lane, key=lambda x: x.get("order") if isinstance(x.get("order"), (int, float)) else 0):
            days = m.get("estimatedDays")
            elapsed += float(days) if isinstance(days, (int, float)) and days > 0 else DEFAULT_DAYS
            due.append((start + timedelta(days=elapsed), str(m["id"])))
    due.sort()
    expected = [mid for at, mid in due if at <= now]
    out["expected_by_now"] = len(expected)
    out["behind"] = [mid for mid in expected if mid not in done_at]
    out["next_up"] = next((mid for at, mid in due if at > now and mid not in done_at), None)
    if len(expected) >= MIN_EXPECTED:
        done = sum(1 for m in milestones if str(m["id"]) in done_at)
        out["rate"] = round(min(done, len(expected)) / len(expected), 3)
        out["rate_status"] = "known"
    return out


def concerns_part(entries: List[Dict[str, Any]], now: datetime) -> List[Dict[str, Any]]:
    out = []
    for e in entries:
        at = parse_ts(e.get("created_at")) or now
        if now - at > timedelta(days=RECENT_DAYS):
            continue
        for kind, severity in concerns_in(entry_text(e)):
            out.append({"type": kind, "severity": severity, "at": at.isoformat(),
                        "context_type": e.get("context_type") or e.get("contextType"),
                        "context_id": e.get("context_id") or e.get("contextId")})
    out.sort(key=lambda x: x["at"], reverse=True)
    return out


# ---- the analysis ---------------------------------------------------------------

def analyze(*, reflections: List[Dict[str, Any]], ratings: List[Dict[str, Any]], completions: List[Dict[str, Any]],
            paths: List[Dict[str, Any]], adaptation_outcomes: int = 0, path_id: Optional[str] = None,
            current_entry: Optional[Dict[str, Any]] = None, now: Optional[datetime] = None) -> Dict[str, Any]:
    """One person's analysis from their own rows. Pure: no database, no model.

    current_entry is a journal entry being written now (not stored yet); it
    counts as one of their reflections.
    """
    now = now or datetime.now(timezone.utc)
    entries = list(reflections) + ([{**current_entry, "created_at": now.isoformat()}] if current_entry else [])
    done = [c for c in completions if (c.get("kind") or "completed") == "completed"]
    result: Dict[str, Any] = {
        "version": VERSION,
        "status": "ok" if entries or ratings else "no_data",
        "computed_at": now.isoformat(),
        "counts": {"reflections": len(entries), "ratings": len(ratings), "completions": len(done)},
    }
    if result["status"] == "no_data":
        result["explanation"] = "No journal entries or milestone ratings yet, so there is nothing to analyse."
        return result
    result["explanation"] = (f"From {len(entries)} journal entr{'y' if len(entries) == 1 else 'ies'}, "
                             f"{len(ratings)} milestone rating{'' if len(ratings) == 1 else 's'} and "
                             f"{len(done)} completed milestone{'' if len(done) == 1 else 's'}.")
    outcomes = Counter(entry_outcome(e) for e in entries)
    result.update({
        "ratings": ratings_part(ratings),
        "completion": completion_part(active_path(paths, path_id), done, now),
        "outcomes": {"reflections": {k: outcomes.get(k, 0) for k in OUTCOMES + ("unrecorded",)},
                     "adaptations": {"recorded": int(adaptation_outcomes)}},
        "concerns": concerns_part(entries, now),
        "themes": None,
    })
    return result


def _rows(sb, table: str, cols: str, user_id: str) -> List[Dict[str, Any]]:
    try:
        return sb.table(table).select(cols).eq("user_id", user_id).execute().data or []
    except Exception as e:
        print(f"[reflection_analysis] {table} unavailable: {str(e)[:120]}")
        return []


def load(sb, user_id: str) -> Dict[str, Any]:
    """One person's rows, read only."""
    adaptations = _rows(sb, "adaptation_outcomes", "id", user_id)
    return {
        "reflections": _rows(sb, "reflections", "context_type, context_id, questions, free_form_text, "
                                                "reflection_response, created_at", user_id),
        "ratings": _rows(sb, "milestone_ratings", "path_id, milestone_id, rating, created_at", user_id),
        "completions": _rows(sb, "race_progress", "milestone_id, kind, completed_at", user_id),
        "paths": _rows(sb, "user_paths", "path_id, is_active, created_at, payload", user_id),
        "adaptation_outcomes": len(adaptations),
    }


UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)


def analyze_person(sb, user_id: str, path_id: Optional[str] = None,
                   current_entry: Optional[Dict[str, Any]] = None, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Read one person's rows and analyse them.

    Without a database, or for someone signed out (no account id), there is
    nothing to read: only an entry being written now can count.
    """
    readable = sb is not None and bool(UUID.match(str(user_id or "")))
    rows = load(sb, str(user_id)) if readable else {
        "reflections": [], "ratings": [], "completions": [], "paths": [], "adaptation_outcomes": 0}
    return analyze(**rows, path_id=path_id, current_entry=current_entry, now=now)
