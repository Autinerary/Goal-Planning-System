"""Strip other people's details from a plan before it leaves the server.

A stored plan (user_paths.payload) keeps the Pattern Recognition result it
was built with. That result lists the people the plan was matched against:
`similar_users` (each one's account id, conditions, a goals summary, success
rate and match score) and `retrieved_user_ids`. On 8 Oct 2026, 81 of 95
stored plans held 487 such entries. They were returned to the plan's owner,
to their connected friends and in data exports.

`without_other_people` returns a copy with those two lists removed and the
number of matches kept (`similar_users_count`), so "Found N similar users"
still reads right. The stored plan is not changed: every caller that writes
a plan back must keep using the stored copy, not this one. Removing the
filter brings the old responses back.

core/path_privacy.py here and frontend/lib/pathPrivacy.ts in the app do the
same thing; tests on both sides use the same example.
"""
from __future__ import annotations

import copy
from typing import Any

# Keys in the pattern_recognition result that hold other people's data.
OTHER_PEOPLE_KEYS = ("similar_users", "retrieved_user_ids")


def without_other_people(payload: Any) -> Any:
    """A copy of a plan without other people's details. Anything that is not
    a plan (None, a list, a string) comes back unchanged."""
    if not isinstance(payload, dict):
        return payload
    responses = payload.get("agentResponses")
    if not isinstance(responses, list) or not any(_holds_other_people(r) for r in responses):
        return payload
    clean = copy.deepcopy(payload)
    for response in clean["agentResponses"]:
        if _holds_other_people(response):
            result = response["result"]
            matches = result.get("similar_users")
            if isinstance(matches, list):
                result["similar_users_count"] = len(matches)
            for key in OTHER_PEOPLE_KEYS:
                result.pop(key, None)
    return clean


def _holds_other_people(response: Any) -> bool:
    return (isinstance(response, dict)
            and response.get("agentId") == "pattern_recognition"
            and isinstance(response.get("result"), dict)
            and any(key in response["result"] for key in OTHER_PEOPLE_KEYS))
