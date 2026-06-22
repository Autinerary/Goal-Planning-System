"""
LangGraph Multi-Agent Orchestrator
Coordinates 6 specialized AI agents using LangGraph state machines.

Public interface (kept compatible with the previous custom orchestrator):
    - initialize()
    - cleanup()
    - generate_path(user_profile, goals, barriers) -> dict
    - adapt_path(user_id, path_id, reflection_data) -> dict
    - health_check() -> dict
"""

from typing import Dict, List, Any, Optional, TypedDict
import importlib

from core.agents.path_planning_agent import PathPlanningAgent
from core.agents.pattern_recognition_agent import PatternRecognitionAgent
from core.agents.tool_recommendation_agent import ToolRecommendationAgent
from core.agents.reflection_analysis_agent import ReflectionAnalysisAgent
from core.agents.adaptation_agent import AdaptationAgent
from core.agents.calendar_optimization_agent import CalendarOptimizationAgent
from core.synthesis_engine import SynthesisEngine
from core import learning

try:
    langgraph_graph = importlib.import_module("langgraph.graph")
    StateGraph = langgraph_graph.StateGraph
    END = langgraph_graph.END
    LANGGRAPH_AVAILABLE = True
except Exception:
    LANGGRAPH_AVAILABLE = False
    StateGraph = None  # type: ignore
    END = None  # type: ignore


# ---------- LangGraph state definitions ----------

class GenerationState(TypedDict, total=False):
    # user_id is optional: when present, the synthesis node will snapshot the
    # generation context into Supabase so the next reflection can attribute
    # reward back to every individual agent decision (path shape, tool ids,
    # schedule buckets, similar users). When absent, nothing is written.
    user_id: str
    user_profile: Dict[str, Any]
    goals: List[str]
    barriers: List[str]
    memory: Dict[str, Any]
    pattern_response: Dict[str, Any]
    path_response: Dict[str, Any]
    tool_response: Dict[str, Any]
    calendar_response: Dict[str, Any]
    agent_responses: List[Dict[str, Any]]
    final: Dict[str, Any]


class AdaptationState(TypedDict, total=False):
    user_id: str
    path_id: str
    reflection_data: Dict[str, Any]
    reflection_response: Dict[str, Any]
    adaptation_response: Dict[str, Any]
    needs_calendar_update: bool
    calendar_response: Dict[str, Any]
    final: Dict[str, Any]


class Orchestrator:
    """
    LangGraph-based orchestrator that wires the 6 specialized agents
    into two state machines: one for path generation and one for adaptation.
    """

    def __init__(self):
        self.agents: Dict[str, Any] = {}
        self.synthesis_engine = SynthesisEngine()
        self.initialized = False
        self.generation_graph = None
        self.adaptation_graph = None

    # ---------- lifecycle ----------

    async def initialize(self):
        if self.initialized:
            return

        if not LANGGRAPH_AVAILABLE:
            raise RuntimeError(
                "LangGraph is not installed. Run: pip install langgraph langchain-core"
            )

        # Initialize all agents
        self.agents['path_planning'] = PathPlanningAgent()
        self.agents['pattern_recognition'] = PatternRecognitionAgent()
        self.agents['tool_recommendation'] = ToolRecommendationAgent()
        self.agents['reflection_analysis'] = ReflectionAnalysisAgent()
        self.agents['adaptation'] = AdaptationAgent()
        self.agents['calendar_optimization'] = CalendarOptimizationAgent()

        for agent in self.agents.values():
            await agent.initialize()

        # Build the two LangGraph state machines
        self.generation_graph = self._build_generation_graph()
        self.adaptation_graph = self._build_adaptation_graph()

        self.initialized = True
        print("LangGraph Orchestrator initialized with 6 agents")

    async def cleanup(self):
        for agent in self.agents.values():
            await agent.cleanup()
        self.agents = {}
        self.generation_graph = None
        self.adaptation_graph = None
        self.initialized = False

    # ---------- generation graph ----------

    def _build_generation_graph(self):
        graph = StateGraph(GenerationState)

        graph.add_node("pattern_recognition", self._node_pattern_recognition)
        graph.add_node("path_planning", self._node_path_planning)
        graph.add_node("tool_recommendation", self._node_tool_recommendation)
        graph.add_node("calendar_optimization", self._node_calendar_optimization)
        graph.add_node("synthesis", self._node_generation_synthesis)

        graph.set_entry_point("pattern_recognition")
        graph.add_edge("pattern_recognition", "path_planning")
        graph.add_edge("path_planning", "tool_recommendation")
        graph.add_edge("tool_recommendation", "calendar_optimization")
        graph.add_edge("calendar_optimization", "synthesis")
        graph.add_edge("synthesis", END)

        return graph.compile()

    async def _node_pattern_recognition(self, state: GenerationState) -> Dict[str, Any]:
        response = await self.agents['pattern_recognition'].find_similar_patterns(
            user_profile=state['user_profile'],
            goals=state['goals'],
            barriers=state['barriers'],
            memory=state.get('memory', {}),
        )
        return {"pattern_response": response}

    async def _node_path_planning(self, state: GenerationState) -> Dict[str, Any]:
        response = await self.agents['path_planning'].generate_path(
            user_profile=state['user_profile'],
            goals=state['goals'],
            barriers=state['barriers'],
            similar_patterns=state.get('pattern_response', {}).get('patterns', []),
            memory=state.get('memory', {}),
        )
        return {"path_response": response}

    async def _node_tool_recommendation(self, state: GenerationState) -> Dict[str, Any]:
        response = await self.agents['tool_recommendation'].recommend_tools(
            user_profile=state['user_profile'],
            milestones=state.get('path_response', {}).get('milestones', []),
            barriers=state['barriers'],
            # Cross-agent context: patterns found by pattern_recognition
            similar_patterns=state.get('pattern_response', {}).get('patterns', []),
        )
        return {"tool_response": response}

    async def _node_calendar_optimization(self, state: GenerationState) -> Dict[str, Any]:
        response = await self.agents['calendar_optimization'].optimize_calendar(
            user_profile=state['user_profile'],
            milestones=state.get('path_response', {}).get('milestones', []),
            tasks=state.get('path_response', {}).get('tasks', []),
            # Cross-agent context: tools and patterns for smarter scheduling
            recommended_tools=state.get('tool_response', {}).get('tools', []),
            similar_patterns=state.get('pattern_response', {}).get('patterns', []),
        )
        return {"calendar_response": response}

    async def _node_generation_synthesis(self, state: GenerationState) -> Dict[str, Any]:
        agent_responses = [
            {
                'agentId': 'pattern_recognition',
                'agentName': 'Pattern Recognition Agent',
                'result': state.get('pattern_response', {}),
                'confidence': state.get('pattern_response', {}).get('confidence', 0.8),
            },
            {
                'agentId': 'path_planning',
                'agentName': 'Path Planning Agent',
                'result': state.get('path_response', {}),
                'confidence': state.get('path_response', {}).get('confidence', 0.85),
            },
            {
                'agentId': 'tool_recommendation',
                'agentName': 'Tool Recommendation Agent',
                'result': state.get('tool_response', {}),
                'confidence': state.get('tool_response', {}).get('confidence', 0.75),
            },
            {
                'agentId': 'calendar_optimization',
                'agentName': 'Calendar Optimization Agent',
                'result': state.get('calendar_response', {}),
                'confidence': state.get('calendar_response', {}).get('confidence', 0.8),
            },
        ]

        synthesized = await self.synthesis_engine.synthesize(agent_responses)

        final = {
            'path': synthesized.get('path'),
            'races': synthesized.get('races'),
            'recommendations': synthesized.get('recommendations'),
            'schedule': synthesized.get('schedule'),
            'explanations': synthesized.get('explanations', []),
            'agentResponses': agent_responses,
        }

        # Snapshot the generation context so the next reflection can close
        # every agent's feedback loop. Best-effort: never fail synthesis.
        user_id = state.get('user_id')
        if user_id:
            try:
                path_resp = state.get('path_response', {}) or {}
                tool_resp = state.get('tool_response', {}) or {}
                calendar_resp = state.get('calendar_response', {}) or {}
                pattern_resp = state.get('pattern_response', {}) or {}

                milestones = path_resp.get('milestones') or []
                est_days_list = [
                    float(m.get('estimatedDays') or 0)
                    for m in milestones
                    if m.get('estimatedDays')
                ]
                est_days_avg = (
                    sum(est_days_list) / len(est_days_list)
                    if est_days_list else None
                )

                tool_ids = [
                    str(t.get('id'))
                    for t in (tool_resp.get('tools') or [])
                    if t.get('id')
                ]

                schedule_days = calendar_resp.get('schedule') or []
                scheduled_buckets = [
                    str(d.get('time_bucket'))
                    for d in schedule_days
                    if isinstance(d, dict) and d.get('time_bucket')
                ]

                retrieved_ids = (
                    pattern_resp.get('retrieved_user_ids')
                    or self.agents['pattern_recognition'].last_retrieved_user_ids
                    or []
                )

                profile_sig = learning.compute_profile_signature(
                    state.get('barriers') or [],
                    state.get('goals') or [],
                )

                await learning.snapshot_user_context(
                    user_id=user_id,
                    profile_signature=profile_sig,
                    milestone_count=len(milestones),
                    est_days_avg=est_days_avg,
                    recommended_tool_ids=tool_ids,
                    scheduled_buckets=scheduled_buckets,
                    retrieved_user_ids=retrieved_ids,
                    barriers=state.get('barriers') or [],
                )
            except Exception as e:
                print(f"[orchestrator] snapshot_user_context skipped: {e}")

        return {"agent_responses": agent_responses, "final": final}

    # ---------- adaptation graph ----------

    def _build_adaptation_graph(self):
        graph = StateGraph(AdaptationState)

        graph.add_node("reflection_analysis", self._node_reflection_analysis)
        graph.add_node("adaptation", self._node_adaptation)
        graph.add_node("calendar_optimization", self._node_adapt_calendar)
        graph.add_node("synthesis", self._node_adaptation_synthesis)

        graph.set_entry_point("reflection_analysis")
        graph.add_edge("reflection_analysis", "adaptation")
        graph.add_conditional_edges(
            "adaptation",
            self._needs_calendar_update,
            {
                "calendar": "calendar_optimization",
                "skip": "synthesis",
            },
        )
        graph.add_edge("calendar_optimization", "synthesis")
        graph.add_edge("synthesis", END)

        return graph.compile()

    async def _node_reflection_analysis(self, state: AdaptationState) -> Dict[str, Any]:
        response = await self.agents['reflection_analysis'].analyze_reflection(
            reflection_data=state['reflection_data'],
            user_id=state['user_id'],
        )
        return {"reflection_response": response}

    async def _node_adaptation(self, state: AdaptationState) -> Dict[str, Any]:
        reflection = state.get('reflection_response', {})
        response = await self.agents['adaptation'].adapt_path(
            user_id=state['user_id'],
            path_id=state['path_id'],
            reflection_insights=reflection.get('insights', {}),
            current_progress=reflection.get('progress', {}),
        )
        return {
            "adaptation_response": response,
            "needs_calendar_update": bool(response.get('needs_calendar_update', False)),
        }

    def _needs_calendar_update(self, state: AdaptationState) -> str:
        return "calendar" if state.get("needs_calendar_update") else "skip"

    async def _node_adapt_calendar(self, state: AdaptationState) -> Dict[str, Any]:
        reflection = state.get('reflection_response', {})
        adaptation = state.get('adaptation_response', {})
        response = await self.agents['calendar_optimization'].optimize_calendar(
            user_profile=reflection.get('user_profile'),
            milestones=adaptation.get('updated_milestones', []),
            tasks=adaptation.get('updated_tasks', []),
        )
        merged = dict(adaptation)
        merged['calendar'] = response
        return {"adaptation_response": merged, "calendar_response": response}

    async def _node_adaptation_synthesis(self, state: AdaptationState) -> Dict[str, Any]:
        reflection = state.get('reflection_response', {})
        adaptation = state.get('adaptation_response', {})

        synthesized = await self.synthesis_engine.synthesize_adaptation(
            reflection_response=reflection,
            adaptation_response=adaptation,
        )

        final = {
            'path': synthesized.get('path'),
            'races': synthesized.get('races'),
            'schedule': synthesized.get('schedule'),
            'explanations': synthesized.get('explanations', []),
            'agentResponses': [
                {
                    'agentId': 'reflection_analysis',
                    'agentName': 'Reflection Analysis Agent',
                    'result': reflection,
                    'confidence': reflection.get('confidence', 0.8),
                },
                {
                    'agentId': 'adaptation',
                    'agentName': 'Adaptation Agent',
                    'result': adaptation,
                    'confidence': adaptation.get('confidence', 0.75),
                },
            ],
        }
        return {"final": final}

    # ---------- public API (unchanged signatures) ----------

    async def generate_path(
        self,
        user_profile: dict,
        goals: List[str],
        barriers: List[str],
        memory: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ) -> dict:
        if not self.initialized:
            await self.initialize()

        # Prefer explicit user_id; fall back to user_profile['id'] which the
        # API routes already populate from the auth session.
        resolved_uid = user_id or user_profile.get('id') or user_profile.get('userId')

        initial: GenerationState = {
            "user_profile": user_profile,
            "goals": goals,
            "barriers": barriers,
            "memory": memory or {},
        }
        if resolved_uid:
            initial["user_id"] = str(resolved_uid)
        result = await self.generation_graph.ainvoke(initial)
        return result.get("final", {})

    async def adapt_path(
        self,
        user_id: str,
        path_id: str,
        reflection_data: Dict[str, Any],
    ) -> dict:
        if not self.initialized:
            await self.initialize()

        initial: AdaptationState = {
            "user_id": user_id,
            "path_id": path_id,
            "reflection_data": reflection_data,
        }
        result = await self.adaptation_graph.ainvoke(initial)
        return result.get("final", {})

    async def index_user(
        self,
        user_id: str,
        user_profile: dict,
        goals: List[str],
        barriers: List[str],
        agent_result: Optional[Dict[str, Any]] = None,
        success_rate: float = 0.5,
    ) -> bool:
        """Store the user's embedding in the vector DB after a run.

        This populates Supabase pgvector (table `pattern_user_embeddings`) so
        future users get matched against real people. Must be called while the
        orchestrator is still initialized (before cleanup). No-ops gracefully
        when Supabase isn't configured.
        """
        if not self.initialized:
            await self.initialize()

        agent = self.agents.get("pattern_recognition")
        if agent is None:
            return False

        result = agent_result or {}
        milestones = result.get("milestones") or (result.get("path") or {}).get("milestones") or []
        journey = (
            f"Goals: {', '.join(goals)}. "
            f"Barriers: {', '.join(barriers) or 'none'}. "
            f"Milestones: {len(milestones)}."
        )
        return await agent.upsert_user_vector(
            user_id=user_id,
            user_profile=user_profile,
            goals=goals,
            barriers=barriers,
            success_rate=success_rate,
            journey=journey,
        )

    async def health_check(self) -> Dict[str, Any]:
        health = {
            'initialized': self.initialized,
            'orchestrator': 'langgraph',
            'langgraph_available': LANGGRAPH_AVAILABLE,
            'agents': {},
        }
        for name, agent in self.agents.items():
            try:
                health['agents'][name] = await agent.health_check()
            except Exception as e:
                health['agents'][name] = {'status': 'error', 'error': str(e)}
        return health

