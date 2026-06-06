"""
Agent 1: Path Planning Agent
Creates the roadmap from current state to goals
SIMULATION MODE: Uses predefined models and generates realistic paths
"""

from typing import List, Dict, Any, Optional
from core.agents.base_agent import BaseAgent
from core.config import Config
from core import llm
from core import memory as mem
import asyncio
import random

class PathPlanningAgent(BaseAgent):
    """Generates step-by-step paths based on goals and barriers"""
    
    def __init__(self):
        super().__init__('path_planning', 'Path Planning Agent')
        self.barrier_models = {}
        self.goal_templates = {}
    
    async def initialize(self):
        """Initialize path planning models"""
        # Load barrier-specific path models (simulation mode)
        self.barrier_models = {
            'autism': {
                'strategies': ['structured_approach', 'clear_expectations', 'sensory_considerations', 'routine_based'],
                'strengths': ['attention_to_detail', 'pattern_recognition', 'deep_focus', 'systematic_thinking'],
                'accommodations': ['quiet_workspace', 'written_instructions', 'advance_notice', 'predictable_schedule']
            },
            'adhd': {
                'strategies': ['short_bursts', 'immediate_rewards', 'flexible_structure', 'body_doubling'],
                'strengths': ['creativity', 'hyperfocus', 'out_of_box_thinking', 'energy'],
                'accommodations': ['movement_breaks', 'visual_timers', 'task_chunking', 'accountability_partner']
            },
            'ocd': {
                'strategies': ['gradual_exposure', 'anxiety_management', 'ritual_awareness', 'cognitive_restructuring'],
                'strengths': ['thoroughness', 'organization', 'attention_to_quality', 'persistence'],
                'accommodations': ['flexible_deadlines', 'check_in_systems', 'stress_management_tools']
            },
            'visible_minority': {
                'strategies': ['network_building', 'cultural_resources', 'advocacy_skills', 'mentorship'],
                'strengths': ['cultural_competence', 'resilience', 'adaptability', 'diverse_perspective'],
                'accommodations': ['inclusive_environments', 'cultural_support_groups', 'bias_awareness']
            },
            'bipolar': {
                'strategies': ['mood_tracking', 'energy_management', 'trigger_awareness', 'support_system'],
                'strengths': ['creativity', 'empathy', 'resilience', 'emotional_depth'],
                'accommodations': ['flexible_scheduling', 'wellness_check_ins', 'workload_adjustment']
            }
        }
        
        # Goal templates for different life areas
        self.goal_templates = {
            'education': [
                'Research and identify accommodations available',
                'Connect with disability services office',
                'Build study support network',
                'Develop personalized study strategies',
                'Create semester milestone plan',
                'Establish regular check-ins with advisor',
                'Build portfolio of work',
                'Prepare for graduation/next steps'
            ],
            'career': [
                'Identify career interests and strengths',
                'Research inclusive employers',
                'Build professional network',
                'Develop interview strategies',
                'Create accommodations request template',
                'Secure internship/entry position',
                'Build workplace success habits',
                'Plan career advancement'
            ],
            'health': [
                'Establish healthcare team',
                'Create daily wellness routine',
                'Build healthy sleep habits',
                'Develop exercise routine',
                'Create meal planning system',
                'Build stress management toolkit',
                'Establish social support network',
                'Track and celebrate progress'
            ],
            'relationships': [
                'Understand own communication style',
                'Identify relationship goals',
                'Build social skills toolkit',
                'Practice boundary setting',
                'Develop conflict resolution skills',
                'Create meaningful connections',
                'Maintain healthy relationships',
                'Build support community'
            ]
        }
        
        self.initialized = True
        mode = "with OpenAI" if llm.is_enabled() else "(simulation mode)"
        print(f"   ✓ {self.agent_name} initialized {mode}")
    
    async def cleanup(self):
        """Cleanup resources"""
        self.initialized = False
    
    async def generate_path(
        self,
        user_profile: dict,
        goals: List[str],
        barriers: List[str],
        similar_patterns: List[Dict[str, Any]] = None,
        memory: Dict[str, Any] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate a personalized path with milestones"""

        # Render prior-session memory once so every goal's roadmap can build on it.
        memory_hint = mem.summarize_for_prompt(memory)

        # Combine barrier models for intersectional planning
        combined_strategies = []
        combined_strengths = []
        combined_accommodations = []
        
        for barrier in barriers:
            barrier_key = barrier.lower().replace(' ', '_')
            if barrier_key in self.barrier_models:
                model = self.barrier_models[barrier_key]
                combined_strategies.extend(model['strategies'])
                combined_strengths.extend(model['strengths'])
                combined_accommodations.extend(model['accommodations'])
        
        # Generate milestones for all goals in parallel.
        goal_milestone_lists = await asyncio.gather(*[
            self._generate_milestones_for_goal(
                goal=goal,
                goal_idx=goal_idx,
                barriers=barriers,
                strategies=combined_strategies,
                similar_patterns=similar_patterns or [],
                memory_hint=memory_hint,
            )
            for goal_idx, goal in enumerate(goals)
        ])
        all_milestones: List[Dict[str, Any]] = []
        for goal_milestones in goal_milestone_lists:
            all_milestones.extend(goal_milestones)

        # Helper tricks depend only on the barrier list, so compute once and
        # reuse across every task instead of calling the LLM 80 times.
        shared_helper_tricks = await self._get_helper_tricks(barriers)

        # Generate tasks and recommended choices for every milestone in
        # parallel — these were the slowest sequential loops (one LLM round
        # trip per milestone, ~16 each) and the calls are independent.
        task_lists, choices_lists = await asyncio.gather(
            asyncio.gather(*[
                self._generate_tasks_for_milestone(m, barriers, helper_tricks=shared_helper_tricks) for m in all_milestones
            ]),
            asyncio.gather(*[
                self._generate_recommended_choices(milestone=m, barriers=barriers, strengths=combined_strengths)
                for m in all_milestones
            ]),
        )
        all_tasks: List[Dict[str, Any]] = []
        for tlist in task_lists:
            all_tasks.extend(tlist)
        for m, choices in zip(all_milestones, choices_lists):
            m['recommendedChoices'] = choices
        
        return {
            'milestones': all_milestones,
            'tasks': all_tasks,
            'strategies': list(set(combined_strategies)),
            'strengths': list(set(combined_strengths)),
            'accommodations': list(set(combined_accommodations)),
            'confidence': 0.85,
            'explanation': f'Generated personalized path with {len(all_milestones)} milestones for {len(goals)} goals, considering {len(barriers)} barrier types'
        }
    
    async def _generate_milestones_for_goal(
        self,
        goal: str,
        goal_idx: int,
        barriers: List[str],
        strategies: List[str],
        similar_patterns: List[Dict[str, Any]],
        memory_hint: str = ""
    ) -> List[Dict[str, Any]]:
        """Generate milestones for a specific goal across four life dimensions.

        Every goal — regardless of category — gets its own roadmap in each of
        Education, Workplace (career), Relationships, and Health/Lifestyle.
        These four dimensions describe HOW the same goal is supported from
        different angles of the user's life.
        """

        # Four life dimensions every goal must address.
        dimensions = [
            ('education',     'Education',        'learning, study habits, courses, credentials, knowledge'),
            ('workplace',     'Workplace',        'job tasks, career moves, professional skills, work environment'),
            ('relationships', 'Relationships',    'mentors, peers, family, networking, communication, support system'),
            ('health',        'Health & Lifestyle','sleep, energy, exercise, nutrition, mental health, daily routine'),
        ]

        # Ask the LLM for a per-dimension roadmap of milestone names so the
        # same goal yields a distinct, actionable plan in each life area.
        per_dim_names: Dict[str, List[str]] = {}
        if llm.is_enabled():
            data = await llm.complete_json(
                system=(
                    "You are a neurodiversity-aware life coach. For ONE user goal, "
                    "produce four ordered mini-roadmaps — one for each life dimension: "
                    "education, workplace, relationships, health. Each roadmap must contain "
                    "4 concrete, actionable milestone names (max 8 words each) that move "
                    "the user toward the SAME goal from that dimension's angle. "
                    "Tailor wording to the user's barriers. No numbering, no commentary."
                ),
                user=(
                    f"Goal: {goal}\n"
                    f"Barriers: {', '.join(barriers) or 'none'}\n"
                    + (f"Prior history:\n{memory_hint}\n" if memory_hint else "")
                    + "Return JSON: {"
                    "\"education\": [\"...\", \"...\", \"...\", \"...\"], "
                    "\"workplace\": [\"...\", \"...\", \"...\", \"...\"], "
                    "\"relationships\": [\"...\", \"...\", \"...\", \"...\"], "
                    "\"health\": [\"...\", \"...\", \"...\", \"...\"]}"
                ),
                temperature=0.7,
                max_tokens=900,
            )
            if isinstance(data, dict):
                for key, _, _ in dimensions:
                    vals = data.get(key)
                    if isinstance(vals, list) and vals:
                        per_dim_names[key] = [str(m).strip() for m in vals if str(m).strip()][:4]

        # Fallback templates per dimension when LLM is unavailable.
        fallback_map = {
            'education':     self.goal_templates['education'],
            'workplace':     self.goal_templates['career'],
            'relationships': self.goal_templates['relationships'],
            'health':        self.goal_templates['health'],
        }

        # First collect the milestone shells with their template names so we
        # can fire all description-enrichment LLM calls in parallel.
        shells: List[Dict[str, Any]] = []
        order_counter = 0
        for dim_key, dim_label, _focus in dimensions:
            names = per_dim_names.get(dim_key) or fallback_map[dim_key][:4]
            for i, template in enumerate(names):
                shells.append({
                    'id': f'milestone_g{goal_idx}_{dim_key}_{i}',
                    'raceId': f'race_{goal_idx}',
                    'name': template,
                    'order': order_counter,
                    'status': 'not_started' if order_counter > 0 else 'in_progress',
                    'barrierAware': True,
                    'strategies': random.sample(strategies, min(2, len(strategies))) if strategies else [],
                    'estimatedDays': random.randint(7, 30),
                    'goal': goal,
                    'dimension': dim_key,
                    'dimensionLabel': dim_label,
                    'category': dim_key if dim_key != 'workplace' else 'career',
                })
                order_counter += 1

        descriptions = await asyncio.gather(*[
            self._enrich_description(s['name'], barriers, goal) for s in shells
        ])
        for shell, desc in zip(shells, descriptions):
            shell['description'] = desc

        return shells
    
    async def _enrich_description(self, template: str, barriers: List[str], goal: str) -> str:
        """Enrich milestone description with barrier-specific details (LLM-backed)."""
        if llm.is_enabled():
            text = await llm.complete_text(
                system=(
                    "You are a neurodiversity-aware life coach. Write ONE concise, "
                    "warm sentence (max 35 words) describing a milestone in a personal "
                    "goal plan, tailored to the user's barriers."
                ),
                user=(
                    f"Goal: {goal}\nMilestone: {template}\nBarriers: {', '.join(barriers) or 'none'}\n"
                    "Return only the sentence — no quotes, no preamble."
                ),
                temperature=0.6,
                max_tokens=80,
            )
            if text:
                return text

        description = f"{template} - tailored for {goal}"
        if 'autism' in [b.lower() for b in barriers]:
            description += ". Using structured, step-by-step approach with clear expectations."
        if 'adhd' in [b.lower() for b in barriers]:
            description += ". Broken into small, engaging chunks with built-in rewards."
        if any('minority' in b.lower() for b in barriers):
            description += ". Connecting with culturally relevant resources and networks."
        return description
    
    async def _generate_tasks_for_milestone(
        self,
        milestone: Dict[str, Any],
        barriers: List[str],
        helper_tricks: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Generate tasks for a milestone"""

        task_templates = [
            ("Research and gather information", 30),
            ("Create action plan", 20),
            ("Take first small step", 15),
            ("Review and adjust approach", 20),
            ("Complete and celebrate", 25)
        ]

        # Reuse the caller-provided helper tricks when available so we don't
        # hit the LLM 5× per milestone for identical input.
        tricks = helper_tricks if helper_tricks is not None else await self._get_helper_tricks(barriers)

        tasks = []
        for i, (task_name, duration) in enumerate(task_templates):
            # Adjust for ADHD - shorter tasks
            if 'adhd' in [b.lower() for b in barriers]:
                duration = min(duration, 20)

            task = {
                'id': f'task_{milestone["id"]}_{i}',
                'milestoneId': milestone['id'],
                'name': f"{task_name}: {milestone['name']}",
                'description': f"Part {i+1} of completing {milestone['name']}",
                'status': 'pending',
                'estimatedDuration': duration,
                'difficulty': ['easy', 'medium', 'medium', 'easy', 'easy'][i],
                'priority': 'high' if i == 0 else 'medium',
                'helperTricks': tricks,
            }
            tasks.append(task)

        return tasks
    
    async def _get_helper_tricks(self, barriers: List[str]) -> List[str]:
        """Get helper tricks based on barriers (LLM-backed with rule fallback)."""
        if llm.is_enabled():
            data = await llm.complete_json(
                system=(
                    "You are a neurodiversity coach. Generate 3 short, actionable "
                    "helper tricks (max 12 words each) for someone with the listed barriers."
                ),
                user=(
                    f"Barriers: {', '.join(barriers) or 'general'}\n"
                    "Return JSON: {\"tricks\": [\"...\", \"...\", \"...\"]}"
                ),
                temperature=0.7,
                max_tokens=200,
            )
            if data and isinstance(data.get('tricks'), list) and data['tricks']:
                return [str(t) for t in data['tricks'][:3]]

        tricks = []
        if 'adhd' in [b.lower() for b in barriers]:
            tricks.extend([
                "Set a 15-minute timer and just start",
                "Use body doubling - work alongside someone",
                "Reward yourself after completing this task",
                "Break it into 5-minute micro-tasks"
            ])
        
        if 'autism' in [b.lower() for b in barriers]:
            tricks.extend([
                "Create a visual checklist for each step",
                "Set up your environment first - reduce distractions",
                "It's okay to take sensory breaks",
                "Follow your established routine"
            ])
        
        if 'ocd' in [b.lower() for b in barriers]:
            tricks.extend([
                "Set a 'good enough' threshold before starting",
                "Use the 5-second rule to move forward",
                "Remember: progress over perfection",
                "Take deep breaths if feeling anxious"
            ])
        
        if not tricks:
            tricks = [
                "Take it one step at a time",
                "Celebrate small wins",
                "It's okay to ask for help",
                "You've got this!"
            ]
        
        return random.sample(tricks, min(3, len(tricks)))
    
    async def _generate_recommended_choices(
        self,
        milestone: Dict[str, Any],
        barriers: List[str],
        strengths: List[str]
    ) -> List[Dict[str, Any]]:
        """Generate recommended choices for a milestone"""
        
        base_choices = [
            {
                'id': f'choice_{milestone["id"]}_1',
                'name': 'Structured Approach',
                'description': 'Step-by-step method with clear checkpoints. Best for those who like predictability.',
                'successPercentage': 87.5,
                'attempts': 1247,
                'estimatedTime': 45,
                'bestFor': ['autism', 'ocd']
            },
            {
                'id': f'choice_{milestone["id"]}_2',
                'name': 'Flexible Sprint',
                'description': 'Short bursts of focused work with movement breaks. Ideal for high-energy approaches.',
                'successPercentage': 84.2,
                'attempts': 983,
                'estimatedTime': 30,
                'bestFor': ['adhd']
            },
            {
                'id': f'choice_{milestone["id"]}_3',
                'name': 'Community-Supported',
                'description': 'Work alongside others who understand your journey. Includes mentorship element.',
                'successPercentage': 91.3,
                'attempts': 567,
                'estimatedTime': 60,
                'bestFor': ['visible_minority', 'all']
            }
        ]
        
        # Sort by relevance to user's barriers
        def relevance_score(choice):
            score = choice['successPercentage']
            if any(b.lower().replace(' ', '_') in choice.get('bestFor', []) for b in barriers):
                score += 10
            return score
        
        choices = sorted(base_choices, key=relevance_score, reverse=True)
        
        return choices[:3]
