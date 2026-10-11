"""The experiment harness's cleaned inputs (scripts/pattern_experiment.py):
stale vectors, vocabulary keys, and agreement under the live filter.

Run from backend/:  python -m unittest tests.test_pattern_experiment_inputs -v
"""
import unittest

from scripts.pattern_experiment import condition_keys, filtered_agreement, stale_counts


class StaleTests(unittest.TestCase):
    def test_counts_conditions_added_after_the_vector(self):
        rows = [
            {"user_id": "a", "barriers": ["ADHD"], "updated_at": "2026-09-01"},
            {"user_id": "b", "barriers": ["adhd", "Dyslexia"], "updated_at": "2026-09-01"},
            {"user_id": "c", "barriers": ["Autism"], "updated_at": "2026-09-01"},
        ]
        current = {"a": ["ADHD", "Dyslexia"], "b": ["ADHD"], "c": ["Autism spectrum disorder"]}
        added_at = {"a": ["2026-08-01", "2026-09-05"], "b": ["2026-08-01"], "c": ["2026-08-01"]}
        self.assertEqual(stale_counts(rows, current, added_at),
                         {"vectors": 3, "added": 1, "removed": 1, "by_time": 1})

    def test_vocabulary_keys_leave_out_placeholders_and_unmapped(self):
        self.assertEqual(condition_keys(["ADHD", "adhd", "Prefer not to share", "vvv"]), {"adhd"})


class FilteredAgreementTests(unittest.TestCase):
    def test_both_arms_pick_only_from_people_the_filter_allows(self):
        # For u, arm A ranks p, q, r and arm B ranks r, q, p. Everyone else
        # sees all ties, so both arms rank them by id and agree.
        a = {("u", "p"): 0.9, ("u", "q"): 0.8, ("u", "r"): 0.1}
        b = {("u", "p"): 0.1, ("u", "q"): 0.8, ("u", "r"): 0.9}
        sim_a = lambda x, y: a.get((x, y), 0.5)
        sim_b = lambda x, y: b.get((x, y), 0.5)
        pool = ["p", "q", "r", "u"]
        # No filter: u gets {p, q} from A and {q, r} from B, Jaccard 1/3.
        self.assertAlmostEqual(filtered_agreement(pool, sim_a, sim_b, 2, lambda x, y: True), (1 / 3 + 3) / 4)
        # Filter: u may not match r, so both arms give u {p, q}.
        self.assertEqual(filtered_agreement(pool, sim_a, sim_b, 2, lambda x, y: not (x == "u" and y == "r")), 1.0)

    def test_fewer_candidates_than_k_counts_as_full_agreement(self):
        pool = ["u", "p"]
        sim = lambda x, y: 0.5
        other = lambda x, y: 0.1
        self.assertEqual(filtered_agreement(pool, sim, other, 10, lambda x, y: True), 1.0)


if __name__ == "__main__":
    unittest.main()
