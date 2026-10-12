"""Autinerary's own listing is never recommended as a tool (Riipen Labs, Group 24).

Run from backend/:  python -m unittest tests.test_self_listing -v
"""
import unittest

from core.agents.tool_recommendation_agent import is_self_listing


class SelfListingTests(unittest.TestCase):
    def test_its_own_names_and_the_first_party_flag(self):
        for row in ({'name': 'Autinerary'}, {'name': '  autinerary corp'}, {'name': 'ResourceHub'},
                    {'name': 'Resource Hub guide'}, {'name': 'ServiceHub'}, {'name': 'Anything', 'is_first_party': True}):
            self.assertTrue(is_self_listing(row), row)

    def test_other_listings_stay(self):
        for row in ({'name': 'Autism Ontario'}, {'name': 'The Autinerary-friendly cafe'.replace('Autinerary-friendly', 'quiet')},
                    {'name': None}, {}, {'name': 'Hub Cafe', 'is_first_party': False}):
            self.assertFalse(is_self_listing(row), row)


if __name__ == '__main__':
    unittest.main()
