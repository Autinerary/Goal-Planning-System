"""Label pairs of real users as genuinely similar, or not. Ground truth for
Pattern Recognition.

The question this answers is the open one on the deck: is cosine similarity
even the right notion of "similar" for these people? The only way to know is
to compare it with human judgement. This tool asks a team member about a small
set of pairs and records the answers in pattern_similarity_labels (STEP 44);
`pattern_experiment --labels` then scores every representation against them.

Each pair is shown as two summaries, Person 1 and Person 2: conditions by name,
goal areas with their generic words, age band and motivation. No names, emails
or ids are shown, and goals are reduced to allow-listed words. If you cannot
judge a pair from that, answer u (unsure) -- and if that happens often, it is
itself a finding: the summary is dropping something that matters.

Which pairs you are shown is deliberate (see core.retrieval_eval.propose_pairs):
half are pairs where the text embedding and the engineered features disagree
most, the rest spread from clearly-similar to clearly-not. Pairs you have
already labelled are skipped, so running it again continues where you left off.

  python -m scripts.label_similar_pairs --labeler AB              # 10 pairs
  python -m scripts.label_similar_pairs --labeler AB --n 6
  python -m scripts.label_similar_pairs --labeler AB --dry-run    # show, don't save

Answers:  s = similar   n = not similar   u = unsure (skip)   q = quit
Each answer is saved immediately; quitting part-way loses nothing.
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Tuple

from dotenv import load_dotenv

load_dotenv()

from core.condition_taxonomy import normalize_condition  # noqa: E402
from core.embedding_privacy import AGE_BANDS, MOTIVATIONS, summarize_goal  # noqa: E402
from core.retrieval_eval import (  # noqa: E402
    canonical_pair,
    engineered_features,
    feature_sim,
    propose_pairs,
    standardized_mean_sim,
    vector_sim,
)

ANSWERS = {"s": "similar", "n": "not_similar"}


def summarize_person(barriers: Iterable[object], goals: Iterable[object],
                     age_band: Optional[str], motivation: Optional[str]) -> List[str]:
    """What a labeller sees about one person. Internal, so conditions are
    shown by their specific name; nothing identifying is shown at all."""
    conds, placeholders, free = [], [], 0
    for b in barriers or []:
        r = normalize_condition(b)
        if r.condition:
            conds.append(r.condition.label)
        elif r.kind == "undisclosed":
            placeholders.append("prefers not to share")
        elif r.kind == "none":
            placeholders.append("no current barriers")
        elif r.kind == "free_text":
            free += 1
    conds = sorted(set(conds))
    if free:
        conds.append(f"{free} self-described (not shown)")
    cond_line = "; ".join(conds + sorted(set(placeholders))) or "none given"

    areas: Dict[str, set] = {}
    for g in goals or []:
        s = summarize_goal(str(g))
        if s:
            areas.setdefault(s[0], set()).update(s[1])
    goal_line = "; ".join(f"{a.replace('_', ' ')} ({', '.join(sorted(w))})"
                          for a, w in sorted(areas.items())) or "none that survive de-identification"

    extras = []
    if age_band in AGE_BANDS:
        extras.append(f"age {age_band}")
    if str(motivation or "").casefold() in MOTIVATIONS:
        extras.append(f"motivated by {str(motivation).casefold()}")
    return [f"conditions: {cond_line}", f"goals:      {goal_line}"] + (
        [f"other:      {', '.join(extras)}"] if extras else [])


def run_session(pairs: Sequence[Tuple[str, str, str]],
                people: Dict[str, List[str]],
                labeler: str,
                input_fn: Callable[[str], str],
                writer: Optional[Callable[[dict], None]],
                out: Callable[[str], None] = print) -> Dict[str, int]:
    """Ask about each pair. Writes each answer as soon as it is given."""
    counts = {"similar": 0, "not_similar": 0, "unsure": 0}
    for i, (a, b, source) in enumerate(pairs, 1):
        out(f"\n── Pair {i} of {len(pairs)} " + "─" * 40)
        for label, uid in (("Person 1", a), ("Person 2", b)):
            out(f"  {label}")
            for line in people[uid]:
                out(f"    {line}")
        while True:
            ans = input_fn("  Genuinely similar?  [s]imilar / [n]ot / [u]nsure / [q]uit: ").strip().lower()
            if ans in ("s", "n", "u", "q"):
                break
        if ans == "q":
            out("\nStopped." + (" Everything answered so far is saved." if writer else ""))
            break
        if ans == "u":
            counts["unsure"] += 1
            continue
        note = input_fn("  Why? (optional, enter to skip): ").strip()[:500]
        ua, ub = canonical_pair(a, b)
        row = {"user_a": ua, "user_b": ub, "label": ANSWERS[ans],
               "labeled_by": labeler, "note": note or None, "source": source}
        if writer is not None:
            writer(row)
        counts[ANSWERS[ans]] += 1
    return counts


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--labeler", required=True, help="your name or initials (stored with each label)")
    ap.add_argument("--n", type=int, default=10, help="pairs to propose (default 10)")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true", help="ask, but save nothing")
    args = ap.parse_args()

    labeler = args.labeler.strip()
    if not 1 <= len(labeler) <= 60:
        print("--labeler must be 1-60 characters.")
        return 1

    from database.supabase_client import get_supabase
    from scripts.pattern_experiment import load, parse_vec

    sb = get_supabase()
    real, emb, prefs, _fields, _note = load(sb)
    if not emb:
        print("No real users with a stored profile vector.")
        return 0
    # One text version only, same rule as the experiment: vectors built from
    # different texts are not comparable.
    majority = Counter(r.get("embedding_text_version") for r in emb).most_common(1)[0][0]
    rows = [r for r in emb if r.get("embedding_text_version") == majority]
    band = {uid: (prefs.get(uid) or {}).get("ageRange") for uid in real}

    vectors = {r["user_id"]: parse_vec(r["embedding"]) for r in rows}
    feats = {r["user_id"]: engineered_features(r.get("barriers") or [], r.get("goals") or [],
                                               band.get(r["user_id"]), r.get("motivation_type"))
             for r in rows}
    pool = sorted(set(vectors) & set(feats))
    text, features = vector_sim(vectors), feature_sim(feats)
    combined = standardized_mean_sim(pool, text, features)

    try:
        done = {canonical_pair(r["user_a"], r["user_b"])
                for r in sb.table("pattern_similarity_labels")
                .select("user_a, user_b").eq("labeled_by", labeler).execute().data or []}
        table_ok = True
    except Exception as e:
        done, table_ok = set(), False
        if not args.dry_run:
            print(f"pattern_similarity_labels is not available ({str(e)[:60]}).")
            print("Apply STEP 44 first, or use --dry-run to try the tool without saving.")
            return 2

    pairs = propose_pairs(pool, text, features, combined, args.n, seed=args.seed,
                          exclude=done, names=("text", "features"))
    print(f"{len(pool)} real users in the pool; {len(done)} pair(s) already labelled by {labeler}.")
    if not pairs:
        print("No new pairs to propose.")
        return 0
    if args.dry_run:
        print("DRY RUN -- answers will not be saved.")

    people = {r["user_id"]: summarize_person(r.get("barriers") or [], r.get("goals") or [],
                                             band.get(r["user_id"]), r.get("motivation_type"))
              for r in rows}

    def write(row):
        sb.table("pattern_similarity_labels").upsert(
            row, on_conflict="user_a,user_b,labeled_by").execute()

    counts = run_session(pairs, people, labeler, input,
                         None if (args.dry_run or not table_ok) else write)
    print(f"\nsimilar {counts['similar']}, not similar {counts['not_similar']}, "
          f"unsure {counts['unsure']}" + ("  (not saved: dry run)" if args.dry_run else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
