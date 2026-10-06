"""The onboarding funnel report's counting rules.

Run from backend/:  python -m unittest tests.test_onboarding_funnel -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.onboarding_funnel import (  # noqa: E402
    AUDIENCE_LABELS,
    CURRENT_VERSION,
    START_EVENTS,
    START_NEEDS,
    START_ROLES,
    compute_start_here,
    render_start_here,
    AREAS,
    compare_versions,
    render_versions,
    render_feature_use,
    summarize_feature_use,
    render_last_seen,
    summarize_last_seen,
    render_ask_later,
    summarize_ask_later,
    render_heard_from,
    summarize_heard_from,
    RH_PROMPTS,
    RH_SETUP_STEPS,
    _ts,
    render_generation,
    summarize_generation,
    is_resourcehub,
    render_resourcehub,
    summarize_resourcehub,
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

    def test_qa_checkins_are_left_out(self):
        rows = [
            {"user_id": "u1", "kind": "welcome_back", "reason": "no_time", "usefulness": None, "comment": None,
             "onboarding_version": "qa-e2e"},
            {"user_id": "u2", "kind": "welcome_back", "reason": "too_much", "usefulness": None, "comment": None,
             "onboarding_version": "goalfirst-2026-10"},
        ]
        c = summarize_checkins(rows)
        self.assertEqual(c["stopped"], 1)
        self.assertEqual(dict(c["reasons"]), {"too_much": 1})


class GroupThreeMeasureTests(unittest.TestCase):
    """Riipen Labs, Group 3: return within 7 to 14 days, time to first
    meaningful action, and the self-reported channel."""

    def _ev(self, visitor, event, at, user=None):
        e = ev(visitor, event, at)
        e["user_id"] = user
        return e

    def test_returns_within_7_and_14_days(self):
        events = [
            self._ev("a", "signup_complete", "2026-10-01T10:00:00+00:00", "ua"),
            self._ev("a", "app_open", "2026-10-05T10:00:00+00:00", "ua"),   # day 4: counts for both
            self._ev("b", "signup_complete", "2026-10-01T10:00:00+00:00", "ub"),
            self._ev("b", "app_open", "2026-10-12T10:00:00+00:00", "ub"),   # day 11: 14-day only
            self._ev("c", "signup_complete", "2026-10-01T10:00:00+00:00", "uc"),
            self._ev("c", "app_open", "2026-10-20T10:00:00+00:00", "uc"),   # day 19: neither
        ]
        o = compute_funnel(events)["overall"]
        self.assertEqual((o["returned"], o["returned_14"]), (1, 2))

    def test_time_to_first_step(self):
        events = [
            self._ev("a", "signup_complete", "2026-10-01T10:00:00+00:00", "ua"),
            self._ev("b", "signup_complete", "2026-10-01T10:00:00+00:00", "ub"),
            self._ev("c", "signup_complete", "2026-10-01T10:00:00+00:00", "uc"),
        ]
        first_done = {
            "ua": "2026-10-01T12:00:00+00:00",   # 2 h
            "ub": "2026-10-02T14:00:00+00:00",   # 28 h
            "uc": "2026-09-30T10:00:00+00:00",   # before sign-up (an older path): ignored
        }
        o = compute_funnel(events, first_done_by_user=first_done)["overall"]
        self.assertEqual(o["first_step"], 2)
        self.assertAlmostEqual(o["first_step_median_hours"], 15.0)
        self.assertIn("marked a first step done        2", render(compute_funnel(events, first_done_by_user=first_done), summarize_feedback([]), False))

    def test_heard_from_counts_accounts_and_hides_small_groups(self):
        people = [{"user_id": f"u{i}", "account": True} for i in range(7)] + [{"user_id": "x", "account": False}]
        heard = {f"u{i}": "reddit" for i in range(5)}
        heard.update({"u5": "friend", "u6": "friend", "x": "tiktok"})
        counts = summarize_heard_from(people, heard)
        self.assertEqual(dict(counts), {"reddit": 5, "friend": 2})   # x never made an account
        text = render_heard_from(counts)
        self.assertIn("reddit                   5", text)
        self.assertIn("friend                  <5", text)
        self.assertNotIn("tiktok", text)



class StartHereTests(unittest.TestCase):
    """Riipen Labs, Group 4's measures for the guided "Start here"."""

    def journey(self, v, role="child", need="services", opened=("therapists",), useful=None, saved=False,
                signup=False, version=V):
        t = "2026-10-05T10:00:{:02d}+00:00"
        rows = [ev(v, "landing_view", t.format(0), version=version),
                ev(v, "start_role", t.format(1), step=role, version=version),
                ev(v, "start_pathway", t.format(2), step=f"{role}.{need}", version=version)]
        rows += [ev(v, "start_open", t.format(3), step=f"{role}.{need}.{item}", version=version) for item in opened]
        if useful:
            rows.append(ev(v, "start_useful", t.format(4), step=f"{role}.{need}.{useful}", version=version))
        if saved:
            rows.append(ev(v, "start_save", t.format(5), step=f"{role}.{need}", version=version))
        if signup:
            rows.append(ev(v, "signup_complete", t.format(6), version=version))
        return rows

    def test_completion_relevance_and_next_action(self):
        events = (self.journey("a", useful="yes", saved=True, signup=True)
                  + self.journey("b", opened=(), useful="no")
                  + [ev("c", "start_role", "2026-10-05T11:00:00+00:00", step="self")]
                  + [ev("d", "landing_view", "2026-10-05T11:00:00+00:00")])
        o = compute_start_here(events)["overall"]
        self.assertEqual(o["started"], 3)          # d never used it
        self.assertEqual(o["chose_role"], 3)
        self.assertEqual(o["pathway"], 2)          # c stopped after the first question
        self.assertEqual(o["opened"], 1)
        self.assertEqual(o["saved"], 1)
        self.assertEqual(o["next_action"], 1)      # b neither opened nor saved
        self.assertEqual((o["yes"], o["no"]), (1, 1))
        self.assertEqual(o["account_after"], 1)

    def test_a_sign_up_before_the_pathway_does_not_count(self):
        events = [ev("a", "signup_complete", "2026-10-05T09:00:00+00:00")] + self.journey("a")
        self.assertEqual(compute_start_here(events)["overall"]["account_after"], 0)

    def test_groups_count_each_browser_once(self):
        events = self.journey("a", need="services") + self.journey("a", need="learn", opened=("book",))
        s = compute_start_here(events)
        self.assertEqual(s["by_role"]["child"]["people"], 1)
        self.assertEqual(s["by_need"]["services"]["people"], 1)
        self.assertEqual(s["by_need"]["learn"]["opened"], 1)
        self.assertEqual(s["opened"][("services", "therapists")], 1)

    def test_test_traffic_is_left_out(self):
        events = self.journey("q", version="qa-start") + self.journey("a")
        self.assertEqual(compute_start_here(events)["overall"]["started"], 1)

    def test_small_groups_hidden(self):
        events = [row for i in range(6) for row in self.journey(f"p{i}", need="services")]
        events += self.journey("x", role="ally", need="sensory", opened=("sensory",))
        text = render_start_here(compute_start_here(events))
        services = next(line for line in text.splitlines() if line.strip().startswith("services"))
        sensory = next(line for line in text.splitlines() if line.strip().startswith("sensory tools"))
        self.assertIn(" 6 ", services)
        self.assertIn("<5", sensory)
        self.assertNotIn("%", sensory)
        self.assertIn("therapists", text)        # opened by 6
        self.assertNotIn("sensory  ", text.split("resources opened most")[1])

    def test_report_prints_no_ids(self):
        text = render_start_here(compute_start_here(self.journey("visitor-123")))
        self.assertNotIn("visitor-123", text)

    def test_answers_match_the_app_and_the_database(self):
        ts = (REPO / "frontend/lib/startHere.ts").read_text()
        route = (REPO / "frontend/app/api/events/route.ts").read_text()
        sql = (REPO / "backend/database/migrations/2026_start_here_events.sql").read_text()
        for key, _ in START_ROLES + START_NEEDS:
            self.assertIn(f"id: '{key}'", ts)
        for event in START_EVENTS:
            self.assertIn(f"'{event}'", route)
            self.assertIn(f"'{event}'", sql)
        self.assertIn("unsure", AUDIENCE_LABELS)


class Group5Tests(unittest.TestCase):
    """Riipen Labs, Group 5's measures."""

    def accounts(self, version, n, finished):
        rows = []
        for i in range(n):
            v = f"{version}-{i}"
            rows.append(ev(v, "signup_complete", "2026-10-05T10:00:00+00:00", version=version))
            if i < finished:
                rows.append(ev(v, "onboarding_complete", "2026-10-05T10:05:00+00:00", version=version))
        return rows

    def test_drop_off_by_version_and_the_40_percent_target(self):
        old = self.accounts("goalfirst-2026-10", 10, 5)     # 50% dropped off
        new = self.accounts("twostep-2026-10", 10, 8)       # 20%: 60% less
        for row in old:
            row["created_at"] = row["created_at"].replace("10-05", "10-01")
        rows = compare_versions(new + old + self.accounts("qa-x", 6, 0))
        self.assertEqual([r["version"] for r in rows], ["goalfirst-2026-10", "twostep-2026-10"])
        text = render_versions(rows)
        self.assertIn("-60%", text)
        self.assertIn("target met", text)

    def test_small_versions_hide_their_numbers(self):
        text = render_versions(compare_versions(self.accounts("twostep-2026-10", 3, 1)))
        line = next(l for l in text.splitlines() if "twostep" in l)
        self.assertIn("<5", line)
        self.assertNotIn("%", line)
        self.assertNotIn("drop-off twostep", text)

    def test_feature_use_counts_accounts_by_group(self):
        rows = []
        for i in range(6):
            uid = f"u{i}"
            rows.append({**ev(f"v{i}", "feature_use", "2026-10-05T10:00:00+00:00", step="calendar"), "user_id": uid})
            if i < 3:
                rows.append({**ev(f"v{i}", "feature_use", "2026-10-06T10:00:00+00:00", step="tidbits"), "user_id": uid})
        rows.append({**ev("w", "feature_use", "2026-10-05T10:00:00+00:00", step="journal"), "user_id": "parent1"})
        audience = {f"u{i}": "self" for i in range(6)} | {"parent1": "child"}
        f = summarize_feature_use(rows, V, audience)
        self.assertEqual(f["all"]["accounts"], 7)
        self.assertEqual(f["myself"]["areas"]["calendar"], 6)
        self.assertEqual(f["myself"]["areas"]["tidbits"], 3)
        text = render_feature_use(f)
        self.assertIn("myself", text)
        self.assertNotIn("my child", text)          # one account: not shown separately
        self.assertIn("1 group(s)", text)
        calendar = next(l for l in text.splitlines() if l.strip().startswith("Calendar"))
        self.assertIn("86%", calendar)               # 6 of 7 accounts
        self.assertNotIn("u0", text)

    def test_areas_match_the_app(self):
        ts = (REPO / "frontend/lib/funnel.ts").read_text()
        for area, _ in AREAS:
            self.assertIn(f"'{area}'", ts)
        sql = (REPO / "backend/database/migrations/2026_feature_use_events.sql").read_text()
        self.assertIn("'feature_use'", sql)

    def test_usefulness_in_the_first_two_weeks(self):
        rows = [
            {"user_id": "a", "kind": "usefulness", "usefulness": "very", "reason": None, "comment": None,
             "created_at": "2026-10-10T10:00:00+00:00"},
            {"user_id": "b", "kind": "usefulness", "usefulness": "not_yet", "reason": None, "comment": None,
             "created_at": "2026-11-30T10:00:00+00:00"},
        ]
        joined = {"a": "2026-10-01T09:00:00+00:00", "b": "2026-10-01T09:00:00+00:00"}
        c = summarize_checkins(rows, {}, joined)
        self.assertEqual(c["usefulness_early"]["very"], 1)
        self.assertEqual(sum(c["usefulness_early"].values()), 1)
        self.assertIn("first two weeks after sign-up (1 answers)", render_checkins(c, show_comments=False))


class WhereTheyLeaveTests(unittest.TestCase):
    """Riipen Labs, Group 6: track "where they click, leave, and whether they return"."""

    def use(self, uid, day, area):
        return {**ev(uid, "feature_use", f"2026-10-{day:02d}T10:00:00+00:00", step=area), "user_id": uid}

    def test_last_day_areas_for_people_away_two_weeks(self):
        from datetime import datetime, timezone
        now = datetime(2026, 10, 30, tzinfo=timezone.utc)
        events = []
        for i in range(6):                        # six people last seen on 10 Oct, on the calendar
            events += [self.use(f"a{i}", 5, "path"), self.use(f"a{i}", 10, "calendar")]
        events += [self.use("b", 10, "journal"), self.use("b", 25, "path")]   # back recently: not away
        s = summarize_last_seen(events, V, now)
        self.assertEqual((s["accounts"], s["away"]), (7, 6))
        self.assertEqual(s["areas"]["calendar"], 6)
        self.assertNotIn("path", s["areas"])      # only their last day counts
        text = render_last_seen(s)
        self.assertIn("Calendar", text)
        self.assertNotIn("a0", text)

    def test_few_people_away_shows_no_breakdown(self):
        from datetime import datetime, timezone
        s = summarize_last_seen([self.use("a", 1, "path")], V, datetime(2026, 10, 30, tzinfo=timezone.utc))
        self.assertIn("fewer than 5 so far", render_last_seen(s))


class Group7Tests(unittest.TestCase):
    """Riipen Labs, Group 7: time to first action, and questions asked later."""

    def test_time_to_first_opened_step(self):
        events = [ev("a", "signup_complete", "2026-10-05T10:00:00+00:00"),
                  ev("a", "feature_use", "2026-10-05T09:00:00+00:00", step="milestones"),   # before sign-up: ignored
                  ev("a", "feature_use", "2026-10-05T10:30:00+00:00", step="path"),
                  ev("a", "feature_use", "2026-10-05T12:00:00+00:00", step="milestones")]
        o = compute_funnel(events)["overall"]
        self.assertEqual(o["first_open"], 1)
        self.assertAlmostEqual(o["first_open_median_hours"], 2.0)
        self.assertIn("opened their first step", render(compute_funnel(events), summarize_feedback([]), False))

    def test_questions_asked_later(self):
        events = []
        for i in range(6):
            v = f"v{i}"
            events.append(ev(v, "ask_later", "2026-10-05T10:00:00+00:00", step="shown.location"))
            if i < 3:
                events.append(ev(v, "ask_later", "2026-10-05T10:01:00+00:00", step="done.location"))
            elif i < 5:
                events.append(ev(v, "ask_later", "2026-10-05T10:01:00+00:00", step="closed.location"))
        events += [ev("w", "ask_later", "2026-10-15T10:00:00+00:00", step="shown.makeItYours"),
                   ev("w", "ask_later", "2026-10-15T10:01:00+00:00", step="done.character")]
        s = summarize_ask_later(events)
        self.assertEqual(s["location"], {"shown": 6, "done": 3, "closed": 2})
        self.assertEqual(s["makeItYours"], {"shown": 1, "done": 1, "closed": 0})
        text = render_ask_later(s)
        location = next(l for l in text.splitlines() if l.strip().startswith("Location"))
        self.assertIn("50%", location)
        make = next(l for l in text.splitlines() if l.strip().startswith("Character"))
        self.assertIn("<5", make)

    def test_ask_later_matches_the_app_and_the_database(self):
        ts = (REPO / "frontend/lib/askLater.ts").read_text()
        sql = (REPO / "backend/database/migrations/2026_ask_later_events.sql").read_text()
        for group in ("location", "aboutYou", "makeItYours"):
            self.assertIn(f"id: '{group}'", ts)
        self.assertIn("'ask_later'", sql)


class Group8Tests(unittest.TestCase):
    """Riipen Labs, Group 8: ResourceHub's three-step setup, the first place
    opened, results within the radius, and prompts that ask for more later."""

    RH = "rh-3step-2026-10"

    def rh(self, visitor, event, at, step=None, version=None):
        return ev(visitor, event, at, step=step, version=version or self.RH)

    def test_setup_completion_and_first_place(self):
        events = []
        for i in range(6):
            v = f"p{i}"
            events.append(self.rh(v, "rh_visit", "2026-10-06T10:00:00+00:00"))
            events.append(self.rh(v, "rh_setup_step", "2026-10-06T10:01:00+00:00", "role"))
            if i < 5:
                events.append(self.rh(v, "rh_setup_step", "2026-10-06T10:02:00+00:00", "topic"))
            if i < 4:
                events.append(self.rh(v, "rh_setup_complete", "2026-10-06T10:03:00+00:00", "topic" if i < 3 else "no_topic"))
                events.append(self.rh(v, "rh_setup_step", "2026-10-06T10:03:00+00:00", "first"))
                events.append(self.rh(v, "rh_first_resource", "2026-10-06T12:00:00+00:00", "setup"))
                # A later "first" from the same browser does not count twice.
                events.append(self.rh(v, "rh_first_resource", "2026-10-07T12:00:00+00:00", "browse"))
        events.append(self.rh("x", "rh_first_resource", "2026-10-06T12:00:00+00:00", "browse"))
        s = summarize_resourcehub(events)
        self.assertEqual(s["visits"], 6)
        self.assertEqual(s["steps"], {"role": 6, "topic": 5, "first": 4})
        self.assertEqual(s["finished"], 4)
        self.assertEqual(s["finished_with_topic"], 3)
        self.assertEqual(s["opened"], 5)
        self.assertEqual(s["opened_from_setup"], 4)
        self.assertAlmostEqual(s["first_open_median_hours"], 2.0)
        self.assertAlmostEqual(s["setup_to_open_median_hours"], 119 / 60)
        text = render_resourcehub(s)
        self.assertIn("finished setup                     4 (67% of those who started)", text)
        self.assertIn("median 2.0 h after their first visit", text)

    def test_coming_back_within_7_and_14_days(self):
        events = []
        # Five first visits on 6 October. a: back on the 9th; b: back on the
        # 18th (within 14 days, not 7); c: back the same day only; d: never;
        # e: the first release, a visit with no step, back on the 7th.
        for v in "abcde":
            events.append(self.rh(v, "rh_visit", "2026-10-06T10:00:00+00:00", None if v == "e" else "first"))
        events += [self.rh("a", "rh_visit", "2026-10-09T10:00:00+00:00", "return"),
                   self.rh("b", "rh_visit", "2026-10-18T09:00:00+00:00", "return"),
                   self.rh("c", "rh_visit", "2026-10-06T20:00:00+00:00", "return"),
                   self.rh("e", "rh_visit", "2026-10-07T08:00:00+00:00", "return")]
        s = summarize_resourcehub(events)
        self.assertEqual(s["visits"], 5)
        self.assertEqual(s["back"]["visit_7"], 2)
        self.assertEqual(s["back"]["visit_14"], 3)
        self.assertIn("within 7 days 40%, within 14 days 60% of first visits", render_resourcehub(s))

    def test_results_within_the_radius_and_prompts(self):
        events = [self.rh("a", "rh_search", "2026-10-06T10:00:00+00:00", "12/20"),
                  self.rh("a", "rh_search", "2026-10-06T10:01:00+00:00", "0/20"),
                  self.rh("b", "rh_search", "2026-10-06T10:02:00+00:00", "8/10"),
                  self.rh("b", "rh_search", "2026-10-06T10:03:00+00:00", "20/20"),
                  self.rh("c", "rh_search", "2026-10-06T10:04:00+00:00", "0/10"),
                  self.rh("c", "rh_search", "2026-10-06T10:05:00+00:00", "9/3")]  # impossible: dropped
        for i in range(5):
            v = f"q{i}"
            events.append(self.rh(v, "rh_prompt", "2026-10-06T10:00:00+00:00", "shown.add_topic"))
            events.append(self.rh(v, "rh_prompt", "2026-10-06T10:01:00+00:00", "yes.add_topic" if i < 2 else "no.add_topic"))
        events.append(self.rh("z", "rh_prompt", "2026-10-06T10:00:00+00:00", "shown.sharpen"))
        s = summarize_resourcehub(events)
        self.assertEqual((s["searches"], s["near"], s["shown"]), (5, 40, 80))
        self.assertEqual(s["prompts"]["add_topic"], {"shown": 5, "yes": 2, "no": 3, "later": 0})
        text = render_resourcehub(s)
        self.assertIn("50% of first-page places within the radius", text)
        add = next(l for l in text.splitlines() if l.strip().startswith("Add a searched topic"))
        self.assertIn("40%", add)
        sharpen = next(l for l in text.splitlines() if l.strip().startswith("Welcome back"))
        self.assertIn("<5", sharpen)

    def test_test_traffic_and_small_groups(self):
        events = [self.rh("t", "rh_visit", "2026-10-06T10:00:00+00:00", version="qa-rh"),
                  self.rh("u", "rh_setup_step", "2026-10-06T10:00:00+00:00", "role")]
        s = summarize_resourcehub(events)
        self.assertEqual(s["visits"], 0)
        self.assertIn("started setup                      <5", render_resourcehub(s))

    def test_kept_out_of_goal_plannings_funnel(self):
        rh = self.rh("a", "rh_visit", "2026-10-06T10:00:00+00:00", version=V)
        self.assertTrue(is_resourcehub(rh))
        self.assertFalse(is_resourcehub(ev("a", "landing_view", "2026-10-06T10:00:00+00:00")))

    def test_vocabulary_matches_resourcehub_and_the_database(self):
        setup = (REPO / "servicehub-mvp/lib/onboarding/setup.ts").read_text()
        track = (REPO / "servicehub-mvp/lib/track.ts").read_text()
        api = (REPO / "servicehub-mvp/app/api/events/route.ts").read_text()
        sql = (REPO / "backend/database/migrations/2026_resourcehub_events.sql").read_text()
        self.assertIn(f"SETUP_STEPS = [{', '.join(repr(x) for x in RH_SETUP_STEPS)}] as const", setup)
        self.assertIn(f"PROMPT_IDS = [{', '.join(repr(p) for p, _ in RH_PROMPTS)}] as const", track)
        self.assertIn(f"SETUP_VERSION = '{self.RH}'", setup)
        for event in ("rh_visit", "rh_setup_step", "rh_setup_complete", "rh_first_resource", "rh_search", "rh_prompt"):
            self.assertIn(f"'{event}'", sql)
            self.assertIn(f"{event}:", api)
        # STEP 51 keeps every earlier event, so it can replace STEP 50.
        for event in ("landing_view", "feature_use", "ask_later"):
            self.assertIn(f"'{event}'", sql)

    def test_needs_match_start_here(self):
        setup = (REPO / "servicehub-mvp/lib/onboarding/setup.ts").read_text()
        start = (REPO / "frontend/lib/startHere.ts").read_text()
        for need in ("services", "community", "school_work", "sensory"):
            self.assertIn(f"id: '{need}'", setup)
            self.assertIn(f"id: '{need}'", start)


class Group9Tests(unittest.TestCase):
    """Riipen Labs, Group 9: setup "freezing", which was path generation
    failing when a second one ran beside the first."""

    def job(self, user, status, start, seconds=None, error=None):
        row = {"user_id": user, "status": status, "created_at": start, "error": error}
        if seconds is not None:
            t = _ts(start)
            row["finished_at"] = (t + __import__("datetime").timedelta(seconds=seconds)).isoformat()
        return row

    def test_making_the_path(self):
        busy = "Too many requests in the last minute. Please wait a moment and try again."
        rows = [self.job(f"u{i}", "succeeded", "2026-10-12T10:00:00+00:00", 30 + i) for i in range(5)]
        rows += [self.job("u5", "failed", "2026-10-12T10:00:00+00:00", 20, busy),
                 self.job("u5", "failed", "2026-10-12T10:00:30+00:00", 2, busy),
                 self.job("u5", "succeeded", "2026-10-12T10:02:00+00:00", 40),
                 self.job("x", "failed", "2026-10-12T10:00:00+00:00", 1, busy)]   # not in this funnel
        g = summarize_generation(rows, {f"u{i}" for i in range(6)})
        self.assertEqual((g["people"], g["got_path"], g["more_than_one_try"]), (6, 6, 1))
        self.assertEqual((g["attempts"], g["failed"]), (8, 2))
        self.assertEqual(g["median_s"], 32.5)
        text = render_generation(g)
        self.assertIn("got a path                         6 (100%)", text)
        self.assertIn("attempts that failed               2 of 8", text)
        self.assertNotIn("Too many requests", text)   # fewer than 5 failures: no reasons shown

    def test_small_groups_hidden(self):
        g = summarize_generation([self.job("u0", "succeeded", "2026-10-12T10:00:00+00:00", 30)], {"u0"})
        self.assertIn("people who started one             <5", render_generation(g))

    def test_postgres_timestamps(self):
        self.assertEqual(_ts("2026-10-05T03:25:46.95505+00:00").microsecond, 955050)
        self.assertEqual(_ts("2026-10-05T03:25:46Z").second, 46)

    def test_the_app_wakes_the_backend_and_waits_for_it(self):
        wake = (REPO / "frontend/lib/wakeBackend.ts").read_text()
        self.assertIn("/health", wake)
        for page in ("signup", "login", "onboarding"):
            self.assertIn("wakeBackend()", (REPO / f"frontend/app/{page}/page.tsx").read_text(), page)
        setup = (REPO / "frontend/app/onboarding/page.tsx").read_text()
        enqueue = setup[setup.index("/api/onboarding/jobs`, onboardingBody"):]
        self.assertIn("timeout: 60000", enqueue[:300])


class Group10Tests(unittest.TestCase):
    """Riipen Labs, Group 10: time to first value, where people pause or
    repeat setup steps, and check-ins that adjust the path."""

    def test_time_to_first_value(self):
        events = []
        for i in range(5):
            v = f"v{i}"
            events.append(ev(v, "signup_complete", "2026-10-12T10:00:00+00:00"))
        events += [
            ev("v0", "start_open", "2026-10-12T09:00:00+00:00", step="self.services.therapists"),  # before sign-up
            ev("v0", "start_open", "2026-10-12T10:10:00+00:00", step="self.services.therapists"),
            ev("v1", "feature_use", "2026-10-12T10:30:00+00:00", step="milestones"),
            ev("v2", "feature_use", "2026-10-13T10:00:00+00:00", step="resourcehub"),
            ev("v3", "feature_use", "2026-10-12T10:05:00+00:00", step="settings"),                # not a value
        ]
        o = compute_funnel(events)["overall"]
        self.assertEqual(o["first_value"], 3)
        self.assertEqual(o["first_value_same_day"], 2)
        self.assertAlmostEqual(o["first_value_median_hours"], 0.5)
        text = render(compute_funnel(events), summarize_feedback([]), False)
        self.assertIn("reached something useful        3   (60% of accounts), median 30 min after sign-up; 2 on the day", text)

    def test_pauses_and_steps_people_come_back_to(self):
        events = []
        for i in range(5):
            v = f"v{i}"
            events += [ev(v, "onboarding_step_view", "2026-10-12T10:00:00+00:00", step="about"),
                       ev(v, "onboarding_step_view", f"2026-10-12T10:00:{40 + i:02d}+00:00", step="goalsAndDreams")]
            if i < 2:   # two went back to the first step, then on again
                events += [ev(v, "onboarding_step_view", "2026-10-12T10:01:30+00:00", step="about"),
                           ev(v, "onboarding_step_view", "2026-10-12T10:02:00+00:00", step="goalsAndDreams")]
        o = compute_funnel(events)["overall"]
        self.assertEqual(o["step_came_back"]["about"], 2)
        self.assertEqual(o["step_median_seconds"]["about"], 42)
        text = render(compute_funnel(events), summarize_feedback([]), False)
        about = next(l for l in text.splitlines() if l.strip().startswith("About you") and "came back" not in l and "%" in l)
        self.assertIn("42 s", about)
        self.assertIn("40%", about)

    def test_setup_sends_every_step_visit(self):
        setup = (REPO / "frontend/app/onboarding/page.tsx").read_text()
        self.assertIn("lastStepTracked.current === currentStep", setup)
        self.assertNotIn("stepsSeen.current.has(currentStep)) return", setup)

    def test_check_in_answers_offer_real_adjustments(self):
        import re
        checkin = (REPO / "frontend/lib/checkin.ts").read_text()
        answers = set(re.findall(r"\{ id: '([a-z_]+)', label:", checkin))
        block = checkin[checkin.index("export const ADJUSTMENTS"):]
        keys = set(re.findall(r"^  ([a-z_]+): \[", block, re.M))
        self.assertTrue(keys and keys <= answers, keys - answers)
        for href in set(re.findall(r"href: '(/[a-z/-]+)", checkin)) - {"/search"}:
            self.assertTrue((REPO / f"frontend/app{href}/page.tsx").exists(), href)
        self.assertIn("ADJUSTMENTS[choice]", (REPO / "frontend/app/components/CheckinQuestion.tsx").read_text())

