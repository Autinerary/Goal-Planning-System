"""Setup merges its preferences into profiles.preferences instead of writing
over the whole column (api/routes/onboarding.py, _persist_preferences_to_supabase).

Making a second plan used to reset everything set since the first: email and
check-in choices, a paused account, spirit animals, the character, Dream Self
goals, notes about people and ticked plan tasks.

Run from backend/:  python -m unittest tests.test_persist_preferences -v
"""
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from api.routes import onboarding


class Query:
    def __init__(self, db):
        self.db, self.payload = db, None

    def select(self, *_):
        return self

    def eq(self, *_):
        return self

    def limit(self, *_):
        return self

    def upsert(self, row, on_conflict=None):
        self.payload = row
        return self

    def execute(self):
        if self.payload is not None:
            self.db.written = self.payload
            return SimpleNamespace(data=[self.payload])
        return SimpleNamespace(data=[{"preferences": self.db.saved}] if self.db.saved is not None else [])


class DB:
    def __init__(self, saved):
        self.saved, self.written = saved, None

    def table(self, _name):
        return Query(self)


SAVED = {
    "checkin": {"optIn": True, "updatedAt": "2026-10-01"},
    "paused": {"since": "2026-10-02", "wasDiscoverable": False},
    "gamification": {"animals": [{"type": "fox", "color": "teal"}], "mode": "general"},
    "character": {"hairStyle": "curly", "hairColor": "#000", "skinColor": "#a00"},
    "dreamGoals": {"career": ["Open a bakery"]},
    "reminders": {"enabled": True, "channel": "email", "contact": "a@example.com", "time": "08:00", "consent": True},
    "viewPreference": "calm",
    "ageRange": "25-34",
    "pathModel": {"key": "old"},
}


def persist(db, prefs):
    with patch.object(onboarding, "get_supabase", lambda: db):
        onboarding._persist_preferences_to_supabase("u1", "a@example.com", prefs)
    return db.written["preferences"]


class PersistPreferencesTests(unittest.TestCase):
    def test_a_second_plan_keeps_everything_set_since_the_first(self):
        merged = persist(DB(dict(SAVED)), {"pathModel": {"key": "new"}, "ageRange": "35-44"})
        for key in ("checkin", "paused", "gamification", "character", "dreamGoals", "reminders", "viewPreference"):
            self.assertEqual(merged[key], SAVED[key], key)
        self.assertEqual(merged["pathModel"], {"key": "new"})
        self.assertEqual(merged["ageRange"], "35-44")

    def test_old_setup_defaults_do_not_reset_choices(self):
        # A page loaded before the change still sends setup's defaults.
        old_defaults = {
            "pathModel": None, "ageRange": "", "techSavvy": "", "viewPreference": "",
            "spiritAnimalMode": "general", "spiritAnimals": [],
            "reminders": {"enabled": False, "channel": "email", "contact": "", "time": "09:00", "consent": False},
        }
        merged = persist(DB(dict(SAVED)), old_defaults)
        self.assertEqual(merged["reminders"], SAVED["reminders"])
        self.assertEqual(merged["viewPreference"], "calm")
        self.assertEqual(merged["ageRange"], "25-34")      # an empty band never erases one
        self.assertIsNone(merged["pathModel"])              # the new plan has no model
        self.assertEqual(merged["spiritAnimalMode"], "general")  # new keys are filled in

    def test_first_plan_writes_what_setup_sends(self):
        merged = persist(DB(None), {"pathModel": None, "ageRange": "18-24"})
        self.assertEqual(merged, {"pathModel": None, "ageRange": "18-24"})

    def test_preferences_stored_as_text_are_read(self):
        merged = persist(DB(json.dumps({"checkin": {"optIn": True}})), {"ageRange": "18-24"})
        self.assertEqual(merged["checkin"], {"optIn": True})

    def test_nothing_sent_writes_nothing(self):
        db = DB(dict(SAVED))
        with patch.object(onboarding, "get_supabase", lambda: db):
            onboarding._persist_preferences_to_supabase("u1", "a@example.com", {})
        self.assertIsNone(db.written)


if __name__ == "__main__":
    unittest.main()
