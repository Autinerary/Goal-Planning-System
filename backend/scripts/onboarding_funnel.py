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

Group 11 asked for 1-, 7- and 14-day return by segment and channel, the
email and notification opt-in rate, and three segments to bring back (visited
but did not start, stopped at a step, finished); they suggested sharing "the
share of users who saved a resource in their first week" once measured, and
testing the AI goal helper against the standard goal step. Those are the
next-day and 14-day columns, "Bringing people back" and "The goal helper".

Group 33 asked for "mobile metrics" and to "track onboarding completion rate
and time-to-first-action". The funnel is also split by device (phone, tablet
or computer, recorded from STEP 69). Group 31 asked to keep letting people
send feedback; what they send from the glossary at any time ("Tell us how
it's going", STEP 69) is counted apart from the check-ins the app asks for.

Groups 25 to 30 (September 2026) moved the optional questions out of setup
and into the app (express-2026-10): setup is the two required steps, and the
rest is on a "Complete your profile" card on the Path. They asked to track
"return rate for deferred questions, day-7 and day-30 retention, short
post-onboarding survey" (Group 30) and to "ask beta testers if signup felt
clear and quick" (Group 25), and for a tour whose prompts have people try
each feature (Group 27). So: returns within 30 days, the card's answers by
question, the survey's "Was making your account clear and quick?" (STEP 70)
and the tour's tasks (STEP 70).

Groups 20 to 24 (September 2026) shaped paced-2026-10: an optional energy
check-in that sets how much setup asks (Group 23), Start here's optional
questions (Group 21), "Skip to resources", the starter kits, and reminders to
finish setup as up to three emails (Groups 20 and 24). They asked for time
spent in setup and completion by energy (Group 23), a first resource "under
60 seconds", the Day 1 save rate and the Day 14 active rate (Group 24),
in-app journaling (Group 20), and long-term feature adoption and ages in the
waitlist form's bands (Group 22). Each has a section below.

Groups 15 to 19 (September 2026) shaped clear-2026-10: plain words, a calmer
look and AI labels that say what people get. Group 15 proposed success
markers for each kind of person over the first 7 to 14 days ("to validate
through the funnel review") and milestone-based emails on days 1, 7 and 14;
Group 16 asked which colour options people choose; Group 18 to monitor
bounce rates; Group 19 to compare people with ADHD and autistic people, and
to count navigation errors. Each has a section below.

Groups 8 to 14 (September 2026) shaped guided-2026-10. Group 12 asked for a
guided demo and "how many users went through the demo, where it drops off",
programs "by age group and need", and micro-surveys "on Day 3 and Day 7".
"A look inside" and the age answers have sections below; the day-3 answers
are with the check-ins.

Reads public.onboarding_events and public.onboarding_feedback (STEP 45),
public.checkin_responses (STEP 46), profiles.preferences, the journal's dates
(public.reflections) and the accounts' metadata (dates of birth are only
counted in age bands). Counts only: no user ids, emails or visitor ids are
printed. Survey and check-in comments are free text and may contain personal
details, so they are only printed with --show-comments, for reading locally.

Run (from backend/):
  python -m scripts.onboarding_funnel                    # current version
  python -m scripts.onboarding_funnel --version all
  python -m scripts.onboarding_funnel --show-comments
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from statistics import median
from typing import Callable, Dict, Iterable, List, Optional, Tuple

# Must match ONBOARDING_VERSION in frontend/lib/funnel.ts. The ones before it
# were clear-2026-10, paced-2026-10 and express-2026-10; every version stays
# in the comparisons by version.
CURRENT_VERSION = "guided-2026-10"

# Onboarding step ids in order, as in frontend/app/onboarding/page.tsx. The
# first two are setup. The optional extras were offered after them until
# express-2026-10, which moved them into the app (the "Complete your profile"
# card); they stay listed for older versions, and are left out of the report
# while nobody reached them. (Before twostep-2026-10, norms were the third step
# of the start, and there was an AI recommendations step at the end.)
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
# Events from before STEP 69 have no device.
NOT_RECORDED = "(not recorded)"

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
# The first three role and goal paths of the beta (Riipen Labs' cohort report:
# "choose the first three role/goal paths"; docs/beta-test-plan-2026-10.md).
BETA_PATHS = ("self.services", "self.community", "child.learn")

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
# The day-3 question (Group 12; STEP 76), as EARLY_REASONS in
# frontend/lib/checkin.ts. Before STEP 76 an answer is kept as text on a
# usefulness check-in, its comment starting with EARLY_PREFIX and the label.
EARLY_REASONS = [
    ("going_fine", "It’s going well"),
    ("too_much", "There is too much to take in"),
    ("unclear_next", "I’m not sure what to do next"),
    ("hard_to_find", "I can’t find what I’m looking for"),
    ("not_what_i_needed", "It isn’t what I need"),
    ("other", "Something else"),
]
EARLY_PREFIX = "Day 3 check-in: "

# Optional setup questions asked later on the Path, as in frontend/lib/askLater.ts.
ASK_LATER = [
    ("location", "Location", ["location"]),
    ("aboutYou", "Sensory needs and conditions", ["aboutYou"]),
    ("makeItYours", "Character, spirit animals, look", ["character", "spiritAnimal", "personalize"]),
]

# The "Complete your profile" card on the Path (frontend/lib/profileItems.ts;
# Groups 29 and 30), sent as ask_later events: "shown.profile" the first time
# the card is shown in a browser, "done.profile.<item>" when an answer is
# saved from it.
PROFILE_ITEMS = [
    ("location", "Your city"),
    ("norms", "Norms and support needs"),
    ("motivation", "What motivates you"),
    ("character", "Character and Dream Self"),
    ("spiritAnimal", "Spirit animals"),
    ("look", "How the app looks"),
    ("reminders", "Reminders, first two weeks"),
]

# The tour's tasks (frontend/app/components/InteractiveDemo.tsx; Group 27:
# "prompts that have users complete a task before moving to the next
# feature"), sent as tour events from STEP 70: "start", "task.<id>" (done),
# "skip.<id>", "finish" and "close".
TOUR_TASKS = [
    ("next_step", "Open your next step"),
    ("calendar", "Open the Calendar"),
    ("energy", "Pick today's energy"),
    ("display", "Open Display"),
    ("resourcehub", "Open ResourceHub at the end"),
]

# Setup's energy check-in (Riipen Labs, Group 23: "an initial question asking
# users to select their current energy level ... so the setup length
# dynamically adapts"), sent as setup_energy from paced-2026-10 (STEP 71), as
# in frontend/lib/funnel.ts SETUP_ENERGY_IDS. People may change their answer:
# their last one counts.
SETUP_ENERGY = [("low", "low energy"), ("some", "some energy"), ("plenty", "plenty of energy")]
ENERGY_IDS = {key for key, _ in SETUP_ENERGY}
NO_ENERGY = "unanswered"

# Start here's optional questions after the starter resources (Group 21: "5
# targeted simple multiple choice questions"), sent as start_refine
# "<question>.<answer>" (STEP 71; frontend/lib/funnel.ts START_REFINE_STEP).
START_REFINE = [
    # Asked only of people supporting someone (Group 12: "by age group and need").
    ("age", "Age of who they support", [("under6", "under 6"), ("6to12", "6 to 12"), ("13to17", "13 to 17"), ("adult", "18 or older")]),
    ("where", "Where they are", [("ontario", "Ontario"), ("canada", "elsewhere in Canada"), ("outside", "outside Canada")]),
    ("soon", "How soon", [("today", "today"), ("week", "this week"), ("exploring", "just exploring")]),
    ("how", "How they like to start", [("read", "read"), ("talk", "talk"), ("place", "a place"), ("plan", "a plan")]),
]
REFINE_STEPS = {f"{q}.{a}" for q, _, answers in START_REFINE for a, _ in answers}

# The waitlist form's age bands (Group 22: they could not be joined with the
# app's 18-24 / 25-40 / 40-65 / 65+), by the oldest age in each. The form puts
# 55 in two bands; here it is in 46-55. Accounts a parent makes for a child
# are under 18.
AGE_BANDS = [("18-24", 24), ("25-35", 35), ("36-45", 45), ("46-55", 55), ("55+", None)]
UNDER_18 = "under 18"
AGE_NOT_KNOWN = "not known"

# ResourceHub's first session (Riipen Labs, Group 8), as sent by
# servicehub-mvp/app/api/events/route.ts: setup steps (lib/onboarding/setup.ts)
# and the prompts that ask for more later (lib/track.ts).
RH_SETUP_STEPS = ["role", "topic", "first"]
RH_PROMPTS = [
    ("sharpen", "Welcome back: sharpen matches"),
    ("more_like_these", "Want more like these?"),
    ("add_topic", "Add a searched topic"),
]

# What counts as reaching something useful after sign-up (Riipen Labs,
# Group 10's "time to first value: how quickly do users reach a relevant path
# or resource?"): opening a step of their path, ResourceHub or Tools
# (feature_use), or a starter resource (start_open).
VALUE_AREAS = ("milestones", "resourcehub", "tools")

# Reaching a first resource after sign-up (Group 24: "under 60 seconds"): a
# starter resource (start_open), a first place in ResourceHub
# (rh_first_resource), or ResourceHub or the starter kits opened (feature_use).
FIRST_RESOURCE_AREAS = ("resourcehub", "kits")
FIRST_RESOURCE_TARGET = timedelta(seconds=60)

# Time on a setup step counts until the next step was shown, if that came
# within this long; a longer gap is someone who left and came back.
STEP_PAUSE_CAP = timedelta(minutes=30)

RETURN_WINDOW = timedelta(days=7)
RETURN_WINDOW_LONG = timedelta(days=14)
# Group 30: "day-7 and day-30 retention".
RETURN_WINDOW_MONTH = timedelta(days=30)
FIRST_WEEKS = timedelta(days=14)
# Group 24's "Day 1 save rate" and "Day 14 active rate", and Group 22's
# feature adoption in each of the first four weeks after sign-up.
FIRST_DAY = timedelta(hours=24)
ACTIVE_FROM_DAY = 14
FEATURE_WEEKS = 4

# Parts of the app counted by feature_use, as in frontend/lib/funnel.ts.
AREAS = [
    ("path", "Path"), ("races", "Races"), ("milestones", "Milestones"), ("calendar", "Calendar"),
    ("tasks", "Tasks"), ("pit_stop", "Pit Stop"), ("tools", "Tools"), ("journal", "Journal"),
    ("assistant", "Assistant"), ("family", "Family"), ("dream_self", "Dream Self"),
    ("settings", "Settings"), ("start", "Start here"), ("path_market", "Path Market"),
    ("compare", "Compare paths"), ("tidbits", "Tidbits"), ("resourcehub", "ResourceHub"),
    # Since Riipen Labs, Group 34: Hare World has its own page (it was counted
    # as Pit Stop), and Your profile, Life Stats and the glossary are counted.
    ("hare_world", "Hare World"), ("profile", "Your profile"), ("stats", "Life Stats"),
    ("help", "What things are called"),
    # Since paced-2026-10 (Group 24): the starter kits.
    ("kits", "Starter kits"),
]
AREA_IDS = {area for area, _ in AREAS}

# Display choices people turn on (Riipen Labs, Group 16: "see which colour
# options are most popularly being chosen by users"), sent as feature_use
# "display_<choice>" by frontend/lib/displayChoices.ts, once a day each.
DISPLAY_CHOICES = [
    ("display_dark", "Dark"),
    ("display_contrast", "Higher contrast"),
    ("display_soft", "Soft colours"),
    ("display_calm", "Calm motion"),
    ("display_text_larger", "Larger text"),
    ("display_text_largest", "Largest text"),
    ("display_look_plain", "Look: Plain"),
    ("display_look_pretty", "Look: Pretty"),
    ("display_look_exciting", "Look: Exciting"),
    ("display_look_fun", "Look: Fun"),
    ("display_view_simple", "Simplified View"),
    ("display_view_full", "Full View"),
    ("display_accent_cyan", "Colour: cyan"),
    ("display_accent_purple", "Colour: purple"),
    ("display_accent_emerald", "Colour: emerald"),
    ("display_accent_amber", "Colour: amber"),
    ("display_accent_rose", "Colour: rose"),
]

# A look inside on the home page, one screen at a time (frontend/app/components/
# LookInside.tsx), sent as feature_use "inside_<screen>" (Riipen Labs, Group 12:
# "how many users went through the demo, where it drops off").
INSIDE_SCREENS = [
    ("inside_path", "Your Path"),
    ("inside_step", "A step"),
    ("inside_calendar", "Calendar"),
    ("inside_resourcehub", "ResourceHub"),
]
# Norms, grouped to compare people with ADHD and autistic people (Riipen Labs,
# Group 19: "conduct targeted focus group testing across different
# neurodivergent subgroups (those with ADHD vs autism) to see if the pattern
# matches or varies by group"), from user_barriers through
# core/condition_taxonomy.py. Nothing about a person's norms is printed, only
# counts, and groups under MIN_CELL are hidden.
NORM_GROUPS = [
    ("autism", "autism"),
    ("adhd", "ADHD"),
    ("both", "autism and ADHD"),
    ("other", "other norms only"),
    ("none", "no norms shared"),
]
# The first two weeks' emails (Group 15: "Day 1, Day 7, and Day 14 emails
# tied to what the user actually did"; frontend/lib/firstWeeks.ts).
FIRST_WEEKS_DAYS = (1, 7, 14)
# Rows for groups smaller than this show "<5" instead of counts and rates, so
# a shared copy of the report cannot single anyone out. Totals are unaffected.
MIN_CELL = 5
SMALL = f"<{MIN_CELL}"


def _ts(value: str) -> datetime:
    """A database timestamp. Postgres trims trailing zeros from the fraction
    ('...:46.95505+00:00'), which fromisoformat before Python 3.11 rejects;
    15 of the first 192 events looked like that."""
    text = str(value).replace("Z", "+00:00")
    head, dot, rest = text.partition(".")
    if dot:
        digits = rest[:len(rest) - len(rest.lstrip("0123456789"))]
        text = f"{head}.{digits[:6].ljust(6, '0')}{rest[len(digits):]}"
    return datetime.fromisoformat(text)


def keep_version(version: str, wanted: str) -> bool:
    """Test traffic ('qa-...') never counts; otherwise match the version."""
    if str(version).startswith("qa"):
        return False
    return wanted == "all" or version == wanted


def _setup_minutes(evs: List[dict]) -> Optional[float]:
    """Time spent in setup (Group 23): minutes from the first setup step shown
    to finishing setup, from one browser's events; None if not finished."""
    shown = [_ts(e["created_at"]) for e in evs if e["event"] == "onboarding_step_view"]
    if not shown:
        return None
    start = min(shown)
    done = [t for t in (_ts(e["created_at"]) for e in evs if e["event"] == "onboarding_complete") if t >= start]
    return (min(done) - start).total_seconds() / 60 if done else None


def _events_by_person(events: Iterable[dict], wanted: Callable[[dict], bool]) -> Tuple[Dict, Dict]:
    """The wanted events by user id where they carry one, and by visitor id
    where they do not, so a person's later events are found from any browser,
    from ResourceHub, and from any version (the app may have changed since
    they signed up). Test traffic never counts."""
    by_user: Dict[str, List[dict]] = defaultdict(list)
    by_visitor: Dict[str, List[dict]] = defaultdict(list)
    for e in events:
        if str(e.get("onboarding_version") or "").startswith("qa") or not wanted(e):
            continue
        if e.get("user_id"):
            by_user[e["user_id"]].append(e)
        else:
            by_visitor[e["visitor_id"]].append(e)
    return by_user, by_visitor


def _person_events(p: dict, index: Tuple[Dict, Dict]) -> List[dict]:
    """One funnel person's events from _events_by_person: their account's, and
    their browser's that carry no user id."""
    by_user, by_visitor = index
    return (by_user.get(p["user_id"], []) if p.get("user_id") else []) + by_visitor.get(p.get("visitor_id"), [])


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
        # Phone, tablet or computer (STEP 69; Group 33: "mobile metrics").
        device = next((e.get("device") for e in evs if e.get("device")), None) or NOT_RECORDED
        user_id = next((e.get("user_id") for e in evs if e.get("user_id")), None)
        signup_at = next((_ts(e["created_at"]) for e in evs if e["event"] == "signup_complete"), None)
        returned = returned_long = returned_month = returned_next_day = False
        if signup_at is not None:
            for e in evs:
                if e["event"] != "app_open":
                    continue
                t = _ts(e["created_at"])
                if t.date() > signup_at.date() and t - signup_at <= RETURN_WINDOW_MONTH:
                    returned_month = True
                if t.date() > signup_at.date() and t - signup_at <= RETURN_WINDOW_LONG:
                    returned_long = True
                    if t - signup_at <= RETURN_WINDOW:
                        returned = True
                    # Group 11's 1-day return: back on the next calendar day.
                    if (t.date() - signup_at.date()).days == 1:
                        returned_next_day = True
        # The AI goal helper on the goal step (Group 11): answered, and a
        # suggestion added (feature_use, frontend/lib/funnel.ts ACTION_IDS).
        used = {e.get("step") for e in evs if e["event"] == "feature_use"}
        # First action: opening a step (feature_use "milestones") after sign-up.
        first_open_hours = None
        if signup_at is not None:
            opens = [_ts(e["created_at"]) for e in evs if e["event"] == "feature_use"
                     and e.get("step") == "milestones" and _ts(e["created_at"]) >= signup_at]
            if opens:
                first_open_hours = (min(opens) - signup_at).total_seconds() / 3600
        # First value: the first useful thing opened after sign-up (Group 10).
        first_value_hours = None
        first_value_same_day = False
        if signup_at is not None:
            values = [_ts(e["created_at"]) for e in evs
                      if ((e["event"] == "feature_use" and e.get("step") in VALUE_AREAS) or e["event"] == "start_open")
                      and _ts(e["created_at"]) >= signup_at]
            if values:
                first_value_hours = (min(values) - signup_at).total_seconds() / 3600
                first_value_same_day = min(values).date() == signup_at.date()
        # Setup steps: visits to each, and time until the next step was shown.
        step_visits: Counter = Counter()
        step_seconds: Dict[str, float] = {}
        views = [e for e in evs if e["event"] == "onboarding_step_view" and e.get("step")]
        for i, e in enumerate(views):
            step_visits[e["step"]] += 1
            if i + 1 < len(views) and e["step"] not in step_seconds:
                gap = _ts(views[i + 1]["created_at"]) - _ts(e["created_at"])
                if gap <= STEP_PAUSE_CAP:
                    step_seconds[e["step"]] = gap.total_seconds()
        # Left setup and came back to it later: a gap longer than a pause.
        resumed = any(_ts(b["created_at"]) - _ts(a["created_at"]) > STEP_PAUSE_CAP
                      for a, b in zip(views, views[1:]))
        first_step_hours = None
        if signup_at is not None and user_id and first_done_by_user.get(user_id):
            done_at = _ts(first_done_by_user[user_id])
            if done_at >= signup_at:
                first_step_hours = (done_at - signup_at).total_seconds() / 3600
        audience = audience_by_user.get(user_id) if user_id else None
        # Setup's energy check-in (Group 23): their last answer.
        energy = next((e["step"] for e in reversed(evs) if e["event"] == "setup_energy" and e.get("step") in ENERGY_IDS), None)
        people.append({
            "user_id": user_id,
            "visitor_id": vid,
            "channel": channel,
            "device": device,
            "audience": AUDIENCE_LABELS.get(audience, NOT_ANSWERED),
            "landing": "landing_view" in names,
            "signup_view": "signup_view" in names,
            "account": signup_at is not None,
            "steps": steps,
            "finished": "onboarding_complete" in names,
            "returned": returned,
            "returned_14": returned_long,
            "returned_30": returned_month,
            "returned_next_day": returned_next_day,
            "signup_at": signup_at,
            "last_step": views[-1]["step"] if views else None,
            "resumed": resumed,
            "helper_used": "goal_helper" in used,
            "helper_picked": "goal_helper_pick" in used,
            "chat_used": "setup_chat" in used,
            "first_step_hours": first_step_hours,
            "first_open_hours": first_open_hours,
            "first_value_hours": first_value_hours,
            "first_value_same_day": first_value_same_day,
            "step_visits": step_visits,
            "step_seconds": step_seconds,
            "setup_minutes": _setup_minutes(evs),
            "setup_version": views[0].get("onboarding_version") if views else None,
            "energy": energy,
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
            "returned_30": sum(p.get("returned_30", False) for p in group),
            "returned_next_day": sum(p["returned_next_day"] for p in group),
            "first_step": sum(p["first_step_hours"] is not None for p in group),
            "first_open": sum(p["first_open_hours"] is not None for p in group),
            "first_value": sum(p["first_value_hours"] is not None for p in group),
            "first_value_same_day": sum(p["first_value_same_day"] for p in group),
            "first_value_median_hours": median(h) if (h := [p["first_value_hours"] for p in group if p["first_value_hours"] is not None]) else None,
            "step_came_back": {sid: sum(p["step_visits"][sid] > 1 for p in group) for sid, _ in STEPS},
            "step_median_seconds": {sid: median(s) if (s := [p["step_seconds"][sid] for p in group if sid in p["step_seconds"]]) else None for sid, _ in STEPS},
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
        "by_device": grouped("device"),
        "people": people,
        "first_event": min(all_times) if all_times else None,
        "last_event": max(all_times) if all_times else None,
    }


def _survey_stats(rows: List[dict]) -> Dict:
    eases = [r["setup_ease"] for r in rows if r.get("setup_ease")]
    infos = [r["info_before_signup"] for r in rows if r.get("info_before_signup")]
    # "Do you know what to do next?" (the cohort report; STEP 62).
    nexts = [r["next_step"] for r in rows if r.get("next_step")]
    # "Was making your account clear and quick?" (Group 25; STEP 70).
    clears = [r["signup_clear"] for r in rows if r.get("signup_clear")]
    return {
        "responses": len(rows),
        "info_before_signup": Counter(infos),
        "about_right_share": (sum(1 for i in infos if i == "about_right") / len(infos)) if infos else None,
        "ease": Counter(eases),
        "ease_median": median(eases) if eases else None,
        "next_step": Counter(nexts),
        "knows_next_share": (sum(1 for n in nexts if n == "yes") / len(nexts)) if nexts else None,
        "signup_clear": Counter(clears),
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
           f"  {'group':<20} {'accounts':>8} {'finished':>9} {'next day':>9} {'back in 7d':>10} {'in 14d':>7} {'in 30d':>7} "
           f"{'surveyed':>8} {'clarity ok':>10} {'ease (1-5)':>10} {'knows next':>10}"]
    for g in list(funnel_groups) + [g for g in survey_groups if g not in funnel_groups]:
        f = funnel_groups.get(g, {"accounts": 0, "finished": 0, "returned": 0, "returned_next_day": 0, "returned_14": 0, "returned_30": 0})
        s = survey_groups.get(g)
        if max(f["accounts"], s["responses"] if s else 0) < MIN_CELL:
            out.append(f"  {g[:20]:<20} {SMALL:>8} {'-':>9} {'-':>9} {'-':>10} {'-':>7} {'-':>7} {'-':>8} {'-':>10} {'-':>10} {'-':>10}")
            continue
        clarity = f"{100 * s['about_right_share']:.0f}%" if s and s["about_right_share"] is not None else "-"
        ease = f"{s['ease_median']}" if s and s["ease_median"] is not None else "-"
        knows = f"{100 * s['knows_next_share']:.0f}%" if s and s.get("knows_next_share") is not None else "-"
        out.append(f"  {g[:20]:<20} {f['accounts']:>8} {pct(f['finished'], f['accounts']):>9} "
                   f"{pct(f.get('returned_next_day', 0), f['accounts']):>9} {pct(f['returned'], f['accounts']):>10} "
                   f"{pct(f.get('returned_14', 0), f['accounts']):>7} {pct(f.get('returned_30', 0), f['accounts']):>7} "
                   f"{(s['responses'] if s else 0):>8} {clarity:>10} {ease:>10} {knows:>10}")
    return out


def _duration(hours: float) -> str:
    if hours < 1:
        return f"{round(hours * 60)} min"
    if hours < 48:
        return f"{hours:.1f} h"
    return f"{hours / 24:.1f} days"


def _short(seconds: float) -> str:
    """Time on a setup step: seconds when under a minute."""
    return f"{round(seconds)} s" if seconds < 60 else _duration(seconds / 3600)


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
        if i >= CORE_STEPS and not n:
            continue
        drop = f"   (-{prev - n} from the step before)" if prev is not None and prev > n and i < CORE_STEPS else ""
        out.append(f"  reached setup: {label:<27} {n}{drop}")
        prev = n
    out.append(f"  finished setup                  {o['finished']}   ({pct(o['finished'], o['accounts'])} of accounts)")
    out.append(f"  returned the next day           {o['returned_next_day']}   ({pct(o['returned_next_day'], o['accounts'])} of accounts)")
    out.append(f"  returned within 7 days          {o['returned']}   ({pct(o['returned'], o['accounts'])} of accounts)")
    out.append(f"  returned within 14 days         {o['returned_14']}   ({pct(o['returned_14'], o['accounts'])} of accounts)")
    out.append(f"  returned within 30 days         {o.get('returned_30', 0)}   ({pct(o.get('returned_30', 0), o['accounts'])} of accounts)")
    out.append(f"  opened their first step         {o['first_open']}   ({pct(o['first_open'], o['accounts'])} of accounts)"
               + (f", median {_duration(o['first_open_median_hours'])} after sign-up" if o['first_open_median_hours'] is not None else ""))
    out.append(f"  marked a first step done        {o['first_step']}   ({pct(o['first_step'], o['accounts'])} of accounts)"
               + (f", median {_duration(o['first_step_median_hours'])} after sign-up" if o['first_step_median_hours'] is not None else ""))
    out.append(f"  reached something useful        {o['first_value']}   ({pct(o['first_value'], o['accounts'])} of accounts)"
               + (f", median {_duration(o['first_value_median_hours'])} after sign-up; "
                  f"{o['first_value_same_day']} on the day they signed up" if o['first_value_median_hours'] is not None else ""))
    out.append("    (a step of their path, a starter resource, ResourceHub or Tools: Group 10's time to first value)")
    out.append("")
    out.append("== Setup steps: where people pause and what they come back to (Group 10)")
    out.append(f"  {'step':<29} {'reached':>7} {'median time':>12} {'came back':>10}")
    for i, (sid, label) in enumerate(STEPS):
        n = o["steps"][sid]
        if i >= CORE_STEPS and not n:
            continue
        if n < MIN_CELL:
            out.append(f"  {label[:29]:<29} {SMALL if n else 0:>7} {'-':>12} {'-':>10}")
            continue
        secs = o["step_median_seconds"][sid]
        took = _short(secs) if secs is not None else "-"
        out.append(f"  {label[:29]:<29} {n:>7} {took:>12} {pct(o['step_came_back'][sid], n):>10}")
    out.append("")
    out.extend(_comparison("By who they are here for", funnel.get("by_audience", {}), feedback.get("by_audience", {})))
    out.append("")
    out.extend(_comparison("By channel (utm_source of the first visit)", funnel["by_channel"], feedback.get("by_channel", {})))
    out.append("")
    # Group 33 asked for "mobile metrics": setup and returns on a phone and a
    # computer. Recorded from STEP 69; earlier events are "(not recorded)".
    out.extend(_comparison("By device (phone, tablet or computer)", funnel.get("by_device", {}), {}))
    out.append("  (clarity ok = answered \"about right\" to how much they knew before making an account;")
    out.append("   knows next = answered \"yes\" to \"Do you know what to do next?\" after setup;")
    out.append(f"   groups smaller than {MIN_CELL} show {SMALL})")
    out.append("")
    out.append(f"== Post-setup survey: {feedback['responses']} responses")
    info = feedback["info_before_signup"]
    total_info = sum(info.values())
    for key, label in (("too_little", "not enough"), ("about_right", "about right"), ("too_much", "too much")):
        out.append(f"  information before sign-up: {label:<12} {info.get(key, 0)}  ({pct(info.get(key, 0), total_info)})")
    nexts = feedback.get("next_step") or Counter()
    total_next = sum(nexts.values())
    out.append("  knows what to do next: " + "   ".join(
        f"{label} {nexts.get(key, 0)} ({pct(nexts.get(key, 0), total_next)})"
        for key, label in (("yes", "yes"), ("not_sure", "not sure"), ("no", "no"))))
    clears = feedback.get("signup_clear") or Counter()
    total_clear = sum(clears.values())
    out.append("  making the account was clear and quick: " + "   ".join(
        f"{label} {clears.get(key, 0)} ({pct(clears.get(key, 0), total_clear)})"
        for key, label in (("yes", "yes"), ("mostly", "mostly"), ("no", "no"))))
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
    groups: Dict[str, Dict[str, Counter]] = {"need": defaultdict(Counter), "role": defaultdict(Counter),
                                             "path": defaultdict(Counter)}
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
        for dim, i in (("role", 0), ("need", 1), ("path", None)):
            merged: Dict[str, set] = defaultdict(set)
            for key, done in acts.items():
                merged[f"{key[0]}.{key[1]}" if i is None else key[i]] |= done
            for value, done in merged.items():
                g = groups[dim][value]
                g["people"] += 1
                for a in ("pathway", "opened", "saved", "yes", "no"):
                    g[a] += a in done
                g["acted"] += bool(done & {"opened", "saved"})
        opened.update(items)
    return {"overall": overall, "by_need": dict(groups["need"]), "by_role": dict(groups["role"]),
            "by_path": dict(groups["path"]), "opened": opened}


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
    roles, needs = dict(START_ROLES), dict(START_NEEDS)
    out.append("")
    out.append("== Start here: by path (who for + need; * = one of the beta's three paths)")
    out.append(f"  {'path':<41} {'browsers':>8} {'opened':>7} {'saved':>6} {'next action':>11}")
    by_path = s.get("by_path", {})
    for value in list(BETA_PATHS) + sorted((v for v in by_path if v not in BETA_PATHS), key=lambda v: -by_path[v]["people"]):
        g = by_path.get(value, Counter())
        role, _, need = value.partition(".")
        label = f"{'*' if value in BETA_PATHS else ' '} {roles.get(role, role)} + {needs.get(need, need)}"
        if g["people"] < MIN_CELL:
            out.append(f"  {label:<41} {(SMALL if g['people'] else '0'):>8} {'-':>7} {'-':>6} {'-':>11}")
            continue
        out.append(f"  {label:<41} {g['people']:>8} {pct(g['opened'], g['people']):>7} {pct(g['saved'], g['people']):>6} "
                   f"{pct(g['acted'], g['people']):>11}")
    shown = [(k, n) for k, n in s["opened"].most_common() if n >= MIN_CELL][:10]
    out.append("")
    out.append(f"== Start here: resources opened most (by need; fewer than {MIN_CELL} not listed)")
    for (need, item), n in shown:
        out.append(f"  {item:<14} ({needs.get(need, need)})  {n}")
    if not shown:
        out.append("  (none yet)")
    return "\n".join(out)


def summarize_start_refine(events: Iterable[dict], wanted_version: str = CURRENT_VERSION) -> Dict:
    """Start here's optional questions (Group 21): of the browsers that
    reached a pathway, how many answered at least one, and how many gave each
    answer (a browser's last answer to each question). Pure."""
    pathway: set = set()
    last: Dict[Tuple[str, str], str] = {}
    rows = [e for e in events if e["event"] in ("start_pathway", "start_refine")
            and keep_version(e.get("onboarding_version", ""), wanted_version)]
    for e in sorted(rows, key=lambda e: e["created_at"]):
        if e["event"] == "start_pathway":
            pathway.add(e["visitor_id"])
        elif e.get("step") in REFINE_STEPS:
            question, _, answer = e["step"].partition(".")
            last[(e["visitor_id"], question)] = answer
    answered = {vid for vid, _ in last}
    return {"pathway": len(pathway), "answered": len(answered & pathway),
            "answers": Counter(f"{question}.{answer}" for (_, question), answer in last.items())}


def render_start_refine(s: Dict) -> str:
    n = s["answered"]
    out = ["== Start here: the optional questions after the starter resources (Group 21)",
           f"  reached a pathway                {s['pathway']}"]
    if s["pathway"] < MIN_CELL or 0 < n < MIN_CELL:
        out.append(f"  answered at least one            {SMALL if n else 0}")
    else:
        out.append(f"  answered at least one            {n}   ({pct(n, s['pathway'])} of those who reached a pathway)")
    for question, label, answers in START_REFINE:
        counts = [(a_label, s["answers"].get(f"{question}.{a}", 0)) for a, a_label in answers]
        total = sum(k for _, k in counts)
        out.append(f"  {label + ':':<32} " + ", ".join(
            f"{a_label} {SMALL if 0 < k < MIN_CELL else k}" + ("" if k < MIN_CELL else f" ({pct(k, total)})")
            for a_label, k in counts))
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


def summarize_setup_time(events: Iterable[dict]) -> List[Dict]:
    """Time spent in setup for each onboarding version, oldest first (Group
    23: "time spent"): per browser, minutes from the first setup step shown to
    finishing setup, and the median. Test traffic never counts. Pure."""
    first: Dict[str, str] = {}
    setup: Dict[str, Dict[str, List[dict]]] = defaultdict(lambda: defaultdict(list))
    for e in events:
        version = str(e.get("onboarding_version", ""))
        if version.startswith("qa"):
            continue
        if version not in first or e["created_at"] < first[version]:
            first[version] = e["created_at"]
        if e["event"] in ("onboarding_step_view", "onboarding_complete"):
            setup[version][e["visitor_id"]].append(e)
    rows = []
    for version in sorted(setup, key=lambda v: first[v]):
        minutes = [m for evs in setup[version].values() if (m := _setup_minutes(evs)) is not None]
        rows.append({"version": version, "finished": len(minutes), "median_minutes": median(minutes) if minutes else None})
    return rows


def render_setup_time(rows: List[Dict]) -> str:
    out = ["== Time spent in setup by onboarding version (Group 23: first step shown to finished)",
           f"  {'version':<22} {'finished':>8} {'median time':>12}"]
    for r in rows:
        if r["finished"] < MIN_CELL:
            out.append(f"  {r['version'][:22]:<22} {SMALL if r['finished'] else 0:>8} {'-':>12}")
            continue
        out.append(f"  {r['version'][:22]:<22} {r['finished']:>8} {_short(r['median_minutes'] * 60):>12}")
    if not rows:
        out.append("  (nobody has reached setup yet)")
    return "\n".join(out)


def summarize_energy(people: List[dict]) -> Dict[str, Dict]:
    """Setup's energy check-in (Group 23 asked to compare "completion,
    time-to-finish" for the shorter and fuller setups): browsers by their last
    answer, and those who saw setup without answering, with how many finished
    setup and their median time in it. Setup in a version that did not ask
    (no answers, and not the current one) is left out. Pure."""
    asked = {p.get("setup_version") for p in people if p.get("energy")} | {CURRENT_VERSION}
    groups: Dict[str, List[dict]] = {key: [] for key, _ in SETUP_ENERGY}
    groups[NO_ENERGY] = []
    for p in people:
        if p.get("energy") in ENERGY_IDS:
            groups[p["energy"]].append(p)
        elif p["steps"] and p.get("setup_version") in asked:
            groups[NO_ENERGY].append(p)
    out = {}
    for key, members in groups.items():
        minutes = [p["setup_minutes"] for p in members if p.get("setup_minutes") is not None]
        out[key] = {"people": len(members), "finished": sum(p["finished"] for p in members),
                    "median_minutes": median(minutes) if minutes else None}
    return out


def render_energy(s: Dict[str, Dict]) -> str:
    out = ["== Energy check-in at the start of setup (Group 23: setup that adapts to energy)",
           f"  {'answer':<20} {'browsers':>8} {'finished setup':>15} {'median time':>12}"]
    for key, label in SETUP_ENERGY + [(NO_ENERGY, "didn't answer")]:
        g = s[key]
        if g["people"] < MIN_CELL:
            out.append(f"  {label:<20} {SMALL if g['people'] else 0:>8} {'-':>15} {'-':>12}")
            continue
        took = _short(g["median_minutes"] * 60) if g["median_minutes"] is not None else "-"
        out.append(f"  {label:<20} {g['people']:>8} {pct(g['finished'], g['people']):>15} {took:>12}")
    out.append("  (their last answer; didn't answer = saw setup and sent none; time = first step shown to finished)")
    return "\n".join(out)


def _is_first_resource(e: dict) -> bool:
    return e["event"] in ("start_open", "rh_first_resource") or (
        e["event"] == "feature_use" and e.get("step") in FIRST_RESOURCE_AREAS)


def summarize_first_resource(people: List[dict], events: Iterable[dict]) -> Dict:
    """Time to a first resource (Group 24: "under 60 seconds"): for each
    account, seconds from signup_complete to the first starter resource
    opened, first place opened in ResourceHub, or ResourceHub or the starter
    kits opened, from any browser of theirs. Pure."""
    index = _events_by_person(events, _is_first_resource)
    accounts = [p for p in people if p["account"]]
    seconds = []
    for p in accounts:
        after = [t for t in (_ts(e["created_at"]) for e in _person_events(p, index)) if t >= p["signup_at"]]
        if after:
            seconds.append((min(after) - p["signup_at"]).total_seconds())
    return {"accounts": len(accounts), "reached": len(seconds), "median_s": median(seconds) if seconds else None,
            "under_target": sum(1 for s in seconds if s < FIRST_RESOURCE_TARGET.total_seconds())}


def render_first_resource(s: Dict) -> str:
    target = round(FIRST_RESOURCE_TARGET.total_seconds())
    out = [f"== Time to a first resource after sign-up (Group 24: \"under {target} seconds\")"]
    if s["accounts"] < MIN_CELL:
        out.append(f"  accounts                         {SMALL if s['accounts'] else 0}")
        return "\n".join(out)
    out.append(f"  accounts                         {s['accounts']}")
    if s["reached"] < MIN_CELL:
        out.append(f"  reached a resource               {SMALL if s['reached'] else 0}")
    else:
        n, med = s["under_target"], s["median_s"]
        # In seconds up to ten minutes, to compare with the target.
        took = f"{round(med)} s" if med < 600 else _duration(med / 3600)
        out.append(f"  reached a resource               {s['reached']}   ({pct(s['reached'], s['accounts'])} of accounts), "
                   f"median {took} after sign-up")
        out.append(f"  in under {target} seconds              {SMALL if 0 < n < MIN_CELL else n}"
                   + ("" if 0 < n < MIN_CELL else
                      f"   ({pct(n, s['accounts'])} of accounts, {pct(n, s['reached'])} of those who reached one)"))
    out.append("  (a starter resource, a first place in ResourceHub, or ResourceHub or the starter kits opened)")
    return "\n".join(out)


def summarize_feature_use(events: Iterable[dict], wanted_version: str = CURRENT_VERSION,
                          audience_by_user: Optional[Dict[str, str]] = None) -> Dict:
    """Which parts of the app each account opened, by who they are here for.
    Counts accounts (signed-in people), not visits. Pure."""
    audience_by_user = audience_by_user or {}
    used: Dict[str, set] = defaultdict(set)
    for e in events:
        if e["event"] == "feature_use" and e.get("user_id") and e.get("step") in AREA_IDS \
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


def summarize_feature_weeks(people: List[dict], events: Iterable[dict], now: Optional[datetime] = None) -> Dict:
    """Feature adoption over time (Group 22: "long-term tracking of feature
    adoption"): for each part of the app, how many accounts opened it in each
    of their first four weeks (week 1 is days 0-6 after signing up, by
    calendar day), and how many accounts had reached each week by now. Pure."""
    today = (now or datetime.now().astimezone()).date()
    index = _events_by_person(events, lambda e: e["event"] == "feature_use" and e.get("step") in AREA_IDS)
    accounts = [p for p in people if p["account"]]
    used: Dict[str, List[set]] = defaultdict(lambda: [set() for _ in range(FEATURE_WEEKS)])
    for i, p in enumerate(accounts):
        start = p["signup_at"].date()
        for e in _person_events(p, index):
            day = (_ts(e["created_at"]).date() - start).days
            if 0 <= day < 7 * FEATURE_WEEKS:
                used[e["step"]][day // 7].add(i)
    return {"reached": [sum(1 for p in accounts if (today - p["signup_at"].date()).days >= 7 * w) for w in range(FEATURE_WEEKS)],
            "areas": {area: [len(s) for s in weeks] for area, weeks in used.items()}}


def render_feature_weeks(s: Dict) -> str:
    def count(n: int) -> str:
        return SMALL if 0 < n < MIN_CELL else str(n)

    out = ["== Parts of the app by week after sign-up (Group 22: feature adoption over time; accounts that opened each)",
           f"  {'part':<24}" + "".join(f"{f'week {w + 1}':>8}" for w in range(FEATURE_WEEKS)),
           f"  {'accounts that got there':<24}" + "".join(f"{n:>8}" for n in s["reached"])]
    labels = dict(AREAS)
    for area in sorted(s["areas"], key=lambda a: [-n for n in s["areas"][a]]):
        out.append(f"  {labels.get(area, area)[:24]:<24}" + "".join(f"{count(n):>8}" for n in s["areas"][area]))
    if not s["areas"]:
        out.append("  (none yet)")
    return "\n".join(out)


def summarize_journal(people: List[dict], entries: Iterable[dict]) -> Dict:
    """In-app journaling (Group 20): of the accounts in this funnel, how many
    wrote a journal entry (public.reflections) within 14 days of signing up,
    and how many entries they have written in all. Pure."""
    joined: Dict[str, datetime] = {}
    for p in people:
        if p["account"] and p.get("user_id"):
            joined.setdefault(p["user_id"], p["signup_at"])
    wrote: set = set()
    total = 0
    for r in entries:
        start = joined.get(r.get("user_id"))
        if start is None or not r.get("created_at"):
            continue
        total += 1
        if timedelta(0) <= _ts(r["created_at"]) - start <= FIRST_WEEKS:
            wrote.add(r["user_id"])
    return {"accounts": len(joined), "wrote_14d": len(wrote), "entries": total}


def render_journal(j: Dict) -> str:
    def count(n: int) -> str:
        return SMALL if 0 < n < MIN_CELL else str(n)

    out = ["== Journal entries (Group 20: in-app journaling)"]
    if j["accounts"] < MIN_CELL:
        out.append(f"  accounts                                {count(j['accounts'])}")
        return "\n".join(out)
    n = j["wrote_14d"]
    out += [f"  accounts                                {j['accounts']}",
            f"  wrote an entry in their first 14 days   {count(n)}"
            + ("" if 0 < n < MIN_CELL else f"   ({pct(n, j['accounts'])})"),
            f"  entries these accounts have written     {count(j['entries'])}",
            "  (opening the journal is counted as Journal in \"Parts of the app people open\")"]
    return "\n".join(out)


def summarize_last_seen(events: Iterable[dict], wanted_version: str = CURRENT_VERSION,
                        now: Optional[datetime] = None, away_days: int = 14) -> Dict:
    """Where people leave: for accounts whose last day in the app (feature_use)
    was `away_days` or more ago, the parts they opened that day. Pure."""
    last: Dict[str, tuple] = {}
    for e in events:
        if e["event"] != "feature_use" or not e.get("user_id") or e.get("step") not in AREA_IDS \
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


def summarize_profile_card(events: Iterable[dict], wanted_version: str = CURRENT_VERSION) -> Dict:
    """The "Complete your profile" card: browsers that saw it, and that saved
    each answer from it (Group 30: "return rate for deferred questions"). Pure."""
    shown: set = set()
    done: Dict[str, set] = {item: set() for item, _ in PROFILE_ITEMS}
    any_done: set = set()
    for e in events:
        if e["event"] != "ask_later" or not e.get("step") or not keep_version(e.get("onboarding_version", ""), wanted_version):
            continue
        step = str(e["step"])
        if step == "shown.profile":
            shown.add(e["visitor_id"])
        elif step.startswith("done.profile."):
            item = step[len("done.profile."):]
            if item in done:
                done[item].add(e["visitor_id"])
                any_done.add(e["visitor_id"])
    return {"shown": len(shown), "any_done": len(any_done & shown) if shown else len(any_done),
            "done": {item: len(v) for item, v in done.items()}}


def render_profile_card(s: Dict) -> str:
    out = ["== Complete your profile: the questions moved out of setup (Groups 29 and 30)",
           f"  card shown                     {s['shown']}"]
    if s["shown"] < MIN_CELL:
        out.append(f"  answered at least one          {SMALL if s['any_done'] else 0}")
    else:
        out.append(f"  answered at least one          {s['any_done']}   ({pct(s['any_done'], s['shown'])} of those shown)")
    for item, label in PROFILE_ITEMS:
        n = s["done"].get(item, 0)
        shown = SMALL if 0 < n < MIN_CELL else str(n)
        share = "-" if n < MIN_CELL or not s["shown"] else pct(n, s["shown"])
        out.append(f"  {label:<30} {shown:>5}  ({share})")
    return "\n".join(out)


def summarize_tour(events: Iterable[dict], wanted_version: str = CURRENT_VERSION) -> Dict:
    """The tour: browsers that started it, finished it or closed it, and did or
    skipped each task. Pure."""
    seen: Dict[str, set] = defaultdict(set)
    for e in events:
        if e["event"] != "tour" or not e.get("step") or not keep_version(e.get("onboarding_version", ""), wanted_version):
            continue
        seen[str(e["step"])].add(e["visitor_id"])
    return {
        "started": len(seen["start"]),
        "finished": len(seen["finish"]),
        "closed": len(seen["close"]),
        "tasks": {t: {"done": len(seen[f"task.{t}"]), "skipped": len(seen[f"skip.{t}"])} for t, _ in TOUR_TASKS},
    }


def render_tour(s: Dict) -> str:
    out = ["== The tour's tasks (Group 27: try each feature before the next)"]
    if s["started"] < MIN_CELL:
        out.append(f"  started the tour               {SMALL if s['started'] else 0}  (fewer than {MIN_CELL} so far)")
        return "\n".join(out)
    out.append(f"  started the tour               {s['started']}")
    out.append(f"  finished it                    {s['finished']}   ({pct(s['finished'], s['started'])})")
    out.append(f"  closed it early                {s['closed']}   ({pct(s['closed'], s['started'])})")
    out.append(f"  {'task':<30} {'did it':>7} {'skipped':>8}")
    for t, label in TOUR_TASKS:
        g = s["tasks"][t]
        out.append(f"  {label:<30} {pct(g['done'], s['started']):>7} {pct(g['skipped'], s['started']):>8}")
    return "\n".join(out)


def is_resourcehub(e: dict) -> bool:
    """ResourceHub's events, kept out of Goal Planning's funnel."""
    return str(e.get("event", "")).startswith("rh_")


def summarize_resourcehub(events: Iterable[dict]) -> Dict:
    """ResourceHub's first session (Group 8): setup completion, time from the
    first visit to the first place opened, whether people come back on a later
    day within 7 and 14 days (of their first visit, and of finishing setup),
    how many search results were within the radius, and whether each prompt
    is taken up. A "person" is a visitor id (one browser). Test traffic
    ('qa-...') never counts. Pure."""
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
    back: Dict[str, set] = {"visit_7": set(), "visit_14": set(), "setup_7": set(), "setup_14": set()}
    near = shown = searches = 0
    prompts: Dict[str, Dict[str, set]] = {p: {"shown": set(), "yes": set(), "no": set(), "later": set()} for p, _ in RH_PROMPTS}

    for vid, evs in by_visitor.items():
        evs.sort(key=lambda e: e["created_at"])
        # The first release sent the first visit with no step.
        first_visit = next((_ts(e["created_at"]) for e in evs
                            if e["event"] == "rh_visit" and e.get("step") in (None, "first")), None)
        finished_at = next((_ts(e["created_at"]) for e in evs if e["event"] == "rh_setup_complete"), None)
        returns = [_ts(e["created_at"]) for e in evs if e["event"] == "rh_visit" and e.get("step") == "return"]
        for start, key in ((first_visit, "visit"), (finished_at, "setup")):
            if start is None:
                continue
            later = [t - start for t in returns if t.date() > start.date()]
            if any(d <= RETURN_WINDOW_LONG for d in later):
                back[f"{key}_14"].add(vid)
            if any(d <= RETURN_WINDOW for d in later):
                back[f"{key}_7"].add(vid)
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
        "back": {k: len(v) for k, v in back.items()},
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
    if s["visits"] >= MIN_CELL:
        out.append(f"  came back on a later day           within 7 days {pct(s['back']['visit_7'], s['visits'])}, "
                   f"within 14 days {pct(s['back']['visit_14'], s['visits'])} of first visits")
    if s["finished"] >= MIN_CELL:
        out.append(f"    after finishing setup            within 7 days {pct(s['back']['setup_7'], s['finished'])}, "
                   f"within 14 days {pct(s['back']['setup_14'], s['finished'])}")
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


def summarize_return_loop(people: List[dict], prefs_by_user: Optional[Dict[str, dict]] = None,
                          push_users: Optional[set] = None,
                          first_save_by_user: Optional[Dict[str, str]] = None) -> Dict:
    """Group 11's measures for bringing people back. Their three segments
    (visited but did not start, stopped at a step, finished), who came back to
    setup after a break, who opted in to reminder emails, check-in emails or
    notifications or the weekly email (what they saved, plus new picks), and
    who saved a resource in their first week (their suggested "proof of
    impact", to publish once measured) or within 24 hours (Group 24's "Day 1
    save rate"). Reminders to finish setup have their own section
    (summarize_setup_reminders). Pure."""
    prefs_by_user = prefs_by_user or {}
    push_users = push_users or set()
    first_save_by_user = first_save_by_user or {}
    accounts = [p for p in people if p["account"]]
    stopped = [p for p in accounts if not p["finished"]]
    known = [p for p in accounts if p.get("user_id")]

    def prefs(p: dict) -> dict:
        return prefs_by_user.get(p["user_id"]) or {}

    def reminders(p: dict) -> bool:
        r = prefs(p).get("reminders") or {}
        return bool(r.get("enabled") and r.get("consent"))

    def checkin(p: dict) -> bool:
        return bool((prefs(p).get("checkin") or {}).get("optIn"))

    def weekly(p: dict) -> bool:
        return (prefs(p).get("weeklyPicks") or {}).get("enabled") is True

    def saved_within(p: dict, window: timedelta) -> bool:
        first = first_save_by_user.get(p["user_id"])
        if not first or p.get("signup_at") is None:
            return False
        return timedelta(0) <= _ts(first) - p["signup_at"] <= window

    return {
        "visited_only": sum(1 for p in people if p["landing"] and not p["account"]),
        "accounts": len(accounts),
        "stopped": len(stopped),
        "stopped_at": Counter(p["last_step"] or "(no step)" for p in stopped),
        "stopped_back": sum(p["returned"] for p in stopped),
        "finished": len(accounts) - len(stopped),
        "finished_back": sum(p["returned"] for p in accounts if p["finished"]),
        "resumed": sum(p["resumed"] for p in accounts),
        "resumed_finished": sum(p["resumed"] and p["finished"] for p in accounts),
        "known": len(known),
        "reminders": sum(reminders(p) for p in known),
        "checkin": sum(checkin(p) for p in known),
        "push": sum(p["user_id"] in push_users for p in known),
        "weekly": sum(weekly(p) for p in known),
        "any_opt_in": sum(reminders(p) or checkin(p) or weekly(p) or p["user_id"] in push_users for p in known),
        "saved_first_day": sum(saved_within(p, FIRST_DAY) for p in known),
        "saved_first_week": sum(saved_within(p, RETURN_WINDOW) for p in known),
    }


def render_return_loop(r: Dict) -> str:
    def count(n: int) -> str:
        return SMALL if 0 < n < MIN_CELL else str(n)

    def share(n: int, d: int) -> str:
        return "" if d < MIN_CELL or 0 < n < MIN_CELL else f"   ({pct(n, d)})"

    labels = dict(STEPS)
    out = ["== Bringing people back (Group 11): three groups, and what each gets now",
           f"  visited, no account yet          {count(r['visited_only'])}   "
           "(Start here keeps their answers and reopens on their starter resources)",
           f"  stopped during setup             {count(r['stopped'])}{share(r['stopped'], r['accounts'])}   "
           "(setup reopens where they left off; reminder emails only if they asked for them)"]
    if r["stopped"] >= MIN_CELL:
        for step, n in r["stopped_at"].most_common():
            out.append(f"    last step seen: {labels.get(step, step)[:27]:<27} {count(n)}")
        out.append(f"    came back within 7 days          {count(r['stopped_back'])}{share(r['stopped_back'], r['stopped'])}")
    out.append(f"  finished setup                   {count(r['finished'])}{share(r['finished'], r['accounts'])}   "
               "(check-ins, the getting-started list, and emails they turned on)")
    out.append(f"  left setup and came back to it   {count(r['resumed'])}, of whom finished {count(r['resumed_finished'])}")
    out.append(f"  opted in, of {r['known']} accounts: daily reminder emails {count(r['reminders'])}{share(r['reminders'], r['known'])}, "
               f"check-in emails {count(r['checkin'])}{share(r['checkin'], r['known'])}, "
               f"notifications {count(r['push'])}{share(r['push'], r['known'])}, "
               f"weekly email {count(r['weekly'])}{share(r['weekly'], r['known'])}; "
               f"any of them {count(r['any_opt_in'])}{share(r['any_opt_in'], r['known'])}")
    out.append(f"  saved a resource within 24 hours       {count(r['saved_first_day'])}{share(r['saved_first_day'], r['known'])}")
    out.append(f"  saved a resource in their first week   {count(r['saved_first_week'])}{share(r['saved_first_week'], r['known'])}")
    return "\n".join(out)


def summarize_setup_reminders(people: List[dict], prefs_by_user: Optional[Dict[str, dict]] = None,
                              events: Iterable[dict] = ()) -> Dict[str, int]:
    """Reminders to finish setup (Groups 20 and 24), from
    profiles.preferences.setupReminder, for the accounts in this funnel: who
    asked, for the sequence of up to three emails (plan "sequence") or the
    first version's one email (no plan; sentAt when it went), how many emails
    went, who opened setup from one (clickedAt), snoozed, or stopped them, and
    who finished setup after their first email (an onboarding_complete from
    their account after it, in any browser). Pure."""
    prefs_by_user = prefs_by_user or {}
    finished_at: Dict[str, List[datetime]] = defaultdict(list)
    for e in events:
        if e["event"] == "onboarding_complete" and e.get("user_id") \
                and not str(e.get("onboarding_version") or "").startswith("qa"):
            finished_at[e["user_id"]].append(_ts(e["created_at"]))
    out = {k: 0 for k in ("asked", "sequence", "one_email", "emails", "emailed", "clicked", "snoozed", "stopped", "finished_after")}
    for user_id in {p["user_id"] for p in people if p["account"] and p.get("user_id")}:
        ask = (prefs_by_user.get(user_id) or {}).get("setupReminder")
        if not isinstance(ask, dict) or not ask.get("requestedAt"):
            continue
        out["asked"] += 1
        out["sequence" if ask.get("plan") == "sequence" else "one_email"] += 1
        sends = [s for s in ask.get("sends") or [] if s] if isinstance(ask.get("sends"), list) else []
        if not sends and ask.get("sentAt"):
            sends = [ask["sentAt"]]
        out["emails"] += len(sends)
        out["emailed"] += bool(sends)
        out["clicked"] += bool(ask.get("clickedAt"))
        snoozes = ask.get("snoozes")
        out["snoozed"] += isinstance(snoozes, (int, float)) and snoozes > 0
        out["stopped"] += bool(ask.get("stoppedAt"))
        if sends:
            first = min(_ts(s) for s in sends)
            out["finished_after"] += any(t > first for t in finished_at.get(user_id, []))
    return out


def render_setup_reminders(r: Dict[str, int]) -> str:
    def count(n: int) -> str:
        return SMALL if 0 < n < MIN_CELL else str(n)

    def share(n: int, d: int) -> str:
        return "" if d < MIN_CELL or 0 < n < MIN_CELL else f"   ({pct(n, d)})"

    out = ["== Reminders to finish setup (Groups 20 and 24)"]
    if r["asked"] < MIN_CELL:
        out.append(f"  asked for them                   {count(r['asked'])}")
        return "\n".join(out)
    out += [
        f"  asked for them                   {r['asked']}: up to three emails {count(r['sequence'])}, "
        f"one email (the first version) {count(r['one_email'])}",
        f"  emails sent                      {count(r['emails'])}, to {count(r['emailed'])} people",
        f"  opened setup from an email       {count(r['clicked'])}{share(r['clicked'], r['emailed'])}",
        f"  snoozed them                     {count(r['snoozed'])}{share(r['snoozed'], r['asked'])}",
        f"  stopped them                     {count(r['stopped'])}{share(r['stopped'], r['asked'])}",
        f"  finished setup after an email    {count(r['finished_after'])}{share(r['finished_after'], r['emailed'])}",
        "  (opened and finished: shares of those emailed; snoozed and stopped: of those who asked)",
    ]
    return "\n".join(out)


def summarize_still_using(people: List[dict], events: Iterable[dict], now: Optional[datetime] = None) -> Dict[str, int]:
    """Still using after two weeks (Group 24: "Day 14 active rate"): of the
    accounts at least 14 days old, how many opened the app (app_open) on day
    14 or later after signing up, by calendar day, from any browser. Pure."""
    today = (now or datetime.now().astimezone()).date()
    index = _events_by_person(events, lambda e: e["event"] == "app_open")
    old = [p for p in people if p["account"] and (today - p["signup_at"].date()).days >= ACTIVE_FROM_DAY]
    active = sum(1 for p in old if any((_ts(e["created_at"]).date() - p["signup_at"].date()).days >= ACTIVE_FROM_DAY
                                       for e in _person_events(p, index)))
    return {"accounts": len(old), "active": active}


def render_still_using(s: Dict[str, int]) -> str:
    out = [f"== Still using after two weeks (Group 24: Day {ACTIVE_FROM_DAY} active rate)"]
    if s["accounts"] < MIN_CELL:
        out.append(f"  accounts at least {ACTIVE_FROM_DAY} days old        {SMALL if s['accounts'] else 0}")
        return "\n".join(out)
    n = s["active"]
    out.append(f"  accounts at least {ACTIVE_FROM_DAY} days old        {s['accounts']}")
    out.append(f"  opened the app on day {ACTIVE_FROM_DAY} or later    {SMALL if 0 < n < MIN_CELL else n}"
               + ("" if 0 < n < MIN_CELL else f"   ({pct(n, s['accounts'])})"))
    return "\n".join(out)


def summarize_goal_helper(people: List[dict]) -> Dict:
    """The AI goal helper (Group 11 suggested testing "the AI guide vs the
    standard Goals step"): of the accounts that reached the goal step, who got
    suggestions, who added one, and how often each group finished setup. Not
    a randomized test: people choose to open the helper. Pure."""
    at_goal = [p for p in people if p["account"] and "goalsAndDreams" in p["steps"]]
    used = [p for p in at_goal if p["helper_used"]]
    others = [p for p in at_goal if not p["helper_used"]]
    return {
        "reached": len(at_goal),
        "used": len(used),
        "picked": sum(p["helper_picked"] for p in used),
        "used_finished": sum(p["finished"] for p in used),
        "others": len(others),
        "others_finished": sum(p["finished"] for p in others),
        "chat": sum(p.get("chat_used", False) for p in people if p["account"]),
        "chat_finished": sum(p.get("chat_used", False) and p["finished"] for p in people if p["account"]),
    }


def render_goal_helper(g: Dict) -> str:
    out = ["== The goal helper (Group 11: optional AI help on the goal step)",
           f"  reached the goal step            {g['reached']}"]
    chat = g.get("chat", 0)
    out.append(f"  answered setup as a chat         {SMALL if 0 < chat < MIN_CELL else chat}"
               + (f", finished setup {pct(g['chat_finished'], chat)}" if chat >= MIN_CELL else ""))
    if g["used"] < MIN_CELL:
        out.append(f"  got suggestions                  {SMALL if g['used'] else 0}   (fewer than {MIN_CELL}: no rates yet)")
        return "\n".join(out)
    out.append(f"  got suggestions                  {g['used']}   ({pct(g['used'], g['reached'])}); "
               f"added one: {pct(g['picked'], g['used'])}")
    out.append(f"  finished setup: with the helper {pct(g['used_finished'], g['used'])}, "
               f"without it {pct(g['others_finished'], g['others']) if g['others'] >= MIN_CELL else SMALL}")
    out.append("  (people choose to use it, so this compares groups, not cause and effect)")
    return "\n".join(out)


def summarize_newsletter_and_stories(subscribers: Iterable[dict], stories: Iterable[dict]) -> Dict:
    """Group 11: email without an account (double opt-in) and shared stories. Counts only. Pure."""
    subs = list(subscribers)
    return {
        "subscribers": Counter(r.get("status") for r in subs),
        "weekly": sum(1 for r in subs if r.get("status") == "confirmed" and r.get("weekly")),
        "lists_sent": sum(1 for r in subs if r.get("list_sent_at")),
        "stories": Counter(r.get("status") for r in stories),
    }


def render_newsletter_and_stories(n: Dict) -> str:
    def count(k: int) -> str:
        return SMALL if 0 < k < MIN_CELL else str(k)
    s, t = n["subscribers"], n["stories"]
    return "\n".join([
        "== Email without an account, and shared stories (Group 11)",
        f"  asked for email: confirmed {count(s.get('confirmed', 0))}, not yet confirmed {count(s.get('pending', 0))}, "
        f"stopped {count(s.get('unsubscribed', 0))}; weekly email {count(n['weekly'])}; lists sent {count(n['lists_sent'])}",
        "  stories: " + ", ".join(f"{k} {count(t.get(k, 0))}" for k in
                                  ("submitted", "awaiting_approval", "approved", "published", "declined", "withdrawn")),
    ])


def summarize_generation(rows: Iterable[dict], user_ids: set) -> Dict:
    """Making the path, for the accounts in this funnel (Riipen Labs Group 9
    saw setup "freezing"): how many got a path, how many needed more than one
    try, how long a successful one took, and why attempts failed. In
    September 223 of 293 attempts failed with "Too many requests in the last
    minute", when a second generation ran beside the first (see
    backend/core/jobs.py, in_flight_for_user). Pure."""
    jobs = [r for r in rows if r.get("user_id") in user_ids]
    by_user: Dict[str, List[dict]] = defaultdict(list)
    for j in jobs:
        by_user[j["user_id"]].append(j)
    seconds = [(_ts(j["finished_at"]) - _ts(j["created_at"])).total_seconds()
               for j in jobs if j.get("status") == "succeeded" and j.get("finished_at")]
    seconds.sort()
    failed = [j for j in jobs if j.get("status") == "failed"]
    return {
        "people": len(by_user),
        "got_path": sum(1 for js in by_user.values() if any(j.get("status") == "succeeded" for j in js)),
        "more_than_one_try": sum(1 for js in by_user.values() if len(js) > 1),
        "attempts": len(jobs),
        "failed": len(failed),
        "median_s": median(seconds) if seconds else None,
        "p90_s": seconds[min(len(seconds) - 1, int(len(seconds) * 0.9))] if seconds else None,
        "reasons": Counter((j.get("error") or "no message")[:80] for j in failed),
    }


def summarize_skips(users: Iterable[dict]) -> Dict[str, int]:
    """Setup skipped for now (Riipen Labs, Group 33: "Add a clear 'Skip
    Onboarding' option"): who skipped, and how many of them made a plan
    later. From the accounts' metadata, set by setup's "Skip for now". Where
    they went (Group 24's "Skip to resources"): setup_skipped_to, 'resources'
    or 'path'; accounts that skipped before it was recorded went to the
    path. Pure."""
    skipped = [u for u in users if (u.get("user_metadata") or {}).get("setup_skipped") is True]
    later = sum(1 for u in skipped if (u.get("user_metadata") or {}).get("has_completed_onboarding") is True)
    went = Counter((u.get("user_metadata") or {}).get("setup_skipped_to") or "path" for u in skipped)
    return {"skipped": len(skipped), "made_a_plan": later, "to_resources": went["resources"], "to_path": went["path"]}


def render_skips(s: Dict[str, int]) -> str:
    out = ["== Setup skipped for now (Group 33: \"Skip Onboarding\")"]
    if s["skipped"] < MIN_CELL:
        out.append(f"  skipped setup                      {SMALL if s['skipped'] else 0}")
        return "\n".join(out)
    out += [
        f"  skipped setup                      {s['skipped']}",
        f"  made a plan later                  {s['made_a_plan']} ({pct(s['made_a_plan'], s['skipped'])})",
        f"  went to resources                  {s.get('to_resources', 0)} ({pct(s.get('to_resources', 0), s['skipped'])})",
        f"  went to their path                 {s.get('to_path', 0)} ({pct(s.get('to_path', 0), s['skipped'])})",
    ]
    return "\n".join(out)


def _age(dob, today: date) -> Optional[int]:
    """Whole years from a 'YYYY-MM-DD' date of birth (as computeAge in
    frontend/lib/age.ts), or None if it is missing, not a date or later than
    today."""
    text = str(dob or "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return None
    try:
        born = date.fromisoformat(text)
    except ValueError:
        return None
    if born > today:
        return None
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def summarize_ages(users: Iterable[dict], today: Optional[date] = None) -> Counter:
    """Accounts by age today in the waitlist form's bands (Group 22), from the
    date of birth given at sign-up: app_metadata, or user_metadata on older
    accounts. Team, test and synthetic accounts (marked "test" by main()) are
    left out. Pure."""
    today = today or date.today()
    counts: Counter = Counter()
    for u in users:
        if u.get("test"):
            continue
        age = _age((u.get("app_metadata") or {}).get("date_of_birth")
                   or (u.get("user_metadata") or {}).get("date_of_birth"), today)
        if age is None:
            counts[AGE_NOT_KNOWN] += 1
        elif age < 18:
            counts[UNDER_18] += 1
        else:
            counts[next(band for band, oldest in AGE_BANDS if oldest is None or age <= oldest)] += 1
    return counts


def render_ages(counts: Counter) -> str:
    total = sum(counts.values())
    out = [f"== Age today, in the waitlist form's bands (Group 22; {total} accounts, from the date of birth)"]
    for label in [band for band, _ in AGE_BANDS] + [UNDER_18, AGE_NOT_KNOWN]:
        n = counts.get(label, 0)
        shown = SMALL if 0 < n < MIN_CELL else str(n)
        share = "-" if n < MIN_CELL else pct(n, total)
        out.append(f"  {label:<20} {shown:>5}  ({share})")
    out.append("  (team, test and synthetic accounts left out; 55 is counted in 46-55)")
    return "\n".join(out)


def render_generation(g: Dict) -> str:
    out = ["== Making the path (Group 9: setup \"freezing\")"]
    if g["people"] < MIN_CELL:
        out.append(f"  people who started one             {SMALL if g['people'] else 0}")
        return "\n".join(out)
    out += [
        f"  people who started one             {g['people']}",
        f"  got a path                         {g['got_path']} ({pct(g['got_path'], g['people'])})",
        f"  needed more than one try           {g['more_than_one_try']} ({pct(g['more_than_one_try'], g['people'])})",
        f"  attempts that failed               {g['failed']} of {g['attempts']}",
    ]
    if g["median_s"] is not None:
        out.append(f"  time to a path                     median {_duration(g['median_s'] / 3600)}, "
                   f"90% within {_duration(g['p90_s'] / 3600)}")
    if g["failed"] >= MIN_CELL:
        for reason, n in g["reasons"].most_common(3):
            out.append(f"    {n:>4} x {reason}")
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

    def kept_as_text(r: dict) -> bool:
        # A day-3 answer from before STEP 76 (see EARLY_PREFIX).
        return r.get("kind") == "usefulness" and str(r.get("comment") or "").startswith(EARLY_PREFIX)

    def early_reason(r: dict) -> Optional[str]:
        if r.get("kind") == "early":
            return r.get("reason")
        label = str(r["comment"])[len(EARLY_PREFIX):].split(".", 1)[0]
        return next((key for key, text in EARLY_REASONS if text == label), None)
    day3 = [r for r in rows if r.get("kind") == "early" or kept_as_text(r)]
    useful = [r for r in rows if r.get("kind") == "usefulness" and not kept_as_text(r)]
    # "Tell us how it's going" in the glossary (STEP 69): people who came to
    # say something, so not mixed into the share who find it useful.
    sent = [r for r in rows if r.get("kind") == "feedback"]
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
        "sent": len(sent),
        "sent_usefulness": Counter(r["usefulness"] for r in sent if r.get("usefulness")),
        "day3": len(day3),
        "day3_reasons": Counter(reason for reason in (early_reason(r) for r in day3) if reason),
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
    day3_total = sum(c.get("day3_reasons", Counter()).values())
    out.append(f"== Day 3: how is it going? (asked in the app on days 3 to 6; Group 12): {c.get('day3', 0)} answers")
    for key, label in EARLY_REASONS:
        n = c.get("day3_reasons", Counter()).get(key, 0)
        out.append(f"  {label:<36} {n:>4}  ({pct(n, day3_total)})")
    out.append("")
    out.append(f"== Useful so far? (asked in the app from day 7, or by the day-14 email): {c['useful']} answers")
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
    sent_total = sum(c.get("sent_usefulness", Counter()).values())
    out.append("")
    out.append(f"== Sent at any time (\"Tell us how it's going\" in the glossary): {c.get('sent', 0)} answers")
    if c.get("sent", 0):
        out.append("  " + "   ".join(f"{label}: {c['sent_usefulness'].get(key, 0)} ({pct(c['sent_usefulness'].get(key, 0), sent_total)})"
                                    for key, label in USEFULNESS))
    out.append(f"  comments: {len(c['comments'])}" + ("" if show_comments else "  (use --show-comments to read them)"))
    if show_comments:
        for kind, text in c["comments"]:
            out.append(f"    - [{kind}] {text}")
    return "\n".join(out)


def summarize_success_markers(people: List[dict], events: Iterable[dict],
                              first_save_by_user: Optional[Dict[str, str]] = None,
                              now: Optional[datetime] = None) -> Dict[str, Dict[str, int]]:
    """Group 15's success markers for the first 7 to 14 days, by who people
    are here for: on day 1, something useful (a step, a resource, ResourceHub
    or Tools opened, or a resource saved, within a day of signing up); in the
    first week, the app opened on two or more later days; in the second
    week, the app opened again (days 8 to 14). A week counts only for
    accounts old enough to have had it. Pure."""
    first_save_by_user = first_save_by_user or {}
    today = (now or datetime.now().astimezone()).date()
    index = _events_by_person(events, lambda e: e["event"] == "app_open")
    groups: Dict[str, Dict[str, int]] = {}
    for p in people:
        if not p["account"] or p["signup_at"] is None:
            continue
        g = groups.setdefault(p["audience"], {"people": 0, "day1": 0, "week1_people": 0, "week1": 0,
                                              "week2_people": 0, "week2": 0})
        g["people"] += 1
        start = p["signup_at"]
        saved = first_save_by_user.get(p["user_id"]) if p.get("user_id") else None
        saved_day1 = bool(saved) and timedelta(0) <= _ts(saved) - start <= FIRST_DAY
        if p.get("first_value_same_day") or saved_day1:
            g["day1"] += 1
        days = {(_ts(e["created_at"]).date() - start.date()).days for e in _person_events(p, index)}
        age = (today - start.date()).days
        if age >= 7:
            g["week1_people"] += 1
            if len([d for d in days if 1 <= d <= 7]) >= 2:
                g["week1"] += 1
        if age >= 14:
            g["week2_people"] += 1
            if any(8 <= d <= 14 for d in days):
                g["week2"] += 1
    return dict(sorted(groups.items(), key=lambda kv: -kv[1]["people"]))


def render_success_markers(s: Dict[str, Dict[str, int]], shared_links: int = 0, share_presses: int = 0) -> str:
    out = ["== Success markers for the first two weeks, by who people are here for (Group 15)",
           "   day 1: a step, resource, ResourceHub or Tools opened, or a resource saved, within a day",
           "   week 1: the app opened on 2+ later days; week 2: opened again on days 8 to 14",
           f"  {'who for':<20} {'people':>7} {'day 1':>12} {'week 1':>14} {'week 2':>14}"]
    if not s:
        out.append("  no accounts yet")
    for label, g in s.items():
        if g["people"] < MIN_CELL:
            out.append(f"  {label[:20]:<20} {SMALL:>7} {'-':>12} {'-':>14} {'-':>14}")
            continue

        def cell(n: int, d: int) -> str:
            if d < MIN_CELL:
                return f"{SMALL} old"
            return f"{n} ({pct(n, d)})"
        out.append(f"  {label[:20]:<20} {g['people']:>7} {cell(g['day1'], g['people']):>12} "
                   f"{cell(g['week1'], g['week1_people']):>14} {cell(g['week2'], g['week2_people']):>14}")
    out.append(f"  browsers that pressed Share this list in Start here: "
               f"{SMALL if 0 < share_presses < MIN_CELL else share_presses}")
    out.append(f"  visitors who arrived from a link someone shared (utm_source=share): "
               f"{SMALL if 0 < shared_links < MIN_CELL else shared_links}")
    return "\n".join(out)


def summarize_display_choices(events: Iterable[dict], wanted_version: str = CURRENT_VERSION) -> Dict:
    """Which display choices people turn on, as distinct browsers (Group 16). Pure."""
    who: Dict[str, set] = defaultdict(set)
    for e in events:
        if e["event"] == "feature_use" and str(e.get("step") or "").startswith("display_") \
                and keep_version(e.get("onboarding_version", ""), wanted_version):
            who[e["step"]].add(e["visitor_id"])
    anyone = set().union(*who.values()) if who else set()
    return {"people": len(anyone), "by_choice": {k: len(v) for k, v in who.items()}}


def render_display_choices(d: Dict) -> str:
    out = ["== Display choices turned on (Group 16: which colour options people choose)"]
    if d["people"] < MIN_CELL:
        out.append(f"  browsers that changed a display setting   {SMALL if d['people'] else 0}")
        return "\n".join(out)
    out.append(f"  browsers that changed a display setting   {d['people']}")
    for key, label in DISPLAY_CHOICES:
        n = d["by_choice"].get(key, 0)
        if n:
            out.append(f"  {label:<26} {SMALL if n < MIN_CELL else n:>6}" + ("" if n < MIN_CELL else f"   ({pct(n, d['people'])})"))
    return "\n".join(out)


def summarize_look_inside(events: Iterable[dict], wanted_version: str = CURRENT_VERSION) -> Dict:
    """Which screens of "A look inside" people opened, as distinct browsers, and
    how many of the four each browser saw (Group 12). The first screen shows
    without a tap: it is counted as opened only when someone came back to it,
    and as seen by everyone who opened another. Pure."""
    wanted = {key for key, _ in INSIDE_SCREENS}
    opened: Dict[str, set] = defaultdict(set)
    for e in events:
        if e["event"] == "feature_use" and e.get("step") in wanted \
                and keep_version(e.get("onboarding_version", ""), wanted_version):
            opened[e["visitor_id"]].add(e["step"])
    return {
        "browsers": len(opened),
        "by_screen": {key: sum(key in s for s in opened.values()) for key, _ in INSIDE_SCREENS},
        # Screens seen: the first, and every other one opened.
        "how_many": {n: sum(len(s - {INSIDE_SCREENS[0][0]}) + 1 == n for s in opened.values())
                     for n in range(1, len(INSIDE_SCREENS) + 1)},
    }


def render_look_inside(d: Dict) -> str:
    out = ["== A look inside on the home page (Group 12: who went through it, and where it stops)"]
    if d["browsers"] < MIN_CELL:
        out.append(f"  browsers that opened a screen   {SMALL if d['browsers'] else 0}")
        return "\n".join(out)
    out.append(f"  browsers that opened a screen   {d['browsers']}")
    for key, label in INSIDE_SCREENS:
        n = d["by_screen"].get(key, 0)
        out.append(f"  {label:<14} {SMALL if 0 < n < MIN_CELL else n:>6}")
    out.append("  screens seen per browser (the first shows on its own): " + "   ".join(
        f"{'all ' if n == len(INSIDE_SCREENS) else ''}{n}: {SMALL if 0 < c < MIN_CELL else c}" for n, c in d["how_many"].items()))
    return "\n".join(out)


def norm_group(norms: Iterable[str]) -> str:
    """'autism', 'adhd', 'both', 'other' or 'none', for one person's norms."""
    from core.condition_taxonomy import match_keys
    keys = match_keys([n for n in norms if n])
    autism = "autism" in keys or "audhd" in keys
    adhd = "adhd" in keys or "audhd" in keys
    if autism and adhd:
        return "both"
    if autism:
        return "autism"
    if adhd:
        return "adhd"
    return "other" if keys else "none"


def summarize_by_norms(people: List[dict], norms_by_user: Dict[str, List[str]]) -> Dict[str, Dict[str, int]]:
    """Setup and returns by norm group (Group 19: ADHD against autism). Only
    accounts; norms from user_barriers. Pure."""
    groups: Dict[str, Dict[str, int]] = {key: {"accounts": 0, "finished": 0, "first_value": 0,
                                                "returned": 0, "returned_14": 0} for key, _ in NORM_GROUPS}
    for p in people:
        if not p["account"]:
            continue
        g = groups[norm_group(norms_by_user.get(p.get("user_id") or "", []))]
        g["accounts"] += 1
        g["finished"] += bool(p["finished"])
        g["first_value"] += p["first_value_hours"] is not None
        g["returned"] += bool(p["returned"])
        g["returned_14"] += bool(p["returned_14"])
    return groups


def render_by_norms(groups: Dict[str, Dict[str, int]]) -> str:
    out = ["== By norms: ADHD and autism compared (Group 19; norms from ResourceHub and setup)",
           f"  {'norms':<20} {'accounts':>8} {'set up':>9} {'used':>9} {'back in 7d':>11} {'back in 14d':>12}"]
    for key, label in NORM_GROUPS:
        g = groups.get(key) or {}
        n = g.get("accounts", 0)
        if n < MIN_CELL:
            out.append(f"  {label:<20} {(SMALL if n else 0):>8} {'-':>9} {'-':>9} {'-':>11} {'-':>12}")
            continue
        out.append(f"  {label:<20} {n:>8} {pct(g['finished'], n):>9} {pct(g['first_value'], n):>9} "
                   f"{pct(g['returned'], n):>11} {pct(g['returned_14'], n):>12}")
    out.append("  (used: opened a step, a resource, ResourceHub or Tools after signing up)")
    return "\n".join(out)


def summarize_first_page_leavers(events: Iterable[dict], wanted_version: str = CURRENT_VERSION) -> Dict[str, Dict[str, int]]:
    """Visitors who saw a first page (the home page or Start here) and did
    nothing else: no answer, no sign-up, no other page counted (Group 18:
    "monitor bounce rates"), by the channel they arrived from. Pure."""
    by_visitor: Dict[str, List[dict]] = defaultdict(list)
    for e in events:
        if keep_version(e.get("onboarding_version", ""), wanted_version):
            by_visitor[e["visitor_id"]].append(e)
    out: Dict[str, Dict[str, int]] = {}
    for evs in by_visitor.values():
        if not any(e["event"] == "landing_view" for e in evs):
            continue
        channel = next((e.get("channel") for e in evs if e.get("channel")), None) or "(none)"
        g = out.setdefault(channel, {"visitors": 0, "left": 0})
        g["visitors"] += 1
        if all(e["event"] == "landing_view" for e in evs):
            g["left"] += 1
    return dict(sorted(out.items(), key=lambda kv: -kv[1]["visitors"]))


def render_first_page_leavers(s: Dict[str, Dict[str, int]]) -> str:
    out = ["== Left after the first page (Group 18: bounce rate), by channel",
           "   a first page (home or Start here) and nothing else: no answer, no sign-up",
           f"  {'channel':<20} {'visitors':>9} {'left':>14}"]
    if not s:
        out.append("  no visitors yet")
    for channel, g in s.items():
        if g["visitors"] < MIN_CELL:
            out.append(f"  {channel[:20]:<20} {SMALL:>9} {'-':>14}")
            continue
        out.append(f"  {channel[:20]:<20} {g['visitors']:>9} {g['left']:>6} ({pct(g['left'], g['visitors'])})")
    return "\n".join(out)


def summarize_not_found(events: Iterable[dict], wanted_version: str = CURRENT_VERSION) -> Dict[str, int]:
    """Pages that were not there (Group 19: "fewer navigation errors"), from
    the app's not-found page (feature_use "not_found"). Pure."""
    hits = [e for e in events if e["event"] == "feature_use" and e.get("step") == "not_found"
            and keep_version(e.get("onboarding_version", ""), wanted_version)]
    return {"times": len(hits), "browsers": len({e["visitor_id"] for e in hits})}


def render_not_found(s: Dict[str, int]) -> str:
    out = ["== Pages not found (Group 19: navigation errors; once a day per browser)"]
    out.append(f"  times                {SMALL if 0 < s['times'] < MIN_CELL else s['times']}")
    out.append(f"  browsers             {SMALL if 0 < s['browsers'] < MIN_CELL else s['browsers']}")
    return "\n".join(out)


def summarize_first_weeks(people: List[dict], prefs_by_user: Dict[str, dict]) -> Dict[str, int]:
    """The first two weeks' emails (Group 15), from profiles.preferences.firstWeeks:
    turned on, each day's email sent, a link in one opened, and stopped. Pure."""
    out = {"accounts": 0, "on": 0, "clicked": 0, "stopped": 0, **{f"sent_{d}": 0 for d in FIRST_WEEKS_DAYS}}
    for p in people:
        if not p["account"] or not p.get("user_id"):
            continue
        out["accounts"] += 1
        fw = (prefs_by_user.get(p["user_id"]) or {}).get("firstWeeks") or {}
        if not isinstance(fw, dict) or not fw.get("consent"):
            continue
        out["on"] += 1
        sent = fw.get("sent") or {}
        for d in FIRST_WEEKS_DAYS:
            out[f"sent_{d}"] += bool(isinstance(sent, dict) and sent.get(f"day{d}"))
        out["clicked"] += bool(fw.get("clicked"))
        out["stopped"] += bool(fw.get("stoppedAt"))
    return out


def render_first_weeks(s: Dict[str, int]) -> str:
    def n(v: int) -> str:
        return SMALL if 0 < v < MIN_CELL else str(v)
    out = ["== Emails for the first two weeks, on days 1, 7 and 14 (Group 15)",
           f"  accounts                         {s['accounts']}",
           f"  asked for them                   {n(s['on'])}"]
    for d in FIRST_WEEKS_DAYS:
        out.append(f"  day {d:<2} email sent                {n(s[f'sent_{d}'])}")
    out.append(f"  opened a link in one             {n(s['clicked'])}")
    out.append(f"  stopped them                     {n(s['stopped'])}")
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
    # Team, test and synthetic accounts, by email, as the other reports tell them apart.
    from scripts.vector_evaluation_pull import is_synthetic, is_team_test

    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return 1
    try:
        try:
            events = fetch_all(sb, "onboarding_events",
                               "visitor_id, user_id, event, step, channel, device, onboarding_version, created_at")
        except Exception:
            # device comes with STEP 69.
            events = fetch_all(sb, "onboarding_events",
                               "visitor_id, user_id, event, step, channel, onboarding_version, created_at")
        feedback = None
        # signup_clear comes with STEP 70, next_step with STEP 62.
        for extra in (", next_step, signup_clear", ", next_step", ""):
            try:
                feedback = fetch_all(sb, "onboarding_feedback",
                                     "user_id, info_before_signup, setup_ease, comment, onboarding_version" + extra)
                break
            except Exception:
                if not extra:
                    raise
    except Exception as e:
        print(f"Could not read the funnel tables ({str(e)[:90]}). Has STEP 45 been applied?")
        return 1
    # ResourceHub's events (STEP 51) have their own section, at the end.
    rh_events = [e for e in events if is_resourcehub(e)]
    events = [e for e in events if not is_resourcehub(e)]
    audience_by_user = {}
    heard_from_by_user = {}
    joined_by_user = {}
    prefs_by_user: Dict[str, dict] = {}
    for p in fetch_all(sb, "profiles", "id, preferences, created_at"):
        prefs_by_user[p["id"]] = p.get("preferences") or {}
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
    print(render_start_refine(summarize_start_refine(events, args.version)))
    print()
    print(render_versions(compare_versions(events)))
    print()
    print(render_setup_time(summarize_setup_time(events)))
    print()
    print(render_energy(summarize_energy(funnel["people"])))
    print()
    # ResourceHub's first place opened counts as a first resource too.
    print(render_first_resource(summarize_first_resource(funnel["people"], events + rh_events)))
    print()
    print(render_feature_use(summarize_feature_use(events, args.version, audience_by_user)))
    print()
    print(render_feature_weeks(summarize_feature_weeks(funnel["people"], events)))
    print()
    try:
        entries = fetch_all(sb, "reflections", "user_id, created_at")
        print(render_journal(summarize_journal(funnel["people"], entries)))
    except Exception:
        print("== Journal entries: not available (reflections could not be read).")
    print()
    print(render_last_seen(summarize_last_seen(events, args.version)))
    print()
    print(render_ask_later(summarize_ask_later(events, args.version)))
    print()
    print(render_profile_card(summarize_profile_card(events, args.version)))
    print()
    print(render_tour(summarize_tour(events, args.version)))
    print()
    push_users: set = set()
    first_save_by_user: Dict[str, str] = {}
    try:
        push_users = {r["user_id"] for r in fetch_all(sb, "push_subscriptions", "user_id")}
    except Exception:
        pass  # without it, notifications show 0
    try:
        for r in fetch_all(sb, "saved_resources", "user_id, created_at"):
            if r.get("user_id") and r.get("created_at"):
                if r["user_id"] not in first_save_by_user or r["created_at"] < first_save_by_user[r["user_id"]]:
                    first_save_by_user[r["user_id"]] = r["created_at"]
    except Exception:
        pass  # without it, first-day and first-week saves show 0
    print(render_return_loop(summarize_return_loop(funnel["people"], prefs_by_user, push_users, first_save_by_user)))
    print()
    print(render_setup_reminders(summarize_setup_reminders(funnel["people"], prefs_by_user, events)))
    print()
    print(render_still_using(summarize_still_using(funnel["people"], events)))
    print()
    shared = sum(1 for p in funnel["people"] if p["channel"] == "share" and p["landing"])
    presses = len({e["visitor_id"] for e in events if e["event"] == "feature_use" and e.get("step") == "share_list"})
    print(render_success_markers(summarize_success_markers(funnel["people"], events, first_save_by_user), shared, presses))
    print()
    print(render_first_weeks(summarize_first_weeks(funnel["people"], prefs_by_user)))
    print()
    norms_by_user: Dict[str, List[str]] = defaultdict(list)
    try:
        for r in fetch_all(sb, "user_barriers", "user_id, barrier_type"):
            if r.get("user_id") and r.get("barrier_type"):
                norms_by_user[r["user_id"]].append(r["barrier_type"])
        print(render_by_norms(summarize_by_norms(funnel["people"], norms_by_user)))
    except Exception:
        print("== By norms: not available (user_barriers could not be read).")
    print()
    print(render_display_choices(summarize_display_choices(events, args.version)))
    print()
    print(render_look_inside(summarize_look_inside(events, args.version)))
    print()
    print(render_first_page_leavers(summarize_first_page_leavers(events, args.version)))
    print()
    print(render_not_found(summarize_not_found(events, args.version)))
    print()
    print(render_goal_helper(summarize_goal_helper(funnel["people"])))
    print()
    try:
        subscribers = fetch_all(sb, "newsletter_subscribers", "status, weekly, list_sent_at")
        stories = fetch_all(sb, "stories", "status")
        print(render_newsletter_and_stories(summarize_newsletter_and_stories(subscribers, stories)))
    except Exception:
        print("== Email without an account, and shared stories: not available yet (apply STEP 52).")
    print()
    print(render_resourcehub(summarize_resourcehub(rh_events)))
    print()
    try:
        users, page = [], 1
        while True:
            batch = sb.auth.admin.list_users(page=page, per_page=1000)
            users += [{"user_metadata": getattr(u, "user_metadata", None) or {},
                       "app_metadata": getattr(u, "app_metadata", None) or {},
                       "test": is_synthetic(u) or is_team_test(u)} for u in batch]
            if len(batch) < 1000:
                break
            page += 1
        print(render_skips(summarize_skips(users)))
        print()
        print(render_ages(summarize_ages(users)))
    except Exception:
        print("== Setup skipped for now, and ages: the accounts could not be read.")
    print()
    try:
        generations = fetch_all(sb, "generation_jobs", "user_id, status, created_at, finished_at, error")
        accounts = {p["user_id"] for p in funnel["people"] if p["account"] and p["user_id"]}
        print(render_generation(summarize_generation(generations, accounts)))
        print()
    except Exception:
        print("== Making the path: not available (generation_jobs could not be read).")
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
