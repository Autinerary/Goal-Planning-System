"""Reflection Analysis never invents a score (core/reflection_analysis.py,
core/learning.py persist_reflection, core/orchestrator.py). Fixtures only.

Run from backend/:  python -m unittest tests.test_reflection_no_data -v
"""
import asyncio
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from core import learning
from core import reflection_analysis as ra
from core.orchestrator import Orchestrator
from core.synthesis_engine import SynthesisEngine

NOW = datetime(2026, 10, 13, 12, 0, tzinfo=timezone.utc)
USER = "8b0c9a3e-4f8e-4a49-9f6a-5d1f6f5c2a10"


def numbers(value, path=""):
    """Every (path, number) in a nested structure."""
    if isinstance(value, bool):
        return []
    if isinstance(value, (int, float)):
        return [(path, value)]
    if isinstance(value, dict):
        return [n for k, v in value.items() for n in numbers(v, f"{path}.{k}")]
    if isinstance(value, list):
        return [n for i, v in enumerate(value) for n in numbers(v, f"{path}[{i}]")]
    return []


class NoDataTests(unittest.TestCase):
    def test_no_data_has_counts_and_nothing_else_numeric(self):
        result = ra.analyze(reflections=[], ratings=[], completions=[], paths=[], adaptation_outcomes=3, now=NOW)
        self.assertEqual(result["status"], "no_data")
        self.assertTrue(result["explanation"])
        self.assertEqual({p.split(".")[1] for p, _ in numbers(result)}, {"counts"})

    def test_unknowns_stay_unknown(self):
        result = ra.analyze(reflections=[{"created_at": NOW.isoformat(), "free_form_text": "ok"}],
                            ratings=[], completions=[], paths=[], now=NOW)
        completion = result["completion"]
        self.assertEqual((completion["rate"], completion["rate_status"], completion["expected_by_now"]), (None, "unknown", None))
        self.assertEqual(completion["trend"], "unknown")
        self.assertEqual(result["ratings"]["by_path"], [])   # no ratings: no score
        self.assertIsNone(result["themes"])


class StoredRowTests(unittest.TestCase):
    def persist(self, response):
        rows = []

        class Table:
            def insert(self, row):
                rows.append(row)
                return self

            def execute(self):
                return SimpleNamespace(data=[{"id": "r1"}])

        with patch.object(learning, "get_supabase", return_value=SimpleNamespace(table=lambda name: Table())):
            learning.persist_reflection(user_id=USER, context_type="path", context_id="p1", questions=[],
                                        free_form_text="ok", reflection_response=response,
                                        adaptation_response={}, reward_signal=0.0, indicators=[])
        return rows[0]

    def test_nothing_computed_is_stored_as_nothing(self):
        row = self.persist(ra.analyze(reflections=[], ratings=[], completions=[], paths=[], now=NOW,
                                      current_entry={"freeFormText": "ok"}))
        self.assertEqual((row["sentiment_label"], row["sentiment_score"], row["completion_rate"]), (None, None, None))

    def test_a_known_rate_is_stored_as_it_is(self):
        row = self.persist({"completion": {"rate": 0.5, "rate_status": "known"}})
        self.assertEqual(row["completion_rate"], 0.5)


class ReportedConfidenceTests(unittest.TestCase):
    def test_the_reflection_step_reports_no_confidence(self):
        o = Orchestrator.__new__(Orchestrator)
        o.synthesis_engine = SynthesisEngine()
        state = {"reflection_response": {"version": ra.VERSION, "status": "no_data"},
                 "adaptation_response": {"adaptations": [], "confidence": 0.0}}
        final = asyncio.run(o._node_adaptation_synthesis(state))["final"]
        reflection = next(a for a in final["agentResponses"] if a["agentId"] == "reflection_analysis")
        self.assertIsNone(reflection["confidence"])


if __name__ == "__main__":
    unittest.main()
