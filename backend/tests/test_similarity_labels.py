"""Ground-truth labelling: which pairs get proposed, how answers are recorded,
and how arms are scored against them.

Run from backend/:  python -m unittest tests.test_similarity_labels -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.retrieval_eval import (  # noqa: E402
    auc,
    canonical_pair,
    feature_sim,
    partner_rank,
    propose_pairs,
    standardized_mean_sim,
)


def _pool(n):
    return [f"u{i:02d}" for i in range(n)]


class ProposeTests(unittest.TestCase):
    def setUp(self):
        self.pool = _pool(12)
        # Two arms that deliberately disagree: A likes pairs with close ids,
        # B likes pairs with far-apart ids.
        idx = {u: i for i, u in enumerate(self.pool)}
        self.sim_a = lambda x, y: 1.0 / (1 + abs(idx[x] - idx[y]))
        self.sim_b = lambda x, y: abs(idx[x] - idx[y]) / 11.0
        self.combined = standardized_mean_sim(self.pool, self.sim_a, self.sim_b)

    def propose(self, n=6, seed=0, exclude=None):
        return propose_pairs(self.pool, self.sim_a, self.sim_b, self.combined,
                             n, seed=seed, exclude=exclude, names=("text", "features"))

    def test_budget_split_between_disagreement_and_spread(self):
        pairs = self.propose(6)
        sources = [s for _, _, s in pairs]
        self.assertEqual(len(pairs), 6)
        self.assertEqual(sum(1 for s in sources if s.startswith("disagree:")), 3)
        self.assertEqual(sum(1 for s in sources if s.startswith("spread:")), 3)
        self.assertIn("disagree:text>features", sources)
        self.assertIn("disagree:features>text", sources)

    def test_each_person_appears_once(self):
        people = [u for a, b, _ in self.propose(6) for u in (a, b)]
        self.assertEqual(len(people), len(set(people)))

    def test_fills_the_budget_when_a_band_runs_dry(self):
        # 12 people, 6 pairs: every person used exactly once. The band pass
        # alone strands people; the fill must still reach the full budget.
        self.assertEqual(len(self.propose(6)), 6)

    def test_never_more_pairs_than_people_allow(self):
        self.assertEqual(len(self.propose(20)), 6)

    def test_pairs_are_canonical(self):
        for a, b, _ in self.propose(6):
            self.assertLess(a, b)

    def test_already_labelled_pairs_are_skipped(self):
        first = self.propose(6)
        done = {(a, b) for a, b, _ in first}
        again = self.propose(6, exclude=done)
        self.assertFalse(done & {(a, b) for a, b, _ in again})

    def test_deterministic_for_a_seed(self):
        self.assertEqual(self.propose(6, seed=3), self.propose(6, seed=3))

    def test_empty_inputs(self):
        self.assertEqual(propose_pairs([], self.sim_a, self.sim_b, self.combined, 5), [])
        self.assertEqual(self.propose(0), [])


class ScoringTests(unittest.TestCase):
    def test_canonical_pair(self):
        self.assertEqual(canonical_pair("b", "a"), ("a", "b"))
        self.assertEqual(canonical_pair("a", "b"), ("a", "b"))

    def test_partner_rank(self):
        # No ties, so every rank can be checked by hand.
        table = {("a", "b"): .9, ("a", "c"): .5, ("a", "d"): .1,
                 ("b", "c"): .4, ("b", "d"): .2, ("c", "d"): .3}
        sim = lambda x, y: table.get((x, y), table.get((y, x)))  # noqa: E731
        pool = ["a", "b", "c", "d"]
        self.assertEqual(partner_rank("a", "b", pool, sim), 1.0)   # each other's nearest
        self.assertEqual(partner_rank("a", "d", pool, sim), 3.0)   # each other's farthest
        # Asymmetric: c is a's 2nd, but a is c's 1st -> averaged.
        self.assertEqual(partner_rank("a", "c", pool, sim), 1.5)
        self.assertIsNone(partner_rank("a", "zzz", pool, sim))

    def test_partner_rank_zero_similarity_falls_back_to_id_order(self):
        # Someone similar to nobody still gets a deterministic rank.
        sim = feature_sim({"a": {"x"}, "b": {"x"}, "d": {"q"}})
        self.assertEqual(partner_rank("a", "d", ["a", "b", "d"], sim), 1.5)

    def test_auc(self):
        self.assertEqual(auc([0.9, 0.8], [0.1, 0.2]), 1.0)
        self.assertEqual(auc([0.1], [0.9]), 0.0)
        self.assertEqual(auc([0.5], [0.5]), 0.5)          # ties count half
        self.assertIsNone(auc([0.9], []))                 # needs both kinds


class SessionTests(unittest.TestCase):
    """The labelling loop, with scripted answers instead of a keyboard."""

    def setUp(self):
        from scripts.label_similar_pairs import run_session, summarize_person
        self.run_session, self.summarize = run_session, summarize_person
        self.people = {u: ["conditions: x", "goals: y"] for u in ("a", "b", "c", "d", "e", "f")}
        self.pairs = [("a", "b", "spread:high"), ("d", "c", "disagree:text>features"),
                      ("e", "f", "spread:low")]

    def session(self, answers, writer=True):
        it = iter(answers)
        written = []
        counts = self.run_session(self.pairs, self.people, "AB", lambda _: next(it),
                                  written.append if writer else None, out=lambda _: None)
        return counts, written

    def test_answers_are_written_canonically_with_notes(self):
        counts, written = self.session(["s", "same goals", "n", "", "u"])
        self.assertEqual(counts, {"similar": 1, "not_similar": 1, "unsure": 1})
        self.assertEqual(len(written), 2)
        self.assertEqual(written[0]["label"], "similar")
        self.assertEqual(written[0]["note"], "same goals")
        self.assertEqual((written[1]["user_a"], written[1]["user_b"]), ("c", "d"))  # reordered
        self.assertIsNone(written[1]["note"])
        self.assertEqual(written[1]["source"], "disagree:text>features")
        self.assertTrue(all(w["labeled_by"] == "AB" for w in written))

    def test_quit_keeps_what_was_answered(self):
        counts, written = self.session(["s", "", "q"])
        self.assertEqual(len(written), 1)
        self.assertEqual(counts["similar"], 1)

    def test_invalid_answer_is_asked_again(self):
        _, written = self.session(["maybe", "yes", "n", "", "q"])
        self.assertEqual([w["label"] for w in written], ["not_similar"])

    def test_dry_run_writes_nothing(self):
        counts, written = self.session(["s", "", "s", "", "s", ""], writer=False)
        self.assertEqual(counts["similar"], 3)
        self.assertEqual(written, [])

    def test_summary_shows_no_identifiers(self):
        lines = self.summarize(
            ["ADHD", "Prefer not to share", "call me 416-555-0199"],
            ["Graduate from University of Ottawa"], "18-24", "intrinsic")
        text = "\n".join(lines)
        self.assertIn("ADHD", text)
        self.assertIn("prefers not to share", text)
        self.assertIn("1 self-described (not shown)", text)
        self.assertNotIn("416", text)
        self.assertNotIn("Ottawa", text)
        self.assertIn("university", text)


if __name__ == "__main__":
    unittest.main()
