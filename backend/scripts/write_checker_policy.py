"""Write frontend/lib/checkerPolicy.ts from the server's checker instructions and rules (core/moderation.py), so the
checker on a person's own device reads exactly what the server's does, and the same rules run first. Run from backend/: python -m scripts.write_checker_policy
(tests/test_moderation.py fails until it's run after a change to the instructions)."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core import moderation as m  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "lib", "checkerPolicy.ts")


def policy():
    """The checker's instructions, and our rules' patterns (read case-insensitively), as the browser uses them."""
    return {
        "person": m.checker_prompt("person"),
        "reply": m.checker_prompt("reply"),
        "categories": list(m.CATEGORIES),
        "rules": {
            "crisis": [pattern.pattern for pattern, _why in m.CRISIS],
            "setsRulesAside": m.SETS_RULES_ASIDE.pattern,
            "scam": m.SCAM.pattern,
        },
    }


def main():
    blob = json.dumps(policy(), ensure_ascii=False, indent=2)
    head = open(OUT, encoding="utf-8").read().split("// policy:start")[0]
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(f"{head}// policy:start\nexport const CHECKER_POLICY = {blob} as const\n// policy:end\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
