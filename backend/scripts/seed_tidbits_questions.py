"""Start Tidbits off with a few questions, openly from the Autinerary team.

Tidbits had one real question, so Start here offers it as a place to ask
rather than a library of answers (docs/start-here.md). These questions give
new people something to answer, one for each of Start here's needs: starter
information, school or work, sensory tools, services, and planning.

They are posted by an "Autinerary team" account (aayush+team@autinerary.ca,
so mail to it reaches the team), never as if from a member. The account has
no password anyone knows; set one from the Supabase dashboard (Authentication
> Users) to answer as the team. Safe to re-run: the account is reused, and a
question already posted is not posted again.

Run from backend/:
  python -m scripts.seed_tidbits_questions           # show what would be posted
  python -m scripts.seed_tidbits_questions --apply   # post them
"""
from __future__ import annotations

import argparse
import secrets
import sys
from pathlib import Path

TEAM_EMAIL = "aayush+team@autinerary.ca"
TEAM_NAME = "Autinerary team"
TEAM_BIO = "The team behind Autinerary. We post questions to get Tidbits started; your answers help the next person most."

QUESTIONS = [
    {
        "title": "What helped most in your first weeks after a diagnosis?",
        "body_markdown": (
            "If you, your child or someone close to you was diagnosed with autism, ADHD or something else, "
            "what helped most in the first few weeks? A person, a book, a group, a routine, a website?\n\n"
            "Answers from your own experience help the next person most. (Posted by the Autinerary team to get "
            "Tidbits started.)"
        ),
        "barrier_tags": ["autism", "adhd"],
        "category_tags": ["getting-started"],
    },
    {
        "title": "How did you ask for accommodations at work or school?",
        "body_markdown": (
            "Asking for accommodations can be hard. What did you say, who did you ask, and what made it go well, "
            "or not? Examples of accommodations that made a real difference are welcome too.\n\n"
            "(Posted by the Autinerary team to get Tidbits started.)"
        ),
        "barrier_tags": [],
        "category_tags": ["employment", "education"],
    },
    {
        "title": "What makes busy or loud places easier for you?",
        "body_markdown": (
            "Noise, bright light, crowds: what do you bring, do or plan before going somewhere busy? "
            "Small tricks count.\n\n(Posted by the Autinerary team to get Tidbits started.)"
        ),
        "barrier_tags": ["sensory"],
        "category_tags": ["daily-living"],
    },
    {
        "title": "Parents: how did you find services for your child when you were starting out?",
        "body_markdown": (
            "Where did you look first, what turned out to be useful, and what do you wish someone had told you "
            "sooner? Your answer could save another parent weeks.\n\n"
            "(Posted by the Autinerary team to get Tidbits started.)"
        ),
        "barrier_tags": [],
        "category_tags": ["services", "parenting"],
    },
    {
        "title": "How do you plan around low-energy days?",
        "body_markdown": (
            "Some days there is less in the tank. How do you decide what still gets done and what can wait? "
            "What helps you get going again afterwards?\n\n"
            "(Posted by the Autinerary team to get Tidbits started.)"
        ),
        "barrier_tags": [],
        "category_tags": ["planning", "daily-living"],
    },
]


def team_user_id(sb, create: bool):
    """The team account's id, creating it if asked. None if it does not exist."""
    found = sb.table("profiles").select("id").eq("email", TEAM_EMAIL).execute().data
    if found:
        return found[0]["id"]
    if not create:
        return None
    # A password nobody knows; the team sets one from the dashboard if needed.
    res = sb.auth.admin.create_user({
        "email": TEAM_EMAIL,
        "password": secrets.token_urlsafe(32),
        "email_confirm": True,
        "user_metadata": {"full_name": TEAM_NAME, "name": TEAM_NAME},
    })
    return res.user.id


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="post the questions")
    args = ap.parse_args()

    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    from database.supabase_client import get_supabase
    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return 1

    user_id = team_user_id(sb, create=args.apply)
    if user_id:
        sb.table("profiles").upsert({"id": user_id, "email": TEAM_EMAIL, "display_name": TEAM_NAME,
                                     "full_name": TEAM_NAME}, on_conflict="id").execute()
        sb.table("community_profiles").upsert({"user_id": user_id, "pseudonym": TEAM_NAME, "bio": TEAM_BIO,
                                               "is_public": True}, on_conflict="user_id").execute()
    posted = set()
    if user_id:
        rows = sb.table("community_posts").select("title").eq("author_id", user_id).execute().data or []
        posted = {r["title"] for r in rows}

    for q in QUESTIONS:
        if q["title"] in posted:
            print(f"  already posted: {q['title']}")
            continue
        if not args.apply:
            print(f"  would post: {q['title']}")
            continue
        sb.table("community_posts").insert({
            "author_id": user_id, **q, "image_urls": [],
            "author_relationships": {}, "author_weight": 1.0,
        }).execute()
        print(f"  posted: {q['title']}")
    if not args.apply:
        print(f"Dry run, as {TEAM_NAME} <{TEAM_EMAIL}>. Run with --apply to post.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
