"""The definitions behind the Path Planning audit's quality checks
(scripts/agent_audit_path_planning.py, docs/reports/agent-audit-path-planning-2026-10-13.md)."""
import unittest

from scripts.agent_audit_path_planning import goal_appears, job_category, pair_kind, parse_ts, task_flags, words


class DefinitionsTests(unittest.TestCase):
    def test_exact_duplicates_ignore_case_punctuation_and_spacing(self):
        self.assertEqual(pair_kind("Talk with their teacher!", "talk with  their teacher"), "exact")

    def test_near_duplicates_share_most_words(self):
        self.assertEqual(pair_kind("Research inclusive employers", "Research inclusive employers in your area"), "near")
        # Same opening verb and one shared word: not a near duplicate.
        self.assertIsNone(pair_kind("Build stress management toolkit", "Build social skills toolkit"))
        # One word each is never "near", only exact.
        self.assertIsNone(pair_kind("Networking", "Network"))

    def test_generic_verbs_and_stopwords_are_not_words(self):
        self.assertEqual(words("Build my own business"), {"own", "busine"})

    def test_tasks(self):
        self.assertEqual(task_flags({"name": "  ", "description": "x"}), {"empty"})
        self.assertEqual(task_flags({"name": "Research", "description": ""}), {"one_word", "no_description"})
        self.assertIn("template", task_flags({"name": "Create action plan: Find a job", "description": "Part 2"}))
        self.assertIn("quality_fallback", task_flags({"name": "Start: Clarify the next outcome", "description": "x"}))
        self.assertEqual(task_flags({"name": "Email the office for the form", "description": "One step."}), set())

    def test_a_goal_appears_in_milestone_names(self):
        self.assertTrue(goal_appears("Get a job in graphic design", ["Build a design portfolio"]))
        self.assertFalse(goal_appears("Get a job in graphic design", ["Establish healthcare team"]))
        self.assertIsNone(goal_appears("Get better", ["Anything at all"]))

    def test_job_messages_are_grouped_without_their_text(self):
        self.assertEqual(job_category("Too many requests in the last minute. Please wait."), "AI limit: requests per minute")
        self.assertEqual(job_category("Goals involving harming others aren't supported."), "input rejected by the guardrails")
        self.assertEqual(job_category("Something unexpected happened somewhere"), "other")

    def test_jobs_with_their_kind_in_front(self):
        # core/jobs.py since 18 November 2026: "[kind] message".
        self.assertEqual(job_category("[guardrail] You can call or text 9-8-8 any time."), "input rejected by the guardrails")
        self.assertEqual(job_category("[limit] You've reached today's usage limit for AI generation."), "AI limit: tokens per day")
        self.assertEqual(job_category("[internal] Your path couldn't be made just now, so please try again in a minute."),
                         "any other exception (cause only in the server log)")
        self.assertEqual(job_category("[internal] Interrupted: the server restarted, or the generation hung."),
                         "interrupted (reaped after a restart or hang)")
        self.assertEqual(job_category("[internal] Stopped at the generation deadline."),
                         "stopped at the generation deadline (a call that hung)")

    def test_timestamps_with_short_fractions(self):
        self.assertEqual(parse_ts("2026-10-12T22:15:01.12345+00:00").microsecond, 123450)
        self.assertIsNotNone(parse_ts("2026-10-12T22:15:01Z"))
        self.assertIsNone(parse_ts("not a time"))


if __name__ == "__main__":
    unittest.main()
