"""The onboarding funnel report's counting rules.

Run from backend/:  python -m unittest tests.test_onboarding_funnel -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.onboarding_funnel import (  # noqa: E402
    CURRENT_VERSION,
    STOP_REASONS,
    USEFULNESS,
    compute_funnel,
    render,
    render_checkins,
    summarize_checkins,
    summarize_feedback,
)

REPO = Path(__file__).resolve().parents[2]

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

    def test_compares_by_who_they_are_here_for(self):
        events = [
            ev("a", "signup_complete", "2026-10-01T10:00:00+00:00"),
            ev("a", "onboarding_complete", "2026-10-01T10:05:00+00:00"),
            ev("b", "signup_complete", "2026-10-01T11:00:00+00:00"),
        ]
        events[0]["user_id"] = events[1]["user_id"] = "u-a"
        events[2]["user_id"] = "u-b"
        f = compute_funnel(events, audience_by_user={"u-a": "child"})
        self.assertEqual(f["by_audience"]["my child"]["finished"], 1)
        self.assertEqual(f["by_audience"]["(not answered)"]["accounts"], 1)

    def test_survey_split_by_user_type(self):
        events = [ev("a", "signup_complete", "2026-10-01T10:00:00+00:00", channel="tiktok")]
        events[0]["user_id"] = "u-a"
        f = compute_funnel(events, audience_by_user={"u-a": "self"})
        rows = [{"user_id": "u-a", "info_before_signup": "about_right", "setup_ease": 5, "comment": None, "onboarding_version": V}]
        s = summarize_feedback(rows, people=f["people"])
        self.assertEqual(s["by_audience"]["myself"]["about_right_share"], 1.0)
        self.assertEqual(s["by_channel"]["tiktok"]["ease_median"], 5)
        self.assertIn("By who they are here for", render(f, s, show_comments=False))

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


class CheckinTests(unittest.TestCase):
    ROWS = [
        {"user_id": "u1", "kind": "inactive_email", "reason": "too_much", "usefulness": None, "comment": None},
        {"user_id": "u2", "kind": "welcome_back", "reason": "too_much", "usefulness": None, "comment": "hard to start"},
        {"user_id": "u3", "kind": "welcome_back", "reason": "no_time", "usefulness": None, "comment": None},
        {"user_id": "u1", "kind": "usefulness", "reason": None, "usefulness": "somewhat", "comment": None},
        {"user_id": "u4", "kind": "usefulness", "reason": None, "usefulness": "very", "comment": None},
    ]

    def test_counts_reasons_and_usefulness_separately(self):
        c = summarize_checkins(self.ROWS, {"u1": "child", "u2": "child", "u3": "self"})
        self.assertEqual(c["stopped"], 3)
        self.assertEqual((c["from_email"], c["on_return"]), (1, 2))
        self.assertEqual(c["reasons"]["too_much"], 2)
        self.assertEqual(c["useful"], 2)
        self.assertEqual(c["usefulness"]["very"], 1)
        self.assertEqual(c["by_audience"]["my child"]["reasons"]["too_much"], 2)
        self.assertEqual(c["by_audience"]["my child"]["usefulness"]["somewhat"], 1)
        # u4 never said who they are here for.
        self.assertEqual(c["by_audience"]["(not answered)"]["usefulness"]["very"], 1)

    def test_comments_only_with_flag(self):
        c = summarize_checkins(self.ROWS)
        self.assertNotIn("hard to start", render_checkins(c, show_comments=False))
        self.assertIn("hard to start", render_checkins(c, show_comments=True))

    def test_report_prints_no_ids(self):
        text = render_checkins(summarize_checkins(self.ROWS, {"u1": "child"}), show_comments=True)
        for uid in ("u1", "u2", "u3", "u4"):
            self.assertNotIn(uid, text)

    def test_answer_lists_match_the_app_and_the_database(self):
        ts = (REPO / "frontend/lib/checkin.ts").read_text()
        sql = (REPO / "backend/database/migrations/2026_checkins.sql").read_text()
        for key, _ in STOP_REASONS + USEFULNESS:
            self.assertIn(f"id: '{key}'", ts)
            self.assertIn(f"'{key}'", sql)


class SmallGroupTests(unittest.TestCase):
    def test_groups_under_five_are_not_shown_as_counts(self):
        # One person from tiktok, six from reddit.
        events = [ev("t1", "signup_complete", "2026-10-01T10:00:00+00:00", channel="tiktok")]
        events += [ev(f"r{i}", "signup_complete", "2026-10-01T10:00:00+00:00", channel="reddit") for i in range(6)]
        text = render(compute_funnel(events), summarize_feedback([]), show_comments=False)
        tiktok = next(line for line in text.splitlines() if line.strip().startswith("tiktok"))
        reddit = next(line for line in text.splitlines() if line.strip().startswith("reddit"))
        self.assertIn("<5", tiktok)
        self.assertNotIn("%", tiktok)
        self.assertIn(" 6 ", reddit)

    def test_checkin_groups_under_five_are_not_shown(self):
        rows = [{"user_id": "u1", "kind": "welcome_back", "reason": "no_time", "usefulness": None, "comment": None}]
        text = render_checkins(summarize_checkins(rows, {"u1": "child"}), show_comments=False)
        child = next(line for line in text.splitlines() if line.strip().startswith("my child"))
        self.assertIn("<5", child)
        self.assertNotIn("didn't have time", child)

