"""One vocabulary for the conditions people record, so the same thing is always
the same thing.

`user_barriers.barrier_type` holds 92 distinct strings today, and many of them
are one condition spelled several ways: "ADHD" / "adhd", "autism" / "Autism" /
"Autism spectrum disorder", "OCD" / "Obsessive-compulsive and related
conditions". Two onboarding flows wrote different labels, the synthetic
generator wrote a third set, and "Other (specify)" accepts free text. Anything
that compares people by condition -- embeddings, engineered features, the
synthetic-data fidelity check -- sees those as different values unless they are
normalised first.

Each known label maps to a canonical key, a broad category, and whether the
specific name may leave the system (see `share_specific`). Anything not in the
table is treated as free text: it is never passed through verbatim, because the
free-text field has already received a prompt-injection attempt from a real
user, and because free text can name a school, an employer or a person.

This is vocabulary, not agent output. Add aliases here as new labels appear;
`normalize_condition` returning a `free_text` result is the signal to do so.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple

# Category -> the phrase used for it when the specific condition is withheld.
CATEGORY_PHRASES: Dict[str, str] = {
    "neurodevelopmental": "a neurodevelopmental difference",
    "learning": "a learning difference",
    "mental_health": "a mental health condition",
    "sensory_processing": "a sensory processing difference",
    "communication": "a communication difference",
    "sensory_disability": "a sensory disability",
    "physical": "a physical disability",
    "intellectual_developmental": "an intellectual or developmental disability",
    "chronic_health": "a chronic health condition",
    "socioeconomic": "a socioeconomic or access barrier",
    "language": "a language barrier",
    "identity": "an identity-related barrier",
    "self_described": "a self-described difference",
}

# Placeholder answers, not conditions.
NON_CONDITIONS = {"none", "undisclosed"}


@dataclass(frozen=True)
class Condition:
    """A normalised condition.

    share_specific: whether the specific name may appear in text sent to a
        third party. True only for conditions common in the general population
        (roughly 1% or more). Rare conditions are quasi-identifiers in a cohort
        this size -- one person with a named rare genetic syndrome is findable --
        so they are sent as their category. Protected characteristics (race,
        sexuality, gender identity, religion, immigration status) and
        socioeconomic circumstances are always sent as their category.

    The prevalence cut is a first pass for review, not a clinical claim.
    """

    key: str
    label: str
    category: str
    share_specific: bool

    def outbound_phrase(self) -> str:
        return self.label if self.share_specific else CATEGORY_PHRASES[self.category]


def _c(key, label, category, share=True):
    return Condition(key, label, category, share)


# canonical key -> Condition
CONDITIONS: Dict[str, Condition] = {c.key: c for c in [
    # Neurodevelopmental
    _c("autism", "autism", "neurodevelopmental"),
    _c("adhd", "ADHD", "neurodevelopmental"),
    _c("audhd", "autism and ADHD", "neurodevelopmental"),
    _c("tourette", "Tourette syndrome", "neurodevelopmental", share=False),
    _c("coordination", "a coordination difference", "neurodevelopmental"),
    # Learning
    _c("dyslexia", "dyslexia", "learning"),
    _c("dyscalculia", "dyscalculia", "learning"),
    _c("dysgraphia", "dysgraphia", "learning"),
    _c("nvld", "a nonverbal learning difference", "learning", share=False),
    # Mental health
    _c("anxiety", "anxiety", "mental_health"),
    _c("depression", "depression", "mental_health"),
    _c("ocd", "OCD", "mental_health"),
    _c("ptsd", "PTSD", "mental_health"),
    _c("mood", "a mood disorder", "mental_health"),
    _c("bipolar", "bipolar disorder", "mental_health"),
    _c("sleep", "a sleep disorder", "mental_health"),
    _c("psychotic", "a psychotic disorder", "mental_health", share=False),
    _c("personality", "a personality disorder", "mental_health", share=False),
    # Sensory processing
    _c("sensory_processing", "sensory processing differences", "sensory_processing"),
    _c("auditory_processing", "auditory processing differences", "sensory_processing"),
    _c("misophonia", "misophonia", "sensory_processing"),
    _c("hyperacusis", "hyperacusis", "sensory_processing"),
    _c("synesthesia", "synesthesia", "sensory_processing"),
    # Communication
    _c("communication", "a communication disorder", "communication"),
    _c("speech", "a speech disability", "communication"),
    _c("selective_mutism", "selective mutism", "communication", share=False),
    _c("nonspeaking", "being nonspeaking", "communication", share=False),
    _c("aac", "using AAC", "communication", share=False),
    # Sensory disability
    _c("vision", "a vision disability", "sensory_disability"),
    _c("hearing", "a hearing disability", "sensory_disability"),
    _c("colour_blind", "colour blindness", "sensory_disability"),
    # Physical
    _c("mobility", "a mobility disability", "physical"),
    _c("wheelchair", "using a wheelchair", "physical"),
    _c("muscular_dystrophy", "muscular dystrophy", "physical", share=False),
    # Intellectual / developmental
    _c("intellectual", "an intellectual disability", "intellectual_developmental"),
    _c("cognitive", "cognitive differences", "learning"),
    _c("down_syndrome", "Down syndrome", "intellectual_developmental", share=False),
    _c("fragile_x", "fragile X syndrome", "intellectual_developmental", share=False),
    _c("williams", "Williams syndrome", "intellectual_developmental", share=False),
    # Chronic health
    _c("chronic_illness", "a chronic illness", "chronic_health"),
    _c("autoimmune", "an autoimmune condition", "chronic_health"),
    _c("chronic_pain", "chronic pain", "chronic_health"),
    _c("epilepsy", "epilepsy", "chronic_health"),
    _c("brain_injury", "an acquired brain injury", "chronic_health", share=False),
    _c("eds", "Ehlers-Danlos syndrome", "chronic_health", share=False),
    _c("me_cfs", "ME/CFS", "chronic_health", share=False),
    _c("rare_genetic", "a rare or genetic condition", "chronic_health", share=False),
    # Socioeconomic and access -- always sent as the category
    _c("low_income", "limited income", "socioeconomic", share=False),
    _c("housing", "housing instability", "socioeconomic", share=False),
    _c("food", "food insecurity", "socioeconomic", share=False),
    _c("transport", "a transportation barrier", "socioeconomic", share=False),
    _c("tech_access", "limited technology access", "socioeconomic", share=False),
    _c("first_gen", "being first generation", "socioeconomic", share=False),
    _c("rural", "living rurally", "socioeconomic", share=False),
    # Language
    _c("language", "a language barrier", "language"),
    # Identity -- protected characteristics, always sent as the category
    _c("visible_minority", "being a visible minority", "identity", share=False),
    _c("lgbtq", "being LGBTQ+", "identity", share=False),
    _c("gender_identity", "gender identity", "identity", share=False),
    _c("religious_minority", "being a religious minority", "identity", share=False),
    _c("immigrant", "being an immigrant or refugee", "identity", share=False),
]}


def _norm(s: str) -> str:
    """Casefold, unify separators, collapse whitespace."""
    s = str(s or "").casefold().strip()
    s = s.replace("_", " ").replace("/", " / ")
    s = re.sub(r"[()]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# normalised raw label -> canonical key (or a NON_CONDITIONS marker)
_ALIASES: Dict[str, str] = {}


def _alias(key: str, *labels: str) -> None:
    for label in labels:
        _ALIASES[_norm(label)] = key


_alias("autism", "autism", "autism spectrum", "autism spectrum disorder", "asd", "autistic")
_alias("adhd", "adhd", "add", "attention deficit hyperactivity disorder")
_alias("audhd", "audhd", "autism + adhd", "autism and adhd")
_alias("tourette", "tourette", "tourette syndrome", "tourettes")
_alias("coordination", "developmental coordination disorder", "dyspraxia")
_alias("dyslexia", "dyslexia", "reading disorder")
_alias("dyscalculia", "dyscalculia", "mathematics disorder", "math disorder")
_alias("dysgraphia", "dysgraphia", "written expression disorder")
_alias("nvld", "nonverbal learning disorder", "nvld")
_alias("anxiety", "anxiety", "anxiety disorder", "anxiety disorders")
_alias("depression", "depression", "major depression")
_alias("ocd", "ocd", "obsessive-compulsive and related conditions",
       "obsessive compulsive disorder", "obsessive-compulsive disorder")
_alias("ptsd", "ptsd", "post-traumatic stress disorder")
_alias("mood", "mood disorders", "mood disorder")
_alias("bipolar", "bipolar", "bipolar disorder")
_alias("sleep", "sleep disorder", "sleep disorders")
_alias("psychotic", "psychotic disorders", "psychotic disorder")
_alias("personality", "cluster a", "cluster b", "cluster c", "personality disorder")
_alias("sensory_processing", "sensory", "sensory processing differences",
       "sensory processing disorder")
_alias("auditory_processing", "auditory processing disorder", "auditory processing differences")
_alias("misophonia", "misophonia")
_alias("hyperacusis", "hyperacusis")
_alias("synesthesia", "synesthesia", "synaesthesia")
_alias("communication", "communication", "communication disorders", "communication disorder")
_alias("speech", "speech disability")
_alias("selective_mutism", "selectively speaking", "selective mutism")
_alias("nonspeaking", "nonspeaking", "non-speaking")
_alias("aac", "aac user")
_alias("vision", "vision disability", "visual impairment", "blind or low vision", "sensory blind")
_alias("hearing", "hearing disability", "hearing impairment", "deaf or hard of hearing", "sensory deaf")
_alias("colour_blind", "color blind", "colour blind", "color blindness")
_alias("mobility", "mobility", "mobility challenges", "physical mobility")
_alias("wheelchair", "wheelchair user", "physical wheelchair")
_alias("muscular_dystrophy", "muscular dystrophy")
_alias("intellectual", "intellectual", "intellectual disability", "intellectual disabilities")
_alias("cognitive", "cognitive")
_alias("down_syndrome", "down syndrome")
_alias("fragile_x", "fragile x syndrome")
_alias("williams", "williams syndrome")
_alias("chronic_illness", "chronic illness", "chronic health", "chronic health conditions")
_alias("autoimmune", "autoimmune condition", "autoimmune disorder")
_alias("chronic_pain", "other chronic pain condition", "chronic pain")
_alias("epilepsy", "epilepsy")
_alias("brain_injury", "acquired brain injury")
_alias("eds", "ehlers-danlos syndrome")
_alias("me_cfs", "me / cfs", "me/cfs", "chronic fatigue syndrome")
_alias("rare_genetic", "other rare or genetic condition")
_alias("low_income", "low income", "limited income", "socioeconomic")
_alias("housing", "housing instability")
_alias("food", "food insecurity")
_alias("transport", "transportation barrier")
_alias("tech_access", "limited technology access")
_alias("first_gen", "first generation")
_alias("rural", "rural / remote area", "rural")
_alias("language", "esl", "english as an additional language", "language barrier", "language")
_alias("visible_minority", "visible minority", "racialized person visible minority",
       "race / visible minority", "race visible minority", "ethnicity")
_alias("lgbtq", "lgbtq+", "lgbtq")
_alias("gender_identity", "gender identity", "gender")
_alias("religious_minority", "religious minority")
_alias("immigrant", "immigrant / refugee", "immigrant", "refugee")
_alias("social", "social")
_alias("none", "no current barriers", "none")
_alias("undisclosed", "prefer not to share")

# "social" was written by an early flow as a barrier type. It is a support
# need rather than a condition; treat it as a communication difference.
CONDITIONS["social"] = _c("social", "social communication differences", "communication")


@dataclass(frozen=True)
class NormalizedCondition:
    """Result of normalising one raw label."""

    condition: Optional[Condition]  # None for placeholders and free text
    kind: str  # "known" | "none" | "undisclosed" | "free_text" | "empty"


def normalize_condition(raw: object) -> NormalizedCondition:
    n = _norm(str(raw or ""))
    if not n:
        return NormalizedCondition(None, "empty")
    key = _ALIASES.get(n)
    if key in NON_CONDITIONS:
        return NormalizedCondition(None, key)
    if key:
        return NormalizedCondition(CONDITIONS[key], "known")
    return NormalizedCondition(None, "free_text")


def normalize_conditions(raw_list) -> Tuple[List[Condition], Dict[str, int]]:
    """Normalise a list, de-duplicating. Returns (conditions, counts by kind)."""
    seen, out = set(), []
    counts = {"known": 0, "none": 0, "undisclosed": 0, "free_text": 0, "empty": 0}
    for raw in raw_list or []:
        r = normalize_condition(raw)
        counts[r.kind] += 1
        if r.condition and r.condition.key not in seen:
            seen.add(r.condition.key)
            out.append(r.condition)
    out.sort(key=lambda c: c.key)
    return out, counts


# Prefix for free-text keys, so a typed label can never collide with a
# canonical key (e.g. a user typing "eds" is not the same as the key "eds").
FREE_TEXT_KEY_PREFIX = "text:"


def match_keys(raw_list) -> Set[str]:
    """Keys two people must share to count as having a condition in common.

    Known conditions map to their canonical key, so "ADHD", "adhd" and
    "Attention Deficit Hyperactivity Disorder" all match each other. Free text
    matches only the same text after normalising case and spacing, which is
    what the exact-string filter did before, minus the case sensitivity.

    Placeholders ("Prefer not to share", "No current barriers") and blanks
    produce no key: two people who both declined to answer have nothing in
    common on this basis.
    """
    keys: Set[str] = set()
    for raw in raw_list or []:
        r = normalize_condition(raw)
        if r.condition:
            keys.add(r.condition.key)
        elif r.kind == "free_text":
            keys.add(FREE_TEXT_KEY_PREFIX + _norm(str(raw)))
    return keys
