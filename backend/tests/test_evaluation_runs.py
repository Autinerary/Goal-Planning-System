"""The experiment run log (core/evaluation_runs.py, STEP 61).

Run from backend/:  python -m unittest tests.test_evaluation_runs -v
"""
import io
import json
import re
import unittest
from contextlib import redirect_stdout
from types import SimpleNamespace

from core.evaluation_runs import RunLog, git_commit


class FakeTable:
    def __init__(self, sb, fail):
        self.sb, self.fail, self.op = sb, fail, None

    def insert(self, row):
        self.op = ("insert", row)
        return self

    def update(self, fields):
        self.op = ("update", fields)
        return self

    def eq(self, column, value):
        self.op = self.op + ((column, value),)
        return self

    def execute(self):
        if self.fail:
            raise RuntimeError('relation "public.evaluation_runs" does not exist')
        self.sb.ops.append(self.op)


class FakeSB:
    def __init__(self, fail=False):
        self.ops, self.fail = [], fail

    def table(self, name):
        assert name == "evaluation_runs"
        return FakeTable(self, self.fail)


class RunLogTests(unittest.TestCase):
    def test_nowhere_to_write_is_a_quiet_no_op(self):
        log = RunLog(sb=None, dsn="")
        self.assertIsNone(log.start("s", {}))
        log.finish()

    def test_a_run_is_logged_at_start_and_finished_at_the_end(self):
        sb = FakeSB()
        log = RunLog(sb=sb, dsn="")
        run_id = log.start("scripts.pattern_experiment", {"embeddings": 72}, started_at="2026-10-09T00:00:00+00:00")
        log.finish()
        (kind, row), (kind2, fields, where) = sb.ops
        self.assertEqual((kind, kind2), ("insert", "update"))
        self.assertEqual(row["run_id"], run_id)
        self.assertEqual(row["started_at"], "2026-10-09T00:00:00+00:00")
        self.assertEqual(row["inputs"], {"embeddings": 72})
        self.assertIn("ended_at", fields)
        self.assertEqual(where, ("run_id", run_id))

    def test_a_missing_table_doesnt_stop_the_run(self):
        out = io.StringIO()
        with redirect_stdout(out):
            log = RunLog(sb=FakeSB(fail=True), dsn="")
            self.assertIsNone(log.start("s", {}))
            log.finish()
        self.assertIn("not logged", out.getvalue())

    def test_git_commit_is_short(self):
        commit = git_commit()
        self.assertTrue(commit is None or re.fullmatch(r"[0-9a-f]{7,12}", commit), commit)


class InputsTests(unittest.TestCase):
    def test_inputs_are_counts_and_settings_only(self):
        from scripts.pattern_experiment import run_inputs
        rows = [{"user_id": "00000000-0000-0000-0000-000000000001", "embedding_text_version": "anon-v1"}] * 3
        args = SimpleNamespace(k=10, conditions="current", filter="live")
        inputs = run_inputs(rows, {"added": 1, "by_time": 2}, 0, None, args)
        self.assertEqual(set(inputs), {"embeddings", "stale", "stale_by_time", "text_version", "stored_text_versions",
                                       "condition_map_hash", "similarity_labels", "group_feedback_answers",
                                       "match_threshold", "settings"})
        text = json.dumps(inputs)
        self.assertNotRegex(text, r"[0-9a-f]{8}-[0-9a-f]{4}-")   # no ids
        self.assertNotIn("@", text)                               # no emails
        self.assertEqual((inputs["embeddings"], inputs["stale"], inputs["match_threshold"]), (3, 1, 0.7))


if __name__ == "__main__":
    unittest.main()
