"""The onboarding funnel report's counting rules.

Run from backend/:  python -m unittest tests.test_onboarding_funnel -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.onboarding_funnel import (  # noqa: E402
    CURRENT_VERSION,
    compute_funnel,
    render,
    summarize_feedback,
)

V = CURRENT_VERSION


def ev(visitor, event, at, step=None, channel=None, version=V):
    return {"visitor_id": visitor, "event": event, "step": step, "channel": channel,
            "onboarding_version": version, "created_at": at}


class FunnelTests(unittest.TestCase):
    def test_stages_count_distinct_browsers(self):
        events = [
            ev("a", "landing_view", "2026-10-01T10:00:00+00:00", channel="tiktok"),
            ev("a", "landing_view", "2026-10-01T10:05:00+00:00", channel="tiktok"),
            ev("a", "signup_view", "2026-10-01T10:06:00+00:00"),
            ev("a", "signup_complete", "2026-10-01T10:08:00+00:00"),
            ev("a", "onboarding_step_view", "2026-10-01T10:09:00+00:00", step="character"),
            ev("a", "onboarding_step_view", "2026-10-01T10:09:30+00:00", step="character"),
            ev("b", "landing_view", "2026-10-01T11:00:00+00:00", channel="facebook"),
        ]
        o = compute_funnel(events)["overall"]
        self.assertEqual((o["visitors"], o["signup_view"], o["accounts"]), (2, 1, 1))
        self.assertEqual(o["steps"]["character"], 1)
        self.assertEqual(o["accounts_from_landing"], 1)

    def test_return_must_be_a_later_day_within_seven_days(self):
        signup = "2026-10-01T09:00:00+00:00"
        cases = {
            "same_day": ("2026-10-01T22:00:00+00:00", False),
            "day_3": ("2026-10-04T08:00:00+00:00", True),
            "day_7_edge": ("2026-10-08T09:00:00+00:00", True),
            "day_9": ("2026-10-10T08:00:00+00:00", False),
        }
        for name, (open_at, expected) in cases.items():
            events = [ev(name, "signup_complete", signup), ev(name, "app_open", open_at)]
            self.assertEqual(compute_funnel(events)["overall"]["returned"], int(expected), name)

    def test_app_open_without_an_account_is_not_a_return(self):
        events = [ev("x", "app_open", "2026-10-03T08:00:00+00:00")]
        self.assertEqual(compute_funnel(events)["overall"]["returned"], 0)

    def test_channel_comes_from_the_first_visit(self):
        events = [
            ev("a", "landing_view", "2026-10-01T10:00:00+00:00", channel="tiktok"),
            ev("a", "signup_complete", "2026-10-01T10:08:00+00:00"),
            ev("b", "landing_view", "2026-10-01T10:00:00+00:00"),
        ]
        by = compute_funnel(events)["by_channel"]
        self.assertEqual(by["tiktok"]["accounts"], 1)
        self.assertEqual(by["(none)"]["visitors"], 1)

    def test_test_traffic_and_other_versions_are_excluded(self):
        events = [
            ev("a", "landing_view", "2026-10-01T10:00:00+00:00", version="qa-local"),
            ev("b", "landing_view", "2026-10-01T10:00:00+00:00", version="old-flow"),
            ev("c", "landing_view", "2026-10-01T10:00:00+00:00"),
        ]
        self.assertEqual(compute_funnel(events)["overall"]["visitors"], 1)
        self.assertEqual(compute_funnel(events, "all")["overall"]["visitors"], 2)

    def test_empty_input_renders(self):
        text = render(compute_funnel([]), summarize_feedback([]), show_comments=False)
        self.assertIn("visited the landing page", text)
        self.assertIn("0 responses", text)


class FeedbackTests(unittest.TestCase):
    def test_counts_and_median(self):
        rows = [
            {"info_before_signup": "too_little", "setup_ease": 2, "comment": "What is a norm?", "onboarding_version": V},
            {"info_before_signup": "about_right", "setup_ease": 4, "comment": None, "onboarding_version": V},
            {"info_before_signup": "about_right", "setup_ease": None, "comment": None, "onboarding_version": V},
            {"info_before_signup": "too_much", "setup_ease": 5, "comment": None, "onboarding_version": "qa-x"},
        ]
        s = summarize_feedback(rows)
        self.assertEqual(s["responses"], 3)
        self.assertEqual(s["info_before_signup"]["about_right"], 2)
        self.assertEqual(s["ease_median"], 3)
        self.assertEqual(len(s["comments"]), 1)

    def test_comments_hidden_unless_asked(self):
        rows = [{"info_before_signup": None, "setup_ease": None, "comment": "my name is X", "onboarding_version": V}]
        hidden = render(compute_funnel([]), summarize_feedback(rows), show_comments=False)
        shown = render(compute_funnel([]), summarize_feedback(rows), show_comments=True)
        self.assertNotIn("my name is X", hidden)
        self.assertIn("my name is X", shown)


if __name__ == "__main__":
    unittest.main()
