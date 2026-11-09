"""
The safety check's test set, with the real services (core/moderation.py; the cases are backend/tests/moderation_cases.json;
docs/ai-moderation.md).

    python -m scripts.eval_moderation           # our rules, OpenAI's moderation service (free) and the checker
                                                 # (GPT-4o mini, for what the service flags: a fraction of a cent)
    python -m scripts.eval_moderation --rules   # our rules only: no network
    python -m scripts.eval_moderation --set holdout   # the held-out cases (tests/moderation_holdout.json), not tuned on

Over-moderating counts as a failure as much as missing something: "over" is a case that should have gone through and
didn't, "missed" one that should have been acted on and wasn't. Run it after changing the definitions, the context rules
or the rules, and before changing AI_CHECKER_MODEL.

Writes nothing anywhere. The database settings are blanked before anything is loaded (load_dotenv never overrides a
variable that is set), so neither a usage line nor a record reaches the live database.
"""
import os
import sys

for name in ("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
    os.environ[name] = ""
os.environ.setdefault("LLM_REQUESTS_PER_MINUTE", "600")      # this run's own calls, in one process

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import asyncio  # noqa: E402
import json  # noqa: E402

from core import moderation  # noqa: E402

SETS = {"cases": "moderation_cases.json", "holdout": "moderation_holdout.json"}
ACTED = {"person": {"steer", "care"}, "reply": {"rewrite"}}


async def main(rules_only: bool, which: str) -> int:
    data = json.load(open(os.path.join(os.path.dirname(__file__), "..", "tests", SETS[which]), encoding="utf-8"))
    where = "other" if rules_only else "openai"
    if not rules_only and not os.getenv("OPENAI_API_KEY", "").strip():
        print("No OPENAI_API_KEY: run with --rules, or set the key in backend/.env.")
        return 2
    totals = {"person": [0, 0, 0, 0], "reply": [0, 0, 0, 0]}       # cases, right, over, missed
    wrong = []
    for case in data["cases"]:
        direction, text = case["direction"], case["text"]
        expect = case["expect"] if isinstance(case["expect"], list) else [case["expect"]]
        if direction == "person":
            verdict = await moderation.check_message(text, where)
        else:
            verdict = await moderation.check_reply(text, where)
        got = verdict.action
        t = totals[direction]
        t[0] += 1
        if got in expect:
            t[1] += 1
            continue
        acted, should = got in ACTED[direction], any(e in ACTED[direction] for e in expect)
        kind = "over" if acted and not should else "missed" if should and not acted else "other"
        if kind == "over":
            t[2] += 1
        elif kind == "missed":
            t[3] += 1
        wrong.append((kind, direction, expect, got, verdict.category, verdict.severity, verdict.by, text))

    print(f"Safety check test set {data['version']}, {'our rules only' if rules_only else 'rules + OpenAI + checker'}\n")
    for direction, (n, right, over, missed) in totals.items():
        print(f"  {direction:7} {right}/{n} right   over-moderated {over}   missed {missed}")
    if wrong:
        print("\nNot as expected:")
        for kind, direction, expect, got, category, severity, by, text in wrong:
            print(f"  [{kind}] {direction}: expected {'/'.join(expect)}, got {got} ({category} S{severity}, {by}): {text[:90]}")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    which = args[args.index("--set") + 1] if "--set" in args and args.index("--set") + 1 < len(args) else "cases"
    if which not in SETS:
        sys.exit(f"--set is one of: {', '.join(SETS)}")
    sys.exit(asyncio.run(main("--rules" in args, which)))
