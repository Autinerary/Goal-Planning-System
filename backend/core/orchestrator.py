"""
Multi-Agent Orchestrator
Coordinates 6 specialized AI agents to create personalized life plans
"""

from typing import Dict, List, Any, Optional
import asyncio
from datetime import datetime

from core.agents.path_planning_agent import PathPlanningAgent
from core.agents.pattern_recognition_agent import PatternRecognitionAgent
from core.agents.tool_recommendation_agent import ToolRecommendationAgent
from core.agents.reflection_analysis_agent import ReflectionAnalysisAgent
from core.agents.adaptation_agent import AdaptationAgent
from core.agents.calendar_optimization_agent import CalendarOptimizationAgent
from core.synthesis_engine import SynthesisEngine
# Note: shared.types is TypeScript, using dicts for Python

class Orchestrator:
    """
    Orchestrator coordinates all agents and synthesizes their outputs
    """
    
    def __init__(self):
        self.agents = {}
        self.synthesis_engine = SynthesisEngine()
        self.initialized = False
    
    async def initialize(self):
        """Initialize all agents"""
        if self.initialized:
            return
        
        # Initialize all agents
        self.agents['path_planning'] = PathPlanningAgent()
        self.agents['pattern_recognition'] = PatternRecognitionAgent()
        self.agents['tool_recommendation'] = ToolRecommendationAgent()
        self.agents['reflection_analysis'] = ReflectionAnalysisAgent()
        self.agents['adaptation'] = AdaptationAgent()
        self.agents['calendar_optimization'] = CalendarOptimizationAgent()
        
        # Initialize each agent
        for agent in self.agents.values():
            await agent.initialize()
        
        self.initialized = True
        print("Orchestrator initialized with 6 agents")
    
    async def cleanup(self):
        """Cleanup resources"""
        for agent in self.agents.values():
            await agent.cleanup()
        self.initialized = False
    
    async def generate_path(
        self, 
        user_profile: dict,
        goals: List[str],
        barriers: List[str]
    ) -> dict:
        """
        Main orchestration method: Generate a personalized path
        """
        if not self.initialized:
            await self.initialize()
        
        # Step 1: Pattern Recognition Agent finds similar users and models
        pattern_response = await self.agents['pattern_recognition'].find_similar_patterns(
            user_profile=user_profile,
            goals=goals,
            barriers=barriers
        )
        
        # Step 2: Path Planning Agent creates the roadmap
        path_response = await self.agents['path_planning'].generate_path(
            user_profile=user_profile,
            goals=goals,
            barriers=barriers,
            similar_patterns=pattern_response.get('patterns', [])
        )
        
        # Step 3: Tool Recommendation Agent finds resources
        tool_response = await self.agents['tool_recommendation'].recommend_tools(
            user_profile=user_profile,
            milestones=path_response.get('milestones', []),
            barriers=barriers
        )
        
        # Step 4: Calendar Optimization Agent creates schedule
        calendar_response = await self.agents['calendar_optimization'].optimize_calendar(
            user_profile=user_profile,
            milestones=path_response.get('milestones', []),
            tasks=path_response.get('tasks', [])
        )
        
        # Step 5: Synthesis Engine combines all agent outputs
        agent_responses = [
            {
                'agentId': 'pattern_recognition',
                'agentName': 'Pattern Recognition Agent',
                'result': pattern_response,
                'confidence': pattern_response.get('confidence', 0.8)
            },
            {
                'agentId': 'path_planning',
                'agentName': 'Path Planning Agent',
                'result': path_response,
                'confidence': path_response.get('confidence', 0.85)
            },
            {
                'agentId': 'tool_recommendation',
                'agentName': 'Tool Recommendation Agent',
                'result': tool_response,
                'confidence': tool_response.get('confidence', 0.75)
            },
            {
                'agentId': 'calendar_optimization',
                'agentName': 'Calendar Optimization Agent',
                'result': calendar_response,
                'confidence': calendar_response.get('confidence', 0.8)
            }
        ]
        
        synthesized = await self.synthesis_engine.synthesize(agent_responses)
        
        return {
            'path': synthesized.get('path'),
            'races': synthesized.get('races'),
            'recommendations': synthesized.get('recommendations'),
            'schedule': synthesized.get('schedule'),
            'explanations': synthesized.get('explanations', []),
            'agentResponses': agent_responses
        }
    
    async def adapt_path(
        self,
        user_id: str,
        path_id: str,
        reflection_data: Dict[str, Any]
    ) -> dict:
        """
        Adapt existing path based on user reflections
        """
        if not self.initialized:
            await self.initialize()
        
        # Step 1: Reflection Analysis Agent analyzes the reflection
        reflection_response = await self.agents['reflection_analysis'].analyze_reflection(
            reflection_data=reflection_data,
            user_id=user_id
        )
        
        # Step 2: Adaptation Agent adjusts the path
        adaptation_response = await self.agents['adaptation'].adapt_path(
            user_id=user_id,
            path_id=path_id,
            reflection_insights=reflection_response.get('insights', {}),
            current_progress=reflection_response.get('progress', {})
        )
        
        # Step 3: If calendar needs updating, Calendar Agent optimizes
        if adaptation_response.get('needs_calendar_update', False):
            calendar_response = await self.agents['calendar_optimization'].optimize_calendar(
                user_profile=reflection_response.get('user_profile'),
                milestones=adaptation_response.get('updated_milestones', []),
                tasks=adaptation_response.get('updated_tasks', [])
            )
            adaptation_response['calendar'] = calendar_response
        
        # Step 4: Synthesis
        synthesized = await self.synthesis_engine.synthesize_adaptation(
            reflection_response=reflection_response,
            adaptation_response=adaptation_response
        )
        
        return {
            'path': synthesized.get('path'),
            'races': synthesized.get('races'),
            'schedule': synthesized.get('schedule'),
            'explanations': synthesized.get('explanations', []),
            'agentResponses': [
                {
                    'agentId': 'reflection_analysis',
                    'agentName': 'Reflection Analysis Agent',
                    'result': reflection_response,
                    'confidence': reflection_response.get('confidence', 0.8)
                },
                {
                    'agentId': 'adaptation',
                    'agentName': 'Adaptation Agent',
                    'result': adaptation_response,
                    'confidence': adaptation_response.get('confidence', 0.75)
                }
            ]
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of all agents"""
        health = {
            'initialized': self.initialized,
            'agents': {}
        }
        
        for name, agent in self.agents.items():
            try:
                agent_health = await agent.health_check()
                health['agents'][name] = agent_health
            except Exception as e:
                health['agents'][name] = {'status': 'error', 'error': str(e)}
        
        return health
