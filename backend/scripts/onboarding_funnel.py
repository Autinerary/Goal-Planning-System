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

Group 3 measured success as "onboarding completion rates, time to first
meaningful action, and whether new users return within their first 7 to 14
days", and suggested asking where people heard about Autinerary. So the
funnel also shows returns within 14 days, how long after sign-up people mark
their first step done (race_progress), and the self-reported channel
(profiles.preferences.heardFrom), next to the tracked one.

Group 4 recommended a guided "Start here" (who you are here for, what you
need today, then a first pathway of resources) and measures for it:
completion ("select a role and goal, then reach a resource list"), relevance
("users mark results as useful or save the path") and confidence ("choose a
next action"). Those come from the start_* events (STEP 48), split by need
and by who it is for, with the resources opened most.

Group 5 set targets: "reduce drop-off by 40%+ (completion rate), track 7-14
day retention, and monitor first-week satisfaction scores", and suggested
tracking "which features different user groups actually use". So the report
also compares setup completion across onboarding versions, shows usefulness
answers given in the first two weeks, and which parts of the app each group
opens (feature_use events, STEP 49).

Group 6 asked to "track user behaviour of where they click, leave, and whether
they return". Where they click and whether they return are above; where
they leave is the parts of the app people opened on their last day, for
those who have now been away two weeks or more.

Group 7 asked to "measure completion rates, time to first action and drop-off
by step", and to test, not assume, that people answer optional questions
later. So the funnel also shows how long after sign-up people open their
first step, and the questions asked later (ask_later events, STEP 50) are
counted: shown, answered, closed.

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
CURRENT_VERSION = "twostep-2026-10"

# Onboarding step ids in order, as in frontend/app/onboarding/page.tsx. The
# first two are the required start; the rest are optional extras. (Before
# twostep-2026-10, norms were the third step of the start, and there was an
# AI recommendations step at the end.)
STEPS = [
    ("about", "About you (age, who for)"),
    ("goalsAndDreams", "One goal"),
    ("barrierConnections", "extra: Norms"),
    ("location", "extra: Location"),
    ("motivation", "extra: Motivation"),
    ("character", "extra: Character"),
    ("profile", "extra: Dream Self"),
    ("spiritAnimal", "extra: Spirit animals"),
    ("personalize", "extra: Personalize"),
]
CORE_STEPS = 2

AUDIENCE_LABELS = {
    "self": "myself",
    "child": "my child",
    "family": "family member",
    "friend": "a friend",
    "work": "teach / work with",
    "ally": "ally / learning",
    "unsure": "not sure yet",
}
NOT_ANSWERED = "(not answered)"

# "Start here" answers, as in frontend/lib/startHere.ts. Its "family" covers
# friends too.
START_EVENTS = ("start_role", "start_pathway", "start_open", "start_useful", "start_save")
START_ROLES = [
    ("self", "myself"),
    ("child", "my child"),
    ("family", "family or friend"),
    ("work", "teach / work with"),
    ("ally", "ally / learning"),
    ("unsure", "not sure yet"),
]
START_NEEDS = [
    ("learn", "starter information"),
    ("services", "services"),
    ("community", "similar experiences"),
    ("school_work", "school or work"),
    ("sensory", "sensory tools"),
    ("unsure", "not sure yet"),
]

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

# Optional setup questions asked later on the Path, as in frontend/lib/askLater.ts.
ASK_LATER = [
    ("location", "Location", ["location"]),
    ("aboutYou", "Sensory needs and conditions", ["aboutYou"]),
    ("makeItYours", "Character, spirit animals, look", ["character", "spiritAnimal", "personalize"]),
]

# ResourceHub's first session (Riipen Labs, Group 8), as sent by
# servicehub-mvp/app/api/events/route.ts: setup steps (lib/onboarding/setup.ts)
# and the prompts that ask for more later (lib/track.ts).
RH_SETUP_STEPS = ["role", "topic", "first"]
RH_PROMPTS = [
    ("sharpen", "Welcome back: sharpen matches"),
    ("more_like_these", "Want more like these?"),
    ("add_topic", "Add a searched topic"),
]

RETURN_WINDOW = timedelta(days=7)
RETURN_WINDOW_LONG = timedelta(days=14)
FIRST_WEEKS = timedelta(days=14)

# Parts of the app counted by feature_use, as in frontend/lib/funnel.ts.
AREAS = [
    ("path", "Path"), ("races", "Races"), ("milestones", "Milestones"), ("calendar", "Calendar"),
    ("tasks", "Tasks"), ("pit_stop", "Pit Stop"), ("tools", "Tools"), ("journal", "Journal"),
    ("assistant", "Assistant"), ("family", "Family"), ("dream_self", "Dream Self"),
    ("settings", "Settings"), ("start", "Start here"), ("path_market", "Path Market"),
    ("compare", "Compare paths"), ("tidbits", "Tidbits"), ("resourcehub", "ResourceHub"),
]

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
                   audience_by_user: Optional[Dict[str, str]] = None,
                   first_done_by_user: Optional[Dict[str, str]] = None) -> Dict:
    """Aggregate raw event rows into funnel counts. Pure: no I/O.

    A "person" is a visitor id (one browser). Stages count distinct visitors.
    Returned within 7 (14) days: created an account, then an app_open on a
    later calendar day no more than 7 (14) days after the account was created.
    First step: the first milestone they marked done (first_done_by_user, the
    earliest race_progress completion per user), and how long after sign-up.
    """
    audience_by_user = audience_by_user or {}
    first_done_by_user = first_done_by_user or {}
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
        returned = returned_long = False
        if signup_at is not None:
            for e in evs:
                if e["event"] != "app_open":
                    continue
                t = _ts(e["created_at"])
                if t.date() > signup_at.date() and t - signup_at <= RETURN_WINDOW_LONG:
                    returned_long = True
                    if t - signup_at <= RETURN_WINDOW:
                        returned = True
        # First action: opening a step (feature_use "milestones") after sign-up.
        first_open_hours = None
        if signup_at is not None:
            opens = [_ts(e["created_at"]) for e in evs if e["event"] == "feature_use"
                     and e.get("step") == "milestones" and _ts(e["created_at"]) >= signup_at]
            if opens:
                first_open_hours = (min(opens) - signup_at).total_seconds() / 3600
        first_step_hours = None
        if signup_at is not None and user_id and first_done_by_user.get(user_id):
            done_at = _ts(first_done_by_user[user_id])
            if done_at >= signup_at:
                first_step_hours = (done_at - signup_at).total_seconds() / 3600
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
            "returned_14": returned_long,
            "first_step_hours": first_step_hours,
            "first_open_hours": first_open_hours,
        })

    def stage_counts(group: List[dict]) -> Dict:
        return {
            "visitors": sum(p["landing"] for p in group),
            "signup_view": sum(p["signup_view"] for p in group),
            "accounts": sum(p["account"] for p in group),
            "steps": {sid: sum(sid in p["steps"] for p in group) for sid, _ in STEPS},
            "finished": sum(p["finished"] for p in group),
            "returned": sum(p["returned"] for p in group),
            "returned_14": sum(p["returned_14"] for p in group),
            "first_step": sum(p["first_step_hours"] is not None for p in group),
            "first_open": sum(p["first_open_hours"] is not None for p in group),
            "first_open_median_hours": median(h) if (h := [p["first_open_hours"] for p in group if p["first_open_hours"] is not None]) else None,
            "first_step_median_hours": median(h) if (h := [p["first_step_hours"] for p in group if p["first_step_hours"] is not None]) else None,
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


def _duration(hours: float) -> str:
    if hours < 1:
        return f"{round(hours * 60)} min"
    if hours < 48:
        return f"{hours:.1f} h"
    return f"{hours / 24:.1f} days"


def summarize_heard_from(people: List[dict], heard_from_by_user: Dict[str, str]) -> Counter:
    """Self-reported channel, for accounts in this funnel that answered."""
    return Counter(heard_from_by_user[p["user_id"]] for p in people
                   if p.get("account") and p.get("user_id") in heard_from_by_user)


def render_heard_from(counts: Counter) -> str:
    total = sum(counts.values())
    out = [f"== Where they heard about us (self-reported, {total} accounts answered)"]
    for source, n in counts.most_common():
        shown = SMALL if n < MIN_CELL else str(n)
        share = "-" if n < MIN_CELL else pct(n, total)
        out.append(f"  {source:<20} {shown:>5}  ({share})")
    return "\n".join(out)


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
    out.append(f"  returned within 14 days         {o['returned_14']}   ({pct(o['returned_14'], o['accounts'])} of accounts)")
    out.append(f"  opened their first step         {o['first_open']}   ({pct(o['first_open'], o['accounts'])} of accounts)"
               + (f", median {_duration(o['first_open_median_hours'])} after sign-up" if o['first_open_median_hours'] is not None else ""))
    out.append(f"  marked a first step done        {o['first_step']}   ({pct(o['first_step'], o['accounts'])} of accounts)"
               + (f", median {_duration(o['first_step_median_hours'])} after sign-up" if o['first_step_median_hours'] is not None else ""))
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


def compute_start_here(events: Iterable[dict], wanted_version: str = CURRENT_VERSION) -> Dict:
    """Group 4's measures for "Start here", counting distinct browsers. Pure.

    Steps carry the answers: "child", "child.services",
    "child.services.therapists" (opened), "child.services.yes" (useful).
    A browser that looked at two pathways counts once in each of their groups.
    """
    by_visitor: Dict[str, List[dict]] = defaultdict(list)
    for e in events:
        if keep_version(e.get("onboarding_version", ""), wanted_version):
            by_visitor[e["visitor_id"]].append(e)

    overall: Counter = Counter()
    groups: Dict[str, Dict[str, Counter]] = {"need": defaultdict(Counter), "role": defaultdict(Counter)}
    opened: Counter = Counter()
    for evs in by_visitor.values():
        start = [e for e in evs if e["event"] in START_EVENTS and e.get("step")]
        if not start:
            continue
        names = {e["event"] for e in start}
        acts: Dict[tuple, set] = defaultdict(set)  # (role, need) -> what they did there
        items = set()
        for e in start:
            parts = str(e["step"]).split(".")
            if e["event"] == "start_role" or len(parts) < 2:
                continue
            key = (parts[0], parts[1])
            if e["event"] == "start_pathway":
                acts[key].add("pathway")
            elif e["event"] == "start_open":
                acts[key].add("opened")
                if len(parts) == 3:
                    items.add((parts[1], parts[2]))
            elif e["event"] == "start_useful" and len(parts) == 3:
                acts[key].add("yes" if parts[2] == "yes" else "no")
            elif e["event"] == "start_save":
                acts[key].add("saved")
        everything = set().union(*acts.values()) if acts else set()
        overall["started"] += 1
        overall["chose_role"] += "start_role" in names
        for a in ("pathway", "opened", "saved", "yes", "no"):
            overall[a] += a in everything
        overall["next_action"] += bool(everything & {"opened", "saved"})
        pathway_times = [_ts(e["created_at"]) for e in start if e["event"] == "start_pathway"]
        if pathway_times:
            first = min(pathway_times)
            overall["account_after"] += any(
                e["event"] == "signup_complete" and _ts(e["created_at"]) >= first for e in evs)
        for dim, i in (("role", 0), ("need", 1)):
            merged: Dict[str, set] = defaultdict(set)
            for key, done in acts.items():
                merged[key[i]] |= done
            for value, done in merged.items():
                g = groups[dim][value]
                g["people"] += 1
                for a in ("pathway", "opened", "saved", "yes", "no"):
                    g[a] += a in done
        opened.update(items)
    return {"overall": overall, "by_need": dict(groups["need"]), "by_role": dict(groups["role"]), "opened": opened}


def render_start_here(s: Dict) -> str:
    o = s["overall"]
    out = ["== Start here (home page and /start; distinct browsers)",
           f"  used it                         {o['started']}",
           f"  chose who they are here for     {o['chose_role']}",
           f"  reached a pathway               {o['pathway']}   ({pct(o['pathway'], o['started'])} of those who used it)",
           f"  opened a resource               {o['opened']}   ({pct(o['opened'], o['pathway'])} of pathways)",
           f"  saved the path                  {o['saved']}   ({pct(o['saved'], o['pathway'])} of pathways)",
           f"  chose a next action             {o['next_action']}   ({pct(o['next_action'], o['pathway'])} of pathways: opened or saved)",
           f"  said it was useful              yes {o['yes']}, not really {o['no']}",
           f"  then created an account         {o['account_after']}   ({pct(o['account_after'], o['pathway'])} of pathways)"]
    for title, key, labels in (("By what they need", "by_need", START_NEEDS), ("By who it is for", "by_role", START_ROLES)):
        out.append("")
        out.append(f"== Start here: {title.lower()}")
        out.append(f"  {'group':<20} {'browsers':>8} {'opened':>7} {'saved':>6} {'useful':>7} {'not useful':>10}")
        for value, label in labels:
            g = s[key].get(value)
            if not g:
                continue
            if g["people"] < MIN_CELL:
                out.append(f"  {label:<20} {SMALL:>8} {'-':>7} {'-':>6} {'-':>7} {'-':>10}")
                continue
            out.append(f"  {label:<20} {g['people']:>8} {pct(g['opened'], g['people']):>7} {pct(g['saved'], g['people']):>6} "
                       f"{g['yes']:>7} {g['no']:>10}")
    needs = dict(START_NEEDS)
    shown = [(k, n) for k, n in s["opened"].most_common() if n >= MIN_CELL][:10]
    out.append("")
    out.append(f"== Start here: resources opened most (by need; fewer than {MIN_CELL} not listed)")
    for (need, item), n in shown:
        out.append(f"  {item:<14} ({needs.get(need, need)})  {n}")
    if not shown:
        out.append("  (none yet)")
    return "\n".join(out)


def compare_versions(events: Iterable[dict]) -> List[Dict]:
    """Setup completion for each onboarding version, oldest first. Group 5's
    target is 40% less drop-off: accounts that did not finish setup. Pure."""
    by_version: Dict[str, Dict] = defaultdict(lambda: {"accounts": set(), "finished": set(), "first": None})
    for e in events:
        version = str(e.get("onboarding_version", ""))
        if version.startswith("qa"):
            continue
        g = by_version[version]
        if g["first"] is None or e["created_at"] < g["first"]:
            g["first"] = e["created_at"]
        if e["event"] == "signup_complete":
            g["accounts"].add(e["visitor_id"])
        elif e["event"] == "onboarding_complete":
            g["finished"].add(e["visitor_id"])
    rows = []
    for version, g in sorted(by_version.items(), key=lambda kv: kv[1]["first"] or ""):
        if not g["accounts"]:
            continue
        rows.append({"version": version, "accounts": len(g["accounts"]),
                     "finished": len(g["finished"] & g["accounts"])})
    return rows


def render_versions(rows: List[Dict]) -> str:
    out = ["== Setup completion by onboarding version (Group 5's target: 40% less drop-off)",
           f"  {'version':<22} {'accounts':>8} {'finished':>9} {'dropped off':>11}"]
    for r in rows:
        if r["accounts"] < MIN_CELL:
            out.append(f"  {r['version'][:22]:<22} {SMALL:>8} {'-':>9} {'-':>11}")
            continue
        out.append(f"  {r['version'][:22]:<22} {r['accounts']:>8} {pct(r['finished'], r['accounts']):>9} "
                   f"{pct(r['accounts'] - r['finished'], r['accounts']):>11}")
    big = [r for r in rows if r["accounts"] >= MIN_CELL]
    if len(big) >= 2:
        before, after = big[-2], big[-1]
        drop_before = (before["accounts"] - before["finished"]) / before["accounts"]
        drop_after = (after["accounts"] - after["finished"]) / after["accounts"]
        if drop_before > 0:
            change = (drop_after - drop_before) / drop_before
            out.append(f"  drop-off {after['version']} vs {before['version']}: {100 * change:+.0f}%"
                       + ("  (target met)" if change <= -0.40 else ""))
    if not rows:
        out.append("  (no accounts yet)")
    return "\n".join(out)


def summarize_feature_use(events: Iterable[dict], wanted_version: str = CURRENT_VERSION,
                          audience_by_user: Optional[Dict[str, str]] = None) -> Dict:
    """Which parts of the app each account opened, by who they are here for.
    Counts accounts (signed-in people), not visits. Pure."""
    audience_by_user = audience_by_user or {}
    used: Dict[str, set] = defaultdict(set)
    for e in events:
        if e["event"] == "feature_use" and e.get("user_id") and e.get("step") \
                and keep_version(e.get("onboarding_version", ""), wanted_version):
            used[e["user_id"]].add(e["step"])
    groups: Dict[str, List[set]] = defaultdict(list)
    for user_id, areas in used.items():
        groups["all"].append(areas)
        groups[AUDIENCE_LABELS.get(audience_by_user.get(user_id), NOT_ANSWERED)].append(areas)
    return {g: {"accounts": len(members), "areas": Counter(a for areas in members for a in areas)}
            for g, members in groups.items()}


def render_feature_use(f: Dict) -> str:
    out = ["== Parts of the app people open (share of accounts that opened each)"]
    if not f:
        out.append("  (none yet: apply STEP 49)")
        return "\n".join(out)
    shown = ["all"] + sorted((g for g in f if g != "all" and f[g]["accounts"] >= MIN_CELL),
                             key=lambda g: -f[g]["accounts"])
    hidden = sum(1 for g in f if g != "all" and f[g]["accounts"] < MIN_CELL)
    out.append(f"  {'part':<16}" + "".join(f"{g[:14]:>16}" for g in shown))
    out.append(f"  {'accounts':<16}" + "".join(f"{f[g]['accounts']:>16}" for g in shown))
    labels = dict(AREAS)
    order = sorted(labels, key=lambda a: -f["all"]["areas"].get(a, 0))
    for area in order:
        out.append(f"  {labels[area]:<16}" + "".join(
            f"{pct(f[g]['areas'].get(area, 0), f[g]['accounts']):>16}" for g in shown))
    if hidden:
        out.append(f"  ({hidden} group(s) with fewer than {MIN_CELL} accounts not shown separately)")
    return "\n".join(out)


def summarize_last_seen(events: Iterable[dict], wanted_version: str = CURRENT_VERSION,
                        now: Optional[datetime] = None, away_days: int = 14) -> Dict:
    """Where people leave: for accounts whose last day in the app (feature_use)
    was `away_days` or more ago, the parts they opened that day. Pure."""
    last: Dict[str, tuple] = {}
    for e in events:
        if e["event"] != "feature_use" or not e.get("user_id") or not e.get("step") \
                or not keep_version(e.get("onboarding_version", ""), wanted_version):
            continue
        day = _ts(e["created_at"]).date()
        seen = last.get(e["user_id"])
        if seen is None or day > seen[0]:
            last[e["user_id"]] = (day, {e["step"]})
        elif day == seen[0]:
            seen[1].add(e["step"])
    today = (now or datetime.now().astimezone()).date()
    away = [areas for day, areas in last.values() if (today - day).days >= away_days]
    return {"accounts": len(last), "away": len(away), "areas": Counter(a for areas in away for a in areas),
            "away_days": away_days}


def render_last_seen(s: Dict) -> str:
    out = [f"== Where people leave: parts opened on their last day, for accounts away {s['away_days']}+ days",
           f"  accounts that opened the app: {s['accounts']}; away {s['away_days']}+ days: {s['away']}"]
    if s["away"] < MIN_CELL:
        out.append(f"  (fewer than {MIN_CELL} so far)")
        return "\n".join(out)
    labels = dict(AREAS)
    for area, n in s["areas"].most_common():
        shown = SMALL if n < MIN_CELL else str(n)
        out.append(f"  {labels.get(area, area):<16} {shown:>5}  ({'-' if n < MIN_CELL else pct(n, s['away'])})")
    return "\n".join(out)


def summarize_ask_later(events: Iterable[dict], wanted_version: str = CURRENT_VERSION) -> Dict:
    """For each group of questions asked later: how many browsers saw it,
    answered something in it, or closed it. Pure."""
    seen: Dict[str, Dict[str, set]] = {g: {"shown": set(), "done": set(), "closed": set()} for g, _, _ in ASK_LATER}
    group_of = {item: g for g, _, items in ASK_LATER for item in items}
    for e in events:
        if e["event"] != "ask_later" or not e.get("step") or not keep_version(e.get("onboarding_version", ""), wanted_version):
            continue
        action, _, name = str(e["step"]).partition(".")
        group = name if name in seen else group_of.get(name)
        if group and action in ("shown", "done", "closed"):
            seen[group][action].add(e["visitor_id"])
    return {g: {k: len(v) for k, v in counts.items()} for g, counts in seen.items()}


def render_ask_later(s: Dict) -> str:
    out = ["== Questions asked later on the Path (Group 7: do people answer them?)",
           f"  {'questions':<32} {'shown':>6} {'answered':>9} {'closed':>7}"]
    for group, label, _ in ASK_LATER:
        g = s.get(group, {"shown": 0, "done": 0, "closed": 0})
        if g["shown"] < MIN_CELL:
            out.append(f"  {label:<32} {SMALL if g['shown'] else 0:>6} {'-':>9} {'-':>7}")
            continue
        out.append(f"  {label:<32} {g['shown']:>6} {pct(g['done'], g['shown']):>9} {pct(g['closed'], g['shown']):>7}")
    return "\n".join(out)


def is_resourcehub(e: dict) -> bool:
    """ResourceHub's events, kept out of Goal Planning's funnel."""
    return str(e.get("event", "")).startswith("rh_")


def summarize_resourcehub(events: Iterable[dict]) -> Dict:
    """ResourceHub's first session (Group 8): setup completion, time from the
    first visit to the first place opened, how many search results were
    within the radius, and whether each prompt is taken up. A "person" is a
    visitor id (one browser). Test traffic ('qa-...') never counts. Pure."""
    by_visitor: Dict[str, List[dict]] = defaultdict(list)
    for e in events:
        if is_resourcehub(e) and not str(e.get("onboarding_version") or "").startswith("qa"):
            by_visitor[e["visitor_id"]].append(e)

    visits: set = set()
    steps: Dict[str, set] = {s: set() for s in RH_SETUP_STEPS}
    finished: set = set()
    with_topic: set = set()
    opened: set = set()
    from_setup: set = set()
    hours_from_visit: List[float] = []
    hours_from_setup: List[float] = []
    near = shown = searches = 0
    prompts: Dict[str, Dict[str, set]] = {p: {"shown": set(), "yes": set(), "no": set(), "later": set()} for p, _ in RH_PROMPTS}

    for vid, evs in by_visitor.items():
        evs.sort(key=lambda e: e["created_at"])
        first_visit = next((_ts(e["created_at"]) for e in evs if e["event"] == "rh_visit"), None)
        setup_start = next((_ts(e["created_at"]) for e in evs
                            if e["event"] == "rh_setup_step" and e.get("step") == "role"), None)
        if first_visit:
            visits.add(vid)
        for e in evs:
            name, step = e["event"], str(e.get("step") or "")
            if name == "rh_setup_step" and step in steps:
                steps[step].add(vid)
            elif name == "rh_setup_complete":
                finished.add(vid)
                if step == "topic":
                    with_topic.add(vid)
            elif name == "rh_search":
                a, _, b = step.partition("/")
                if a.isdigit() and b.isdigit() and 0 < int(b) and int(a) <= int(b):
                    near += int(a)
                    shown += int(b)
                    searches += 1
            elif name == "rh_prompt":
                action, _, prompt = step.partition(".")
                if prompt in prompts and action in prompts[prompt]:
                    prompts[prompt][action].add(vid)
        first = next((e for e in evs if e["event"] == "rh_first_resource"), None)
        if first:
            opened.add(vid)
            at = _ts(first["created_at"])
            if first.get("step") == "setup":
                from_setup.add(vid)
            if first_visit and at >= first_visit:
                hours_from_visit.append((at - first_visit).total_seconds() / 3600)
            if setup_start and at >= setup_start:
                hours_from_setup.append((at - setup_start).total_seconds() / 3600)

    return {
        "visits": len(visits),
        "steps": {s: len(v) for s, v in steps.items()},
        "finished": len(finished & steps["role"]),
        "finished_with_topic": len(with_topic & finished & steps["role"]),
        "opened": len(opened),
        "opened_from_setup": len(from_setup),
        "first_open_median_hours": median(hours_from_visit) if hours_from_visit else None,
        "setup_to_open_median_hours": median(hours_from_setup) if hours_from_setup else None,
        "searches": searches,
        "near": near,
        "shown": shown,
        "prompts": {p: {k: len(v) for k, v in a.items()} for p, a in prompts.items()},
    }


def render_resourcehub(s: Dict) -> str:
    def count(n: int) -> str:
        return SMALL if 0 < n < MIN_CELL else str(n)

    started = s["steps"]["role"]
    out = ["== ResourceHub's first session (Group 8: three-step setup, results near you)",
           f"  first visits (browsers)            {count(s['visits'])}"]
    if started < MIN_CELL:
        out.append(f"  started setup                      {count(started)}")
    else:
        out += [
            f"  started setup                      {started}",
            f"  reached step 2 (topic)             {s['steps']['topic']} ({pct(s['steps']['topic'], started)})",
            f"  finished setup                     {s['finished']} ({pct(s['finished'], started)} of those who started)",
            f"    and chose a topic                {pct(s['finished_with_topic'], s['finished'])} of those who finished",
        ]
    line = f"  opened a first place               {count(s['opened'])}"
    if s["opened"] >= MIN_CELL:
        if s["first_open_median_hours"] is not None:
            line += f", median {_duration(s['first_open_median_hours'])} after their first visit"
        out.append(line)
        if s["opened_from_setup"] >= MIN_CELL and s["setup_to_open_median_hours"] is not None:
            out.append(f"    from setup's last step           {s['opened_from_setup']}, "
                       f"median {_duration(s['setup_to_open_median_hours'])} after starting setup")
    else:
        out.append(line)
    if s["searches"] < MIN_CELL:
        out.append(f"  searches with a location           {count(s['searches'])}")
    else:
        out.append(f"  searches with a location           {s['searches']}: "
                   f"{pct(s['near'], s['shown'])} of first-page places within the radius")
    out.append(f"  {'prompts that ask for more later':<34} {'shown':>6} {'yes':>6} {'no':>6} {'later':>6}")
    for prompt, label in RH_PROMPTS:
        a = s["prompts"][prompt]
        if a["shown"] < MIN_CELL:
            out.append(f"  {label:<34} {count(a['shown']):>6} {'-':>6} {'-':>6} {'-':>6}")
            continue
        out.append(f"  {label:<34} {a['shown']:>6} {pct(a['yes'], a['shown']):>6} "
                   f"{pct(a['no'], a['shown']):>6} {pct(a['later'], a['shown']):>6}")
    return "\n".join(out)


def summarize_checkins(rows: Iterable[dict], audience_by_user: Optional[Dict[str, str]] = None,
                       joined_by_user: Optional[Dict[str, str]] = None) -> Dict:
    """Why people stopped (email and welcome-back answers) and whether active
    users find it useful, overall and by who they are here for. Pure."""
    audience_by_user = audience_by_user or {}
    # Test answers ('qa-...' versions) never count, as in the funnel.
    rows = [r for r in rows if not str(r.get("onboarding_version") or "").startswith("qa")]

    def audience(r: dict) -> str:
        return AUDIENCE_LABELS.get(audience_by_user.get(r.get("user_id")), NOT_ANSWERED)

    stopped = [r for r in rows if r.get("kind") in ("inactive_email", "welcome_back")]
    useful = [r for r in rows if r.get("kind") == "usefulness"]
    joined_by_user = joined_by_user or {}

    def early(r: dict) -> bool:
        joined = joined_by_user.get(r.get("user_id"))
        return bool(joined and r.get("created_at") and _ts(r["created_at"]) - _ts(joined) <= FIRST_WEEKS)
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
        "usefulness_early": Counter(r["usefulness"] for r in useful if r.get("usefulness") and early(r)),
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
    out.append(f"== Useful so far? (after 5 days of use, or from the second week): {c['useful']} answers")
    out.append("  " + "   ".join(f"{label}: {c['usefulness'].get(key, 0)} ({pct(c['usefulness'].get(key, 0), useful_total)})"
                                for key, label in USEFULNESS))
    early_total = sum(c["usefulness_early"].values())
    out.append(f"  in the first two weeks after sign-up ({early_total} answers): " + "   ".join(
        f"{label}: {c['usefulness_early'].get(key, 0)} ({pct(c['usefulness_early'].get(key, 0), early_total)})"
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
    # ResourceHub's events (STEP 51) have their own section, at the end.
    rh_events = [e for e in events if is_resourcehub(e)]
    events = [e for e in events if not is_resourcehub(e)]
    audience_by_user = {}
    heard_from_by_user = {}
    joined_by_user = {}
    for p in fetch_all(sb, "profiles", "id, preferences, created_at"):
        if p.get("created_at"):
            joined_by_user[p["id"]] = p["created_at"]
        heard = (p.get("preferences") or {}).get("heardFrom")
        if heard:
            heard_from_by_user[p["id"]] = heard
        aud = (p.get("preferences") or {}).get("audience")
        if aud:
            audience_by_user[p["id"]] = aud
    first_done_by_user: Dict[str, str] = {}
    try:
        for r in fetch_all(sb, "race_progress", "user_id, kind, completed_at"):
            if r.get("kind") == "completed" and r.get("completed_at"):
                if r["user_id"] not in first_done_by_user or r["completed_at"] < first_done_by_user[r["user_id"]]:
                    first_done_by_user[r["user_id"]] = r["completed_at"]
    except Exception:
        pass  # without it, the first-step line just shows 0
    funnel = compute_funnel(events, args.version, audience_by_user, first_done_by_user)
    print(render(funnel, summarize_feedback(feedback, args.version, funnel["people"]), args.show_comments))
    print()
    print(render_heard_from(summarize_heard_from(funnel["people"], heard_from_by_user)))
    print()
    print(render_start_here(compute_start_here(events, args.version)))
    print()
    print(render_versions(compare_versions(events)))
    print()
    print(render_feature_use(summarize_feature_use(events, args.version, audience_by_user)))
    print()
    print(render_last_seen(summarize_last_seen(events, args.version)))
    print()
    print(render_ask_later(summarize_ask_later(events, args.version)))
    print()
    print(render_resourcehub(summarize_resourcehub(rh_events)))
    print()
    try:
        checkins = fetch_all(sb, "checkin_responses", "user_id, kind, reason, usefulness, comment, onboarding_version, created_at")
    except Exception:
        print("== Check-ins: not available yet (apply STEP 46).")
        return 0
    print(render_checkins(summarize_checkins(checkins, audience_by_user, joined_by_user), args.show_comments))
    return 0


if __name__ == "__main__":
    sys.exit(main())
