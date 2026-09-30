"""Pattern Recognition representation experiment.

Compares ways of turning a profile into something searchable, on the real
cohort only (synthetic and team/QA accounts are excluded using the same
classifiers as the Vector deck, so "real" means the same thing everywhere).

  arm 1   text           the stored vector: goals + conditions + profile, one string
  arm 2   engineered     named binary features, no model, no free text
  arm 3   concatenated   arm 1 + arm 2 (equal weight)
  arm 4   split          goals and conditions embedded separately (STEP 43 table)
            4a goals only, 4b conditions only, 4 = mean of the two

Measures, all read-only:
  * agreement -- how much each pair of arms retrieves the same top-k people
  * threshold sweep -- how many matches the production search would return at
    each threshold, with and without its exact-string condition filter
  * against human labels -- once pairs have been labelled with
    label_similar_pairs.py, how each arm ranks pairs judged similar (partner
    rank) and separates them from pairs judged not similar (AUC)

Nothing here calls OpenAI or writes anything.

  python -m scripts.pattern_experiment               # report to stdout
  python -m scripts.pattern_experiment --k 5 --out docs/experiments/x.md
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from statistics import median
from typing import Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()

from core.condition_taxonomy import normalize_conditions  # noqa: E402
from core.embedding_privacy import AGE_BANDS  # noqa: E402
from core.retrieval_eval import (  # noqa: E402
    arm_agreement,
    auc,
    chance_jaccard,
    engineered_features,
    feature_sim,
    matches_at,
    mean_sim,
    partner_rank,
    standardized_mean_sim,
    vector_sim,
)
from database.supabase_client import get_supabase  # noqa: E402
from scripts.vector_evaluation_pull import is_synthetic, is_team_test, list_all_users  # noqa: E402

PAGE = 1000
THRESHOLDS = [0.70, 0.75, 0.80, 0.85, 0.90, 0.95]


def fetch_all(sb, table, cols):
    rows, start = [], 0
    while True:
        b = sb.table(table).select(cols).range(start, start + PAGE - 1).execute().data or []
        rows.extend(b)
        if len(b) < PAGE:
            break
        start += PAGE
    return rows


def parse_vec(v) -> List[float]:
    return json.loads(v) if isinstance(v, str) else list(v)


class Report:
    def __init__(self):
        self.lines: List[str] = []

    def __call__(self, s: str = "") -> None:
        self.lines.append(s)
        print(s)

    def text(self) -> str:
        return "\n".join(self.lines) + "\n"


def load(sb):
    users = list_all_users(sb)
    real = {str(u.id) for u in users if not is_synthetic(u) and not is_team_test(u)}

    try:
        emb = fetch_all(sb, "pattern_user_embeddings",
                        "user_id, embedding, barriers, goals, motivation_type, embedding_text_version")
    except Exception as e:
        if "embedding_text_version" not in str(e):
            raise
        emb = fetch_all(sb, "pattern_user_embeddings",
                        "user_id, embedding, barriers, goals, motivation_type")
    emb = [r for r in emb if r["user_id"] in real]

    prefs = {p["id"]: (p.get("preferences") or {}) for p in fetch_all(sb, "profiles", "id, preferences")}

    try:
        fields = fetch_all(sb, "pattern_user_field_embeddings",
                           "user_id, field, embedding, embedding_text_version")
        fields_note = None
    except Exception as e:
        missing = "Could not find the table" in str(e) or "does not exist" in str(e)
        fields, fields_note = [], ("pattern_user_field_embeddings does not exist yet -- apply "
                                   "STEP 43, then run embed_pattern_fields --apply"
                                   if missing else f"could not read field embeddings: {str(e)[:80]}")
    fields = [r for r in fields if r["user_id"] in real]
    return real, emb, prefs, fields, fields_note


def score_against_labels(r: Report, sb, pool: List[str], arms: Dict) -> None:
    """How well each arm agrees with pairs a team member judged similar or not.

    Two numbers per arm:
      * partner rank -- for pairs labelled similar, where each person ranks
        the other among everyone (1 = nearest). Lower is better.
      * AUC -- the chance a similar pair scores above a not-similar pair.
        0.5 is chance. Needs both kinds of label.
    """
    r()
    r("## Against human labels")
    r()
    try:
        labels = fetch_all(sb, "pattern_similarity_labels", "user_a, user_b, label, labeled_by")
    except Exception:
        r("Not run: `pattern_similarity_labels` does not exist yet (STEP 44). Label pairs with "
          "`python -m scripts.label_similar_pairs --labeler <name>` once it is applied.")
        return
    in_pool = set(pool)
    usable = [x for x in labels if x["user_a"] in in_pool and x["user_b"] in in_pool]
    if not usable:
        r(f"Not run: {len(labels)} label(s) stored, none for pairs in the current pool. "
          "Label pairs with `python -m scripts.label_similar_pairs --labeler <name>`.")
        return

    pos = [(x["user_a"], x["user_b"]) for x in usable if x["label"] == "similar"]
    neg = [(x["user_a"], x["user_b"]) for x in usable if x["label"] == "not_similar"]
    labelers = Counter(x["labeled_by"] for x in usable)
    r(f"{len(usable)} usable labels ({len(pos)} similar, {len(neg)} not similar) from "
      f"{len(labelers)} labeller(s); {len(labels) - len(usable)} skipped (pair not in pool).")

    # Inter-rater agreement, where more than one person labelled the same pair.
    labels_by_pair: Dict[tuple, List[str]] = {}
    for x in usable:
        labels_by_pair.setdefault((x["user_a"], x["user_b"]), []).append(x["label"])
    shared = {p: ls for p, ls in labels_by_pair.items() if len(ls) >= 2}
    if shared:
        agree = sum(1 for ls in shared.values() if len(set(ls)) == 1)
        r(f"Pairs labelled by more than one person: {len(shared)}; they agreed on {agree}.")

    r()
    r("| arm | mean partner rank, similar pairs (1 = nearest) | AUC similar vs not |")
    r("|---|---|---|")
    for name, sim in arms.items():
        ranks = [x for x in (partner_rank(a, b, pool, sim) for a, b in pos) if x is not None]
        pos_s = [s for s in (sim(a, b) for a, b in pos) if s is not None]
        neg_s = [s for s in (sim(a, b) for a, b in neg) if s is not None]
        area = auc(pos_s, neg_s)
        rank_cell = f"{sum(ranks) / len(ranks):.1f} of {len(pool) - 1}" if ranks else "—"
        auc_cell = f"{area:.2f}" if area is not None else "— (needs both labels)"
        r(f"| {name} | {rank_cell} | {auc_cell} |")
    r()
    r(f"**Read with care:** with {len(usable)} labels, differences between arms are "
      "not statistically meaningful. One pair changing its label can reorder the table. "
      "Treat this as a sanity check on direction, and grow the label set before "
      "choosing a representation on it.")


def run(args) -> Report:
    r = Report()
    sb = get_supabase()
    real, emb, prefs, fields, fields_note = load(sb)

    r("# Pattern Recognition representation experiment")
    r()
    r(f"Real users in the cohort: {len(real)}. With a stored profile vector: {len(emb)}.")

    # ---- Arm 1: stored vectors, one text version only ----------------------
    versions = Counter(row.get("embedding_text_version") for row in emb)
    majority = versions.most_common(1)[0][0] if versions else None
    arm1_rows = [row for row in emb if row.get("embedding_text_version") == majority]
    label = majority or "legacy raw text (NULL)"
    r(f"Stored vector text versions: {dict((k or 'NULL', v) for k, v in versions.items())}. "
      f"Arm 1 uses only '{label}' ({len(arm1_rows)} users) -- vectors from different "
      f"text versions are not comparable.")
    if majority is None:
        r("> Arm 1 is the **legacy raw text**, which included email and user id. Its results "
          "describe today's production index, not the anonymised text. Re-run after "
          "`reembed_pattern_users --apply` for the like-for-like comparison.")

    vectors = {row["user_id"]: parse_vec(row["embedding"]) for row in arm1_rows}
    raw_barriers = {row["user_id"]: [str(b) for b in row.get("barriers") or []] for row in emb}
    goals = {row["user_id"]: row.get("goals") or [] for row in emb}
    motivation = {row["user_id"]: row.get("motivation_type") for row in emb}

    def band(uid):
        b = (prefs.get(uid) or {}).get("ageRange")
        return b if b in AGE_BANDS else None

    arms = {"1 text": vector_sim(vectors)}

    features = {uid: engineered_features(raw_barriers[uid], goals[uid], band(uid), motivation[uid])
                for uid in raw_barriers}
    arms["2 engineered"] = feature_sim(features)
    # Two versions of "concatenated" -- see the note printed below the table.
    arms["3 concat (raw)"] = mean_sim(arms["1 text"], arms["2 engineered"])

    by_field: Dict[str, Dict[str, List[float]]] = {"goals": {}, "barriers": {}}
    for row in fields:
        if row.get("embedding_text_version") and row["field"] in by_field:
            by_field[row["field"]][row["user_id"]] = parse_vec(row["embedding"])
    if by_field["goals"] and by_field["barriers"]:
        arms["4a goals only"] = vector_sim(by_field["goals"])
        arms["4b conditions only"] = vector_sim(by_field["barriers"])
        arms["4 split (mean)"] = mean_sim(arms["4a goals only"], arms["4b conditions only"])
        arm4_note = None
    else:
        arm4_note = fields_note or "table exists but is empty -- run embed_pattern_fields --apply"

    # Compare arms on the same people: everyone every runnable arm covers.
    pool = sorted(set(vectors) & set(features))
    if "4 split (mean)" in arms:
        pool = sorted(set(pool) & set(by_field["goals"]) & set(by_field["barriers"]))
    n, k = len(pool), args.k
    arms["3 concat (scaled)"] = standardized_mean_sim(pool, arms["1 text"], arms["2 engineered"])
    # Keep a stable column order: 1, 2, 3 raw, 3 scaled, then 4s.
    order = ["1 text", "2 engineered", "3 concat (raw)", "3 concat (scaled)",
             "4a goals only", "4b conditions only", "4 split (mean)"]
    arms = {name: arms[name] for name in order if name in arms}
    r()
    r(f"Comparison pool: **{n} real users**, top-k with k = {k}.")
    if arm4_note:
        r(f"Arm 4 **NOT RUN**: {arm4_note}.")

    # ---- Agreement -----------------------------------------------------------
    r()
    r("## Agreement between arms")
    r()
    r(f"Mean Jaccard overlap of top-{k} neighbour sets. 1.00 = identical retrieval; "
      f"chance for unrelated rankings at this pool size is about {chance_jaccard(n, k):.2f}.")
    r()
    names = list(arms)
    r("| | " + " | ".join(names) + " |")
    r("|---|" + "---|" * len(names))
    for a in names:
        cells = []
        for b in names:
            cells.append("—" if a == b else f"{arm_agreement(pool, arms[a], arms[b], k):.2f}")
        r(f"| {a} | " + " | ".join(cells) + " |")
    r()
    r("*3 concat (raw)* averages the two cosines as they are, which is what literally "
      "concatenating the vectors does. Because ada-002 cosines here span only about "
      "0.84–1.0 while feature cosines span 0–1, the feature arm dominates it. "
      "*3 concat (scaled)* z-scores each arm over the pool first so both have an equal "
      "say. Compare arms against the scaled version.")

    # ---- Against human labels (item 4) ---------------------------------------
    score_against_labels(r, sb, pool, arms)

    # ---- Similarity range of the stored vectors ------------------------------
    pair_sims = [arms["1 text"](a, b) for i, a in enumerate(pool) for b in pool[i + 1:]]
    pair_sims = [s for s in pair_sims if s is not None]
    r()
    r("## Arm 1: how spread out are the similarities?")
    r()
    if pair_sims:
        qs = sorted(pair_sims)
        r(f"Pairwise cosine over {len(qs)} pairs: min {qs[0]:.3f}, 10th pct "
          f"{qs[len(qs) // 10]:.3f}, median {median(qs):.3f}, 90th pct "
          f"{qs[(9 * len(qs)) // 10]:.3f}, max {qs[-1]:.3f}.")
        below = sum(1 for s in qs if s <= 0.7)
        r(f"Pairs at or below the production threshold of 0.70: **{below} of {len(qs)}**.")

    # ---- Threshold sweep -----------------------------------------------------
    norm_keys = {uid: {c.key for c in normalize_conditions(bs)[0]} for uid, bs in raw_barriers.items()}

    def raw_gate(a, b):          # what production does: Postgres array overlap, exact strings
        return bool(set(raw_barriers.get(a, [])) & set(raw_barriers.get(b, [])))

    def norm_gate(a, b):         # the same filter after normalising spellings
        return bool(norm_keys.get(a, set()) & norm_keys.get(b, set()))

    r()
    r("## Threshold sweep (arm 1, capped at 10 like the RPC)")
    r()
    r("Mean matches per user. The production search also requires at least one "
      "**exact** condition string in common (`barriers_filter`, array overlap), "
      "so `ADHD` never matches `adhd`. The last column applies the same filter "
      "after normalising spellings.")
    r()
    r("| threshold | cosine only | + exact-string filter (production) | + normalised filter |")
    r("|---|---|---|---|")
    for t in THRESHOLDS:
        cols = []
        for gate in (None, raw_gate, norm_gate):
            vals = [matches_at(u, pool, arms["1 text"], t, cap=10, gate=gate) for u in pool]
            cols.append(f"{sum(vals) / len(vals):.1f}" if vals else "—")
        r(f"| {t:.2f} | " + " | ".join(cols) + " |")

    at = [matches_at(u, pool, arms["1 text"], 0.70, cap=10, gate=raw_gate) for u in pool]
    if at:
        r()
        r(f"At the production settings (0.70 + exact-string filter): "
          f"{sum(1 for x in at if x == 0)} users get **0** matches, "
          f"{sum(1 for x in at if x == 10)} get the full **10**, "
          f"{sum(1 for x in at if 0 < x < 10)} fall in between.")

    # ---- Why the exact-string filter decides the result ----------------------
    # Every pair in the pool, before the cap: which pairs does the filter let
    # through, and on what basis?
    placeholder_strings = set()
    for bs in raw_barriers.values():
        for b in bs:
            kind = normalize_conditions([b])[1]
            if kind["none"] or kind["undisclosed"]:
                placeholder_strings.add(b)
    through_on_placeholder_only = missed_on_spelling = through = 0
    for i, a in enumerate(pool):
        for b in pool[i + 1:]:
            shared_raw = set(raw_barriers.get(a, [])) & set(raw_barriers.get(b, []))
            if shared_raw:
                through += 1
                if shared_raw <= placeholder_strings:
                    through_on_placeholder_only += 1
            elif norm_gate(a, b):
                missed_on_spelling += 1
    total_pairs = n * (n - 1) // 2
    r()
    r("## What the exact-string filter is actually matching on")
    r()
    r(f"Of {total_pairs} pairs, the production filter lets **{through}** through.")
    r(f"- **{through_on_placeholder_only}** of those share *only* a placeholder answer "
      f"(\"Prefer not to share\" / \"No current barriers\") — matched because both people "
      f"declined to say, not because they have anything in common.")
    r(f"- **{missed_on_spelling}** pairs share a real condition under a different spelling "
      f"(e.g. `ADHD` / `adhd`) and are filtered **out**.")
    r()
    r("So the filter is wrong in both directions, and normalising it would give fewer but "
      "real matches.")

    # ---- Near-duplicate vectors ----------------------------------------------
    dupes = [(a, b) for i, a in enumerate(pool) for b in pool[i + 1:]
             if (arms["1 text"](a, b) or 0) >= 0.9995]
    if dupes:
        same_input = sum(
            1 for a, b in dupes
            if sorted(map(str.casefold, raw_barriers[a])) == sorted(map(str.casefold, raw_barriers[b]))
            and sorted(map(str.casefold, map(str, goals[a]))) == sorted(map(str.casefold, map(str, goals[b]))))
        r()
        r(f"Pairs with cosine ≥ 0.9995 (effectively identical vectors): {len(dupes)}; "
          f"of those, {same_input} entered identical conditions and goals.")

    return r


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--out", help="also write the report to this markdown file")
    args = ap.parse_args()
    report = run(args)
    if args.out:
        with open(args.out, "w") as f:
            f.write(report.text())
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
