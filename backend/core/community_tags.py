"""The community tags a shared starter model carries (Settings, Models, Community models), and a person's own, worked out
from what they told us at setup, so the two can be matched.

A model's tags are chosen by the person who shares it. A person's come from their onboarding answers: their norms
(user_barriers, every spelling folded to one condition by core/condition_taxonomy), who they're here for (supporting a
child, family member, friend or people they work with counts as "caregivers"), and the life areas of their goals
(career is "work", education is "students"). Onboarding answers are labels: good for matching a person to a model,
too thin to train one.

Used for three things (api/routes/adapters.py):
  match       how much of a model's community a person is part of, and which tags they share
  similarity  how alike two people's tags are, to weight ratings by people like you
  crowd       how many people share every tag of a model, so a rare combination that could point to its owner isn't
              shown publicly (see MIN_CROWD)
"""
from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

from core import condition_taxonomy

# (id, label). The order is the order they're shown in.
COMMUNITY_TAGS: List[Tuple[str, str]] = [
    ("autism", "Autism"), ("adhd", "ADHD"), ("dyspraxia", "Dyspraxia"), ("tourette", "Tourette"),
    ("dyslexia", "Dyslexia"), ("learning-disability", "Learning disability"),
    ("anxiety", "Anxiety"), ("depression", "Depression"), ("ocd", "OCD"), ("mental-health", "Mental health"),
    ("sensory-processing", "Sensory processing"), ("vision", "Vision"), ("hearing", "Hearing"),
    ("communication", "Communication"), ("intellectual-disability", "Intellectual disability"),
    ("chronic-illness", "Chronic illness"), ("physical-disability", "Physical disability"),
    ("low-income", "Low income"), ("newcomer", "Newcomers and language"), ("rural", "Rural"),
    ("lgbtq", "LGBTQ+"), ("racialized", "Racialized"),
    ("caregivers", "Parents, family and supporters"), ("students", "Students"), ("work", "Work"),
]
TAG_IDS = [tag for tag, _ in COMMUNITY_TAGS]
MAX_TAGS = 6
# A model's tags are shown to everyone only if at least this many people here share all of them (the owner included).
MIN_CROWD = 5

# A condition's key (core/condition_taxonomy) to its tags; then, for keys not listed, its category's.
_KEY_TAGS: Dict[str, Tuple[str, ...]] = {
    "autism": ("autism",), "adhd": ("adhd",), "audhd": ("autism", "adhd"), "tourette": ("tourette",),
    "coordination": ("dyspraxia",), "dyslexia": ("dyslexia",),
    "anxiety": ("anxiety",), "depression": ("depression",), "mood": ("depression",), "ocd": ("ocd",),
    "vision": ("vision",), "colour_blind": ("vision",), "hearing": ("hearing",),
    "low_income": ("low-income",), "housing": ("low-income",), "food": ("low-income",),
    "language": ("newcomer",), "immigrant": ("newcomer",), "rural": ("rural",),
    "lgbtq": ("lgbtq",), "gender_identity": ("lgbtq",), "visible_minority": ("racialized",),
    # Barriers with no tag of their own (and religious minority, which isn't one to put on a model).
    "transport": (), "tech_access": (), "first_gen": (), "religious_minority": (),
}
_CATEGORY_TAGS: Dict[str, Tuple[str, ...]] = {
    "learning": ("learning-disability",), "mental_health": ("mental-health",),
    "sensory_processing": ("sensory-processing",), "communication": ("communication",),
    "physical": ("physical-disability",), "intellectual_developmental": ("intellectual-disability",),
    "chronic_health": ("chronic-illness",),
}
# Who someone is here for (frontend lib/audiences.ts): supporting someone else.
_SUPPORTING = {"child", "family", "friend", "work"}
_AREA_TAGS = {"career": "work", "education": "students"}
# A goal's life area from its words when the person didn't say: the same words as frontend lib/goalCategories.ts
# guessGoalArea, for the two areas that are tags (education is checked first there too).
_AREA_WORDS = [
    ("education", re.compile(r"\b(graduat\w*|school|universit\w*|college|degree|diploma|stud(y|ies|ying)|course\w*|class(es)?|"
                             r"exams?|grades?|semester|tutor\w*|homework|learn a trade|apprentice\w*|masters?|phd|"
                             r"med(ical)? school|mcat|program|languages?|fluen(t|cy)|literacy|reading|math)\b", re.I)),
    ("career", re.compile(r"\b(jobs?|work(ing|place)?|career|business|interview\w*|resum[eé]s?|cv|employ\w*|intern(ship)?s?|"
                          r"promot\w*|hired?|hiring|salary|freelanc\w*|entrepreneur\w*|startup|volunteer\w*|coworkers?|"
                          r"boss)\b", re.I)),
]


def goal_areas(goals: Iterable[object], chosen: Optional[Dict[str, object]] = None) -> List[str]:
    """Each goal's life area: the one the person chose at setup (userProfile.goalCategories), else its words'."""
    chosen = chosen if isinstance(chosen, dict) else {}
    areas = []
    for goal in goals or ():
        text = str(goal or "").strip()
        area = chosen.get(text)
        if not isinstance(area, str):
            area = next((name for name, words in _AREA_WORDS if words.search(text)), "other")
        areas.append(area)
    return areas


def tags_for_condition(raw: object) -> Tuple[str, ...]:
    """The tags a stored barrier ("ADHD", "Autism spectrum disorder", "esl") stands for, or none."""
    normalized = condition_taxonomy.normalize_condition(raw)
    condition = normalized.condition
    if condition is None:
        return ()
    if condition.key in _KEY_TAGS:
        return _KEY_TAGS[condition.key]
    return _CATEGORY_TAGS.get(condition.category, ())


def person_tags(barriers: Iterable[object] = (), audience: Optional[str] = None,
                goal_areas: Iterable[str] = ()) -> Set[str]:
    """A person's tags from their onboarding answers: their norms, who they're here for, their goals' life areas."""
    tags: Set[str] = set()
    for raw in barriers or ():
        tags.update(tags_for_condition(raw))
    if (audience or "").strip().lower() in _SUPPORTING:
        tags.add("caregivers")
    for area in goal_areas or ():
        tag = _AREA_TAGS.get(str(area or "").strip().lower())
        if tag:
            tags.add(tag)
    return tags


def clean_tags(tags: Iterable[str]) -> List[str]:
    """Known tags only, each once, in the list's order."""
    wanted = {str(t) for t in tags or ()}
    return [tag for tag in TAG_IDS if tag in wanted]


def match(person: Set[str], model_tags: Sequence[str]) -> Tuple[float, List[str]]:
    """How much of a model's community this person is part of (the share of its tags they have), and which."""
    model = clean_tags(model_tags)
    shared = [tag for tag in model if tag in person]
    return (len(shared) / len(model) if model else 0.0), shared


def similarity(a: Set[str], b: Set[str]) -> float:
    """How alike two people's tags are: the tags they share over all the tags either has (0 to 1)."""
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def rating_for(person: Set[str], ratings: Iterable[Tuple[Set[str], int]]) -> Optional[float]:
    """The ratings, weighted towards people whose tags are like this person's. Everyone counts a little (0.2), and
    someone with exactly the same tags counts five times as much."""
    total = weight_sum = 0.0
    for rater, stars in ratings:
        weight = 0.2 + 0.8 * similarity(person, rater)
        total += weight * stars
        weight_sum += weight
    return round(total / weight_sum, 1) if weight_sum else None


def crowd(model_tags: Sequence[str], people: Iterable[Set[str]]) -> int:
    """How many people have every one of a model's tags."""
    wanted = set(clean_tags(model_tags))
    if not wanted:
        return 0
    return sum(1 for tags in people if wanted <= tags)
