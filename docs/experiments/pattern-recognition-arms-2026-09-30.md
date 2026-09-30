# Pattern Recognition representation experiment

Real users in the cohort: 109. With a stored profile vector: 57.
Stored vector text versions: {'NULL': 57}. Arm 1 uses only 'legacy raw text (NULL)' (57 users) -- vectors from different text versions are not comparable.
> Arm 1 is the **legacy raw text**, which included email and user id. Its results describe today's production index, not the anonymised text. Re-run after `reembed_pattern_users --apply` for the like-for-like comparison.

Comparison pool: **57 real users**, top-k with k = 5.
Arm 4 **NOT RUN**: pattern_user_field_embeddings does not exist yet -- apply STEP 43, then run embed_pattern_fields --apply.

## Agreement between arms

Mean Jaccard overlap of top-5 neighbour sets. 1.00 = identical retrieval; chance for unrelated rankings at this pool size is about 0.05.

| | 1 text | 2 engineered | 3 concat (raw) | 3 concat (scaled) |
|---|---|---|---|---|
| 1 text | — | 0.26 | 0.32 | 0.52 |
| 2 engineered | 0.26 | — | 0.83 | 0.52 |
| 3 concat (raw) | 0.32 | 0.83 | — | 0.61 |
| 3 concat (scaled) | 0.52 | 0.52 | 0.61 | — |

*3 concat (raw)* averages the two cosines as they are, which is what literally concatenating the vectors does. Because ada-002 cosines here span only about 0.84–1.0 while feature cosines span 0–1, the feature arm dominates it. *3 concat (scaled)* z-scores each arm over the pool first so both have an equal say. Compare arms against the scaled version.

## Arm 1: how spread out are the similarities?

Pairwise cosine over 1596 pairs: min 0.839, 10th pct 0.867, median 0.898, 90th pct 0.932, max 1.000.
Pairs at or below the production threshold of 0.70: **0 of 1596**.

## Threshold sweep (arm 1, capped at 10 like the RPC)

Mean matches per user. The production search also requires at least one **exact** condition string in common (`barriers_filter`, array overlap), so `ADHD` never matches `adhd`. The last column applies the same filter after normalising spellings.

| threshold | cosine only | + exact-string filter (production) | + normalised filter |
|---|---|---|---|
| 0.70 | 10.0 | 7.6 | 4.5 |
| 0.75 | 10.0 | 7.6 | 4.5 |
| 0.80 | 10.0 | 7.6 | 4.5 |
| 0.85 | 10.0 | 7.6 | 4.5 |
| 0.90 | 9.6 | 7.5 | 4.3 |
| 0.95 | 1.7 | 1.2 | 0.4 |

At the production settings (0.70 + exact-string filter): 6 users get **0** matches, 39 get the full **10**, 12 fall in between.

## What the exact-string filter is actually matching on

Of 1596 pairs, the production filter lets **303** through.
- **154** of those share *only* a placeholder answer ("Prefer not to share" / "No current barriers") — matched because both people declined to say, not because they have anything in common.
- **32** pairs share a real condition under a different spelling (e.g. `ADHD` / `adhd`) and are filtered **out**.

So the filter is wrong in both directions, and normalising it would give fewer but real matches.

Pairs with cosine ≥ 0.9995 (effectively identical vectors): 10; of those, 10 entered identical conditions and goals.
