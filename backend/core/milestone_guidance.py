"""What to avoid, and what helps, at each step of a plan.

The team's notes, October 2026 (Odosa): the Race view's Avoidance view should
show "at each milestone, in red text, what should be avoided for that
milestone, rather than just the general things to avoid at the top", the
Suggestions view the same in green, and the Milestone view "a 'Top 5
mistakes made at this stage'" that matches the Race view's.

One list per step, written once per plan and kept in it
(payload.milestoneGuidance), so every page shows the same words. Written by
AI for this person's steps when AI is on; otherwise general advice for the
kind of step, plus what the person told us themselves (the obstacles they
named, what did not work for them before). Each entry says which it is, and
the pages say so too.

Not advice on medicine, law or money beyond "ask a professional", no
numbers or percentages (nobody counted these), and nothing that shames.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from core import llm

AVOID_COUNT = 5
TIPS_COUNT = 5
MAX_ITEM_CHARS = 120
CHUNK = 8

# General advice for a kind of step, used when AI is off or fails. Short,
# plain, and true of most people at a step like it.
GENERAL: Dict[str, Dict[str, List[str]]] = {
    "education": {
        "avoid": [
            "Waiting until exams to ask about accommodations",
            "Studying for hours without a break",
            "Cramming the night before",
            "Skipping meals or sleep to finish work",
            "Keeping it to yourself when you're stuck",
        ],
        "tips": [
            "Ask about accommodations early in the term",
            "Break study time into short blocks",
            "Keep every deadline in one calendar",
            "Find a quiet place that works for you",
            "Check in with an advisor or tutor",
        ],
    },
    "workplace": {
        "avoid": [
            "Applying everywhere at once and burning out",
            "Hiding what helps you work well",
            "Going into an interview without preparing",
            "Saying yes to every extra task",
            "Waiting for feedback instead of asking for it",
        ],
        "tips": [
            "Practise answers to common interview questions",
            "Write down the accommodations that help you",
            "Ask what a typical day looks like",
            "Keep a list of what you finished each week",
            "Plan rest after demanding days",
        ],
    },
    "relationships": {
        "avoid": [
            "Expecting yourself to enjoy every social event",
            "Cancelling every plan when you're tired",
            "Guessing what someone meant instead of asking",
            "Comparing your circle to other people's",
            "Giving your energy to people who drain it",
        ],
        "tips": [
            "Start with one small, low-pressure plan",
            "Choose activities around shared interests",
            "Say what you need clearly and kindly",
            "Plan recovery time after social time",
            "Keep in touch with a short message",
        ],
    },
    "health": {
        "avoid": [
            "Changing everything at once",
            "Skipping rest when your energy is low",
            "Ignoring signs that you need a break",
            "Dropping the routine after one missed day",
            "Waiting until it feels urgent to ask for help",
        ],
        "tips": [
            "Start with one small habit",
            "Keep the same time each day",
            "Notice how you feel, not only what you did",
            "Plan easy options for low-energy days",
            "Ask a professional before big changes",
        ],
    },
    "general": {
        "avoid": [
            "Trying to do the whole step in one go",
            "Setting a deadline with no room to spare",
            "Doing it without the supports that help you",
            "Skipping the step's first small task",
            "Judging yourself for a slow week",
        ],
        "tips": [
            "Do the first small task today",
            "Put the next task in your calendar",
            "Use the supports that worked before",
            "Ask someone you trust to check in",
            "Celebrate each finished task",
        ],
    },
}


def _area(milestone: Dict[str, Any]) -> str:
    d = str(milestone.get("dimension") or milestone.get("category") or "").lower()
    if d == "career":
        d = "workplace"
    return d if d in GENERAL else "general"


def _clean(items: Any, count: int) -> List[str]:
    """Up to `count` short, distinct lines."""
    out: List[str] = []
    seen = set()
    for item in items if isinstance(items, list) else []:
        text = " ".join(str(item or "").split()).strip(" -•*").rstrip(".")
        if not text:
            continue
        if len(text) > MAX_ITEM_CHARS:
            text = text[:MAX_ITEM_CHARS].rsplit(" ", 1)[0].rstrip(",;:") + "…"
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
        if len(out) >= count:
            break
    return out


def plan_milestones(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """The plan's milestones, each once, with their tasks where stored."""
    seen: Dict[str, Dict[str, Any]] = {}
    for race in payload.get("races") or []:
        for m in (race or {}).get("milestones") or []:
            if isinstance(m, dict) and m.get("id") and m["id"] not in seen:
                seen[m["id"]] = m
    for response in payload.get("agentResponses") or []:
        if isinstance(response, dict) and response.get("agentId") == "path_planning":
            result = response.get("result") or {}
            tasks = result.get("tasks") or []
            for m in result.get("milestones") or []:
                if isinstance(m, dict) and m.get("id") and m["id"] not in seen:
                    own = [t for t in tasks if isinstance(t, dict) and t.get("milestoneId") == m["id"]]
                    seen[m["id"]] = {**m, "tasks": own}
    return list(seen.values())


def stale(payload: Dict[str, Any], milestones: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Milestones with no guidance yet, or whose name changed since."""
    have = payload.get("milestoneGuidance") or {}
    out = []
    for m in milestones:
        entry = have.get(m["id"]) if isinstance(have, dict) else None
        if not isinstance(entry, dict) or entry.get("name") != m.get("name") or not entry.get("avoid"):
            out.append(m)
    return out


def _person(payload: Dict[str, Any]) -> Dict[str, Any]:
    profile = payload.get("userProfile") or {}
    support = profile.get("supportContext") or {}
    return {
        "norms": [str(b) for b in profile.get("barrierTypes") or [] if b],
        "obstacles": [str(c) for c in profile.get("currentChallenges") or [] if c],
        "not_worked": str(support.get("strategiesNotWorked") or "").strip(),
        "worked": str(support.get("strategiesWorked") or "").strip(),
        "audience": profile.get("audience"),
    }


def general_guidance(milestone: Dict[str, Any], person: Dict[str, Any]) -> Dict[str, Any]:
    """Without AI: the person's own words first, then general advice for the kind of step."""
    base = GENERAL[_area(milestone)]
    avoid: List[str] = []
    if person["not_worked"]:
        avoid.append(f"Going back to what didn't work before: {person['not_worked']}")
    for obstacle in person["obstacles"][:2]:
        avoid.append(f"Letting “{obstacle}” decide the day: plan around it first")
    avoid.extend(base["avoid"])
    tricks: List[str] = []
    for task in milestone.get("tasks") or []:
        for trick in (task or {}).get("helperTricks") or []:
            tricks.append(str(trick))
    tips = tricks + base["tips"]
    return {
        "name": milestone.get("name"),
        "avoid": _clean(avoid, AVOID_COUNT),
        "tips": _clean(tips, TIPS_COUNT),
        "source": "general",
    }


SYSTEM = (
    "You help people plan the steps toward their goals. For each step you are given, write "
    f"'avoid': the {AVOID_COUNT} most common mistakes people make at a step like this one, and "
    f"'tips': up to {TIPS_COUNT} things that help at this step. Each line is at most 14 words, "
    "plain and specific to the step's name and description, and to the person's norms and "
    "obstacles where they matter. Write mistakes as what someone does, for example "
    "'Leaving the accommodation request until exam week'. Never give medical, medication, "
    "legal or money advice beyond suggesting a professional; never give numbers, percentages "
    "or statistics; never shame or blame. "
    "Return JSON: {\"steps\": {\"<step id>\": {\"avoid\": [\"...\"], \"tips\": [\"...\"]}}} "
    "with every step id you were given. "
)


async def _ai_chunk(chunk: List[Dict[str, Any]], person: Dict[str, Any], supporting: str) -> Dict[str, Any]:
    lines = []
    for m in chunk:
        tasks = [t.get("name") for t in (m.get("tasks") or []) if isinstance(t, dict) and t.get("name")][:4]
        lines.append(
            f"- id {m['id']}: {llm.user_text(m.get('name'), 160)}"
            f" ({_area(m)}; goal {llm.user_text(m.get('goal'), 120)})"
            f" {llm.user_text(m.get('description'), 260)}"
            + (f" Tasks: {llm.user_list(tasks, 100, 4)}" if tasks else "")
        )
    user = (
        f"Norms: {llm.user_list(person['norms'], empty='none given')}\n"
        f"Obstacles they named: {llm.user_list(person['obstacles'], empty='none given')}\n"
        + (f"What did not work for them before: {llm.user_text(person['not_worked'], 400)}\n" if person["not_worked"] else "")
        + (f"What worked for them: {llm.user_text(person['worked'], 400)}\n" if person["worked"] else "")
        + "Steps:\n" + "\n".join(lines)
    )
    data = await llm.complete_json(
        system=SYSTEM + supporting + llm.USER_TEXT_RULE,
        user=user,
        temperature=0.4,
        max_tokens=2400,
        agent="path_planning",
    )
    steps = (data or {}).get("steps") if isinstance(data, dict) else None
    return steps if isinstance(steps, dict) else {}


async def write_guidance(payload: Dict[str, Any], milestones: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Guidance for these milestones: by AI where it answers, general otherwise."""
    person = _person(payload)
    out: Dict[str, Dict[str, Any]] = {}
    ai: Dict[str, Any] = {}
    if llm.is_enabled() and milestones:
        from core.agents.path_planning_agent import supported_person, supporting_rule
        who = supported_person(person["audience"])
        supporting = supporting_rule(who) if who else ""
        chunks = [milestones[i:i + CHUNK] for i in range(0, len(milestones), CHUNK)]
        try:
            for part in await asyncio.gather(*[_ai_chunk(c, person, supporting) for c in chunks], return_exceptions=True):
                if isinstance(part, dict):
                    ai.update(part)
        except Exception as e:  # pragma: no cover - network
            print(f"[guidance] AI skipped: {e}")
    for m in milestones:
        entry = ai.get(m["id"]) if isinstance(ai.get(m["id"]), dict) else None
        avoid = _clean((entry or {}).get("avoid"), AVOID_COUNT)
        tips = _clean((entry or {}).get("tips"), TIPS_COUNT)
        if len(avoid) >= 3:
            fallback = general_guidance(m, person)
            out[m["id"]] = {
                "name": m.get("name"),
                "avoid": (avoid + [a for a in fallback["avoid"] if a not in avoid])[:AVOID_COUNT],
                "tips": tips or fallback["tips"],
                "source": "ai",
            }
        else:
            out[m["id"]] = general_guidance(m, person)
    return out


def merged(payload: Dict[str, Any], fresh: Dict[str, Dict[str, Any]], milestones: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """The plan's guidance after this run: kept for unchanged steps, new for the rest,
    and only for steps the plan still has."""
    have = payload.get("milestoneGuidance") if isinstance(payload.get("milestoneGuidance"), dict) else {}
    ids = {m["id"] for m in milestones}
    out = {k: v for k, v in have.items() if k in ids}
    out.update(fresh)
    return out
