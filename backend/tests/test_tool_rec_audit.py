"""The Tool Recommendation audit reads reviewers' details from rating_rater_context after STEP 105, which empties the
rater_* columns on the ratings, and from the ratings themselves before it (scripts/tool_rec_audit.py).

Run from backend/:  python -m unittest tests.test_tool_rec_audit -v
"""
import unittest
from types import SimpleNamespace

from scripts.tool_rec_audit import with_rater_context


class Query:
    def __init__(self, db, table):
        self.db, self.table = db, table

    def select(self, *_):
        return self

    def range(self, start, end):
        self.start, self.end = start, end
        return self

    def execute(self):
        if self.table not in self.db.tables:
            raise RuntimeError(self.db.missing)
        return SimpleNamespace(data=self.db.tables[self.table][self.start:self.end + 1])


class DB:
    def __init__(self, tables, missing="relation \"public.rating_rater_context\" does not exist (42P01)"):
        self.tables, self.missing = tables, missing

    def table(self, name):
        return Query(self, name)


def ratings():
    return [{"id": "r1", "rater_diagnostics": None, "rater_relationships": None},
            {"id": "r2", "rater_diagnostics": None, "rater_relationships": None}]


class RaterContextTests(unittest.TestCase):
    def test_after_step_105_from_the_context_table(self):
        rows = ratings()
        db = DB({"rating_rater_context": [{"rating_id": "r1", "rater_diagnostics": {"adhd": 3}, "rater_relationships": []}]})
        self.assertTrue(with_rater_context(db, rows))
        self.assertEqual(rows[0]["rater_diagnostics"], {"adhd": 3})
        self.assertIsNone(rows[1]["rater_diagnostics"])

    def test_before_step_105_the_ratings_keep_their_own(self):
        rows = [{"id": "r1", "rater_diagnostics": {"autism": 2}, "rater_relationships": ["self"]}]
        for missing in ("relation \"public.rating_rater_context\" does not exist (42P01)",
                        "Could not find the table 'public.rating_rater_context' in the schema cache (PGRST205)"):
            self.assertFalse(with_rater_context(DB({}, missing), rows))
        self.assertEqual(rows[0]["rater_diagnostics"], {"autism": 2})

    def test_another_failure_is_not_hidden(self):
        with self.assertRaises(RuntimeError):
            with_rater_context(DB({}, "permission denied for table rating_rater_context"), ratings())


if __name__ == "__main__":
    unittest.main()
