"""Tool Recommendation reads the step (28 October 2026): a word-relevance shortlist, then a model picks from it,
a few steps per call. No real model or database here: the pool is handed in and the model is a stand-in.

Run from backend/:  python -m unittest tests.test_tool_step_matching -v
"""
import asyncio
import unittest
from unittest import mock

from core.agents.tool_recommendation_agent import (STEP_PICKS, STEPS_PER_ASK, ToolRecommendationAgent, bm25_order,
                                                    read_step_picks)


def _svc(rid, name, description, category="Support Group", cost=None):
    return {"id": f"sh_{rid}", "resourceId": rid, "name": name, "description": description, "category": category,
            "type": "service", "rating": None, "reviews": 0, "costType": cost, "province": "ON"}


POOL = [
    _svc("college", "Northern College Accessibility Services", "Academic accommodations for college students with autism and ADHD", "Education Support"),
    _svc("swim", "Adapted Swim Lessons", "Adapted swimming lessons with instructors trained to teach autistic children", "Swimming"),
    _svc("ride", "Therapeutic Riding Centre", "Therapeutic horseback riding for children with autism", "Horseback Riding"),
    _svc("odsp", "Community Legal Clinic", "Help with ODSP applications and appeals for people with low incomes", "Legal & Future Planning"),
    _svc("respite", "Respite Services", "Respite for families of autistic children so parents get a break", "Social Services"),
]
SWIM = {"id": "m_swim", "name": "Find adapted swimming lessons", "description": "Swimming lessons with instructors trained to teach autistic children."}


def _agent():
    agent = ToolRecommendationAgent()
    agent._resource_pool = [dict(t) for t in POOL]
    agent._province = None
    return agent


class ShortlistTests(unittest.TestCase):
    def test_word_relevance_puts_the_steps_own_kind_of_service_first(self):
        order = bm25_order(POOL, "Find adapted swimming lessons for autistic children")
        self.assertEqual(order[0]["resourceId"], "swim")
        order = bm25_order(POOL, "Get help with an ODSP application or appeal")
        self.assertEqual(order[0]["resourceId"], "odsp")

    def test_an_empty_pool_gives_nothing(self):
        self.assertEqual(bm25_order([], "anything"), [])


class ReadingTheAnswerTests(unittest.TestCase):
    def test_numbers_become_services_and_anything_else_is_ignored(self):
        steps = [({"id": "a"}, POOL[:3]), ({"id": "b"}, POOL[3:])]
        got = read_step_picks({"S1": [2, "1", 2, 9, "x", None], "S2": []}, steps)
        self.assertEqual(got, {"a": ["sh_swim", "sh_college"], "b": []})
        self.assertEqual(read_step_picks("not a dict", steps), {})
        many = read_step_picks({"S1": [1, 2, 3, 1, 2, 3]}, [({"id": "a"}, POOL[:3])])
        self.assertLessEqual(len(many["a"]), STEP_PICKS)


class StepMatchingTests(unittest.TestCase):
    def test_the_models_picks_come_first(self):
        agent = _agent()

        async def answer(system, user, **kw):
            return {"S1": [3, 1]}                    # whatever the shortlist order, the model's own order wins

        with mock.patch("core.llm.is_enabled", return_value=True), mock.patch("core.llm.complete_json", side_effect=answer):
            tools = asyncio.run(agent._find_relevant_tools(SWIM, ["Autism"], {}))
        shortlist = agent._shortlist(agent._for_place(agent._resource_pool), SWIM, ["Autism"])
        self.assertEqual([t["id"] for t in tools[:2]], [shortlist[2]["id"], shortlist[0]["id"]])
        self.assertTrue(all("relevanceScore" in t for t in tools))   # the confidence formula still has its scores

    def test_a_plan_makes_one_call_per_group_of_steps(self):
        agent = _agent()
        calls = []

        async def answer(system, user, **kw):
            if system.startswith("You match the steps"):      # not the existing "how it helps" call
                calls.append(user)
            return {}

        async def pool():                               # recommend_tools reloads the pool each run
            return [dict(t) for t in POOL]

        agent._fetch_resource_pool = pool
        steps = [dict(SWIM, id=f"m{i}") for i in range(9)]
        with mock.patch("core.llm.is_enabled", return_value=True), mock.patch("core.llm.complete_json", side_effect=answer), \
             mock.patch("core.learning.get_tool_outcome_scores", new=mock.AsyncMock(return_value={})):
            asyncio.run(agent.recommend_tools(user_profile={}, milestones=steps, barriers=["Autism"]))
        self.assertEqual(len(calls), -(-9 // STEPS_PER_ASK))          # 9 steps, 4 a call: 3 calls, not 9
        self.assertIn("<user_text>Autism</user_text>", calls[0])      # the person's words are fenced

    def test_without_a_usable_answer_the_shortlist_order_stands(self):
        for failure in (None, {"S1": "nonsense"}, RuntimeError("Too many requests")):
            agent = _agent()

            async def answer(system, user, **kw):
                if isinstance(failure, Exception):
                    raise failure
                return failure

            with mock.patch("core.llm.is_enabled", return_value=True), mock.patch("core.llm.complete_json", side_effect=answer):
                tools = asyncio.run(agent._find_relevant_tools(SWIM, ["Autism"], {}))
            self.assertEqual(tools[0]["resourceId"], "swim", failure)

    def test_with_the_model_off_nothing_is_asked(self):
        agent = _agent()
        with mock.patch("core.llm.is_enabled", return_value=False), \
             mock.patch("core.llm.complete_json", side_effect=AssertionError("the model was asked")):
            tools = asyncio.run(agent._find_relevant_tools(SWIM, ["Autism"], {}))
        self.assertEqual(tools[0]["resourceId"], "swim")


if __name__ == "__main__":
    unittest.main()
