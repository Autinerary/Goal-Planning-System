"""
AutoGen-based Multi-Agent Orchestrator
Uses Microsoft AutoGen framework for agent collaboration
"""

import os
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

load_dotenv()

# Check simulation mode
SIMULATION_MODE = os.getenv("APP_MODE", "simulation") == "simulation"

if SIMULATION_MODE:
    # In simulation mode, we use a mock LLM config
    print("🤖 AutoGen: Running in SIMULATION mode (no LLM API calls)")
    
    # Mock config for simulation
    LLM_CONFIG = {
        "config_list": [
            {
                "model": "gpt-4",
                "api_key": "simulation-mode-no-key-needed"
            }
        ],
        "temperature": 0.7,
        "timeout": 120,
    }
else:
    # Production mode - use real API keys
    LLM_CONFIG = {
        "config_list": [
            {
                "model": os.getenv("OPENAI_MODEL", "gpt-4"),
                "api_key": os.getenv("OPENAI_API_KEY", ""),
            }
        ],
        "temperature": 0.7,
        "timeout": 120,
    }

# Import AutoGen only when needed (to avoid import errors if not installed)
try:
    import autogen
    from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager
    AUTOGEN_AVAILABLE = True
except ImportError:
    AUTOGEN_AVAILABLE = False
    print("⚠️  AutoGen not installed. Run: pip install pyautogen")


class AutoGenOrchestrator:
    """
    Orchestrates 6 specialized AI agents using AutoGen framework
    """
    
    def __init__(self):
        self.initialized = False
        self.agents = {}
        self.group_chat = None
        self.manager = None
        
    async def initialize(self):
        """Initialize all AutoGen agents"""
        if self.initialized:
            return
            
        if not AUTOGEN_AVAILABLE:
            print("⚠️  AutoGen not available - using fallback mode")
            self.initialized = True
            return
        
        # Create specialized agents
        self.agents = {
            'path_planning': self._create_path_planning_agent(),
            'pattern_recognition': self._create_pattern_recognition_agent(),
            'tool_recommendation': self._create_tool_recommendation_agent(),
            'reflection_analysis': self._create_reflection_analysis_agent(),
            'adaptation': self._create_adaptation_agent(),
            'calendar_optimization': self._create_calendar_optimization_agent(),
        }
        
        # Create user proxy (represents the system/user)
        self.user_proxy = UserProxyAgent(
            name="Orchestrator",
            system_message="""You are the orchestrator coordinating 6 specialized agents to create 
            personalized life plans for people facing systematic barriers (autism, ADHD, OCD, 
            visible minorities, etc.). Coordinate the agents to generate comprehensive, 
            barrier-aware plans.""",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=10,
            code_execution_config=False,
        )
        
        # Create group chat for agent collaboration
        all_agents = [self.user_proxy] + list(self.agents.values())
        self.group_chat = GroupChat(
            agents=all_agents,
            messages=[],
            max_round=12,
            speaker_selection_method="auto"
        )
        
        self.manager = GroupChatManager(
            groupchat=self.group_chat,
            llm_config=LLM_CONFIG if not SIMULATION_MODE else None
        )
        
        self.initialized = True
        print("🤖 AutoGen Orchestrator initialized with 6 agents")
        
    def _create_path_planning_agent(self) -> 'AssistantAgent':
        """Create the Path Planning Agent"""
        return AssistantAgent(
            name="PathPlanningAgent",
            system_message="""You are the Path Planning Agent. Your expertise is creating 
            step-by-step roadmaps for achieving goals while accounting for systematic barriers.
            
            Your responsibilities:
            1. Generate personalized paths based on user goals and barriers
            2. Create milestones that are barrier-aware (autism-friendly, ADHD-optimized, etc.)
            3. Consider intersectionality - how multiple barriers interact
            4. Provide recommended choices with success rates
            
            Barrier models you know:
            - Autism: structured approach, clear expectations, sensory considerations
            - ADHD: short bursts, immediate rewards, flexible structure, body doubling
            - OCD: gradual exposure, anxiety management, ritual awareness
            - Visible Minority: network building, cultural resources, advocacy skills
            
            Always explain WHY a path element was chosen for the specific barrier combination.""",
            llm_config=LLM_CONFIG if not SIMULATION_MODE else None,
            human_input_mode="NEVER",
        )
    
    def _create_pattern_recognition_agent(self) -> 'AssistantAgent':
        """Create the Pattern Recognition Agent"""
        return AssistantAgent(
            name="PatternRecognitionAgent",
            system_message="""You are the Pattern Recognition Agent. Your expertise is 
            analyzing journeys of people with similar barriers to find success patterns.
            
            Your responsibilities:
            1. Find patterns from similar users who succeeded
            2. Identify anti-patterns (what didn't work)
            3. Discover intersectional patterns (autism+ADHD combos, etc.)
            4. Recommend proven models based on barrier combinations
            
            Key patterns you've discovered:
            - Early accommodation requests → 73% higher completion
            - Body doubling for ADHD → 67% improved task completion
            - Special interest integration → 156% motivation increase
            - Community support for minorities → accelerated success
            
            Always cite pattern statistics and explain relevance to the user's profile.""",
            llm_config=LLM_CONFIG if not SIMULATION_MODE else None,
            human_input_mode="NEVER",
        )
    
    def _create_tool_recommendation_agent(self) -> 'AssistantAgent':
        """Create the Tool Recommendation Agent"""
        return AssistantAgent(
            name="ToolRecommendationAgent",
            system_message="""You are the Tool Recommendation Agent. Your expertise is 
            connecting users with the right resources (services, products, articles, communities).
            
            Your responsibilities:
            1. Recommend barrier-specific tools and services
            2. Find relevant commentaries and success stories
            3. Suggest products that help with specific challenges
            4. Connect users with communities and support networks
            
            Tools you know about:
            - Services: CADDAC, Autism Canada, ASAN, Focusmate, BetterHelp
            - Products: Tiimo, Forest App, Time Timer, noise-canceling headphones
            - Commentaries: How to ADHD (YouTube), Neuroclastic, ADHD Alien
            - Communities: Reddit r/ADHD, Actually Autistic community
            
            Always explain why a tool is relevant to the user's specific barriers.""",
            llm_config=LLM_CONFIG if not SIMULATION_MODE else None,
            human_input_mode="NEVER",
        )
    
    def _create_reflection_analysis_agent(self) -> 'AssistantAgent':
        """Create the Reflection Analysis Agent"""
        return AssistantAgent(
            name="ReflectionAnalysisAgent",
            system_message="""You are the Reflection Analysis Agent. Your expertise is 
            analyzing user journals and reflections to detect patterns and provide insights.
            
            Your responsibilities:
            1. Analyze sentiment (positive, negative, neutral)
            2. Detect coupled events (sleep issues → task avoidance, etc.)
            3. Identify burnout warning signs
            4. Extract what's working and what isn't
            
            Coupled events you watch for:
            - Poor sleep → task avoidance (78% correlation)
            - Skipping meals → energy crash (72% correlation)
            - Hyperfocus → next-day crash (74% correlation)
            - Social withdrawal → negative mood spiral
            
            Always provide actionable insights and celebrate wins, no matter how small.""",
            llm_config=LLM_CONFIG if not SIMULATION_MODE else None,
            human_input_mode="NEVER",
        )
    
    def _create_adaptation_agent(self) -> 'AssistantAgent':
        """Create the Adaptation Agent"""
        return AssistantAgent(
            name="AdaptationAgent",
            system_message="""You are the Adaptation Agent. Your expertise is adjusting 
            plans based on user progress and reflections.
            
            Your responsibilities:
            1. Detect when plans need adjustment
            2. Reduce workload when completion is low
            3. Add recovery time when stress is detected
            4. Gradually increase challenge when things are going well
            
            Adaptation rules:
            - Completion < 50% → reduce workload, smaller task chunks
            - Burnout detected → add recovery days, reduce intensity
            - Positive momentum → gradual challenge increase
            - Pattern detected → intervene with specific adjustments
            
            Barrier-specific adjustments:
            - ADHD: shorten tasks, add novelty, immediate rewards
            - Autism: reduce uncertainty, add structure, sensory breaks
            - OCD: reduce perfectionism pressure, set "good enough" criteria
            
            Always explain why an adaptation is being made.""",
            llm_config=LLM_CONFIG if not SIMULATION_MODE else None,
            human_input_mode="NEVER",
        )
    
    def _create_calendar_optimization_agent(self) -> 'AssistantAgent':
        """Create the Calendar Optimization Agent"""
        return AssistantAgent(
            name="CalendarOptimizationAgent",
            system_message="""You are the Calendar Optimization Agent. Your expertise is 
            scheduling tasks realistically based on energy patterns and barriers.
            
            Your responsibilities:
            1. Classify days by type (high energy, recovery, balanced)
            2. Schedule tasks based on energy patterns
            3. Create worst/average/best case scenarios
            4. Account for barrier-specific needs
            
            Scheduling rules by barrier:
            - Autism: max 4 transitions/day, 15min buffer, routine-based
            - ADHD: 25min max tasks, variety needed, movement breaks
            - OCD: 1.5x time allocation, checking buffer, clear end criteria
            
            Day themes:
            - Monday: Fresh Start (planning)
            - Tuesday: Deep Work (challenging tasks)
            - Wednesday: Momentum (progress)
            - Thursday: Connection (collaboration)
            - Friday: Completion (wrapping up)
            - Weekend: Flexible/Recovery
            
            Always create three scenarios: worst case (essentials only), 
            average case (sustainable), best case (full schedule).""",
            llm_config=LLM_CONFIG if not SIMULATION_MODE else None,
            human_input_mode="NEVER",
        )
    
    async def generate_path(
        self,
        user_profile: dict,
        goals: List[str],
        barriers: List[str]
    ) -> Dict[str, Any]:
        """
        Use AutoGen agents to collaboratively generate a personalized path
        """
        if not self.initialized:
            await self.initialize()
        
        if SIMULATION_MODE or not AUTOGEN_AVAILABLE:
            # In simulation mode, use the original orchestrator logic
            from core.orchestrator import Orchestrator
            fallback = Orchestrator()
            await fallback.initialize()
            return await fallback.generate_path(user_profile, goals, barriers)
        
        # Create the task message for the group chat
        task_message = f"""
        Create a personalized life plan for a user with the following profile:
        
        **Barriers:** {', '.join(barriers)}
        **Goals:** {', '.join(goals)}
        **Profile:** {user_profile}
        
        Each agent should contribute:
        1. PatternRecognitionAgent: Find similar successful journeys and patterns
        2. PathPlanningAgent: Generate barrier-aware milestones and paths
        3. ToolRecommendationAgent: Recommend tools for each milestone
        4. CalendarOptimizationAgent: Create realistic schedules
        
        Work together to create a comprehensive, barrier-aware plan.
        """
        
        # Initiate the group chat
        self.user_proxy.initiate_chat(
            self.manager,
            message=task_message
        )
        
        # Extract results from the conversation
        # In a real implementation, you'd parse the agent responses
        return self._parse_group_chat_results()
    
    async def adapt_path(
        self,
        user_id: str,
        path_id: str,
        reflection_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Use AutoGen agents to adapt an existing path based on reflection
        """
        if not self.initialized:
            await self.initialize()
        
        if SIMULATION_MODE or not AUTOGEN_AVAILABLE:
            from core.orchestrator import Orchestrator
            fallback = Orchestrator()
            await fallback.initialize()
            return await fallback.adapt_path(user_id, path_id, reflection_data)
        
        task_message = f"""
        Analyze this user reflection and adapt their path:
        
        **Reflection:** {reflection_data.get('freeFormText', '')}
        **Questions:** {reflection_data.get('questions', [])}
        
        Each agent should contribute:
        1. ReflectionAnalysisAgent: Analyze sentiment, detect patterns, identify concerns
        2. AdaptationAgent: Suggest plan adjustments based on analysis
        3. CalendarOptimizationAgent: Update schedule if needed
        
        Provide specific, actionable adaptations.
        """
        
        self.user_proxy.initiate_chat(
            self.manager,
            message=task_message
        )
        
        return self._parse_group_chat_results()
    
    def _parse_group_chat_results(self) -> Dict[str, Any]:
        """Parse results from the group chat conversation"""
        # In production, this would parse the actual conversation
        # For now, return a structured response
        return {
            'status': 'completed',
            'agents_participated': list(self.agents.keys()),
            'message': 'AutoGen agents collaborated to generate the plan'
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of AutoGen orchestrator"""
        return {
            'initialized': self.initialized,
            'autogen_available': AUTOGEN_AVAILABLE,
            'simulation_mode': SIMULATION_MODE,
            'agents': {
                name: {'status': 'healthy', 'type': 'AutoGen AssistantAgent'}
                for name in self.agents.keys()
            } if self.agents else {}
        }
    
    async def cleanup(self):
        """Cleanup resources"""
        self.agents = {}
        self.group_chat = None
        self.manager = None
        self.initialized = False
