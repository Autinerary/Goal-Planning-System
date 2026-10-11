"""The stored condition vocabulary (STEP 57): built from the runtime map in
core/condition_taxonomy.py, placeholders kept apart, nothing guessed, and
user_barriers never written.

Run from backend/:  python -m unittest tests.test_condition_vocabulary -v
"""
import unittest
from types import SimpleNamespace

from core.condition_taxonomy import TAXONOMY_VERSION, match_keys, vocabulary_entry
from scripts import sync_condition_vocabulary as sync


class VocabularyEntryTests(unittest.TestCase):
    def test_spellings_of_one_condition_share_a_key(self):
        for raw in ("ADHD", "adhd", "Attention deficit hyperactivity disorder"):
            self.assertEqual(vocabulary_entry(raw)["canonical"], "adhd")
        self.assertEqual(vocabulary_entry("Autism spectrum disorder")["canonical"], "autism")
        self.assertEqual(vocabulary_entry("ADHD")["kind"], "condition")

    def test_placeholders_are_their_own_kind(self):
        self.assertEqual(vocabulary_entry("Prefer not to share"),
                         {"kind": "placeholder", "canonical": "undisclosed",
                          "label": "Prefer not to share", "category": "placeholder"})
        self.assertEqual(vocabulary_entry("No current barriers")["canonical"], "none")

    def test_unknown_values_are_not_guessed(self):
        for raw in ("vvv", "", "Having high amounts of aura"):
            self.assertEqual(vocabulary_entry(raw),
                             {"kind": "unmapped", "canonical": None, "label": None, "category": None})

    def test_same_answer_as_the_runtime_filter(self):
        # A condition's key is exactly the key match_keys gives the filter.
        for raw in ("ADHD", "Reading disorder", "Cluster B", "sensory", "Visible Minority"):
            self.assertEqual({vocabulary_entry(raw)["canonical"]}, match_keys([raw]))


class SyncTests(unittest.TestCase):
    def test_one_row_per_distinct_value_stamped_with_the_map_version(self):
        rows = sync.build_vocabulary(["ADHD", "adhd", "ADHD", None, "vvv"])
        self.assertEqual([r["raw_value"] for r in rows], ["ADHD", "adhd", "vvv"])
        self.assertTrue(all(r["taxonomy_version"] == TAXONOMY_VERSION for r in rows))

    def test_counts_before_and_after(self):
        c = sync.distinct_counts(["ADHD", "adhd", "Prefer not to share", "vvv", "VVV "])
        self.assertEqual(c, {"raw": 5, "after": 3, "conditions": 1, "placeholders": 1, "unmapped": 1})

    def test_apply_writes_only_the_vocabulary(self):
        written = []
        table = lambda name: SimpleNamespace(upsert=lambda rows, on_conflict=None: SimpleNamespace(
            execute=lambda: written.append((name, len(rows), on_conflict))))
        self.assertEqual(sync.apply(SimpleNamespace(table=table), sync.build_vocabulary(["ADHD", "vvv"])), 0)
        self.assertEqual(written, [("condition_vocabulary", 2, "raw_value")])

    def test_report_lists_unmapped_values_with_whose_they_are(self):
        rows = [{"user_id": "r", "barrier_type": "ADHD"}, {"user_id": "r", "barrier_type": "vvv"},
                {"user_id": "t", "barrier_type": "adhd"}]
        text = "\n".join(sync.report(rows, ["ADHD"], {"r": "real", "t": "team"}))
        self.assertIn("| real | 2 | 1 | 2 | 2 | 1 | 0 | 1 |", text)
        self.assertIn("| all | 3 | 2 | 3 | 2 | 1 | 0 | 1 |", text)
        self.assertIn("- `vvv` (real account)", text)
        self.assertIn("`ADHD`, `adhd`", text)


if __name__ == "__main__":
    unittest.main()
