# Condition filter: before and after normalising (8 Oct 2026)

Pattern Recognition used to keep a match only if the two people shared an
exact condition string (`barriers && barriers_filter` in the RPC). So `ADHD`
never matched `adhd`, and two people who had both answered "Prefer not to
share" counted as sharing a condition. Since d34f80a (merged 30 Sep 2026, and
live since) it compares normalised conditions (`match_keys`,
core/condition_taxonomy.py) and ignores placeholder answers. Someone who
entered only a placeholder, or nothing, is matched on the vector alone.

Re-run on 8 Oct 2026 against every stored vector (72, all anon-v1). Read-only:

    python -m scripts.condition_filter_impact      (from backend/)

```
rows (queries and candidates): 72
embedding_text_version: {'anon-v1': 72}
pattern_user_feedback rows: 0

== Matches per query (all rows)
  before  mean 8.8 | 0 matches: 1 | full 10: 57 | 1-9: 14
  after   mean 9.1 | 0 matches: 1 | full 10: 61 | 1-9: 10

== By what the query person entered
  has a recognised condition (35); result list unchanged for 16
    before  mean 7.7 | 0 matches: 0 | full 10: 21 | 1-9: 14
    after   mean 8.4 | 0 matches: 0 | full 10: 25 | 1-9: 10
  placeholder only (31); result list unchanged for 0
    before  mean 10.0 | 0 matches: 0 | full 10: 31 | 1-9: 0
    after   mean 10.0 | 0 matches: 0 | full 10: 31 | 1-9: 0
  no conditions entered (5); result list unchanged for 5
    before  mean 10.0 | 0 matches: 0 | full 10: 5 | 1-9: 0
    after   mean 10.0 | 0 matches: 0 | full 10: 5 | 1-9: 0
  free text only (1); result list unchanged for 1
    before  mean 0.0 | 0 matches: 1 | full 10: 0 | 1-9: 0
    after   mean 0.0 | 0 matches: 1 | full 10: 0 | 1-9: 0

== Returned matches that share a recognised or typed condition with the query
  before  256 of 630 returned matches  (queries that are filtered: 256 of 270)
  after   295 of 655 returned matches  (queries that are filtered: 295 of 295)

== Pairs the filter admits, before the cap of 10 (unordered, over threshold)
  before (exact strings) 540
  after  (normalised)    230
    removed: share only a placeholder answer     352
    added:   same condition, different spelling  42

== How much each query's top-10 changed
  identical result list: 22 of 72 queries
  mean Jaccard(before, after) over queries with any match: 0.60
```

What changed:

- **Pairs the filter admits:** 540 → 230.
  - Removed: 352 pairs that shared only a placeholder answer.
  - Added: 42 pairs that share a condition under a different spelling.
- **Matches per query:** mean 8.8 → 9.1. Queries with the full 10: 57 → 61.
- **The 31 people who entered only a placeholder** still get 10 matches each.
  None of their 31 lists is the same as before: they are now matched on the
  vector alone, not on a shared placeholder.
- **Overall:** 22 of 72 queries return the same list. Mean Jaccard between
  before and after is 0.60.
