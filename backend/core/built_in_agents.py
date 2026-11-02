"""The six agents built into every plan, as people see them on My agents (frontend app/agents/page.tsx): what each
does, what it looks at, and the instructions it gives the model, read from the agent's own code so the page can't
drift from it.

    ./venv/bin/python -m core.built_in_agents --write     writes frontend/lib/built-in-agents.json
    tests/test_built_in_agents.py                         checks the file matches the code

Only instructions in use are listed. Reflection Analysis's per-entry analysis (analyze_reflection) isn't called by
the plan's graph since 13 October 2026, and its theme reading is off unless REFLECTION_THEMES_ENABLED=true, so it
lists none; Pattern Recognition matches people and doesn't write.

What a model is told can depend on the plan, so the parts filled in at the time are shown in ‹angle quotes›, and a
part added only in some plans says when.
"""
from __future__ import annotations

import ast
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from core import llm
from core.model_registry import AGENT_IDS, AGENT_LABELS

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "frontend" / "lib" / "built-in-agents.json"

# In the order the plan's graph runs them (each agent file's "Agent N"). `prompts`: the function whose model call
# is shown, and what that call is for, in plain words.
AGENTS: List[Dict[str, Any]] = [
    {
        "id": "path_planning", "file": "path_planning_agent.py",
        "does": "Breaks each of your goals into small steps in four life areas (education, work, relationships and "
                "health), describes each step, and splits it into short tasks, fitted to your norms.",
        "looksAt": "Your goals, your norms and your setup answers, with your earlier plans as background.",
        "prompts": [
            ("_generate_milestones_for_goal", "Writing the steps for a goal"),
            ("_generate_barrier_model", "What helps with your norms"),
            ("_enrich_descriptions_batch", "Describing each step"),
            ("_generate_tasks_batch", "Breaking each step into tasks"),
            ("_get_helper_tricks", "Helper tricks"),
        ],
    },
    {
        "id": "pattern_recognition", "file": "pattern_recognition_agent.py",
        "does": "Finds people whose norms and goals are like yours, and what worked for them, so your plan learns "
                "from people who came before you.",
        "looksAt": "Your norms and goals, compared with other people's as numbers, never their words.",
        "note": "It doesn't write anything, so it gives a model no instructions: it matches people.",
        "prompts": [],
    },
    {
        "id": "tool_recommendation", "file": "tool_recommendation_agent.py",
        "does": "Picks services and tools from ResourceHub for each step, ranked by how well they fit your norms and "
                "how people like you rated them, and says why.",
        "looksAt": "Your steps, your norms and where you live, and ResourceHub's listings and ratings.",
        "prompts": [
            ("_barrier_fit_scores", "How well each resource fits you"),
            ("ask", "Matching services to each step"),
            ("_generate_helps_with", "What each tool helps with"),
            ("recommend_tools", "Why these tools"),
        ],
    },
    {
        "id": "reflection_analysis", "file": "reflection_analysis_agent.py",
        "does": "Reads how it's going: your journal entries, how you rated your steps and the steps you finish, to "
                "find what helps you and what gets in the way.",
        "looksAt": "Your journal, your step ratings and your progress.",
        "note": "It gives a model no instructions: it counts and compares what you wrote and did.",
        "prompts": [],
    },
    {
        "id": "adaptation", "file": "adaptation_agent.py",
        "does": "Changes your plan when your progress says it should, for example smaller steps when things stall, "
                "and tells you what changed and why.",
        "looksAt": "What Reflection Analysis found, and your plan.",
        "prompts": [("adapt_path", "Explaining what changed")],
    },
    {
        "id": "calendar_optimization", "file": "calendar_optimization_agent.py",
        "does": "Puts your steps' tasks into your week around each day's energy, with rest built in, and sums up "
                "how it planned your week.",
        "looksAt": "Your plan's tasks and your norms. Each day's energy is a default for that day of the week.",
        "prompts": [("optimize_calendar", "Summing up your week")],
    },
]

_MODEL_CALLS = {"complete_json", "complete_text"}


def _words(name: str) -> str:
    return name.strip("_").replace("_", " ")


class _Render:
    """Turns the expression a model call's `system` is built from into the text it sends."""

    def __init__(self, tree: ast.Module):
        self.constants: Dict[str, ast.AST] = {}
        self.functions: Dict[str, ast.FunctionDef] = {}
        for node in tree.body:
            if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                self.constants[node.targets[0].id] = node.value
            elif isinstance(node, ast.FunctionDef):
                self.functions[node.name] = node

    def text(self, node: ast.AST) -> str:
        if isinstance(node, ast.Constant):
            return str(node.value)
        if isinstance(node, ast.JoinedStr):
            return "".join(self.text(v) for v in node.values)
        if isinstance(node, ast.FormattedValue):
            return self.slot(node.value)
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            return self.text(node.left) + self.text(node.right)
        return self.slot(node)

    def slot(self, node: ast.AST) -> str:
        """A part filled in when the plan is made."""
        if isinstance(node, ast.Constant):
            return str(node.value)
        if isinstance(node, ast.Name):
            if node.id in self.constants:
                return self.text(self.constants[node.id])
            return f"‹{_words(node.id)}›"
        if isinstance(node, ast.Attribute):
            if isinstance(node.value, ast.Name) and node.value.id == "llm" and isinstance(getattr(llm, node.attr, None), str):
                return getattr(llm, node.attr)
            return f"‹{_words(node.attr)}›"
        if isinstance(node, (ast.JoinedStr, ast.BinOp)):
            return self.text(node)
        if isinstance(node, ast.IfExp):
            body, other = self.text(node.body), self.text(node.orelse)
            # A plural "s", say: the usual reading.
            if isinstance(node.body, ast.Constant) and isinstance(node.orelse, ast.Constant):
                return body
            if not other:
                when = "When the plan is for someone else" if "supporting_rule" in ast.unparse(node.body) else "Sometimes"
                return f"[{when}:] {body}"
            return f"{body} [or] {other}"
        if isinstance(node, ast.Call):
            name = node.func.id if isinstance(node.func, ast.Name) else None
            fn = self.functions.get(name or "")
            if fn is not None:
                body = [s for s in fn.body if not (isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant))]
                if len(body) == 1 and isinstance(body[0], ast.Return) and body[0].value is not None:
                    return self.text(body[0].value)
            if isinstance(node.func, ast.Attribute) and node.func.attr == "join":
                return "‹a list›"
            return f"‹{_words(name or getattr(node.func, 'attr', 'something'))}›"
        return "‹…›"


def _system_of(call: ast.Call) -> Optional[ast.AST]:
    for keyword in call.keywords:
        if keyword.arg == "system":
            return keyword.value
    return call.args[0] if call.args else None


def _prompts_in(tree: ast.Module, function: str, render: _Render) -> List[str]:
    """The instructions of each model call in that function (and the functions inside it), in order."""
    found = [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == function]
    if not found:
        raise LookupError(f"no function {function}")
    texts: List[str] = []
    for node in sorted((n for f in found for n in ast.walk(f)), key=lambda n: getattr(n, "lineno", 0)):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in _MODEL_CALLS:
            system = _system_of(node)
            if system is not None:
                text = " ".join(render.text(system).split())
                if text not in texts:
                    texts.append(text)
    if not texts:
        raise LookupError(f"{function} gives a model no instructions")
    return texts


def built_in_agents() -> Dict[str, Any]:
    agents = []
    for number, spec in enumerate(AGENTS, 1):
        tree = ast.parse((HERE / "agents" / spec["file"]).read_text())
        render = _Render(tree)
        prompts = []
        for function, label in spec["prompts"]:
            for text in _prompts_in(tree, function, render):
                prompts.append({"label": label, "text": text})
        agents.append({"number": number, "id": spec["id"], "name": AGENT_LABELS[spec["id"]], "does": spec["does"],
                       "looksAt": spec["looksAt"], "note": spec.get("note", ""), "prompts": prompts})
    assert [a["id"] for a in agents] == sorted(AGENT_IDS, key=[a["id"] for a in AGENTS].index), "the six agents changed"
    return {"agents": agents}


def as_json() -> str:
    return json.dumps(built_in_agents(), ensure_ascii=False, indent=2) + "\n"


if __name__ == "__main__":
    if "--write" in sys.argv:
        OUT.write_text(as_json())
        print(f"wrote {OUT}")
    else:
        print(as_json())
