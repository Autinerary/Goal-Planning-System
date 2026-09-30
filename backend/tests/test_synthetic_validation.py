"""Synthetic-data checks, on hand-built cohorts where the right answer is known.

Run from backend/:  python -m unittest tests.test_synthetic_validation -v
"""

import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.synthetic_validation import fidelity, privacy_nn, utility_tstr  # noqa: E402
from scripts.synthetic_validation.common import (  # noqa: E402
    Person,
    distribution,
    jsd,
    jsd_null,
    percentile,
    wilson,
)


def person(uid, cohort, conds, band="18-40", tech="somewhat", view="pretty",
           rel="lived", conn=None):
    from core.condition_taxonomy import CONDITIONS
    return Person(uid, cohort, frozenset(conds),
                  tuple(sorted(CONDITIONS[c].category for c in conds)),
                  band, tech, view, rel, conn, False, len(conds))


def cohort(prefix, cohort_name, n, seed, pairs=True):
    """A cohort with real structure: ADHD and dyslexia travel together,
    autism and anxiety travel together."""
    rng = random.Random(seed)
    out = []
    for i in range(n):
        base = rng.choice([("adhd", "dyslexia"), ("autism", "anxiety")])
        conds = set(base) if pairs else {rng.choice(["adhd", "dyslexia", "autism", "anxiety"])}
        if rng.random() < 0.5:
            conds.add(rng.choice(["ocd", "depression"]))
        out.append(person(f"{prefix}{i:03d}", cohort_name, conds,
                          band=rng.choice(["18-40", "18-40", "40-65"])))
    return out


class StatsTests(unittest.TestCase):
    def test_jsd_bounds(self):
        self.assertAlmostEqual(jsd({"a": 0.5, "b": 0.5}, {"a": 0.5, "b": 0.5}), 0.0)
        self.assertAlmostEqual(jsd({"a": 1.0}, {"b": 1.0}), 1.0)

    def test_null_is_small_for_one_population(self):
        vals = ["a"] * 60 + ["b"] * 30 + ["c"] * 10
        null = jsd_null(vals, 250, draws=200)
        self.assertLess(percentile(null, 0.95), 0.05)
        self.assertEqual(null, sorted(null))

    def test_null_widens_with_smaller_samples(self):
        vals = ["a"] * 6 + ["b"] * 3 + ["c"] * 1
        self.assertGreater(percentile(jsd_null(vals, 10, draws=200), 0.95),
                           percentile(jsd_null(vals * 20, 200, draws=200), 0.95))

    def test_wilson(self):
        lo, hi = wilson(50, 100)
        self.assertAlmostEqual(lo, 0.404, places=2)
        self.assertAlmostEqual(hi, 0.596, places=2)
        self.assertEqual(wilson(0, 10)[0], 0.0)

    def test_distribution_ignores_none(self):
        self.assertEqual(distribution(["a", None, "a", "b"]), {"a": 2 / 3, "b": 1 / 3})


class FidelityTests(unittest.TestCase):
    def test_same_population_passes(self):
        people = cohort("r", "real", 120, seed=1) + cohort("s", "synthetic", 250, seed=2)
        self.assertTrue(fidelity.run(people).passed)

    def test_different_population_fails(self):
        real = cohort("r", "real", 120, seed=1)
        synth = [person(f"s{i}", "synthetic", {"chronic_illness"}, band="65+") for i in range(250)]
        result = fidelity.run(real + synth)
        self.assertFalse(result.passed)
        self.assertIn("age band", result.headline)

    def test_self_contradiction_is_reported(self):
        real = cohort("r", "real", 50, seed=1)
        synth = [person(f"s{i}", "synthetic", {"adhd"}, conn="parent", rel="lived") for i in range(20)]
        text = "\n".join(fidelity.run(real + synth).lines)
        self.assertIn("20 synthetic accounts", text)
        self.assertIn("20 of them are recorded", text)


class UtilityTests(unittest.TestCase):
    def test_structured_synthetic_matches_real(self):
        people = cohort("r", "real", 80, seed=3) + cohort("s", "synthetic", 250, seed=4)
        result = utility_tstr.run(people)
        self.assertTrue(result.passed, result.headline)

    def test_structureless_synthetic_fails(self):
        # Synthetic conditions drawn independently: no co-occurrence to learn.
        real = cohort("r", "real", 80, seed=3)
        synth = cohort("s", "synthetic", 250, seed=4, pairs=False)
        self.assertFalse(utility_tstr.run(real + synth).passed)

    def test_subset_neighbours_are_not_used(self):
        # The nearest person holds a subset of the query and has nothing to
        # suggest; the one who can suggest something must be used instead.
        pool = [("sub", frozenset({"adhd"})), ("teach", frozenset({"adhd", "dyslexia"}))]
        from collections import Counter
        preds, used = utility_tstr.predict(frozenset({"adhd", "ocd"}), pool, Counter())
        self.assertTrue(used)
        self.assertEqual(preds, ["dyslexia"])


def fine_grained(prefix, cohort_name, n, seed):
    """People with three of twelve conditions: most profiles are unique, the
    situation where copying a record would single someone out."""
    rng = random.Random(seed)
    pool = ["adhd", "autism", "anxiety", "depression", "dyslexia", "dyscalculia",
            "ocd", "ptsd", "misophonia", "epilepsy", "vision", "hearing"]
    return [person(f"{prefix}{i:03d}", cohort_name, set(rng.sample(pool, 3)),
                   band=rng.choice(["18-40", "40-65", "65+"])) for i in range(n)]


class PrivacyTests(unittest.TestCase):
    def test_copies_of_rare_real_records_fail(self):
        real = fine_grained("r", "real", 60, seed=5)
        copies = [person(f"s{i}", "synthetic", set(p.conditions), band=p.age_band)
                  for i, p in enumerate(real * 4)]
        result = privacy_nn.run(real + copies)
        self.assertFalse(result.passed)
        self.assertIn("CLOSER", "\n".join(result.lines))

    def test_fresh_draws_from_the_same_space_pass(self):
        # A one-sided test at the 5% level will fail honest data now and then
        # by design, so check the rate over many seeds rather than trusting
        # (or cherry-picking) one.
        real = fine_grained("r", "real", 60, seed=5)
        passes = sum(privacy_nn.run(real + fine_grained("s", "synthetic", 250, seed=s)).passed
                     for s in range(90, 100))
        self.assertGreaterEqual(passes, 8)

    def test_copying_widely_shared_profiles_is_not_a_disclosure(self):
        # Every profile here is held by several real people, so a copy is
        # indistinguishable from sampling the population and says nothing
        # about any individual. The check should not call that a leak.
        real = cohort("r", "real", 60, seed=5)
        copies = [person(f"s{i}", "synthetic", set(p.conditions), band=p.age_band)
                  for i, p in enumerate(real * 4)]
        self.assertTrue(privacy_nn.run(real + copies).passed)

    def test_small_cells_are_withheld(self):
        real = [person("r1", "real", {"epilepsy"})] + cohort("r", "real", 40, seed=6)
        synth = [person("s1", "synthetic", {"epilepsy"})]
        text = "\n".join(privacy_nn.run(real + synth).lines)
        self.assertNotIn("epilepsy", text)
        self.assertIn("withheld", text)
        shown = "\n".join(privacy_nn.run(real + synth, show_profiles=True).lines)
        self.assertIn("epilepsy", shown)

    def test_generator_reads_are_found(self):
        reads = privacy_nn.generator_reads()
        self.assertIsNotNone(reads)
        self.assertTrue(reads and all("purge()" in r for r in reads))

    def test_distance(self):
        a, b = frozenset({"adhd", "age:18-40"}), frozenset({"adhd", "age:40-65"})
        self.assertAlmostEqual(privacy_nn.distance(a, b), 1 - 1 / 3)
        self.assertEqual(privacy_nn.distance(a, a), 0.0)


if __name__ == "__main__":
    unittest.main()
