"""The maths behind the Pattern Recognition experiment.

Run from backend/:  python -m unittest tests.test_retrieval_eval -v
"""

import math
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.retrieval_eval import (  # noqa: E402
    arm_agreement,
    chance_jaccard,
    cosine,
    engineered_features,
    feature_sim,
    jaccard,
    matches_at,
    mean_sim,
    ranked_neighbours,
    set_cosine,
    standardized_mean_sim,
    top_k,
    vector_sim,
)


class VectorTests(unittest.TestCase):
    def test_cosine(self):
        self.assertAlmostEqual(cosine([1, 0], [1, 0]), 1.0)
        self.assertAlmostEqual(cosine([1, 0], [0, 1]), 0.0)
        self.assertEqual(cosine([0, 0], [1, 1]), 0.0)

    def test_vector_sim_missing_user_is_none(self):
        sim = vector_sim({"a": [1, 0], "b": [0, 1]})
        self.assertIsNone(sim("a", "zzz"))
        self.assertAlmostEqual(sim("a", "b"), sim("b", "a"))

    def test_mean_sim_equals_concatenated_vector_cosine(self):
        # The docstring claims averaging two cosines is the same as the cosine
        # of the two unit vectors concatenated with 1/sqrt(2) weights. Check it.
        rng = random.Random(7)
        for _ in range(20):
            a1, b1 = [rng.gauss(0, 1) for _ in range(6)], [rng.gauss(0, 1) for _ in range(6)]
            a2, b2 = [rng.gauss(0, 1) for _ in range(4)], [rng.gauss(0, 1) for _ in range(4)]

            def unit(v):
                n = math.sqrt(sum(x * x for x in v))
                return [x / n / math.sqrt(2) for x in v]

            concat = cosine(unit(a1) + unit(a2), unit(b1) + unit(b2))
            averaged = mean_sim(vector_sim({"a": a1, "b": b1}), vector_sim({"a": a2, "b": b2}))("a", "b")
            self.assertAlmostEqual(concat, averaged, places=9)


class FeatureTests(unittest.TestCase):
    def test_spellings_give_the_same_features(self):
        self.assertEqual(engineered_features(["ADHD"], []), engineered_features(["adhd"], []))

    def test_placeholder_is_not_a_feature(self):
        self.assertEqual(engineered_features(["Prefer not to share"], []), set())

    def test_goal_places_dropped(self):
        f = engineered_features([], ["Graduate from University of Ottawa"])
        self.assertIn("word:university", f)
        self.assertIn("area:education", f)
        self.assertFalse(any("ottawa" in x for x in f))

    def test_same_family_shares_a_category(self):
        a = engineered_features(["Dyslexia"], [])
        b = engineered_features(["Dyscalculia"], [])
        self.assertIn("cat:learning", a & b)
        self.assertGreater(set_cosine(a, b), 0)

    def test_set_cosine(self):
        self.assertAlmostEqual(set_cosine({"x", "y"}, {"x", "y"}), 1.0)
        self.assertEqual(set_cosine(set(), {"x"}), 0.0)
        self.assertAlmostEqual(set_cosine({"x"}, {"x", "y", "z", "w"}), 0.5)


class RankingTests(unittest.TestCase):
    def setUp(self):
        self.sim = feature_sim({
            "u1": {"a", "b"}, "u2": {"a", "b"}, "u3": {"a"}, "u4": {"z"},
        })
        self.pool = ["u1", "u2", "u3", "u4"]

    def test_self_excluded_and_order(self):
        ranked = ranked_neighbours("u1", self.pool, self.sim)
        self.assertEqual([u for u, _ in ranked], ["u2", "u3", "u4"])

    def test_ties_break_deterministically(self):
        sim = feature_sim({"q": {"a"}, "m": {"a"}, "k": {"a"}})
        self.assertEqual(top_k("q", ["q", "m", "k"], sim, 2), ["k", "m"])

    def test_arm_agrees_with_itself(self):
        self.assertEqual(arm_agreement(self.pool, self.sim, self.sim, 2), 1.0)

    def test_jaccard(self):
        self.assertEqual(jaccard([], []), 1.0)
        self.assertAlmostEqual(jaccard(["a", "b"], ["b", "c"]), 1 / 3)

    def test_chance_level_is_small_for_this_cohort(self):
        self.assertAlmostEqual(chance_jaccard(57, 5), 0.047, places=2)


class ThresholdTests(unittest.TestCase):
    def setUp(self):
        self.sim = lambda a, b: {("a", "b"): 0.7, ("a", "c"): 0.9}.get(tuple(sorted((a, b))), 0.1)
        self.pool = ["a", "b", "c"]

    def test_threshold_is_strict_like_the_rpc(self):
        # RPC: WHERE similarity > match_threshold -- 0.7 itself does not pass.
        self.assertEqual(matches_at("a", self.pool, self.sim, 0.7), 1)
        self.assertEqual(matches_at("a", self.pool, self.sim, 0.69), 2)

    def test_cap(self):
        self.assertEqual(matches_at("a", self.pool, self.sim, 0.0, cap=1), 1)

    def test_gate(self):
        self.assertEqual(matches_at("a", self.pool, self.sim, 0.5, gate=lambda x, y: y != "c"), 1)


class StandardizedTests(unittest.TestCase):
    POOL = ["a", "b", "c", "d"]

    @staticmethod
    def arm(outlier, hi, lo):
        """One pair stands out at `hi`; every other pair sits at `lo`."""
        return lambda x, y: hi if tuple(sorted((x, y))) == outlier else lo

    def test_same_shaped_signals_count_equally_once_scaled(self):
        # Both arms single out one pair for "a" by the same relative margin,
        # but "narrow" does it inside a 0.02 band (like ada-002 here) and
        # "wide" across 0.8 (like feature cosines).
        narrow = self.arm(("a", "b"), 0.99, 0.97)
        wide = self.arm(("a", "d"), 0.90, 0.10)

        raw = mean_sim(narrow, wide)
        self.assertGreater(raw("a", "d"), raw("a", "b"))  # wide decides alone

        scaled = standardized_mean_sim(self.POOL, narrow, wide)
        self.assertAlmostEqual(scaled("a", "b"), scaled("a", "d"))  # equal say

    def test_single_arm_becomes_z_scores(self):
        wide = self.arm(("a", "d"), 0.90, 0.10)
        z = standardized_mean_sim(self.POOL, wide)
        vals = [z(x, y) for i, x in enumerate(self.POOL) for y in self.POOL[i + 1:]]
        mean = sum(vals) / len(vals)
        sd = math.sqrt(sum((v - mean) ** 2 for v in vals) / (len(vals) - 1))
        self.assertAlmostEqual(mean, 0.0)
        self.assertAlmostEqual(sd, 1.0)


if __name__ == "__main__":
    unittest.main()
