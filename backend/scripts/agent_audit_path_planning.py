"""What Path Planning produced, measured on every stored path, and what exists
to judge it by (docs/reports/agent-audit-path-planning-2026-10-13.md).

Read-only against the database: it only selects. It prints counts and
distributions, never ids, emails, goals or anything else people typed.

The run is logged with core/evaluation_runs.py at the start and the end, but
only to the Postgres named by EVALUATION_RUNS_DSN: the script never hands the
log the Supabase client, so a run against production writes nothing there.
Without EVALUATION_RUNS_DSN the run is not logged, and says so.

Every figure is given for the current paths (user_paths.is_legacy = false)
and again for all paths, legacy included. Legacy paths (STEP 53) were written
before 064801c and carry path planning's old fixed confidence, 0.85.

Definitions used by the quality checks (also in the report):
  * words of a text: lowercased, split on anything that isn't a letter or a
    digit, without STOPWORDS and GENERIC_VERBS and words under 3 letters,
    each cut to a stem (a trailing -ing, -ed, -es or -s removed, then the
    first 6 letters).
  * exact duplicate: two milestones of one path whose names are equal once
    lowercased, with punctuation and repeated spaces removed.
  * near duplicate: not exact, both names have at least 2 words, and their
    sets of words overlap by Jaccard >= 0.6 (also counted at 0.5 and 0.8).
  * both are counted within one goal (race) and across the goals of a path.
  * empty task: no name once trimmed; one-word task: a name of one word.
  * a goal appears in its milestones when at least one of the goal's words
    is a word of at least one milestone NAME in its race. Descriptions are
    left out on purpose: the template fallbacks paste the goal into them.

  python -m scripts.agent_audit_path_planning        (from backend/)
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from itertools import combinations
from typing import Any, Callable, Dict, List, Optional, Sequence, Set, Tuple

from dotenv import load_dotenv

load_dotenv()

from core.condition_taxonomy import match_keys  # noqa: E402
from core.agents.path_planning_agent import (  # noqa: E402
    LIFE_AREAS, MAX_MILESTONES_PER_PATH, MILESTONES_PER_AREA, SUPPORT_TEMPLATES, PathPlanningAgent,
)
from core.evaluation_runs import RunLog  # noqa: E402
from core.learning import compute_profile_signature  # noqa: E402
from core.output_quality import _FALLBACK_STAGES  # noqa: E402
from core.path_provenance import is_legacy_payload  # noqa: E402
from database.supabase_client import get_supabase  # noqa: E402
from scripts.reembed_pattern_users import fetch_all  # noqa: E402
from scripts.vector_evaluation_pull import is_synthetic, is_team_test, list_all_users  # noqa: E402

SCRIPT = "scripts.agent_audit_path_planning"
NEAR_DUPLICATE = 0.6
SENSITIVITY = (0.5, 0.8)
MIN_SAMPLES = 20  # get_best_path_shape's min_samples in generate_path
# The milestone rating reached production with 0670fc0 (merged and deployed
# 11 October 2026); visits to the milestone pages since then could see it.
RATINGS_LIVE = "2026-10-11"

STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "of", "to", "for", "with", "in", "on", "at", "by", "from",
    "into", "about", "as", "your", "their", "my", "our", "his", "her", "its", "you", "they", "them",
    "it", "is", "are", "be", "this", "that", "these", "those", "who", "what", "how", "i", "me", "we",
    "us", "he", "she", "will", "can", "so", "if", "than", "then", "up", "out", "all", "any", "each",
}
# Verbs that start most milestone names and many goals ("Build ...", "Get a
# job"): sharing one says nothing about the subject, so they don't count.
GENERIC_VERBS = {
    "get", "make", "find", "build", "create", "start", "improve", "become", "develop", "have",
    "want", "need", "more", "better", "new", "good", "able", "help", "set", "take", "keep",
}
# _generate_tasks_for_milestone's template tasks ("<phase>: <milestone>") and
# output_quality's starter task ("Start: <milestone>").
TASK_TEMPLATE_PREFIXES = (
    "Research and gather information:", "Create action plan:", "Take first small step:",
    "Review and adjust approach:", "Complete and celebrate:",
)
QUALITY_TASK_PREFIX = "Start: "
# _generate_recommended_choices: the same three choices, with these numbers,
# on every milestone.
FIXED_CHOICE_RATES = {87.5, 84.2, 91.3}
# core/jobs.py and api/routes/onboarding.py: the messages a failed job can carry.
JOB_MESSAGES = {
    "Path generation failed. Please try again.": "any other exception (cause only in the server log)",
    "Generation was interrupted. Please try again.": "interrupted (reaped after a restart or hang)",
}
BUDGET_PREFIXES = {
    "Too many requests in the last minute": "AI limit: requests per minute",
    "You've reached today's usage limit": "AI limit: tokens per day",
    "You've reached today's AI budget": "AI limit: spend per day",
}
GUARDRAIL_HINTS = ("aren't supported", "isn't supported", "achievable human outcomes", "too long",
                   "isn't appropriate", "without profanity")


# ---- definitions ------------------------------------------------------------

def normalized(text: Any) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(text or "").lower())).strip()


def stem(word: str) -> str:
    for suffix in ("ing", "ed", "es", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            word = word[: -len(suffix)]
            break
    return word[:6]


def words(text: Any) -> Set[str]:
    return {stem(w) for w in normalized(text).split()
            if len(w) >= 3 and w not in STOPWORDS and w not in GENERIC_VERBS}


def jaccard(a: Set[str], b: Set[str]) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


def pair_kind(a: str, b: str, threshold: float = NEAR_DUPLICATE) -> Optional[str]:
    """'exact', 'near' or None for two milestone names."""
    if normalized(a) and normalized(a) == normalized(b):
        return "exact"
    wa, wb = words(a), words(b)
    if len(wa) >= 2 and len(wb) >= 2 and jaccard(wa, wb) >= threshold:
        return "near"
    return None


def task_flags(task: Dict[str, Any]) -> Set[str]:
    name = str(task.get("name") or "").strip()
    flags = set()
    if not name:
        flags.add("empty")
    elif len(name.split()) == 1:
        flags.add("one_word")
    if not str(task.get("description") or "").strip():
        flags.add("no_description")
    if name.startswith(TASK_TEMPLATE_PREFIXES):
        flags.add("template")
    if name.startswith(QUALITY_TASK_PREFIX):
        flags.add("quality_fallback")
    return flags


def goal_appears(goal: Any, milestone_names: Sequence[Any]) -> Optional[bool]:
    """True/False, or None when the goal has no words to look for."""
    goal_words = words(goal)
    if not goal_words:
        return None
    return any(goal_words & words(name) for name in milestone_names)


# ---- reading ------------------------------------------------------------------

def summary(values: Sequence[float], digits: int = 2) -> str:
    if not values:
        return "none"
    v = sorted(values)
    q = statistics.quantiles(v, n=4) if len(v) > 1 else [v[0]] * 3
    f = f"{{:.{digits}f}}"
    return (f"n={len(v)}  min={f.format(v[0])}  q1={f.format(q[0])}  median={f.format(statistics.median(v))}  "
            f"q3={f.format(q[2])}  max={f.format(v[-1])}  distinct={len(set(v))}")


def count_rows(sb, table: str) -> Optional[int]:
    try:
        return sb.table(table).select("*", count="exact").limit(1).execute().count
    except Exception:
        return None


def fetch_paged(sb, table: str, cols: str, page: int = 1000) -> List[Dict[str, Any]]:
    """Every row, in id order so pages don't overlap."""
    rows, start = [], 0
    while True:
        batch = (sb.table(table).select(cols).order("id")
                 .range(start, start + page - 1).execute().data or [])
        rows.extend(batch)
        if len(batch) < page:
            return rows
        start += page


def parse_ts(value: Any) -> Optional[datetime]:
    """Supabase timestamps, on Python 3.9 (whose fromisoformat wants 6-digit fractions)."""
    m = re.match(r"^(.*T\d{2}:\d{2}:\d{2})(\.\d+)?(.*)$", str(value or "").replace("Z", "+00:00"))
    if not m:
        return None
    try:
        return datetime.fromisoformat(f"{m.group(1)}.{(m.group(2) or '.0')[1:7].ljust(6, '0')}{m.group(3)}")
    except ValueError:
        return None


def payload_of(row: Dict[str, Any]) -> Dict[str, Any]:
    p = row.get("payload") or {}
    if isinstance(p, str):
        try:
            p = json.loads(p)
        except ValueError:
            p = {}
    return p if isinstance(p, dict) else {}


def planner(payload: Dict[str, Any]) -> Dict[str, Any]:
    for response in payload.get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == "path_planning":
            return response
    return {}


def races(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [r for r in payload.get("races") or [] if isinstance(r, dict)]


def race_milestones(race: Dict[str, Any]) -> List[Dict[str, Any]]:
    ms = race.get("milestones")
    return [m for m in ms if isinstance(m, dict)] if isinstance(ms, list) else []


def agent_constants() -> Tuple[Set[str], Set[str]]:
    """The template names (normalized) and the curated barrier models' keys."""
    agent = PathPlanningAgent()
    asyncio.run(agent.initialize())
    names = [n for lst in agent.goal_templates.values() for n in lst]
    names += [n for lst in SUPPORT_TEMPLATES.values() for n in lst]
    names += [name for name, _ in _FALLBACK_STAGES]
    return {normalized(n) for n in names}, set(agent.barrier_models)


def job_category(message: Any) -> str:
    text = str(message or "").strip()
    if not text:
        return "no message"
    if text in JOB_MESSAGES:
        return JOB_MESSAGES[text]
    for prefix, label in BUDGET_PREFIXES.items():
        if text.startswith(prefix):
            return label
    if any(hint in text for hint in GUARDRAIL_HINTS):
        return "input rejected by the guardrails"
    head = text.split(":", 1)[0]
    return f"other: '{head}'" if ":" in text and len(head) <= 40 else "other"


# ---- the audit --------------------------------------------------------------

class Era:
    """One slice of the paths: 'current' or 'all'."""

    def __init__(self, name: str):
        self.name = name
        self.paths = 0
        self.milestones: List[int] = []
        self.goals_vs_16 = Counter()
        self.over_cap = 0
        self.copies_differ = 0
        self.tasks_per_milestone: List[int] = []
        self.tasks_bucket = Counter()
        self.confidence: List[float] = []
        self.confidence_formula = Counter()
        self.name_source = Counter()
        self.path_source = Counter()
        self.source_by_account = Counter()
        self.template_days = Counter()
        self.generated_equal_template = 0
        self.unmarked_template_named = Counter()
        self.quality = Counter()
        self.supporting = 0
        self.names_long = 0
        self.names_bracket = 0
        self.names_cut = 0
        self.description_fallback = 0
        self.fixed_choices = Counter()
        self.est_days = Counter()
        self.dups = defaultdict(Counter)       # scope -> {'paths', 'pairs', 'milestones'}
        self.tasks = Counter()
        self.task_total = 0
        self.goal_check = Counter()
        self.paths_goal_missing = 0
        self.empty_races = 0
        self.dates: List[str] = []
        self.milestone_counts = Counter()
        self.long_estimates = Counter()
        self.conditions = Counter()
        self.missed_labels = Counter()


def audit_path(era: Era, row: Dict[str, Any], templates: Set[str], curated: Set[str], who: str) -> None:
    p = payload_of(row)
    plan = planner(p)
    result = plan.get("result") if isinstance(plan.get("result"), dict) else {}
    rs = races(p)
    ms = [m for r in rs for m in race_milestones(r)]
    goals = (p.get("userProfile") or {}).get("goals")
    goal_count = len(goals) if isinstance(goals, list) and goals else len(rs)

    era.paths += 1
    era.dates.append(str(row.get("created_at") or "")[:10])
    era.milestones.append(len(ms))
    era.milestone_counts[len(ms)] += 1
    if any(isinstance(m.get("estimatedDays"), int) and m["estimatedDays"] >= 6 for m in ms):
        era.long_estimates[str(row.get("created_at") or "")[:10]] += 1

    # Which barrier labels reach a curated model (the key is the label
    # lowercased with spaces as underscores) and the ADHD task-length rule
    # (the label 'adhd', exactly), against the condition map.
    barriers = [str(b) for b in (p.get("userProfile") or {}).get("barrierTypes") or []]
    keys = match_keys(barriers)
    era.conditions["paths with any barrier"] += bool(barriers)
    era.conditions["paths with a curated model"] += any(b.lower().replace(" ", "_") in curated for b in barriers)
    for condition in ("autism", "adhd", "ocd"):
        if condition in keys or (condition in ("autism", "adhd") and "audhd" in keys):
            era.conditions[f"{condition}: paths"] += 1
            labels = [b for b in barriers if condition in match_keys([b]) or
                      (condition in ("autism", "adhd") and "audhd" in match_keys([b]))]
            if any(b.lower().replace(" ", "_") == condition for b in labels):
                era.conditions[f"{condition}: its curated model used"] += 1
            else:
                era.missed_labels.update(labels)
    expected = 16 * goal_count
    era.goals_vs_16["equal" if len(ms) == expected else "fewer" if len(ms) < expected else "more"] += 1
    era.over_cap += len(ms) > MAX_MILESTONES_PER_PATH
    agent_ms = [m for m in result.get("milestones") or [] if isinstance(m, dict)]
    era.copies_differ += bool(agent_ms) and len(agent_ms) != len(ms)

    # Tasks: path planning's flat list, by milestoneId (every era has it);
    # the copies on the race milestones (core/path_storage.py) otherwise.
    flat = result.get("tasks")
    by_milestone: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    if isinstance(flat, list):
        for t in flat:
            if isinstance(t, dict):
                by_milestone[str(t.get("milestoneId"))].append(t)
    for m in ms:
        tasks = by_milestone.get(str(m.get("id"))) if isinstance(flat, list) else \
            [t for t in m.get("tasks") or [] if isinstance(t, dict)]
        tasks = tasks or []
        era.tasks_per_milestone.append(len(tasks))
        era.tasks_bucket[min(len(tasks), 6)] += 1
        for t in tasks:
            era.task_total += 1
            for flag in task_flags(t):
                era.tasks[flag] += 1

    conf = plan.get("confidence")
    if isinstance(conf, (int, float)):
        era.confidence.append(round(float(conf), 2))
        if agent_ms and any("nameSource" in m for m in agent_ms):
            share = sum(1 for m in agent_ms if m.get("nameSource") == "generated") / len(agent_ms)
            era.confidence_formula["matches 0.35 + 0.6 x generated share" if
                                   abs(round(0.35 + 0.6 * share, 2) - float(conf)) < 0.006 else "differs"] += 1

    sources = Counter(m.get("nameSource", "unmarked") for m in ms)
    era.name_source.update(sources)
    if not ms:
        source = "no milestones"
    elif sources.get("unmarked") == len(ms):
        source = "unmarked (legacy)"
    elif sources.get("generated") == len(ms):
        source = "all generated"
    elif sources.get("template", 0) == len(ms):
        source = "all template"
    else:
        source = "mixed"
    era.path_source[source] += 1
    era.source_by_account[f"{who}: {source}"] += 1
    if sources.get("template"):
        era.template_days[str(row.get("created_at") or "")[:10]] += 1
    for m in ms:
        is_template_name = normalized(m.get("name")) in templates
        if m.get("nameSource") == "generated" and is_template_name:
            era.generated_equal_template += 1
        if "nameSource" not in m:
            era.unmarked_template_named["a template name" if is_template_name else "not a template name"] += 1
        name = str(m.get("name") or "")
        era.names_long += len(name.split()) > 8
        era.names_bracket += name.lstrip().startswith(("{", "["))
        era.names_cut += len(name) == 100
        era.description_fallback += " - tailored for " in str(m.get("description") or "")
        rates = {c.get("successPercentage") for c in m.get("recommendedChoices") or [] if isinstance(c, dict)}
        era.fixed_choices["the fixed three" if rates == FIXED_CHOICE_RATES else
                          "none" if not rates else "other"] += 1
        days = m.get("estimatedDays")
        era.est_days[days if isinstance(days, int) and days <= 10 else ">10" if isinstance(days, int) else "missing"] += 1
    era.supporting += any(m.get("forPerson") for m in ms)

    report = result.get("qualityReport") if isinstance(result.get("qualityReport"), dict) else None
    if report is None:
        era.quality["no quality report"] += 1
    else:
        era.quality["quality report"] += 1
        era.quality["usedFallback"] += bool(report.get("usedFallback"))
        era.quality["a goal backfilled"] += bool(report.get("goalsBackfilled"))
        era.quality["tasks padded (paths)"] += bool(report.get("tasksPadded"))
        era.quality["tasks padded (milestones)"] += int(report.get("tasksPadded") or 0)
    era.quality["generic stage milestones"] += sum(1 for m in ms if str(m.get("id", "")).startswith("milestone_quality_"))

    # Duplicates, within one goal and across the goals of the path.
    for threshold in (NEAR_DUPLICATE,) + SENSITIVITY:
        scopes = {"within a goal": [], "across goals": []}
        for r in rs:
            names = [str(m.get("name") or "") for m in race_milestones(r)]
            scopes["within a goal"] += [(i, j, k) for (i, a), (j, b) in combinations(enumerate(names), 2)
                                        if (k := pair_kind(a, b, threshold))]
        for (ri, r1), (rj, r2) in combinations(enumerate(rs), 2):
            for a in race_milestones(r1):
                for b in race_milestones(r2):
                    k = pair_kind(str(a.get("name") or ""), str(b.get("name") or ""), threshold)
                    if k:
                        scopes["across goals"].append((ri, rj, k))
        for scope, pairs in scopes.items():
            for kind in ("exact", "near"):
                if kind == "exact" and threshold != NEAR_DUPLICATE:
                    continue  # exact doesn't depend on the threshold
                n = sum(1 for *_x, k in pairs if k == kind)
                key = f"{scope}, {kind}" + ("" if kind == "exact" or threshold == NEAR_DUPLICATE else f" @{threshold}")
                era.dups[key]["pairs"] += n
                era.dups[key]["paths"] += n > 0

    # Goals that don't appear in their milestones' names.
    missing = False
    for r in rs:
        names = [m.get("name") for m in race_milestones(r)]
        if not names:
            era.empty_races += 1
            era.goal_check["goal with no milestones"] += 1
            missing = True
            continue
        found = goal_appears(r.get("goal") or r.get("name"), names)
        era.goal_check["no words to look for" if found is None else "appears" if found else "doesn't appear"] += 1
        missing = missing or found is False
    era.paths_goal_missing += missing


def print_era(era: Era) -> None:
    print(f"\n== {era.name}: {era.paths} paths, generated {min(era.dates) if era.dates else '-'} to "
          f"{max(era.dates) if era.dates else '-'}")
    print(f"  milestones per path: {summary(era.milestones, 0)}  values: {dict(sorted(era.milestone_counts.items()))}")
    print(f"  against 16 per goal: {dict(era.goals_vs_16)}; over the cap of {MAX_MILESTONES_PER_PATH}: {era.over_cap}; "
          f"race and agent copies differ in count: {era.copies_differ}")
    print(f"  tasks per milestone: {summary(era.tasks_per_milestone, 0)}  "
          f"by count (6 = 6+): {dict(sorted(era.tasks_bucket.items()))}")
    print(f"  confidence: {summary(era.confidence)}")
    print(f"  confidence values: {dict(sorted(Counter(era.confidence).items()))}")
    print(f"  confidence against its formula: {dict(era.confidence_formula)}")
    print(f"  milestone name source: {dict(era.name_source)}")
    print(f"  paths by name source: {dict(era.path_source)}")
    print(f"  paths by account and name source: {dict(sorted(era.source_by_account.items()))}")
    print(f"  days with a path holding template names: {dict(sorted(era.template_days.items()))}")
    print(f"  'generated' names identical to a template name: {era.generated_equal_template}; "
          f"unmarked (legacy) milestones: {dict(era.unmarked_template_named)}")
    print(f"  quality gate: {dict(era.quality)}")
    print(f"  plans for someone the user supports (forPerson): {era.supporting}")
    print(f"  names over 8 words: {era.names_long}; starting with {{ or [: {era.names_bracket}; "
          f"exactly 100 characters (cut by the gate): {era.names_cut}")
    print(f"  descriptions from the fallback ('<name> - tailored for <goal>'): {era.description_fallback}")
    print(f"  recommendedChoices: {dict(era.fixed_choices)}")
    print(f"  estimatedDays: {dict(sorted(era.est_days.items(), key=lambda kv: (isinstance(kv[0], str), kv[0])))}")
    print(f"  paths with an estimate of 6 days or more, by day generated: {dict(sorted(era.long_estimates.items()))}")
    print(f"  barriers: {dict(era.conditions)}")
    print(f"  condition labels that missed their curated model (in 2+ paths): "
          f"{ {k: v for k, v in era.missed_labels.items() if v >= 2} }")
    total = sum(era.milestones)
    print(f"  duplicate milestones (of {total} milestones):")
    for key in sorted(era.dups):
        print(f"    {key}: {era.dups[key]['pairs']} pairs in {era.dups[key]['paths']} paths")
    print(f"  tasks: {era.task_total}; {dict(era.tasks)}")
    print(f"  goals (races) checked against milestone names: {dict(era.goal_check)}; "
          f"paths with at least one goal missing or empty: {era.paths_goal_missing}")


def main() -> None:
    sb = get_supabase()
    if sb is None:
        print("Supabase is not configured.")
        return

    # The run log first, with what decides the result: counts and settings.
    templates, curated = agent_constants()
    inputs = {
        "user_paths": count_rows(sb, "user_paths"),
        "generation_jobs": count_rows(sb, "generation_jobs"),
        "path_planning_outcomes": count_rows(sb, "path_planning_outcomes"),
        "milestone_ratings": count_rows(sb, "milestone_ratings"),
        "race_progress": count_rows(sb, "race_progress"),
        "reflections": count_rows(sb, "reflections"),
        "settings": {
            "near_duplicate_jaccard": NEAR_DUPLICATE, "sensitivity": list(SENSITIVITY),
            "max_milestones_per_path": MAX_MILESTONES_PER_PATH, "milestones_per_area": MILESTONES_PER_AREA,
            "life_areas": LIFE_AREAS, "min_samples": MIN_SAMPLES,
            "template_names_hash": hashlib.sha1("|".join(sorted(templates)).encode()).hexdigest()[:12],
        },
    }
    run_log = RunLog()  # never the Supabase client: EVALUATION_RUNS_DSN or nothing
    run_id = run_log.start(SCRIPT, inputs)
    print(f"run log: {'run ' + run_id + ' in ' + str(run_log.where) if run_id else 'not logged (EVALUATION_RUNS_DSN not set)'}")
    print(f"inputs: {json.dumps(inputs)}")

    users = list_all_users(sb)
    kind = {str(u.id): "synthetic" if is_synthetic(u) else "team" if is_team_test(u) else "real" for u in users}
    account: Callable[[Any], str] = lambda uid: kind.get(str(uid), "no account")

    rows = fetch_all(sb, "user_paths", "user_id, path_id, is_legacy, created_at, payload")
    legacy_flag = Counter((bool(r.get("is_legacy")), is_legacy_payload(r.get("payload"))) for r in rows)
    print(f"\n== Stored paths: {len(rows)}  legacy {sum(1 for r in rows if r.get('is_legacy'))}  "
          f"by account: {dict(Counter(account(r['user_id']) for r in rows))}")
    print(f"  is_legacy column against the payload rule (column, rule): {dict(legacy_flag)}")
    current, everything = Era("current (is_legacy = false)"), Era("all paths, legacy included")
    for r in rows:
        audit_path(everything, r, templates, curated, account(r["user_id"]))
        if not r.get("is_legacy"):
            audit_path(current, r, templates, curated, account(r["user_id"]))
    print_era(current)
    print_era(everything)

    # The learner: path_planning_outcomes, read by get_best_path_shape.
    print("\n== path_planning_outcomes (the path-shape learner)")
    outcomes = fetch_all(sb, "path_planning_outcomes",
                         "profile_signature, milestone_count, est_days_avg, reward_count, reward_avg, updated_at")
    print(f"  rows: {len(outcomes)}")
    for o in sorted(outcomes, key=lambda o: str(o.get("updated_at"))):
        print(f"    milestone_count={o.get('milestone_count')}  reward_count={o.get('reward_count')}  "
              f"reward_avg={o.get('reward_avg')}  est_days_avg={o.get('est_days_avg')}  "
              f"updated={str(o.get('updated_at'))[:10]}")
    print(f"  rows with at least {MIN_SAMPLES} samples (needed before it changes a plan): "
          f"{sum(1 for o in outcomes if int(o.get('reward_count') or 0) >= MIN_SAMPLES)}")
    path_sigs = Counter()
    sig_users = defaultdict(set)
    for r in rows:
        prof = payload_of(r).get("userProfile") or {}
        sig = compute_profile_signature(prof.get("barrierTypes") or [], prof.get("goals") or [])
        path_sigs[sig] += 1
        sig_users[sig].add(str(r.get("user_id")))
    contexts = fetch_all(sb, "user_latest_context", "user_id, profile_signature")
    ctx_sigs = Counter(c.get("profile_signature") for c in contexts)
    print(f"  signatures of the stored paths: {len(path_sigs)} distinct for {len(rows)} paths; "
          f"shared by 2 or more people: {sum(1 for s in sig_users.values() if len(s) > 1)}")
    print(f"  user_latest_context: {len(contexts)} rows, {len(ctx_sigs)} distinct signatures, "
          f"largest group {max(ctx_sigs.values()) if ctx_sigs else 0}")
    print(f"  outcome rows whose signature matches a stored path: "
          f"{sum(1 for o in outcomes if o.get('profile_signature') in path_sigs)}; "
          f"a latest context: {sum(1 for o in outcomes if o.get('profile_signature') in ctx_sigs)}")

    # Generation jobs (the whole pipeline, not path planning alone).
    print("\n== generation_jobs")
    jobs = fetch_all(sb, "generation_jobs", "user_id, status, error, request, created_at, started_at, finished_at, path_id")
    print(f"  rows: {len(jobs)}  created {min(str(j['created_at'])[:10] for j in jobs) if jobs else '-'} to "
          f"{max(str(j['created_at'])[:10] for j in jobs) if jobs else '-'}")
    print(f"  by status: {dict(Counter(j['status'] for j in jobs))}")
    failed = [j for j in jobs if j["status"] == "failed"]
    print(f"  failed, by message: {dict(Counter(job_category(j.get('error')) for j in failed))}")
    print(f"  failed, by account: {dict(Counter(account(j['user_id']) for j in failed))}")
    print(f"  all jobs, by account: {dict(Counter(account(j['user_id']) for j in jobs))}")

    def goal_bucket(j: Dict[str, Any]) -> str:
        req = j.get("request") or {}
        if isinstance(req, str):
            try:
                req = json.loads(req)
            except ValueError:
                req = {}
        n = len(req.get("goals") or []) if isinstance(req, dict) else 0
        return "0" if n == 0 else "1" if n == 1 else "2" if n == 2 else "3-4" if n <= 4 else "5+"

    print(f"  goals in the request, failed: {dict(Counter(goal_bucket(j) for j in failed))}; "
          f"succeeded: {dict(Counter(goal_bucket(j) for j in jobs if j['status'] == 'succeeded'))}")
    exact = Counter((min(len(((json.loads(j['request']) if isinstance(j.get('request'), str) else j.get('request')) or {}).get('goals') or []), 5),
                     j["status"]) for j in jobs)
    print(f"  status by goals in the request (5 = 5+): {dict(sorted(exact.items()))}")
    running, total = [], 0
    for day, n in sorted(Counter(str(j["created_at"])[:10] for j in jobs).items()):
        total += n
        running.append(f"{day}:{total}")
    print(f"  running total of jobs by day created: {' '.join(running)}")
    print(f"  failed, by day: {dict(sorted(Counter(str(j['created_at'])[:10] for j in failed).items()))}")

    def seconds(j: Dict[str, Any]) -> Optional[float]:
        a, b = parse_ts(j.get("started_at")), parse_ts(j.get("finished_at"))
        return (b - a).total_seconds() if a and b else None

    print(f"  seconds from start to finish, succeeded: "
          f"{summary([s for j in jobs if j['status'] == 'succeeded' and (s := seconds(j)) is not None], 0)}")
    print(f"  seconds from start to failure: {summary([s for j in failed if (s := seconds(j)) is not None], 0)}")
    stored = {str(r.get("path_id")) for r in rows}
    ok = [j for j in jobs if j["status"] == "succeeded"]
    print(f"  succeeded jobs whose path is still stored: {sum(1 for j in ok if str(j.get('path_id')) in stored)} of {len(ok)}")
    hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    stale = [j for j in jobs if j["status"] in ("queued", "running")
             and (parse_ts(j["created_at"]) or hour_ago) < hour_ago]
    print(f"  queued or running for over an hour: {len(stale)}")

    # Which model answered: the usage ledger (core/budget.py, llm_usage).
    print("\n== llm_usage (the usage ledger, core/budget.py)")
    ledger = fetch_paged(sb, "llm_usage", "id, agent_id, model_id, created_at, completion_tokens")
    print(f"  rows: {len(ledger)}  from {min(str(u['created_at'])[:10] for u in ledger) if ledger else '-'}  "
          f"by agent: {dict(Counter(u['agent_id'] for u in ledger))}")
    usage = [u for u in ledger if u.get("agent_id") == "path_planning"]
    print(f"  path_planning calls: {len(usage)}  by model: {dict(Counter(u['model_id'] for u in usage))}  "
          f"from {min(str(u['created_at'])[:10] for u in usage) if usage else '-'} "
          f"to {max(str(u['created_at'])[:10] for u in usage) if usage else '-'}")
    print(f"  completion tokens per call: {summary([float(u.get('completion_tokens') or 0) for u in usage], 0)}")
    first = min(str(u["created_at"])[:10] for u in ledger) if ledger else None
    print(f"  current paths generated before the ledger's first day: "
          f"{sum(1 for d in current.dates if first and d < first)} of {current.paths}")

    # What exists to judge the plans by.
    print("\n== Signals about plans")
    ratings = fetch_all(sb, "milestone_ratings", "user_id, path_id, milestone_id, rating")
    print(f"  milestone_ratings: {len(ratings)}  by account: {dict(Counter(account(r['user_id']) for r in ratings))}  "
          f"ratings: {dict(Counter(r['rating'] for r in ratings))}")
    by_path = {(str(r.get("user_id")), str(r.get("path_id"))): payload_of(r) for r in rows}
    rated_source = Counter()
    for rt in ratings:
        p = by_path.get((str(rt.get("user_id")), str(rt.get("path_id"))))
        m = next((m for r in races(p or {}) for m in race_milestones(r) if m.get("id") == rt.get("milestone_id")), None)
        rated_source[m.get("nameSource", "unmarked") if m else "path not stored"] += 1
    print(f"  ratings by the rated milestone's name source: {dict(rated_source)}")
    visits, start = [], 0
    while True:
        batch = (sb.table("onboarding_events").select("id, user_id, onboarding_version")
                 .eq("event", "feature_use").eq("step", "milestones").gte("created_at", RATINGS_LIVE)
                 .order("id").range(start, start + 999).execute().data or [])
        visits += [v for v in batch if not str(v.get("onboarding_version") or "").startswith("qa")]
        if len(batch) < 1000:
            break
        start += 1000
    people = {str(v["user_id"]) for v in visits if v.get("user_id")}
    print(f"  milestone pages opened since {RATINGS_LIVE} (feature_use 'milestones'): {len(visits)} events, "
          f"signed-in people by account: {dict(Counter(account(u) for u in people))}, "
          f"signed out: {sum(1 for v in visits if not v.get('user_id'))}")
    # To tell "nobody saw it" from "the event isn't sent": the same event, any
    # part of the app, since then; and the milestone pages at any time.
    since = (sb.table("onboarding_events").select("step, onboarding_version").eq("event", "feature_use")
             .gte("created_at", RATINGS_LIVE).limit(5000).execute().data or [])
    since = [e for e in since if not str(e.get("onboarding_version") or "").startswith("qa")]
    ever = (sb.table("onboarding_events").select("created_at").eq("event", "feature_use").eq("step", "milestones")
            .order("created_at", desc=True).limit(5000).execute().data or [])
    print(f"  feature_use since {RATINGS_LIVE}, any part of the app: {len(since)}  {dict(Counter(e['step'] for e in since))}")
    print(f"  milestone pages opened at any time: {len(ever)}, the last on {str(ever[0]['created_at'])[:10] if ever else '-'}")
    print(f"  reflections: {count_rows(sb, 'reflections')}")
    progress = fetch_all(sb, "race_progress", "user_id, milestone_id, kind")
    print(f"  race_progress: {len(progress)}  by kind: {dict(Counter(p['kind'] for p in progress))}  "
          f"completed, by account: {dict(Counter(account(p['user_id']) for p in progress if p['kind'] == 'completed'))}")
    # race_progress has no path_id and milestone ids repeat across a person's
    # paths, so a completion is matched only for people with one stored path.
    paths_of = defaultdict(list)
    for r in rows:
        paths_of[str(r.get("user_id"))].append(r)
    done = defaultdict(set)
    for pr in progress:
        if pr["kind"] == "completed":
            done[str(pr["user_id"])].add(str(pr["milestone_id"]))
    single = Counter()
    for uid, ids in done.items():
        if len(paths_of.get(uid, [])) != 1:
            single["people with 0 or several paths (not matched)"] += 1
            continue
        r = paths_of[uid][0]
        single[f"people with one path ({account(uid)})"] += 1
        for m in (m for race in races(payload_of(r)) for m in race_milestones(race)):
            source = m.get("nameSource", "unmarked")
            single[f"{account(uid)}: milestones, {source}"] += 1
            if str(m.get("id")) in ids:
                single[f"{account(uid)}: completed, {source}"] += 1
    print(f"  completions matched to a path: {dict(single)}")

    run_log.finish()
    print(f"\nrun log: {'finished ' + run_id if run_id else 'not logged'}")


if __name__ == "__main__":
    main()
