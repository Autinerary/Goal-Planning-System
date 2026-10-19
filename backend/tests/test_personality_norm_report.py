"""Run from backend/:  python -m unittest tests.test_personality_norm_report -v"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.personality_norm_report import groups  # noqa: E402


class GroupsTests(unittest.TestCase):
    def test_groups_by_norm_trait_and_band(self):
        people = {"a": {"extraversion": "low"}, "b": {"extraversion": "low", "openness": "high"}}
        norms = {"a": {"Autism"}, "b": {"Autism"}}
        got = {(g["norm"], g["trait"], g["band"]): sorted(g["people"]) for g in groups(people, norms)}
        self.assertEqual(got[("Autism", "extraversion", "low")], ["a", "b"])
        self.assertEqual(got[("Autism", "openness", "high")], ["b"])

    def test_people_without_a_norm_are_grouped_apart(self):
        got = groups({"a": {"neuroticism": "high"}}, {})
        self.assertEqual(got[0]["norm"], "(no norm shared)")

    def test_unknown_bands_are_ignored(self):
        self.assertEqual(groups({"a": {"extraversion": "very"}}, {"a": {"ADHD"}}), [])


if __name__ == "__main__":
    unittest.main()
