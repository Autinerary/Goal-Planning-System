"""The load test's summary maths.

Run from backend/:  python -m unittest tests.test_load_test -v
"""

import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.load_test import Hit, error_rate, percentile, summarize  # noqa: E402


class LoadTestMathTests(unittest.TestCase):
    def test_percentile_interpolates(self):
        self.assertEqual(percentile([1, 2, 3, 4, 5], 0.5), 3)
        self.assertAlmostEqual(percentile([1, 2, 3, 4], 0.5), 2.5)
        self.assertAlmostEqual(percentile([10, 20], 0.95), 19.5)
        self.assertTrue(math.isnan(percentile([], 0.5)))

    def test_summary_counts_errors_and_times_only_successes(self):
        hits = [
            Hit("a", True, "200", 0.1),
            Hit("a", True, "200", 0.3),
            Hit("a", False, "503", 9.0),
            Hit("a", False, "ReadTimeout", 30.0),
            Hit("b", True, "200", 1.0),
        ]
        rows = {r["endpoint"]: r for r in summarize(hits, seconds=10)}
        self.assertEqual(rows["a"]["requests"], 4)
        self.assertEqual(rows["a"]["errors"], 2)
        self.assertEqual(rows["a"]["error_kinds"], {"503": 1, "ReadTimeout": 1})
        self.assertAlmostEqual(rows["a"]["max"], 0.3)  # failures do not count as fast or slow successes
        self.assertAlmostEqual(rows["a"]["rps"], 0.4)
        self.assertEqual(list(rows), ["a", "b"])  # first-seen order

    def test_all_failed_has_no_latency(self):
        rows = summarize([Hit("a", False, "502", 1.0)], seconds=1)
        self.assertTrue(math.isnan(rows[0]["p50"]))

    def test_error_rate(self):
        self.assertEqual(error_rate([]), 0.0)
        self.assertEqual(error_rate([Hit("a", True, "200", 0), Hit("a", False, "500", 0)]), 0.5)


if __name__ == "__main__":
    unittest.main()
