# Pattern Recognition representation experiment, cleaned inputs (9 October 2026)

> `python -m scripts.pattern_experiment --k 10` (from backend/), read-only.
> **Cleaned inputs** means two things:
> - each person's current conditions from `user_barriers`, kept only where
>   the condition vocabulary maps them to a condition
>   (`condition_taxonomy.vocabulary_entry`, taxonomy `841a277543`), so no
>   placeholders and nothing unmapped;
> - neighbours chosen through the live condition filter.
>
> Arms 1 and 4 use the stored vectors as they are: nothing was re-embedded.
> `--conditions stored --filter none` reproduces the 8 October run exactly.
> That is the first column below.
>
> **Stale vectors:** 5 of 72 lack a condition the person added after the
> vector was built (5 of the 60 in the pool). None has lost one. By
> timestamp the count is 11, because re-embedding did not refresh
> `updated_at`.
>
> **Labels:** 0 are stored, so no arm is scored and none is preferred.

## Neighbour overlap, before and after

Mean Jaccard of top-10 neighbour sets, 60 real users. Chance is about 0.09
without the filter.

The live filter leaves some people fewer than 10 candidates to choose from:
16 of 60 with stored conditions, 10 of 60 with cleaned ones. For them every
arm returns the same set, which counts as 1.00.

| arm pair | 8 Oct (same today) | cleaned conditions only | live filter only | cleaned inputs: both | change |
|---|---|---|---|---|---|
| 1 text · 2 engineered | 0.46 | 0.40 | 0.69 | 0.63 | +0.17 |
| 1 text · 3 concat (raw) | 0.55 | 0.48 | 0.74 | 0.69 | +0.14 |
| 1 text · 3 concat (scaled) | 0.67 | 0.65 | 0.81 | 0.79 | +0.12 |
| 1 text · 4a goals only | 0.22 | 0.22 | 0.53 | 0.51 | +0.29 |
| 1 text · 4b conditions only | 0.34 | 0.34 | 0.55 | 0.56 | +0.22 |
| 1 text · 4 split (mean) | 0.43 | 0.43 | 0.64 | 0.63 | +0.20 |
| 2 engineered · 3 concat (raw) | 0.81 | 0.82 | 0.90 | 0.89 | +0.08 |
| 2 engineered · 3 concat (scaled) | 0.67 | 0.61 | 0.82 | 0.77 | +0.10 |
| 2 engineered · 4a goals only | 0.31 | 0.31 | 0.59 | 0.56 | +0.25 |
| 2 engineered · 4b conditions only | 0.23 | 0.20 | 0.51 | 0.47 | +0.24 |
| 2 engineered · 4 split (mean) | 0.37 | 0.34 | 0.63 | 0.58 | +0.21 |
| 3 concat (raw) · 3 concat (scaled) | 0.80 | 0.73 | 0.90 | 0.85 | +0.05 |
| 3 concat (raw) · 4a goals only | 0.31 | 0.31 | 0.59 | 0.57 | +0.26 |
| 3 concat (raw) · 4b conditions only | 0.25 | 0.23 | 0.52 | 0.50 | +0.25 |
| 3 concat (raw) · 4 split (mean) | 0.41 | 0.38 | 0.66 | 0.61 | +0.20 |
| 3 concat (scaled) · 4a goals only | 0.27 | 0.28 | 0.58 | 0.56 | +0.29 |
| 3 concat (scaled) · 4b conditions only | 0.30 | 0.30 | 0.53 | 0.54 | +0.24 |
| 3 concat (scaled) · 4 split (mean) | 0.44 | 0.44 | 0.68 | 0.66 | +0.22 |
| 4a goals only · 4b conditions only | 0.13 | 0.13 | 0.47 | 0.45 | +0.32 |
| 4a goals only · 4 split (mean) | 0.41 | 0.41 | 0.66 | 0.62 | +0.21 |
| 4b conditions only · 4 split (mean) | 0.33 | 0.33 | 0.58 | 0.60 | +0.27 |
| **mean of the 21 pairs** | 0.41 | 0.40 | 0.65 | 0.62 | +0.21 |


## Full run, cleaned inputs

Real users in the cohort: 113. With a stored profile vector: 60.
Stale vectors (a condition added after the vector was built), by content: 5 of 72 stored (5 of 60 real users); a condition since removed: 0. By timestamp: 11 of 72. Nothing is re-embedded.
Conditions used: **current** (user_barriers now, cleaned with the vocabulary, taxonomy 841a277543). Neighbours: **live condition filter**.
Stored vector text versions: {'anon-v1': 60}. Arm 1 uses only 'anon-v1' (60 users) -- vectors from different text versions are not comparable.

Comparison pool: **60 real users**, top-k with k = 10.

## Agreement between arms

Mean Jaccard overlap of top-10 neighbour sets. 1.00 = identical retrieval; chance for unrelated rankings at this pool size is about 0.09.
With the live filter, 10 of 60 people have fewer than 10 people to choose from; every arm returns the same set for them, so it counts as 1.00.

| | 1 text | 2 engineered | 3 concat (raw) | 3 concat (scaled) | 4a goals only | 4b conditions only | 4 split (mean) |
|---|---|---|---|---|---|---|---|
| 1 text | — | 0.63 | 0.69 | 0.79 | 0.51 | 0.56 | 0.63 |
| 2 engineered | 0.63 | — | 0.89 | 0.77 | 0.56 | 0.47 | 0.58 |
| 3 concat (raw) | 0.69 | 0.89 | — | 0.85 | 0.57 | 0.50 | 0.61 |
| 3 concat (scaled) | 0.79 | 0.77 | 0.85 | — | 0.56 | 0.54 | 0.66 |
| 4a goals only | 0.51 | 0.56 | 0.57 | 0.56 | — | 0.45 | 0.62 |
| 4b conditions only | 0.56 | 0.47 | 0.50 | 0.54 | 0.45 | — | 0.60 |
| 4 split (mean) | 0.63 | 0.58 | 0.61 | 0.66 | 0.62 | 0.60 | — |

*3 concat (raw)* averages the two cosines as they are, which is what literally concatenating the vectors does. Because ada-002 cosines here span only about 0.77–1.0 while feature cosines span 0–1, the feature arm dominates it. *3 concat (scaled)* z-scores each arm over the pool first so both have an equal say. Compare arms against the scaled version.

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
