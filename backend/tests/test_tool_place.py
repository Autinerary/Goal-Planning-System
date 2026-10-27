"""Tool Recommendation suggests services where the person lives, or for anyone in Canada.

The pool had no place in it, so a person in Ontario was shown British Columbia's
services (27 October 2026: 81 of 90 top-three suggestions in a 30-step test were
from another province). No model and no database here: the pool is handed in.

Run from backend/:  python -m unittest tests.test_tool_place -v
"""
import asyncio
import unittest
from unittest import mock

from core.agents.tool_recommendation_agent import ToolRecommendationAgent, province_code


def _tool(rid, province, name=None):
    return {"id": f"sh_{rid}", "resourceId": rid, "name": name or f"Autism support {rid}",
            "description": "Support for autistic adults and families", "category": "Support Group", "type": "service",
            "rating": None, "reviews": 0, "costType": None, "province": province}


POOL = [_tool("on1", "ON"), _tool("bc1", "BC"), _tool("nat1", ""), _tool("on2", "ON"), _tool("odd", None, "Listed with a city as its province")]


class _Rows:
    def __init__(self, data):
        self.data = data


class _Profiles:
    """Just enough of the Supabase client for select('location').eq('id', ...).limit(1).execute()."""

    def __init__(self, location):
        self.location = location
        self.asked = []

    def table(self, name):
        self.asked.append(name)
        return self

    def select(self, *_a):
        return self

    def eq(self, *_a):
        return self

    def limit(self, *_a):
        return self

    def execute(self):
        return _Rows([{"location": self.location}] if self.location is not None else [])


def _agent(province=None, supabase=None):
    agent = ToolRecommendationAgent()
    agent._resource_pool = [dict(t) for t in POOL]
    agent._province = province
    agent.supabase = supabase
    return agent


class ProvinceCodeTests(unittest.TestCase):
    def test_names_and_codes_as_the_app_reads_them(self):
        self.assertEqual(province_code("Ontario"), "ON")
        self.assertEqual(province_code(" on "), "ON")
        self.assertEqual(province_code("Québec"), "QC")
        self.assertEqual(province_code("PEI"), "PE")
        self.assertEqual(province_code(""), "")            # a national service
        self.assertEqual(province_code(None), "")
        self.assertIsNone(province_code("St. James"))       # a city in the province field


class PlaceFilterTests(unittest.TestCase):
    def test_a_person_in_ontario_gets_ontario_and_national_services_only(self):
        agent = _agent("ON")
        with mock.patch("core.llm.is_enabled", return_value=False):
            tools = asyncio.run(agent._find_relevant_tools({"id": "m", "name": "Find an autism support group", "description": ""},
                                                           ["Autism"], {}))
            shelf = asyncio.run(agent._get_pit_stop_tools(["Autism"]))
        self.assertEqual({t["resourceId"] for t in tools}, {"on1", "on2", "nat1"})
        self.assertEqual({t["resourceId"] for group in shelf.values() for t in group}, {"on1", "on2", "nat1"})

    def test_when_we_dont_know_where_they_live_nothing_is_filtered(self):
        agent = _agent(None)
        with mock.patch("core.llm.is_enabled", return_value=False):
            tools = asyncio.run(agent._find_relevant_tools({"id": "m", "name": "Find an autism support group", "description": ""},
                                                           ["Autism"], {}))
        self.assertEqual({t["resourceId"] for t in tools}, {"on1", "on2", "nat1", "bc1", "odd"})


class WhereThePersonLivesTests(unittest.TestCase):
    def test_from_the_request_when_it_carries_a_place(self):
        agent = _agent(supabase=_Profiles({"province": "BC"}))
        self.assertEqual(asyncio.run(agent._person_province({"location": {"province": "Ontario"}})), "ON")
        self.assertEqual(asyncio.run(agent._person_province({"province": "ab"})), "AB")
        self.assertEqual(agent.supabase.asked, [])          # no need to read the profile row

    def test_from_the_profile_row_otherwise(self):
        agent = _agent(supabase=_Profiles({"city": "Toronto", "province": "Ontario"}))
        self.assertEqual(asyncio.run(agent._person_province({"id": "user-1"})), "ON")
        self.assertEqual(agent.supabase.asked, ["profiles"])

    def test_unknown_when_there_is_nothing_to_go_on(self):
        self.assertIsNone(asyncio.run(_agent(supabase=_Profiles(None))._person_province({"id": "user-1"})))
        self.assertIsNone(asyncio.run(_agent(supabase=_Profiles({"province": ""}))._person_province({"id": "user-1"})))
        self.assertIsNone(asyncio.run(_agent(supabase=_Profiles({"province": "St. James"}))._person_province({"id": "u"})))
        with mock.patch("core.agents.tool_recommendation_agent.get_supabase", return_value=None):
            self.assertIsNone(asyncio.run(_agent()._person_province({})))
            self.assertIsNone(asyncio.run(_agent()._person_province({"id": "user-1"})))


if __name__ == "__main__":
    unittest.main()
