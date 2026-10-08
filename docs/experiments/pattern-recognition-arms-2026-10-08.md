# Pattern Recognition representation experiment

> Run on 8 Oct 2026 with `python -m scripts.pattern_experiment --k 10` (from
> backend/). This was after STEPs 42–44, `reembed_pattern_users --apply` and
> `embed_pattern_fields --apply`. The cells can't be compared one for one with
> the [30 Sep run](pattern-recognition-arms-2026-09-30.md), which used k = 5
> and the legacy raw-text vectors and had no arm 4. No arm is preferred here:
> no similarity labels are stored, and 5–10 labels could not tell the arms
> apart statistically.

Real users in the cohort: 113. With a stored profile vector: 60.
Stored vector text versions: {'anon-v1': 60}. Arm 1 uses only 'anon-v1' (60 users) -- vectors from different text versions are not comparable.

Comparison pool: **60 real users**, top-k with k = 10.

## Agreement between arms

Mean Jaccard overlap of top-10 neighbour sets. 1.00 = identical retrieval; chance for unrelated rankings at this pool size is about 0.09.

| | 1 text | 2 engineered | 3 concat (raw) | 3 concat (scaled) | 4a goals only | 4b conditions only | 4 split (mean) |
|---|---|---|---|---|---|---|---|
| 1 text | — | 0.46 | 0.55 | 0.67 | 0.22 | 0.34 | 0.43 |
| 2 engineered | 0.46 | — | 0.81 | 0.67 | 0.31 | 0.23 | 0.37 |
| 3 concat (raw) | 0.55 | 0.81 | — | 0.80 | 0.31 | 0.25 | 0.41 |
| 3 concat (scaled) | 0.67 | 0.67 | 0.80 | — | 0.27 | 0.30 | 0.44 |
| 4a goals only | 0.22 | 0.31 | 0.31 | 0.27 | — | 0.13 | 0.41 |
| 4b conditions only | 0.34 | 0.23 | 0.25 | 0.30 | 0.13 | — | 0.33 |
| 4 split (mean) | 0.43 | 0.37 | 0.41 | 0.44 | 0.41 | 0.33 | — |

*3 concat (raw)* averages the two cosines as they are, which is what literally concatenating the vectors does. Because ada-002 cosines here span only about 0.84–1.0 while feature cosines span 0–1, the feature arm dominates it. *3 concat (scaled)* z-scores each arm over the pool first so both have an equal say. Compare arms against the scaled version.

## Against human labels

Not run: 0 label(s) stored, none for pairs in the current pool. Label pairs with `python -m scripts.label_similar_pairs --labeler <name>`.

## Arm 1: how spread out are the similarities?

Pairwise cosine over 1770 pairs: min 0.772, 10th pct 0.815, median 0.869, 90th pct 0.925, max 1.000.
Pairs at or below the production threshold of 0.70: **0 of 1770**.

## Threshold sweep (arm 1, capped at 10 like the RPC)

Mean matches per user. Until d34f80a the production search also required at least one **exact** condition string in common (`barriers_filter`, array overlap), so `ADHD` never matched `adhd`. Production now filters on normalised conditions (`match_keys` in core/condition_taxonomy.py). The last column normalises spellings but is not identical to production: it ignores free-text conditions, and anyone without a recognised condition gets no matches, where production leaves people with only placeholder answers (or none) unfiltered.

| threshold | cosine only | + exact-string filter (production until d34f80a) | + normalised filter |
|---|---|---|---|
| 0.70 | 10.0 | 7.6 | 4.3 |
| 0.75 | 10.0 | 7.6 | 4.3 |
| 0.80 | 10.0 | 7.6 | 4.3 |
| 0.85 | 10.0 | 7.4 | 4.2 |
| 0.90 | 8.8 | 5.0 | 3.3 |
| 0.95 | 1.7 | 0.7 | 0.2 |

At the old production settings (0.70 + exact-string filter, before d34f80a): 6 users get **0** matches, 41 get the full **10**, 13 fall in between.

## What the exact-string filter was actually matching on

Of 1770 pairs, the old production filter let **331** through.
- **181** of those share *only* a placeholder answer ("Prefer not to share" / "No current barriers") — matched because both people declined to say, not because they have anything in common.
- **32** pairs share a real condition under a different spelling (e.g. `ADHD` / `adhd`) and were filtered **out**.

So the filter was wrong in both directions. Production has filtered on normalised conditions since d34f80a.

Pairs with cosine ≥ 0.9995 (effectively identical vectors): 7; of those, 1 entered identical conditions and goals.
