"""
Synthesis Engine
Combines outputs from multiple agents into coherent plans
"""

from typing import List, Dict, Any

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
        agent_responses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Synthesize multiple agent responses into a unified plan
        """
        # Extract results from each agent
        path_result = self._get_agent_result(agent_responses, 'path_planning')
        pattern_result = self._get_agent_result(agent_responses, 'pattern_recognition')
        tool_result = self._get_agent_result(agent_responses, 'tool_recommendation')
        calendar_result = self._get_agent_result(agent_responses, 'calendar_optimization')
        
        # Build path structure
        path = await self._build_path(
            path_result=path_result,
            pattern_result=pattern_result,
            tool_result=tool_result
        )
        
        # Build races
        races = await self._build_races(
            path_result=path_result,
            tool_result=tool_result
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
        tool_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Build Path object from agent results"""
        # In production: Create full Path object
        return {
            'id': 'path_1',
            'name': 'Personalized Path',
            'description': 'Path generated based on your profile',
            'races': [],
            'stats': [],
            'motivationWheel': {
                'id': 'wheel_1',
                'options': ['Focus', 'Energy', 'Confidence', 'Growth']
            }
        }
    
    async def _build_races(
        self,
        path_result: Dict[str, Any],
        tool_result: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Build Race objects from agent results"""
        races = []
        milestones = path_result.get('milestones', [])
        
        # Group milestones into races (goals)
        # In production: Use goal-based grouping
        race = {
            'id': 'race_1',
            'name': 'Main Goal',
            'goal': 'Achieve primary objective',
            'progress': 0,
            'models': [],
            'milestones': milestones
        }
        races.append(race)
        
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
