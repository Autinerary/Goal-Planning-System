"""The condition filter Pattern Recognition applies to its matches.

Run from backend/:  python -m unittest tests.test_condition_filter -v
"""

import asyncio
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.agents.pattern_recognition_agent import (  # noqa: E402
    CANDIDATE_POOL,
    PatternRecognitionAgent,
    apply_condition_filter,
)
from core.condition_taxonomy import FREE_TEXT_KEY_PREFIX, match_keys  # noqa: E402


def row(uid, *barriers):
    return {"user_id": uid, "similarity": 1.0, "barriers": list(barriers)}


class MatchKeyTests(unittest.TestCase):
    def test_spellings_of_one_condition_share_a_key(self):
        self.assertEqual(match_keys(["ADHD"]), match_keys(["adhd"]))
        self.assertEqual(match_keys(["ADHD"]),
                         match_keys(["Attention Deficit Hyperactivity Disorder"]))
        self.assertEqual(match_keys(["Autism Spectrum Disorder"]), match_keys(["autism"]))

    def test_placeholders_and_blanks_have_no_key(self):
        for raw in ("Prefer not to share", "No current barriers", "none", "", "   ", None):
            self.assertEqual(match_keys([raw]), set(), raw)

    def test_free_text_matches_itself_ignoring_case_and_spacing(self):
        self.assertEqual(match_keys(["Long  COVID"]), match_keys(["long covid"]))
        self.assertEqual(match_keys(["long covid"]), {FREE_TEXT_KEY_PREFIX + "long covid"})

    def test_free_text_cannot_collide_with_a_canonical_key(self):
        # "EDS" is not a recognised alias, so it stays free text and must not
        # match the canonical key for Ehlers-Danlos syndrome by accident.
        self.assertFalse(match_keys(["EDS"]) & match_keys(["Ehlers-Danlos Syndrome"]))


class FilterTests(unittest.TestCase):
    def test_spelling_variant_now_matches(self):
        out = apply_condition_filter([row("a", "adhd")], ["ADHD"], 10)
        self.assertEqual([r["user_id"] for r in out], ["a"])

    def test_shared_placeholder_is_not_a_match(self):
        rows = [row("a", "Prefer not to share"), row("b", "No current barriers")]
        self.assertEqual(apply_condition_filter(rows, ["ADHD", "Prefer not to share"], 10), [])

    def test_candidate_with_no_conditions_is_filtered_out(self):
        rows = [{"user_id": "a", "barriers": None}, row("b")]
        self.assertEqual(apply_condition_filter(rows, ["anxiety"], 10), [])

    def test_keeps_rpc_order_and_caps(self):
        rows = [row("c", "Anxiety"), row("x", "dyslexia"), row("a", "anxiety"), row("b", "ANXIETY")]
        out = apply_condition_filter(rows, ["anxiety"], 2)
        self.assertEqual([r["user_id"] for r in out], ["c", "a"])

    def test_placeholder_only_query_is_unfiltered_like_an_empty_one(self):
        rows = [row(str(i), "dyslexia") for i in range(12)]
        self.assertEqual(apply_condition_filter(rows, ["Prefer not to share"], 10), rows[:10])
        self.assertEqual(apply_condition_filter(rows, [], 10), rows[:10])


class _FakeRpc:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def __call__(self, name, args):
        self.calls.append((name, dict(args)))
        self._limit = args["match_count"]
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows[: self._limit])


class VectorSearchTests(unittest.TestCase):
    def search(self, rows, barriers, top_k=10):
        rpc = _FakeRpc(rows)
        agent = PatternRecognitionAgent()
        agent.supabase = SimpleNamespace(rpc=rpc)
        out = asyncio.run(agent._vector_search([0.0] * 1536, top_k=top_k,
                                               filters={"barriers": barriers},
                                               query_user_id=None))
        return out, rpc.calls

    def test_filtered_query_overfetches_and_filters_in_python(self):
        rows = [row(str(i), "Prefer not to share") for i in range(15)] + [row("hit", "adhd")]
        out, calls = self.search(rows, ["ADHD"])
        (_, args), = calls
        self.assertIsNone(args["barriers_filter"])
        self.assertEqual(args["match_count"], CANDIDATE_POOL)
        self.assertEqual([r["user_id"] for r in out], ["hit"])

    def test_unfiltered_query_asks_for_top_k_only(self):
        rows = [row(str(i), "dyslexia") for i in range(15)]
        out, calls = self.search(rows, ["No current barriers"], top_k=10)
        self.assertEqual(calls[0][1]["match_count"], 10)
        self.assertEqual(len(out), 10)

    def test_still_passes_all_five_rpc_arguments(self):
        # Omitting one makes the call ambiguous between the two overloads
        # (PGRST203), which silently returned no matches before.
        _, calls = self.search([], ["ADHD"])
        self.assertEqual(set(calls[0][1]), {"query_embedding", "match_threshold", "match_count",
                                            "barriers_filter", "query_user_id"})


if __name__ == "__main__":
    unittest.main()
