"""Onboarding funnel and post-setup survey report.

Success measures from Riipen Labs' onboarding reviews (Sept 2026):
  * Group 1: the share of visitors who create an account, where people leave
    during onboarding (drop-off per step), the share who return within 7 days
  * Group 2: "compare goal completion, clarity and perceived effort across
    representative user types and acquisition channels"

So, besides the funnel, people are compared by who they are here for (the
first onboarding question, saved to profiles.preferences.audience) and by
acquisition channel (utm_source of the first visit), on: finished setup,
returned within 7 days, and the post-setup survey's clarity question ("how
much did you know before making an account?") and effort question ("how
easy was setup?").

Group 2 also asked to "ask active users about usefulness and inactive users
why they disengaged". Those answers (public.checkin_responses, STEP 46) are
summarized at the end: why people stopped, from the check-in email and the
welcome-back question, and whether active users find it useful, each split by
who they are here for. Check-ins are not split by onboarding version.

Reads public.onboarding_events and public.onboarding_feedback (STEP 45),
public.checkin_responses (STEP 46) and profiles.preferences. Counts only: no
user ids, emails or visitor ids are printed. Survey and check-in comments are
free text and may contain personal details, so they are only printed with
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
CURRENT_VERSION = "goalfirst-2026-10"

# Onboarding step ids in order, as in frontend/app/onboarding/page.tsx. The
# first three are the required start; the rest are optional extras.
STEPS = [
    ("about", "About you (age, who for)"),
    ("goalsAndDreams", "One goal"),
    ("barrierConnections", "Norms (optional)"),
    ("location", "extra: Location"),
    ("motivation", "extra: Motivation"),
    ("character", "extra: Character"),
    ("profile", "extra: Dream Self"),
    ("spiritAnimal", "extra: Spirit animals"),
    ("personalize", "extra: Personalize"),
    ("recommendations", "extra: Resources"),
]
CORE_STEPS = 3

AUDIENCE_LABELS = {
    "self": "myself",
    "child": "my child",
    "family": "family member",
    "friend": "a friend",
    "work": "teach / work with",
    "ally": "ally / learning",
}
NOT_ANSWERED = "(not answered)"

# Check-in answers, as in frontend/lib/checkin.ts.
STOP_REASONS = [
    ("too_much", "too much to set up or learn"),
    ("not_what_i_needed", "not what I needed"),
    ("hard_to_find", "couldn't find what I wanted"),
    ("no_time", "didn't have time"),
    ("not_useful_yet", "not useful yet"),
    ("just_exploring", "just exploring"),
    ("other", "something else"),
]
USEFULNESS = [("very", "very useful"), ("somewhat", "somewhat"), ("not_yet", "not yet")]

RETURN_WINDOW = timedelta(days=7)

# Rows for groups smaller than this show "<5" instead of counts and rates, so
# a shared copy of the report cannot single anyone out. Totals are unaffected.
MIN_CELL = 5
SMALL = f"<{MIN_CELL}"


def _ts(value: str) -> datetime:
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def keep_version(version: str, wanted: str) -> bool:
    """Test traffic ('qa-...') never counts; otherwise match the version."""
    if str(version).startswith("qa"):
        return False
    return wanted == "all" or version == wanted


def compute_funnel(events: Iterable[dict], wanted_version: str = CURRENT_VERSION,
                   audience_by_user: Optional[Dict[str, str]] = None) -> Dict:
    """Aggregate raw event rows into funnel counts. Pure: no I/O.

    A "person" is a visitor id (one browser). Stages count distinct visitors.
    Returned within 7 days: created an account, then an app_open on a later
    calendar day no more than 7 days after the account was created.
    """
    audience_by_user = audience_by_user or {}
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
        user_id = next((e.get("user_id") for e in evs if e.get("user_id")), None)
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
        audience = audience_by_user.get(user_id) if user_id else None
        people.append({
            "user_id": user_id,
            "channel": channel,
            "audience": AUDIENCE_LABELS.get(audience, NOT_ANSWERED),
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

    def grouped(key: str) -> Dict[str, Dict]:
        groups: Dict[str, List[dict]] = defaultdict(list)
        for p in people:
            groups[p[key]].append(p)
        return {g: stage_counts(m) for g, m in sorted(groups.items(), key=lambda kv: -len(kv[1]))}

    all_times = [e["created_at"] for evs in by_visitor.values() for e in evs]
    return {
        "overall": stage_counts(people),
        "by_channel": grouped("channel"),
        "by_audience": grouped("audience"),
        "people": people,
        "first_event": min(all_times) if all_times else None,
        "last_event": max(all_times) if all_times else None,
    }


def _survey_stats(rows: List[dict]) -> Dict:
    eases = [r["setup_ease"] for r in rows if r.get("setup_ease")]
    infos = [r["info_before_signup"] for r in rows if r.get("info_before_signup")]
    return {
        "responses": len(rows),
        "info_before_signup": Counter(infos),
        "about_right_share": (sum(1 for i in infos if i == "about_right") / len(infos)) if infos else None,
        "ease": Counter(eases),
        "ease_median": median(eases) if eases else None,
    }


def summarize_feedback(rows: Iterable[dict], wanted_version: str = CURRENT_VERSION,
                       people: Optional[List[dict]] = None) -> Dict:
    """Survey totals, and the same split by user type and channel when the
    funnel's people (which carry user ids) are given."""
    rows = [r for r in rows if keep_version(r.get("onboarding_version", ""), wanted_version)]
    out = _survey_stats(rows)
    out["comments"] = [r["comment"] for r in rows if r.get("comment")]
    person = {p["user_id"]: p for p in (people or []) if p.get("user_id")}
    for key in ("audience", "channel"):
        groups: Dict[str, List[dict]] = defaultdict(list)
        for r in rows:
            p = person.get(r.get("user_id"))
            groups[p[key] if p else NOT_ANSWERED if key == "audience" else "(none)"].append(r)
        out[f"by_{key}"] = {g: _survey_stats(m) for g, m in groups.items()}
    return out


def pct(n: int, d: int) -> str:
    return f"{100 * n / d:.0f}%" if d else "n/a"


def _comparison(title: str, funnel_groups: Dict[str, Dict], survey_groups: Dict[str, Dict]) -> List[str]:
    out = [f"== {title}",
           f"  {'group':<20} {'accounts':>8} {'finished':>9} {'back in 7d':>10} {'surveyed':>8} {'clarity ok':>10} {'ease (1-5)':>10}"]
    for g in list(funnel_groups) + [g for g in survey_groups if g not in funnel_groups]:
        f = funnel_groups.get(g, {"accounts": 0, "finished": 0, "returned": 0})
        s = survey_groups.get(g)
        if max(f["accounts"], s["responses"] if s else 0) < MIN_CELL:
            out.append(f"  {g[:20]:<20} {SMALL:>8} {'-':>9} {'-':>10} {'-':>8} {'-':>10} {'-':>10}")
            continue
        clarity = f"{100 * s['about_right_share']:.0f}%" if s and s["about_right_share"] is not None else "-"
        ease = f"{s['ease_median']}" if s and s["ease_median"] is not None else "-"
        out.append(f"  {g[:20]:<20} {f['accounts']:>8} {pct(f['finished'], f['accounts']):>9} "
                   f"{pct(f['returned'], f['accounts']):>10} {(s['responses'] if s else 0):>8} {clarity:>10} {ease:>10}")
    return out


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
    for i, (sid, label) in enumerate(STEPS):
        n = o["steps"][sid]
        drop = f"   (-{prev - n} from the step before)" if prev is not None and prev > n and i < CORE_STEPS else ""
        out.append(f"  reached setup: {label:<27} {n}{drop}")
        prev = n
    out.append(f"  finished setup                  {o['finished']}   ({pct(o['finished'], o['accounts'])} of accounts)")
    out.append(f"  returned within 7 days          {o['returned']}   ({pct(o['returned'], o['accounts'])} of accounts)")
    out.append("")
    out.extend(_comparison("By who they are here for", funnel.get("by_audience", {}), feedback.get("by_audience", {})))
    out.append("")
    out.extend(_comparison("By channel (utm_source of the first visit)", funnel["by_channel"], feedback.get("by_channel", {})))
    out.append("  (clarity ok = answered \"about right\" to how much they knew before making an account;")
    out.append(f"   groups smaller than {MIN_CELL} show {SMALL})")
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


def summarize_checkins(rows: Iterable[dict], audience_by_user: Optional[Dict[str, str]] = None) -> Dict:
    """Why people stopped (email and welcome-back answers) and whether active
    users find it useful, overall and by who they are here for. Pure."""
    audience_by_user = audience_by_user or {}
    # Test answers ('qa-...' versions) never count, as in the funnel.
    rows = [r for r in rows if not str(r.get("onboarding_version") or "").startswith("qa")]

    def audience(r: dict) -> str:
        return AUDIENCE_LABELS.get(audience_by_user.get(r.get("user_id")), NOT_ANSWERED)

    stopped = [r for r in rows if r.get("kind") in ("inactive_email", "welcome_back")]
    useful = [r for r in rows if r.get("kind") == "usefulness"]
    by_audience: Dict[str, Dict[str, Counter]] = defaultdict(lambda: {"reasons": Counter(), "usefulness": Counter()})
    for r in stopped:
        if r.get("reason"):
            by_audience[audience(r)]["reasons"][r["reason"]] += 1
    for r in useful:
        if r.get("usefulness"):
            by_audience[audience(r)]["usefulness"][r["usefulness"]] += 1
    return {
        "stopped": len(stopped),
        "from_email": sum(r["kind"] == "inactive_email" for r in stopped),
        "on_return": sum(r["kind"] == "welcome_back" for r in stopped),
        "reasons": Counter(r["reason"] for r in stopped if r.get("reason")),
        "useful": len(useful),
        "usefulness": Counter(r["usefulness"] for r in useful if r.get("usefulness")),
        "by_audience": dict(by_audience),
        "comments": [(r["kind"], r["comment"]) for r in rows if r.get("comment")],
    }


def render_checkins(c: Dict, show_comments: bool) -> str:
    labels = dict(STOP_REASONS)
    out = [f"== Why people stopped (check-ins, all versions): {c['stopped']} answers "
           f"({c['from_email']} from the email, {c['on_return']} on coming back)"]
    total = sum(c["reasons"].values())
    for key, label in STOP_REASONS:
        out.append(f"  {label:<30} {c['reasons'].get(key, 0):>4}  ({pct(c['reasons'].get(key, 0), total)})")
    out.append("")
    useful_total = sum(c["usefulness"].values())
    out.append(f"== Useful so far? (active users, after 5 days of use): {c['useful']} answers")
    out.append("  " + "   ".join(f"{label}: {c['usefulness'].get(key, 0)} ({pct(c['usefulness'].get(key, 0), useful_total)})"
                                for key, label in USEFULNESS))
    if c["by_audience"]:
        out.append("")
        out.append("== Check-ins by who they are here for")
        out.append(f"  {'group':<20} {'stopped':>7}  {'most common reason':<30} {'useful?':>7}  very/somewhat/not yet")
        for g, m in sorted(c["by_audience"].items(), key=lambda kv: -sum(kv[1]["reasons"].values()) - sum(kv[1]["usefulness"].values())):
            n_stop = sum(m["reasons"].values())
            if n_stop + sum(m["usefulness"].values()) < MIN_CELL:
                out.append(f"  {g[:20]:<20} {SMALL:>7}  {'-':<30} {'-':>7}  -")
                continue
            top = m["reasons"].most_common(1)
            top_label = f"{labels[top[0][0]]} ({top[0][1]})" if top else "-"
            u = m["usefulness"]
            out.append(f"  {g[:20]:<20} {n_stop:>7}  {top_label[:30]:<30} {sum(u.values()):>7}  "
                       f"{u.get('very', 0)}/{u.get('somewhat', 0)}/{u.get('not_yet', 0)}")
    out.append(f"  comments: {len(c['comments'])}" + ("" if show_comments else "  (use --show-comments to read them)"))
    if show_comments:
        for kind, text in c["comments"]:
            out.append(f"    - [{kind}] {text}")
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
                           "visitor_id, user_id, event, step, channel, onboarding_version, created_at")
        feedback = fetch_all(sb, "onboarding_feedback",
                             "user_id, info_before_signup, setup_ease, comment, onboarding_version")
    except Exception as e:
        print(f"Could not read the funnel tables ({str(e)[:90]}). Has STEP 45 been applied?")
        return 1
    audience_by_user = {}
    for p in fetch_all(sb, "profiles", "id, preferences"):
        aud = (p.get("preferences") or {}).get("audience")
        if aud:
            audience_by_user[p["id"]] = aud
    funnel = compute_funnel(events, args.version, audience_by_user)
    print(render(funnel, summarize_feedback(feedback, args.version, funnel["people"]), args.show_comments))
    print()
    try:
        checkins = fetch_all(sb, "checkin_responses", "user_id, kind, reason, usefulness, comment, onboarding_version")
    except Exception:
        print("== Check-ins: not available yet (apply STEP 46).")
        return 0
    print(render_checkins(summarize_checkins(checkins, audience_by_user), args.show_comments))
    return 0


if __name__ == "__main__":
    sys.exit(main())
