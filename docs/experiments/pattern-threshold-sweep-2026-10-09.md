# Pattern Recognition threshold sweep (9 October 2026)

`python -m scripts.pattern_threshold_sweep` (from backend/). Read-only.

**Where the count stops being flat:**
- The lowest similarity between any two stored vectors is **0.772**. The
  earlier figure of 0.839 was the old raw-text vectors on 30 September.
- So at every threshold up to 0.75, everyone is above it for everyone
  (71 of 71).
- The uncapped count starts falling at **0.80**.
- What the search returns, filtered and at most 10, is flat at a mean of
  9.1 through 0.85, and first falls at **0.90**.

Stored vectors: 72 (anon-v1: 72). Each is a query against the other 71.

Pairwise cosine over 2556 pairs: min 0.772, 10th pct 0.812, median 0.865, 90th pct 0.925, max 1.000.

- pairs at or below 0.50: 0 of 2556
- pairs at or below 0.55: 0 of 2556
- pairs at or below 0.60: 0 of 2556
- pairs at or below 0.65: 0 of 2556
- pairs at or below 0.70: 0 of 2556
- pairs at or below 0.75: 0 of 2556
- pairs at or below 0.80: 128 of 2556
- pairs at or below 0.85: 915 of 2556
- pairs at or below 0.90: 1995 of 2556

### What the search returns (threshold, live condition filter, at most 10)

| threshold | mean | median | min | max | people with 0 |
|---|---|---|---|---|---|
| 0.50 | 9.1 | 10 | 0 | 10 | 1 |
| 0.55 | 9.1 | 10 | 0 | 10 | 1 |
| 0.60 | 9.1 | 10 | 0 | 10 | 1 |
| 0.65 | 9.1 | 10 | 0 | 10 | 1 |
| 0.70 | 9.1 | 10 | 0 | 10 | 1 |
| 0.75 | 9.1 | 10 | 0 | 10 | 1 |
| 0.80 | 9.1 | 10 | 0 | 10 | 1 |
| 0.85 | 9.1 | 10 | 0 | 10 | 2 |
| 0.90 | 8.0 | 10 | 0 | 10 | 4 |

### Everyone above the threshold (no filter, no cap)

| threshold | mean | median | min | max | people with 0 |
|---|---|---|---|---|---|
| 0.50 | 71.0 | 71 | 71 | 71 | 0 |
| 0.55 | 71.0 | 71 | 71 | 71 | 0 |
| 0.60 | 71.0 | 71 | 71 | 71 | 0 |
| 0.65 | 71.0 | 71 | 71 | 71 | 0 |
| 0.70 | 71.0 | 71 | 71 | 71 | 0 |
| 0.75 | 71.0 | 71 | 71 | 71 | 0 |
| 0.80 | 67.4 | 70 | 46 | 71 | 0 |
| 0.85 | 45.6 | 46 | 9 | 65 | 0 |
| 0.90 | 15.6 | 16 | 0 | 35 | 1 |

