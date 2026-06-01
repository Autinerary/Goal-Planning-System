"""
Agent 1: Path Planning Agent
Creates the roadmap from current state to goals
SIMULATION MODE: Uses predefined models and generates realistic paths
"""

from typing import List, Dict, Any
from core.agents.base_agent import BaseAgent
from core.config import Config
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
        print(f"   ✓ {self.agent_name} initialized (simulation mode)")
    
    async def cleanup(self):
        """Cleanup resources"""
        self.initialized = False
    
    async def generate_path(
        self,
        user_profile: dict,
        goals: List[str],
        barriers: List[str],
        similar_patterns: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate a personalized path with milestones"""
        
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
        
        # Generate milestones based on goals
        all_milestones = []
        all_tasks = []
        
        for goal_idx, goal in enumerate(goals):
            goal_milestones = await self._generate_milestones_for_goal(
                goal=goal,
                goal_idx=goal_idx,
                barriers=barriers,
                strategies=combined_strategies,
                similar_patterns=similar_patterns or []
            )
            all_milestones.extend(goal_milestones)
            
            # Generate tasks for each milestone
            for milestone in goal_milestones:
                tasks = await self._generate_tasks_for_milestone(milestone, barriers)
                all_tasks.extend(tasks)
        
        # Add recommended choices
        for milestone in all_milestones:
            milestone['recommendedChoices'] = await self._generate_recommended_choices(
                milestone=milestone,
                barriers=barriers,
                strengths=combined_strengths
            )
        
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
        similar_patterns: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate milestones for a specific goal"""
        
        # Determine goal category
        goal_lower = goal.lower()
        category = 'education'  # default
        if any(word in goal_lower for word in ['job', 'career', 'work', 'employment']):
            category = 'career'
        elif any(word in goal_lower for word in ['health', 'fitness', 'wellness', 'sleep']):
            category = 'health'
        elif any(word in goal_lower for word in ['relationship', 'friend', 'social', 'family']):
            category = 'relationships'
        
        templates = self.goal_templates.get(category, self.goal_templates['education'])
        
        milestones = []
        for i, template in enumerate(templates):
            milestone = {
                'id': f'milestone_g{goal_idx}_{i}',
                'raceId': f'race_{goal_idx}',
                'name': template,
                'description': await self._enrich_description(template, barriers, goal),
                'order': i,
                'status': 'not_started' if i > 0 else 'in_progress',
                'barrierAware': True,
                'strategies': random.sample(strategies, min(2, len(strategies))) if strategies else [],
                'estimatedDays': random.randint(7, 30)
            }
            milestones.append(milestone)
        
        return milestones
    
    async def _enrich_description(self, template: str, barriers: List[str], goal: str) -> str:
        """Enrich milestone description with barrier-specific details"""
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
        barriers: List[str]
    ) -> List[Dict[str, Any]]:
        """Generate tasks for a milestone"""
        
        task_templates = [
            ("Research and gather information", 30),
            ("Create action plan", 20),
            ("Take first small step", 15),
            ("Review and adjust approach", 20),
            ("Complete and celebrate", 25)
        ]
        
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
                'helperTricks': await self._get_helper_tricks(barriers)
            }
            tasks.append(task)
        
        return tasks
    
    async def _get_helper_tricks(self, barriers: List[str]) -> List[str]:
        """Get helper tricks based on barriers"""
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
