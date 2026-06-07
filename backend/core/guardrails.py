"""
Input guardrails for goal validation.

Rejects goals (and barriers, dreams, challenges) containing content that the
system should never plan around. Returns a rejection reason or None if the
input is acceptable.

Policy categories (ordered):
 1. Slurs / hate speech
 2. Political figures
 3. Religion (proselytization framing — but "find a faith community" is OK)
 4. Obscene / criminal jobs
 5. Antisemitic / "goy" references
 6. Non-human identity (animals)
 7. Culture-as-identity framing
 8. Objects-as-identity
 9. Race-as-goal framing
10. Self-harm / physical harm
"""

import re
from typing import List, Optional, Tuple

# ---------------------------------------------------------------------------
# Blocklists — lowercase, checked against lowercased input
# ---------------------------------------------------------------------------

_SLURS: set = {
    # Racial / ethnic slurs
    "nigger", "nigga", "spic", "wetback", "kike", "chink", "gook", "raghead",
    "towelhead", "beaner", "coon", "darkie", "paki", "wop", "dago",
    # Homophobic / transphobic
    "faggot", "fag", "tranny", "dyke",
    # Ableist
    "retard", "retarded",
}

_POLITICAL_FIGURES: set = {
    "adolf hitler", "hitler", "mussolini", "osama bin laden", "bin laden",
    "charlie kirk", "richard spencer", "david duke", "nick fuentes",
    "pol pot", "idi amin", "joseph stalin", "stalin",
}

_OBSCENE_CRIMINAL_JOBS: set = {
    "porn star", "pornstar", "prostitute", "escort", "stripper",
    "drug dealer", "drug lord", "drug trafficker", "hitman", "assassin",
    "pimp", "sex worker", "cam girl", "camgirl", "onlyfans model",
    "cartel boss", "arms dealer",
}

_ANTISEMITIC_TERMS: set = {
    "goy", "goyim", "goyish",
}

_ANIMAL_PATTERNS = re.compile(
    r"\b(?:i\s+want\s+to\s+be\s+(?:a\s+)?(?:dog|cat|bird|fish|snake|horse|"
    r"monkey|cow|pig|wolf|fox|bear|deer|rabbit|hamster|rat|animal|furry))\b",
    re.IGNORECASE,
)

_OBJECT_PATTERNS = re.compile(
    r"\b(?:i\s+want\s+to\s+be\s+(?:a\s+)?(?:brick|rock|stone|wall|chair|table|"
    r"tree|lamp|car|robot|machine|object|thing|toaster|pencil))\b",
    re.IGNORECASE,
)

_RACE_AS_GOAL = re.compile(
    r"\b(?:i\s+want\s+to\s+be\s+(?:a\s+)?(?:black|white|asian|hispanic|latino|"
    r"latina|arab|indian|native|indigenous|african|caucasian))\b",
    re.IGNORECASE,
)

_SELF_HARM = re.compile(
    r"\b(?:commit\s+suicide|kill\s+myself|end\s+my\s+life|self[\s-]?harm|"
    r"cut\s+myself|hang\s+myself|overdose|shoot\s+myself|jump\s+off|"
    r"want\s+to\s+die|slit\s+my\s+wrist|starve\s+myself)\b",
    re.IGNORECASE,
)

_HARM_OTHERS = re.compile(
    r"\b(?:kill\s+(?:someone|people|him|her|them|everybody|everyone)|"
    r"murder|shoot\s+up|bomb|mass\s+shooting|school\s+shooting|"
    r"terrorist|terrorism|blow\s+up)\b",
    re.IGNORECASE,
)

_PROFANITY = re.compile(
    r"\b(?:fuck(?:ing|ed|er|s)?|shit(?:ty|s)?|bitch(?:es)?|ass(?:hole)?|damn|"
    r"cunt|dick|cock|pussy|bastard|whore|slut|bollocks|wanker|twat)\b",
    re.IGNORECASE,
)

# Max allowed length for a single goal string
_MAX_GOAL_LENGTH = 500

# Max number of goals allowed per submission
_MAX_GOALS_COUNT = 10


def validate_text(text: str) -> Optional[str]:
    """Validate a single text input (goal, dream, challenge).

    Returns a rejection reason string, or None if acceptable.
    """
    if not text or not text.strip():
        return None  # empty is fine — handled elsewhere

    lower = text.lower().strip()

    # Length check
    if len(text) > _MAX_GOAL_LENGTH:
        return "Goal is too long (max 500 characters)."

    # 1. Slurs
    words = set(re.findall(r"[a-z']+", lower))
    if words & _SLURS:
        return "Your input contains language that isn't appropriate for goal planning."

    # 2. Political figures
    for figure in _POLITICAL_FIGURES:
        if figure in lower:
            return "Goals involving political figures aren't supported."

    # 5. Antisemitic terms (checked before general culture to catch specifically)
    for term in _ANTISEMITIC_TERMS:
        if re.search(rf"\b{re.escape(term)}\b", lower):
            return "This type of content isn't supported."

    # 4. Obscene / criminal jobs
    for job in _OBSCENE_CRIMINAL_JOBS:
        if job in lower:
            return "Goals involving illegal or obscene occupations aren't supported."

    # 6. Animals as identity
    if _ANIMAL_PATTERNS.search(text):
        return "Goals must relate to achievable human outcomes."

    # 8. Objects as identity
    if _OBJECT_PATTERNS.search(text):
        return "Goals must relate to achievable human outcomes."

    # 9. Race as goal
    if _RACE_AS_GOAL.search(text):
        return "Goals involving changing race aren't supported."

    # 10. Self-harm / harming others
    if _SELF_HARM.search(text):
        return (
            "It sounds like you may be going through a difficult time. "
            "Please reach out to the 988 Suicide & Crisis Lifeline (call or text 988)."
        )
    if _HARM_OTHERS.search(text):
        return "Goals involving harming others aren't supported."

    # Profanity filter (soft block)
    if _PROFANITY.search(text):
        return "Please rephrase your goal without profanity."

    return None


def validate_goals(goals: List[str]) -> Tuple[bool, Optional[str]]:
    """Validate an entire goals list.

    Returns (is_valid, rejection_reason).
    """
    if len(goals) > _MAX_GOALS_COUNT:
        return False, f"Too many goals (max {_MAX_GOALS_COUNT})."

    for goal in goals:
        reason = validate_text(goal)
        if reason:
            return False, reason

    return True, None


def validate_all_inputs(
    goals: List[str],
    barriers: List[str],
    dreams: List[str] = None,
    challenges: List[str] = None,
) -> Tuple[bool, Optional[str]]:
    """Validate all user-submitted text fields at once.

    Returns (is_valid, rejection_reason).
    """
    all_texts = list(goals)
    all_texts.extend(barriers or [])
    all_texts.extend(dreams or [])
    all_texts.extend(challenges or [])

    if len(goals) > _MAX_GOALS_COUNT:
        return False, f"Too many goals (max {_MAX_GOALS_COUNT})."

    for text in all_texts:
        reason = validate_text(text)
        if reason:
            return False, reason

    return True, None
