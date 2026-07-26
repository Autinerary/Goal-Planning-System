"""
Synthesis Engine
Combines outputs from multiple agents into coherent plans
"""

import re
from typing import List, Dict, Any, Optional

class SynthesisEngine:
    """Synthesizes agent outputs into unified responses"""
    
    def __init__(self):
        self.confidence_weights = {
            'path_planning': 0.3,
            'pattern_recognition': 0.25,
            'tool_recommendation': 0.2,
            'calendar_optimization': 0.15,
            'reflection_analysis': 0.1
        }
    
    async def synthesize(
        self,
        agent_responses: List[Dict[str, Any]],
        goals: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Synthesize multiple agent responses into a unified plan
        """
        # Extract results from each agent
        path_result = self._get_agent_result(agent_responses, 'path_planning')
        pattern_result = self._get_agent_result(agent_responses, 'pattern_recognition')
        tool_result = self._get_agent_result(agent_responses, 'tool_recommendation')
        calendar_result = self._get_agent_result(agent_responses, 'calendar_optimization')

        # Build races first (real goal-per-race grouping), then the path
        # wrapper that carries them.
        races = await self._build_races(
            path_result=path_result,
            tool_result=tool_result,
            goals=goals,
        )

        path = await self._build_path(
            path_result=path_result,
            pattern_result=pattern_result,
            tool_result=tool_result,
            races=races,
        )
        
        # Generate explanations
        explanations = await self._generate_explanations(
            agent_responses=agent_responses
        )
        
        return {
            'path': path,
            'races': races,
            'recommendations': tool_result.get('recommendations', {}),
            'schedule': calendar_result.get('schedule', []),
            'explanations': explanations,
            'agent_responses': agent_responses
        }
    
    async def synthesize_adaptation(
        self,
        reflection_response: Dict[str, Any],
        adaptation_response: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Synthesize adaptation responses"""
        return {
            'path': adaptation_response.get('updated_path'),
            'races': adaptation_response.get('updated_races'),
            'schedule': adaptation_response.get('calendar', {}).get('schedule', []),
            'explanations': [
                reflection_response.get('explanation', ''),
                adaptation_response.get('explanation', '')
            ],
            'insights': reflection_response.get('insights', {})
        }
    
    def _get_agent_result(
        self,
        agent_responses: List[Dict[str, Any]],
        agent_id: str
    ) -> Dict[str, Any]:
        """Get result from specific agent"""
        for response in agent_responses:
            if response.get('agentId') == agent_id:
                return response.get('result', {})
        return {}
    
    async def _build_path(
        self,
        path_result: Dict[str, Any],
        pattern_result: Dict[str, Any],
        tool_result: Dict[str, Any],
        races: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Build the Path wrapper carrying the real races and milestones.

        Compare/friend views read `path.races`, and several views fall back to
        `path.milestones`, so both carry the real agent output.
        """
        races = races or []
        return {
            'id': 'path_1',
            'name': 'Personalized Path',
            'description': 'Path generated from your goals and barriers',
            'races': races,
            'milestones': path_result.get('milestones', []),
        }

    @staticmethod
    def _race_index(race_id: str) -> int:
        """Sort key for race ids shaped like 'race_<n>' (unknown ids last)."""
        m = re.match(r'^race_(\d+)$', race_id or '')
        return int(m.group(1)) if m else 10_000

    async def _build_races(
        self,
        path_result: Dict[str, Any],
        tool_result: Dict[str, Any],
        goals: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Build one race per goal, with that goal's milestones grouped under it.

        The path-planning agent stamps every milestone with `raceId`
        ('race_<goal_idx>') and `goal` (the goal text), so grouping is a direct
        read — no inference. Falls back to grouping by goal text, then to a
        single race, so older payload shapes still synthesize.
        """
        goals = goals or []
        milestones = path_result.get('milestones', [])

        # Group milestones by raceId (primary) or goal text (fallback).
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        goal_text_to_race_id: Dict[str, str] = {}
        for m in milestones:
            race_id = m.get('raceId')
            if not race_id:
                goal_text = (m.get('goal') or '').strip()
                if goal_text:
                    if goal_text not in goal_text_to_race_id:
                        goal_text_to_race_id[goal_text] = f'race_{len(goal_text_to_race_id)}'
                    race_id = goal_text_to_race_id[goal_text]
                else:
                    race_id = 'race_0'
            grouped.setdefault(race_id, []).append(m)

        # Ensure every declared goal gets a race even if the planner produced
        # no milestones for it (the frontend renders it at 0% rather than
        # silently dropping the user's goal).
        for idx, _goal in enumerate(goals):
            grouped.setdefault(f'race_{idx}', [])

        races: List[Dict[str, Any]] = []
        for race_id in sorted(grouped.keys(), key=self._race_index):
            race_milestones = grouped[race_id]
            # Name the race by the user's actual goal: prefer the milestone's
            # own goal text, then the goals list by index.
            goal_name = next(
                (m.get('goal') for m in race_milestones if m.get('goal')), None
            )
            if not goal_name:
                idx = self._race_index(race_id)
                goal_name = goals[idx] if idx < len(goals) else f'Goal {len(races) + 1}'
            races.append({
                'id': race_id,
                'name': goal_name,
                'goal': goal_name,
                'progress': 0,
                'models': [],
                'milestones': race_milestones,
            })

        return races
    
    async def _generate_explanations(
        self,
        agent_responses: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate human-readable explanations"""
        explanations = []
        
        for response in agent_responses:
            agent_name = response.get('agentName', 'Unknown Agent')
            result = response.get('result', {})
            explanation = f"{agent_name}: {result.get('explanation', '')}"
            explanations.append(explanation)
        
        return explanations
