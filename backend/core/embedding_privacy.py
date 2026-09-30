"""What leaves the system when a profile is embedded.

Pattern Recognition sends text to OpenAI's embedding API for every indexed
user and every search. That text used to be

    f"barriers: {barriers}. goals: {goals}. profile: {profile}"

where `profile` was the whole onboarding dict -- email and user id included,
plus dreams, current challenges and seven free-text support fields. So every
indexed user's email address went to a third party inside their embedding
request, alongside their conditions.

This module builds the replacement: a short, persona-style summary made only
from fields that are either closed vocabularies or have been reduced to one.

    conditions   normalised via core.condition_taxonomy; rare conditions,
                 protected characteristics and socioeconomic circumstances are
                 sent as their category, never by name
    goals        reduced to allow-listed words plus a goal area; anything not
                 on the list (place names, institutions, people, typos, free
                 text) is dropped
    age band     only if it is one of the app's own coarse bands
    motivation   only if it is one of the app's own options

Everything else in the profile is deliberately NOT sent: email, id, dates,
dreams, current challenges, support-context free text, preferences. Those
remain stored in our own database exactly as before -- only the outbound text
changes.

The output is deterministic (sorted, de-duplicated), so the same profile always
produces the same text and therefore the same vector.

Bump EMBEDDING_TEXT_VERSION whenever the output of build_embedding_text changes
for any input: vectors built from different text are not comparable, and the
version is how stored rows record which text they came from.
"""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional, Tuple

from core.condition_taxonomy import normalize_conditions

EMBEDDING_TEXT_VERSION = "anon-v1"

AGE_BANDS = {"18-24", "25-40", "18-40", "40-65", "65+"}
MOTIVATIONS = {"achievement", "curiosity", "intrinsic", "social", "reward", "deadline"}

# Goal words that carry meaning without identifying anyone. A word earns a
# place here by being generic -- the question is never "is this useful?" but
# "could this word name a specific person, place or organisation?". Institution
# and place names (e.g. a university's name) are left out on purpose; the
# word "university" survives, which city it is in does not.
GOAL_AREAS: Dict[str, List[str]] = {
    "education": [
        "graduate", "graduation", "graduating", "university", "uni", "college",
        "school", "undergrad", "undergraduate", "masters", "master's", "phd",
        "degree", "diploma", "study", "studying", "studies", "grades", "gpa",
        "exam", "exams", "testing", "class", "classes", "course", "courses",
        "homework", "learn", "learning", "language", "languages", "reading",
        "math", "science", "program", "admission", "admissions", "scholarship",
        "tutoring", "academic", "education", "medical", "med", "nursing",
        "lab", "research",
    ],
    "career": [
        "job", "jobs", "work", "working", "career", "careers", "employment",
        "employed", "business", "entrepreneur", "administration", "role",
        "experience", "internship", "interview", "interviews", "resume",
        "promotion", "teach", "teaching", "teacher", "students", "volunteer",
        "volunteering", "income", "salary", "workplace", "professional",
        "presentation", "presentations",
    ],
    "relationships": [
        "friend", "friends", "friendship", "family", "parents", "partner",
        "dating", "relationship", "relationships", "social", "community",
        "network", "support", "catch-up", "shared", "communication",
        "communicate", "conversation", "conversations", "connect", "connection",
        "people", "group", "join",
    ],
    "wellbeing": [
        "normalizing", "normalising", "positivity", "focus", "time-management",
        "routine", "routines", "habit", "habits", "sleep", "stress", "calm",
        "confidence", "mindfulness", "gym", "exercise", "fitness", "health",
        "healthy", "strategies", "organize", "organise", "organization",
        "organisation", "planning", "motivation", "wellbeing", "wellness",
        "mental", "therapy", "anxiety", "depression", "adhd", "adhd-friendly",
        "ocd", "autism", "sensory",
    ],
    "independent_living": [
        "live", "living", "independently", "independent", "independence",
        "budget", "budgeting", "money", "finances", "financial", "cook",
        "cooking", "meal", "meals", "groceries", "cleaning", "apartment",
        "housing", "move", "moving", "drive", "driving", "license", "transit",
        "errands", "chores",
    ],
    "creative": [
        "artist", "art", "arts", "gallery", "creative", "creativity", "hobby",
        "hobbies", "music", "musician", "band", "rhythm", "drawing", "painting",
        "photography", "craft", "crafts", "design", "writing", "writer",
        "instrument", "guitar", "piano", "dance", "acting", "theatre",
    ],
    "self_advocacy": [
        "self-advocacy", "advocate", "advocacy", "accommodations",
        "accommodation", "rights", "disclosure",
    ],
}

# word -> area. Built once; a word appears in exactly one area.
_WORD_AREA: Dict[str, str] = {}
for _area, _words in GOAL_AREAS.items():
    for _w in _words:
        assert _w not in _WORD_AREA, f"goal word listed twice: {_w}"
        _WORD_AREA[_w] = _area

# Tie-break when a goal's words point at several areas equally.
_AREA_PRIORITY = ["career", "education", "independent_living", "relationships",
                  "creative", "self_advocacy", "wellbeing"]

_WORD_RE = re.compile(r"[a-z][a-z'\-]*")


def _goal_words(goal: str) -> List[str]:
    """Allow-listed words from one goal, in order, de-duplicated.

    Hyphenated words are tried whole first ("time-management"), then split, so
    a known compound survives and an unknown one still yields its known parts.
    """
    out: List[str] = []
    for tok in _WORD_RE.findall(str(goal or "").casefold()):
        tok = tok.strip("'-")
        candidates = [tok] if tok in _WORD_AREA else tok.split("-")
        for c in candidates:
            if c in _WORD_AREA and c not in out:
                out.append(c)
    return out


def summarize_goal(goal: str) -> Optional[Tuple[str, List[str]]]:
    """(area, words) for one goal, or None if nothing generic survives."""
    words = _goal_words(goal)
    if not words:
        return None
    votes: Dict[str, int] = {}
    for w in words:
        votes[_WORD_AREA[w]] = votes.get(_WORD_AREA[w], 0) + 1
    best = max(votes.values())
    area = next(a for a in _AREA_PRIORITY if votes.get(a) == best)
    return area, sorted(words)


def build_barriers_text(barriers: Iterable[object]) -> str:
    """The conditions part of the outbound text, on its own.

    Also used for the per-field embedding experiment, which is why it is a
    separate function: split and concatenated embeddings must be built from
    the same anonymised pieces or the comparison is not like for like.
    """
    conditions, counts = normalize_conditions(list(barriers or []))
    phrases = sorted({c.outbound_phrase() for c in conditions})
    if counts["free_text"]:
        phrases.append("a self-described difference")
    if not phrases:
        return "conditions: none shared"
    return "conditions: " + "; ".join(phrases)


def build_goals_text(goals: Iterable[object]) -> str:
    """The goals part of the outbound text, on its own."""
    by_area: Dict[str, set] = {}
    for g in goals or []:
        s = summarize_goal(str(g))
        if s:
            area, words = s
            by_area.setdefault(area, set()).update(words)
    if not by_area:
        return "goals: personal goals"
    parts = [f"{area.replace('_', ' ')} ({', '.join(sorted(words))})"
             for area, words in sorted(by_area.items())]
    return "goals: " + "; ".join(parts)


def _age_band(profile: dict) -> Optional[str]:
    for source in (profile.get("preferences") or {}, profile.get("demographics") or {}):
        if isinstance(source, dict):
            band = str(source.get("ageRange") or "").strip()
            if band in AGE_BANDS:
                return band
    return None


def build_embedding_text(barriers, goals, profile: Optional[dict] = None) -> str:
    """The only text Pattern Recognition sends out for embedding."""
    profile = profile if isinstance(profile, dict) else {}
    parts = [build_barriers_text(barriers), build_goals_text(goals)]
    band = _age_band(profile)
    if band:
        parts.append(f"age band: {band}")
    motivation = str(profile.get("motivationType") or "").strip().casefold()
    if motivation in MOTIVATIONS:
        parts.append(f"motivation: {motivation}")
    return ". ".join(parts) + "."


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
_UUID_RE = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I)
_DATE_RE = re.compile(r"\b\d{4}-\d{2}-\d{2}")


def audit_embedding_text(text: str) -> List[str]:
    """Problems found in outbound text; empty means it passed.

    Checks for the things that must never leave: email addresses, UUIDs,
    ISO dates, and any word that is not generated by this module's own closed
    vocabularies. The last check is the one that matters -- it proves the
    output is built only from allow-listed material, so a name typed into a
    goal cannot slip through a gap in the pattern checks.
    """
    problems = []
    if _EMAIL_RE.search(text):
        problems.append("email address")
    if _UUID_RE.search(text):
        problems.append("uuid")
    if _DATE_RE.search(text):
        problems.append("date")
    allowed = _allowed_output_words()
    for w in re.findall(r"[a-z0-9+/'\-]+", text.casefold()):
        if w not in allowed:
            problems.append(f"unexpected word: {w!r}")
    return problems


_ALLOWED_CACHE: Optional[set] = None


def _allowed_output_words() -> set:
    global _ALLOWED_CACHE
    if _ALLOWED_CACHE is None:
        from core.condition_taxonomy import CATEGORY_PHRASES, CONDITIONS
        words = set(_WORD_AREA)
        words |= {a.replace("_", " ") for a in GOAL_AREAS}
        for phrase in list(CATEGORY_PHRASES.values()) + [c.label for c in CONDITIONS.values()]:
            words |= set(re.findall(r"[a-z0-9+/'\-]+", phrase.casefold()))
        words |= set(" ".join(a.replace("_", " ") for a in GOAL_AREAS).split())
        words |= set(" ".join(AGE_BANDS).split()) | MOTIVATIONS
        words |= {"conditions", "none", "shared", "goals", "personal", "goals",
                  "age", "band", "motivation", "a", "self-described", "difference"}
        _ALLOWED_CACHE = words
    return _ALLOWED_CACHE
