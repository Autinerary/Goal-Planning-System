"""How ResourceHub's "Support Group" places are re-sorted.

Run from backend/:  python -m unittest tests.test_resort_support_groups -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.resort_support_groups import classify  # noqa: E402


class ClassifyTests(unittest.TestCase):
    def test_osm_tags_decide_first(self):
        self.assertEqual(classify("Jennings Senior Living", {"social_facility": "assisted_living"}), "Senior Care")
        self.assertEqual(classify("CHSLD de la Rive", {"social_facility": "nursing_home"}), "Senior Care")
        self.assertEqual(classify("Hornby Shelter", {"social_facility": "shelter"}), "Shelter")
        self.assertEqual(classify("Regina Food Bank", {"social_facility": "food_bank"}), "Food Support")
        self.assertEqual(classify("Ronald McDonald House", {"social_facility": "group_home"}), "Supported Housing")
        self.assertEqual(classify("Fort Clarence Place", {"social_facility": "group_home", "social_facility:for": "senior"}), "Senior Care")

    def test_real_support_organisations_stay(self):
        self.assertEqual(classify("Autism Calgary", {}), "Support Group")
        self.assertEqual(classify("Canadian Mental Health Association Winnipeg Region", {"social_facility": "outreach"}), "Support Group")
        self.assertEqual(classify("Child and Parent Resource Institute", {}), "Support Group")

    def test_a_support_word_never_overrides_a_care_home_or_food_bank(self):
        self.assertEqual(classify("Parent Food Bank", {"social_facility": "food_bank"}), "Food Support")
        self.assertEqual(classify("Alzheimer Care Residence", {"social_facility": "nursing_home"}), "Senior Care")

    def test_untyped_places_go_by_name(self):
        self.assertEqual(classify("Rise N Shine Child Care Centre", {}), "Child Care")
        self.assertEqual(classify("Employment Ontario", {}), "Employment")
        self.assertEqual(classify("Cuisines Collectives du Grand Plateau", {}), "Food Support")
        self.assertEqual(classify("Extendicare Poseidon", {}), "Senior Care")
        self.assertEqual(classify("Surrey Urban Outreach Society", {"social_facility": "outreach"}), "Social Services")


if __name__ == "__main__":
    unittest.main()
