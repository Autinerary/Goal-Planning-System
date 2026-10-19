"""Run from backend/:  python -m unittest tests.test_cost_order -v"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.agents.tool_recommendation_agent import cost_order  # noqa: E402


class CostOrderTests(unittest.TestCase):
    def test_free_first_then_cheapest_then_unknown(self):
        tools = [
            {"name": "unknown", "price": None, "costType": None},
            {"name": "paid no price", "price": None, "costType": "paid"},
            {"name": "120", "price": 120, "costType": "paid"},
            {"name": "free", "price": None, "costType": "free"},
            {"name": "40", "price": "40", "costType": "paid"},
            {"name": "zero", "price": 0, "costType": None},
        ]
        self.assertEqual([t["name"] for t in cost_order(tools)], ["free", "zero", "40", "120", "paid no price", "unknown"])

    def test_ties_keep_relevance_order(self):
        tools = [{"name": "a", "costType": "free"}, {"name": "b", "costType": "free"}]
        self.assertEqual([t["name"] for t in cost_order(tools)], ["a", "b"])

    def test_never_adds_or_drops(self):
        self.assertEqual(cost_order([]), [])
        self.assertEqual(len(cost_order([{"name": "x"}] * 4)), 4)


if __name__ == "__main__":
    unittest.main()
