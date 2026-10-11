"""Which stored paths are legacy (core/path_provenance.py, STEP 53).

Run from backend/:  python -m unittest tests.test_path_provenance -v
"""
import json
import unittest

from core.path_provenance import fixed_values, is_legacy_payload


def path(milestones, responses=()):
    return {"races": [{"milestones": milestones}], "agentResponses": list(responses)}


OLD_RESPONSES = [
    {"agentId": "pattern_recognition", "confidence": 0.8,
     "result": {"patterns": [{"success_rate": 0.82}, {"success_rate": 0.79}]}},
    {"agentId": "path_planning", "confidence": 0.85},
    {"agentId": "calendar_optimization", "confidence": 0.82},
]


class LegacyPathTests(unittest.TestCase):
    def test_old_shape_is_legacy_and_its_fixed_values_are_named(self):
        old = path([{"id": "m1", "name": "a"}, {"id": "m2", "name": "b"}], OLD_RESPONSES)
        self.assertTrue(is_legacy_payload(old))
        self.assertEqual(sorted(fixed_values(old)), sorted([
            "pattern_recognition confidence 0.8",
            "pattern_recognition patterns success_rate 0.82",
            "path_planning confidence 0.85",
            "calendar_optimization confidence 0.82",
        ]))

    def test_a_computed_value_equal_to_an_old_constant_is_not_legacy(self):
        # Pattern recognition's computed confidence can round to 0.80.
        new = path([{"id": "m1", "nameSource": "generated"}],
                   [{"agentId": "pattern_recognition", "confidence": 0.8, "result": {}}])
        self.assertFalse(is_legacy_payload(new))
        self.assertEqual(fixed_values(new), ["pattern_recognition confidence 0.8"])

    def test_one_marked_milestone_is_enough(self):
        self.assertFalse(is_legacy_payload(path([{"id": "m1"}, {"id": "m2", "nameSource": "template"}])))

    def test_no_milestones_is_not_legacy(self):
        for payload in ({}, {"races": None}, {"races": [{"milestones": []}]}, {"races": [{"milestones": "x"}]}, None, "not json"):
            self.assertFalse(is_legacy_payload(payload), payload)

    def test_a_json_string_payload_is_read(self):
        self.assertTrue(is_legacy_payload(json.dumps(path([{"id": "m1"}]))))


if __name__ == "__main__":
    unittest.main()
