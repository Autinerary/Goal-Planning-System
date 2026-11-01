"""Scrubbing a person's own writing before it goes into a training set (Settings, Models, "Build my training set").

What has a shape is found by pattern: email addresses, links and @handles, phone numbers, ID numbers, street
addresses and postal codes, and dates of birth (a date after "born", "birthday", "DOB" or "date of birth"). Diagnosis
terms and medicines come from word lists, and "diagnosed with ..." catches conditions the list doesn't have. Names,
schools and employers are found by cue ("my therapist Dana", "Dr. Okafor", "I work at ...", "I study at ..."), by the
person's own name from their profile, and, where spaCy and its small English model are installed, by spaCy's
named-entity recogniser, which finds the names and organisations the cues miss. Each find becomes a neutral
placeholder: [NAME], [SCHOOL], [DIAGNOSIS] and so on.

It finds a lot, not everything, and the page says so: the person reads every item, and can edit or drop it, before
anything is kept. Nothing here stores, logs or sends text anywhere; it's a function of its input.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

SCRUBBER_VERSION = "2026-10-31.1"

PLACEHOLDERS: Dict[str, str] = {
    "email": "[EMAIL]",
    "link": "[LINK]",
    "phone": "[PHONE]",
    "id_number": "[ID_NUMBER]",
    "address": "[ADDRESS]",
    "date_of_birth": "[DATE_OF_BIRTH]",
    "diagnosis": "[DIAGNOSIS]",
    "medication": "[MEDICATION]",
    "school": "[SCHOOL]",
    "employer": "[EMPLOYER]",
    "name": "[NAME]",
    "organization": "[ORGANIZATION]",
}
# Two finds of the same length over the same words: the one earlier here wins.
_PRIORITY = {kind: i for i, kind in enumerate(PLACEHOLDERS)}

MAX_TEXT_CHARS = 20_000

# ---- What has a shape ---------------------------------------------------------------------------------------------

_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
_LINK = re.compile(r"\b(?:https?://|www\.)[^\s<>\"]*[^\s<>\".,;:!?)\]]")
_HANDLE = re.compile(r"(?<![\w@.])@[A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?")
_PHONE = re.compile(
    r"(?<![\w+])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-]?)\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?)\s*\d{1,5})?(?!\w)"
    r"|(?<!\w)\+\d{1,3}(?:[\s.-]?\(?\d{1,4}\)?){2,5}(?!\w)")
# A SIN (123 456 789), an Ontario health card (1234-567-890-AB) or any run of nine or more digits.
_ID_NUMBER = re.compile(r"(?<![\w-])(?:\d{3}[\s-]\d{3}[\s-]\d{3}|\d{4}[\s-]?\d{3}[\s-]?\d{3}[\s-]?[A-Za-z]{2}|\d{9,})(?![\w-])")

_STREET_TYPES = (r"(?i:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Crescent|Cres|Way|Place|Pl|"
                 r"Terrace|Terr|Circle|Cir|Trail|Trl|Parkway|Pkwy|Highway|Hwy|Square|Sq|Grove|Gate|Heights|Hts|Line|"
                 r"Sideroad|Concession|Close|Row|Mews)")
_UNIT = r"(?:,?\s*(?i:Apt|Apartment|Unit|Suite|Ste|#)\.?\s*[A-Za-z0-9-]+)?"
_DIRECTION = r"(?:\s+(?i:North|South|East|West|N|S|E|W)\b\.?)?"
# "42 Wellesley Street East, Apt 3": a number, a capitalised street name (or "5th"), and a street type.
_ADDRESS = re.compile(
    rf"\b\d{{1,6}}[A-Za-z]?(?:\s*-\s*\d{{1,6}})?\s+(?:[A-Z][A-Za-z'’.-]*|\d+(?:st|nd|rd|th))(?:\s+[A-Z][A-Za-z'’.-]*){{0,3}}"
    rf"\s+{_STREET_TYPES}\b\.?{_DIRECTION}{_UNIT}")
# Written in lower case, after "I live at" or "my address is".
_ADDRESS_CUED = re.compile(
    rf"(?i:\b(?:live|lives|living|stay|stays|staying|moved|moving)\s+(?:at|on|to)|\baddress\s*(?:is|:))\s+"
    rf"(\d{{1,6}}[A-Za-z]?\s+(?:[A-Za-z0-9'’.-]+\s+){{1,4}}?{_STREET_TYPES}\b\.?{_DIRECTION}{_UNIT})")
_POSTAL = re.compile(
    r"\b[ABCEGHJ-NPRSTVXYabceghj-nprstvxy]\d[ABCEGHJ-NPRSTV-Zabceghj-nprstv-z][ -]?\d[ABCEGHJ-NPRSTV-Zabceghj-nprstv-z]\d\b"
    r"|\b\d{5}-\d{4}\b"
    r"|\b(?i:P\.?\s?O\.?\s+Box|Post\s+Office\s+Box)\s+\d+\b")

_MONTHS = (r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|"
           r"Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?")
_DATE = (rf"(?:{_MONTHS}\s+\d{{1,2}}(?:st|nd|rd|th)?(?:,?\s+\d{{4}})?"
         rf"|\d{{1,2}}(?:st|nd|rd|th)?\s+(?:of\s+)?{_MONTHS}(?:,?\s+\d{{4}})?"
         rf"|\d{{4}}-\d{{1,2}}-\d{{1,2}}|\d{{1,2}}[/.-]\d{{1,2}}[/.-]\d{{2,4}}"
         rf"|(?:{_MONTHS}\s+)?\d{{4}})")
_DATE_OF_BIRTH = re.compile(
    rf"\b(?:born(?:\s+(?:on|in))?|birthday(?:\s+is)?(?:\s+on)?|b-?day(?:\s+is)?|d\.?o\.?b\.?|date\s+of\s+birth)"
    rf"\s*(?:is|was|:|-)?\s*({_DATE})(?!\w)", re.IGNORECASE)

# ---- Health -------------------------------------------------------------------------------------------------------

_DIAGNOSIS_TERMS = [
    "autism", "autistic", "aspergers", "asperger's", "asperger", "asperger syndrome", "asperger's syndrome",
    "autism spectrum disorder", "autism spectrum condition", "on the spectrum", "adhd", "audhd",
    "attention deficit hyperactivity disorder", "attention-deficit/hyperactivity disorder", "attention deficit disorder",
    "dyslexia", "dyslexic", "dyspraxia", "dyspraxic", "dyscalculia", "dysgraphia", "developmental coordination disorder",
    "ocd", "obsessive compulsive disorder", "obsessive-compulsive disorder", "ptsd", "cptsd", "c-ptsd",
    "post-traumatic stress disorder", "post traumatic stress disorder", "anxiety disorder",
    "generalized anxiety disorder", "generalised anxiety disorder", "social anxiety disorder", "social anxiety",
    "panic disorder", "depression", "clinical depression", "major depressive disorder", "depressive disorder",
    "bipolar", "bipolar disorder", "borderline personality disorder", "personality disorder", "schizophrenia",
    "schizoaffective disorder", "psychosis", "eating disorder", "anorexia", "anorexia nervosa", "bulimia",
    "bulimia nervosa", "binge eating disorder", "arfid", "tourette", "tourettes", "tourette's", "tourette syndrome",
    "tourette's syndrome", "tic disorder", "epilepsy", "epileptic", "cerebral palsy", "down syndrome",
    "down's syndrome", "fragile x", "fragile x syndrome", "fetal alcohol spectrum disorder", "fasd",
    "intellectual disability", "learning disability", "learning disabilities", "sensory processing disorder",
    "auditory processing disorder", "nonverbal learning disability", "pathological demand avoidance",
    "oppositional defiant disorder", "selective mutism", "apraxia", "chronic fatigue syndrome", "fibromyalgia",
    "ehlers-danlos syndrome", "ehlers danlos", "multiple sclerosis", "crohn's disease", "crohns", "celiac disease",
    "type 1 diabetes", "type 2 diabetes", "diabetes", "long covid", "postural orthostatic tachycardia syndrome",
]
# Acronyms that are also ordinary words in lower case (ADD, ODD) count only in capitals.
_DIAGNOSIS_ACRONYMS = ["ADD", "ASC", "ASD", "GAD", "MDD", "BPD", "ODD", "PDA", "SPD", "DCD", "POTS", "EDS", "ME/CFS",
                       "CFS", "TBI"]
_MEDICATIONS = [
    "adderall", "ritalin", "concerta", "vyvanse", "elvanse", "strattera", "biphentin", "foquest", "dexedrine",
    "methylphenidate", "lisdexamfetamine", "dextroamphetamine", "amphetamine", "atomoxetine", "guanfacine",
    "intuniv", "clonidine", "risperidone", "risperdal", "aripiprazole", "abilify", "sertraline", "zoloft",
    "fluoxetine", "prozac", "escitalopram", "cipralex", "lexapro", "citalopram", "celexa", "bupropion", "wellbutrin",
    "venlafaxine", "effexor", "duloxetine", "cymbalta", "lithium", "quetiapine", "seroquel", "lamotrigine",
    "lamictal", "valproate", "depakote", "olanzapine", "zyprexa", "clonazepam", "rivotril", "lorazepam", "ativan",
    "diazepam", "valium",
]


def _word_list(words: Iterable[str], flags: int = 0) -> re.Pattern:
    alternatives = "|".join(re.escape(w) for w in sorted(set(words), key=len, reverse=True))
    return re.compile(rf"(?<![\w-])(?:{alternatives})(?![\w-])", flags)


_DIAGNOSIS = _word_list(_DIAGNOSIS_TERMS, re.IGNORECASE)
_DIAGNOSIS_CAPS = _word_list(_DIAGNOSIS_ACRONYMS)
_MEDICATION = _word_list(_MEDICATIONS, re.IGNORECASE)
_STOP_AFTER = r"(?:and|but|when|after|in|at|last|this|because|so|which|that|since|by|from|as|for|or|with|about)"
_DIAGNOSED = re.compile(
    r"(?i:\b(?:diagnosed\s+with|diagnosis\s+(?:of|is|was)|dx(?:'d)?\s+with|dx\s*:)\s+(?:an?\s+|the\s+)?)"
    rf"((?i:[a-z][a-z'’/-]*(?:\s+(?!{_STOP_AFTER}\b)[a-z][a-z'’/-]*){{0,4}}))"
    rf"(?=\s*(?:[.,;:!?)\n]|$)|\s+(?i:{_STOP_AFTER})\b)")

# ---- People, schools and employers --------------------------------------------------------------------------------

_NAME = r"[A-Z][a-z'’]+(?:-[A-Z][a-z'’]+)?"
_NOT_A_NAME = (r"(?!(?:And|But|Or|So|The|A|An|I|Is|Was|Who|That|This|He|She|They|We|It|At|In|On|Of|To|For|Has|Had|"
               r"Says|Said|Told|Thinks|Thought|Helped|Will|Would|Can|Could|Should|Did|Does|Just|Also|Then|"
               r"Dr|Mr|Mrs|Ms|Mx|Miss|Prof)\b)")
_RELATIONS = (r"(?:mom|mum|mother|dad|father|parents?|brother|sister|sibling|son|daughter|kid|child|partner|spouse|"
              r"husband|wife|boyfriend|girlfriend|fianc[ée]e?|friend|best\s+friend|roommate|flatmate|neighbou?r|"
              r"cousin|aunt|uncle|niece|nephew|grandma|grandmother|grandpa|grandfather|nan|nana|therapist|"
              r"counsell?or|psychologist|psychiatrist|doctor|family\s+doctor|gp|paediatrician|pediatrician|nurse|"
              r"teacher|tutor|professor|prof|coach|mentor|boss|manager|supervisor|co-?worker|colleague|"
              r"case\s*worker|social\s+worker|support\s+worker|worker|ot|occupational\s+therapist|slp|"
              r"speech\s+therapist|ea|aide|landlord|classmate|teammate|pastor|priest|imam|rabbi)")
_NAME_AFTER_RELATION = re.compile(
    rf"(?i:\b(?:my|our|his|her|their|your)\s+(?:new\s+|old\s+|former\s+)?{_RELATIONS})\s*,?\s+{_NOT_A_NAME}"
    rf"({_NAME}(?:\s+{_NOT_A_NAME}{_NAME})?)")
_NAME_AFTER_TITLE = re.compile(rf"\b(?:Dr|Mr|Mrs|Ms|Mx|Miss|Prof)\.?\s+({_NAME}(?:\s+{_NOT_A_NAME}{_NAME})?)")
_NAME_SELF = re.compile(
    rf"(?i:\b(?:my\s+name\s+is|my\s+name's|i\s+am\s+called|i'm\s+called|call\s+me|named|called))\s+{_NOT_A_NAME}"
    rf"({_NAME}(?:\s+{_NOT_A_NAME}{_NAME})?)")

# A capitalised word just before what people do to or with each other: "Marcus said", "Priya came over",
# "Nkechi is my sister", "Aisha and I". The recogniser often misses a name that starts a sentence.
_NOT_A_PERSON = (r"(?!(?:He|She|They|We|You|It|Everyone|Someone|Somebody|Nobody|Everybody|People|Mom|Mum|Dad|Grandma|"
                 r"Grandpa|Today|Yesterday|Tomorrow|There|Here|Nothing|Everything|Something|What|Which|Where|When|"
                 r"Why|How|My|Our|Your|Their|His|Her)\b)")
_SOCIAL_VERBS = (r"(?:said|says|told|tells|texted|texts|called|calls|helped|helps|came|comes|picked|asked|asks|gave|"
                 r"gives|drove|drives|met|meets|messaged|emailed|showed|took|brought|invited|reminded|suggested|"
                 r"thinks|thought|wants|wanted|hugged|visited|cooked|is\s+my|was\s+my|and\s+I|and\s+me|&\s+I)")
_NAME_BY_VERB = re.compile(rf"(?<!the )(?<!The )\b{_NOT_A_NAME}{_NOT_A_PERSON}({_NAME})(?=\s+{_SOCIAL_VERBS}\b)")

_SCHOOL_WORDS = r"(?:School|Academy|College|University|Institute|Polytechnic|Collegiate|Conservatory|Kindergarten|Preschool|Daycare)"
_SCHOOL_KINDS = r"(?:Elementary|Public|Middle|Junior|Senior|Secondary|High|Catholic|Christian|Montessori|Community|Technical|Career)"
_ORG_WORD = r"[A-Z][\w'’&-]*(?:\.(?=\w)[\w'’&-]+)*"     # a dot only inside a word, never the sentence's full stop
_LEADING = r"(?!(?:The|A|An|My|Our|Your|This|That|His|Her|Their)\s)"
_SCHOOL = re.compile(
    rf"\b{_LEADING}(?:{_ORG_WORD}\s+){{1,4}}(?:{_SCHOOL_KINDS}\s+)?{_SCHOOL_WORDS}\b(?:\s+of\s+{_ORG_WORD}(?:\s+{_ORG_WORD}){{0,3}})?"
    rf"|\b(?:University|College|Institute|Academy)\s+of\s+{_ORG_WORD}(?:\s+{_ORG_WORD}){{0,3}}")
_SCHOOL_CUED = re.compile(
    r"(?i:\b(?:study|studies|studied|studying|attend|attends|attended|attending|graduated|graduating|enrolled|"
    r"transferred)\s+(?:at|from|in|to)\s+)"
    rf"(?!(?i:a|an|the|my|our|school|college|university|class|home|night)\b)({_ORG_WORD}(?:\s+(?:of\s+)?{_ORG_WORD}){{0,4}})")
_NOT_AN_EMPLOYER = r"(?!(?:I|It|This|That|Them|Him|Her|Me|Us|You|Home|Night|Work|School|Least|Most|First|Last|Once|All)\b)"
_EMPLOYER_CUED = re.compile(
    r"(?i:\b(?:(?:work|works|worked|working|intern|interns|interned|interning|volunteer|volunteers|volunteered|"
    r"volunteering|employed|hired)\s+(?:at|for|by)|(?:job|jobs|placement|co-?op|internship|position|shift|shifts|role)"
    r"\s+(?:at|with))\s+(?:the\s+)?)"
    rf"{_NOT_AN_EMPLOYER}({_ORG_WORD}(?:\s+(?:&\s+|and\s+|of\s+)?{_ORG_WORD}){{0,4}})")
_EMPLOYER_CUE_BEFORE = re.compile(
    r"(?i:\b(?:work|works|worked|working|intern|interned|volunteer|volunteered|employed|hired|job|placement|co-?op|"
    r"internship|position|shift|boss|manager|employer)\b[^.!?\n]{0,30})$")

_PLACEHOLDER = re.compile(r"\[[A-Z_]+\]")
# Everyday words spaCy sometimes takes for a name or an organisation when they start a sentence ("Email me ...",
# "My SIN is ..."). A one-word guess that is one of these is left alone; anything longer is still replaced.
_EVERYDAY_WORDS = {
    "email", "e-mail", "text", "call", "phone", "sin", "dear", "hi", "hello", "hey", "thanks", "thank", "ok", "okay",
    "yes", "no", "today", "tomorrow", "yesterday", "tonight", "monday", "tuesday", "wednesday", "thursday", "friday",
    "saturday", "sunday", "journal", "note", "notes", "goal", "goals", "plan", "step", "steps", "task", "tasks",
    "therapy", "school", "work", "job", "class", "mom", "mum", "dad", "home", "pool", "gym", "bus", "zoom", "wifi",
}

_PATTERNS: List[Tuple[str, re.Pattern, int]] = [
    ("email", _EMAIL, 0),
    ("link", _LINK, 0),
    ("name", _HANDLE, 0),
    ("phone", _PHONE, 0),
    ("id_number", _ID_NUMBER, 0),
    ("address", _ADDRESS, 0),
    ("address", _ADDRESS_CUED, 1),
    ("address", _POSTAL, 0),
    ("date_of_birth", _DATE_OF_BIRTH, 1),
    ("diagnosis", _DIAGNOSIS, 0),
    ("diagnosis", _DIAGNOSIS_CAPS, 0),
    ("diagnosis", _DIAGNOSED, 1),
    ("medication", _MEDICATION, 0),
    ("name", _NAME_AFTER_RELATION, 1),
    ("name", _NAME_AFTER_TITLE, 1),
    ("name", _NAME_SELF, 1),
    ("name", _NAME_BY_VERB, 1),
    ("school", _SCHOOL, 0),
    ("school", _SCHOOL_CUED, 1),
    ("employer", _EMPLOYER_CUED, 1),
]

# ---- spaCy's named-entity recogniser, if it's installed --------------------------------------------------------------

_SPACY_MODEL = "en_core_web_sm"
_nlp: Any = None
_nlp_tried = False


def _ner() -> Any:
    """spaCy's small English pipeline with only its entity recogniser, loaded once; None without spaCy, the model,
    or with SCRUBBER_NER=off."""
    global _nlp, _nlp_tried
    if os.getenv("SCRUBBER_NER", "").strip().lower() == "off":
        return None
    if not _nlp_tried:
        _nlp_tried = True
        try:
            import spacy
            _nlp = spacy.load(_SPACY_MODEL, exclude=["tok2vec", "tagger", "parser", "attribute_ruler", "lemmatizer", "senter"])
        except Exception as e:
            print(f"[scrubber] spaCy's recogniser isn't available, patterns only: {type(e).__name__}")
            _nlp = None
    return _nlp


def version() -> str:
    """This scrubber and what found names and organisations, recorded with each approval (STEP 95)."""
    nlp = _ner()
    if nlp is None:
        return f"{SCRUBBER_VERSION}+patterns"
    meta = getattr(nlp, "meta", {}) or {}
    return f"{SCRUBBER_VERSION}+{meta.get('lang', 'en')}_{meta.get('name', 'ner')}-{meta.get('version', '')}".rstrip("-")


def uses_ner() -> bool:
    return _ner() is not None


# ---- Scrubbing ----------------------------------------------------------------------------------------------------

@dataclass
class ScrubResult:
    text: str
    found: Dict[str, int] = field(default_factory=dict)


def _known_name_pattern(known_names: Sequence[str]) -> Optional[re.Pattern]:
    """The person's own name from their profile, each part on its own too ("Priya", "Sharma"), as written with a
    capital; a username as written, in any case."""
    words: List[str] = []
    for raw in known_names or []:
        value = str(raw or "").strip()
        if not value or len(value) > 80:
            continue
        if re.fullmatch(r"[A-Za-z][A-Za-z'’ -]*", value):
            words.append(value)
            words.extend(part for part in re.split(r"[\s-]+", value) if len(part) >= 2)
        elif re.fullmatch(r"[A-Za-z0-9_.]{3,30}", value):
            words.append(f"(?i:{re.escape(value)})")
    if not words:
        return None
    alternatives = sorted({w if w.startswith("(?i:") else re.escape(w[0].upper() + w[1:]) for w in words}, key=len, reverse=True)
    return re.compile(rf"(?<![\w@])(?:{'|'.join(alternatives)})(?![\w])")


def _spans(text: str, known_names: Sequence[str], use_ner: Optional[bool]) -> List[Tuple[int, int, str]]:
    found: List[Tuple[int, int, str]] = []
    for kind, pattern, group in _PATTERNS:
        for m in pattern.finditer(text):
            start, end = m.span(group)
            if end > start:
                found.append((start, end, kind))
    known = _known_name_pattern(known_names)
    if known is not None:
        found.extend((m.start(), m.end(), "name") for m in known.finditer(text))
    nlp = _ner() if use_ner is not False else None
    if nlp is not None:
        for ent in nlp(text).ents:
            if len(ent) == 1 and ent.text.lower() in _EVERYDAY_WORDS:
                continue
            if ent.label_ == "PERSON" and re.search(r"[A-Za-z]", ent.text):
                found.append((ent.start_char, ent.end_char, "name"))
            elif ent.label_ == "ORG" and re.search(r"[A-Za-z]{2}", ent.text):
                if re.search(_SCHOOL_WORDS, ent.text, re.IGNORECASE):
                    kind = "school"
                elif _EMPLOYER_CUE_BEFORE.search(text[max(0, ent.start_char - 40):ent.start_char]):
                    kind = "employer"
                else:
                    kind = "organization"
                found.append((ent.start_char, ent.end_char, kind))
    return found


def _choose(text: str, spans: List[Tuple[int, int, str]], protected: List[Tuple[int, int]]) -> List[Tuple[int, int, str]]:
    """Longest finds first; nothing over a placeholder already there; no two finds over the same words."""
    taken: List[Tuple[int, int, str]] = []
    blocked = list(protected)
    for start, end, kind in sorted(spans, key=lambda s: (-(s[1] - s[0]), _PRIORITY[s[2]], s[0])):
        # Spaces and commas a pattern swept in at the end stay as they were.
        while end > start and text[end - 1] in " \t\n,;:":
            end -= 1
        if end <= start or any(start < b_end and b_start < end for b_start, b_end in blocked):
            continue
        taken.append((start, end, kind))
        blocked.append((start, end))
    return sorted(taken)


def scrub(text: str, known_names: Sequence[str] = (), use_ner: Optional[bool] = None) -> ScrubResult:
    """`text` with everything found replaced by its placeholder, and how many of each kind were replaced."""
    text = str(text or "")[:MAX_TEXT_CHARS]
    if not text.strip():
        return ScrubResult(text=text, found={})
    protected = [(m.start(), m.end()) for m in _PLACEHOLDER.finditer(text)]
    chosen = _choose(text, _spans(text, known_names, use_ner), protected)
    out: List[str] = []
    found: Dict[str, int] = {}
    cursor = 0
    for start, end, kind in chosen:
        out.append(text[cursor:start])
        out.append(PLACEHOLDERS[kind])
        found[kind] = found.get(kind, 0) + 1
        cursor = end
    out.append(text[cursor:])
    return ScrubResult(text="".join(out), found=found)
