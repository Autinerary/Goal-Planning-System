"""
Agent 6: Calendar Optimization Agent
Schedules tasks realistically based on energy and patterns
SIMULATION MODE: Uses rule-based scheduling with barrier-aware heuristics

Learning: every reflection feeds a reward into `calendar_outcomes` keyed by
(user_id, time_bucket) where time_bucket is a coarse string like
"high_energy_high" or "recovery_low". On the next optimization we pull the
user's top buckets and bias the schedule toward putting their priority tasks
on those day shapes. Falls back to the original heuristics when there isn't
enough data. See backend/core/learning.py and
2026_universal_agent_learning.sql.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from core.agents.base_agent import BaseAgent
from core.config import Config
from core import llm, learning
import random

class CalendarOptimizationAgent(BaseAgent):
    """Optimizes calendar scheduling based on user patterns"""
    
    def __init__(self):
        super().__init__('calendar_optimization', 'Calendar Optimization Agent')
        self.scheduling_rules = {}
        self.day_themes = {}
        self.energy_patterns = {}
    
    async def initialize(self):
        """Initialize scheduling rules and patterns"""
        
        # Barrier-specific scheduling rules
        self.scheduling_rules = {
            'autism': {
                'max_transitions': 4,  # Limit context switches
                'buffer_between_tasks': 15,  # minutes
                'routine_importance': 'high',
                'preferred_task_length': 45,  # minutes
                'needs_advance_notice': True,
                'sensory_breaks': True
            },
            'adhd': {
                'max_task_length': 25,  # Pomodoro-style
                'variety_needed': True,
                'best_focus_time': 'varies',  # Needs learning
                'movement_breaks': True,
                'rewards_after_tasks': True,
                'novel_task_boost': True
            },
            'ocd': {
                'time_for_completion': 1.5,  # 50% extra time
                'checking_buffer': 10,  # minutes
                'anxiety_management_breaks': True,
                'clear_end_criteria': True
            },
            'bipolar': {
                'energy_monitoring': True,
                'flexible_scheduling': True,
                'mood_check_ins': True,
                'avoid_overcommitment': True
            },
            'general': {
                'max_daily_tasks': 5,
                'work_blocks': 90,  # minutes
                'break_duration': 15,  # minutes
                'start_time': '09:00',
                'end_time': '17:00'
            }
        }
        
        # Day themes for motivation
        self.day_themes = {
            'monday': {'theme': 'Fresh Start', 'energy': 'medium', 'focus': 'planning'},
            'tuesday': {'theme': 'Deep Work', 'energy': 'high', 'focus': 'challenging_tasks'},
            'wednesday': {'theme': 'Momentum', 'energy': 'medium', 'focus': 'progress'},
            'thursday': {'theme': 'Connection', 'energy': 'medium', 'focus': 'collaboration'},
            'friday': {'theme': 'Completion', 'energy': 'low', 'focus': 'wrapping_up'},
            'saturday': {'theme': 'Exploration', 'energy': 'varies', 'focus': 'flexible'},
            'sunday': {'theme': 'Rest & Reflect', 'energy': 'low', 'focus': 'recovery'}
        }
        
        # Simulated learned energy patterns
        self.energy_patterns = {
            'morning': 0.7,
            'late_morning': 0.9,
            'afternoon': 0.6,
            'late_afternoon': 0.5,
            'evening': 0.4
        }
        
        self.initialized = True
        mode = "with OpenAI rationale" if llm.is_enabled() else "with scheduling rules"
        print(f"   ✓ {self.agent_name} initialized {mode}")
    
    async def cleanup(self):
        """Cleanup resources"""
        self.initialized = False
    
    async def optimize_calendar(
        self,
        user_profile: dict,
        milestones: List[Dict[str, Any]],
        tasks: List[Dict[str, Any]],
        recommended_tools: List[Dict[str, Any]] = None,
        similar_patterns: List[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Optimize calendar schedule"""
        
        barriers = user_profile.get('barrierTypes', [])
        barrier_keys = [b.lower().replace(' ', '_') for b in barriers]
        
        # Get combined scheduling rules
        rules = await self._get_combined_rules(barrier_keys)

        # Learning: read this user's best-performing time_bucket shapes so we
        # can bias scheduling toward day shapes that actually produced good
        # reflections in the past.
        user_id = user_profile.get('id') or user_profile.get('userId')
        learned_prefs = await learning.get_user_calendar_preferences(
            user_id=user_id, min_samples=2, max_results=5,
        )
        # Materialize a ranked list of preferred buckets for downstream use.
        preferred_buckets = [
            row.get('time_bucket')
            for row in learned_prefs
            if isinstance(row, dict) and row.get('time_bucket')
        ]

        # Classify upcoming days
        day_types = await self._classify_day_types(user_profile, rules)

        # Re-order day_types so days that match the user's top learned
        # buckets come first. Each day's bucket key is `type_energyLevel`.
        if preferred_buckets:
            def _bucket_rank(day: Dict[str, Any]) -> int:
                key = f"{day.get('type','balanced')}_{day.get('energy_level','medium')}"
                try:
                    return preferred_buckets.index(key)
                except ValueError:
                    return len(preferred_buckets) + 1
            day_types = sorted(day_types, key=_bucket_rank)

        # Schedule tasks across days
        scheduled_days = []
        remaining_tasks = tasks.copy()
        
        for day_type in day_types:
            day_schedule = await self._schedule_day(
                day_type=day_type,
                tasks=remaining_tasks,
                rules=rules,
                barriers=barrier_keys
            )
            scheduled_days.append(day_schedule)
            
            # Remove scheduled tasks from remaining
            scheduled_ids = [t['id'] for t in day_schedule.get('tasks', [])]
            remaining_tasks = [t for t in remaining_tasks if t['id'] not in scheduled_ids]
        
        # Create scenario variants
        scenarios = await self._create_scenarios(scheduled_days, rules)

        explanation = f'Optimized {len(tasks)} tasks across {len(scheduled_days)} days with barrier-aware scheduling'
        if llm.is_enabled() and tasks:
            text = await llm.complete_text(
                system=(
                    "You are a productivity coach for neurodivergent users. "
                    "In one warm sentence (max 40 words), summarize how you scheduled their week."
                ),
                user=(
                    f"Barriers: {', '.join(barriers) or 'none'}\n"
                    f"Total tasks: {len(tasks)}\n"
                    f"Days scheduled: {len(scheduled_days)}\n"
                    f"Unscheduled: {len(remaining_tasks)}\n"
                    "Return just the sentence."
                ),
                temperature=0.6,
                max_tokens=100,
            )
            if text:
                explanation = text

        return {
            'schedule': scheduled_days,
            'scenarios': scenarios,
            'rules_applied': rules,
            'unscheduled_tasks': remaining_tasks,
            'confidence': 0.82,
            'explanation': explanation
        }
    
    async def _get_combined_rules(self, barrier_keys: List[str]) -> Dict[str, Any]:
        """Combine scheduling rules based on barriers"""
        
        combined = self.scheduling_rules['general'].copy()
        
        for barrier in barrier_keys:
            if barrier in self.scheduling_rules:
                barrier_rules = self.scheduling_rules[barrier]
                
                # Take the more restrictive rules
                if 'max_task_length' in barrier_rules:
                    combined['max_task_length'] = min(
                        barrier_rules['max_task_length'],
                        combined.get('max_task_length', 60)
                    )
                
                if 'max_transitions' in barrier_rules:
                    combined['max_transitions'] = min(
                        barrier_rules['max_transitions'],
                        combined.get('max_transitions', 10)
                    )
                
                if 'buffer_between_tasks' in barrier_rules:
                    combined['buffer_between_tasks'] = max(
                        barrier_rules['buffer_between_tasks'],
                        combined.get('buffer_between_tasks', 5)
                    )
                
                # Add all boolean flags
                for key, value in barrier_rules.items():
                    if isinstance(value, bool) and value:
                        combined[key] = True
        
        return combined
    
    async def _classify_day_types(
        self,
        user_profile: dict,
        rules: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Classify upcoming days into types"""
        
        day_types = []
        today = datetime.now()
        
        for i in range(7):
            date = today + timedelta(days=i)
            day_name = date.strftime('%A').lower()
            theme_data = self.day_themes.get(day_name, self.day_themes['monday'])
            
            # Adjust energy based on rules
            energy = theme_data['energy']
            if rules.get('flexible_scheduling'):
                energy = 'flexible'
            
            # Determine day type
            if i == 0:
                day_type = 'focus'
            elif energy == 'high':
                day_type = 'high_energy'
            elif energy == 'low':
                day_type = 'recovery'
            else:
                day_type = 'balanced'
            
            day_types.append({
                'date': date,
                'date_str': date.strftime('%Y-%m-%d'),
                'day_name': day_name.capitalize(),
                'type': day_type,
                'theme': theme_data['theme'],
                'focus': theme_data['focus'],
                'energy_level': energy,
                'motivation': f"Today's focus: {theme_data['focus'].replace('_', ' ').title()}"
            })
        
        return day_types
    
    async def _schedule_day(
        self,
        day_type: Dict[str, Any],
        tasks: List[Dict[str, Any]],
        rules: Dict[str, Any],
        barriers: List[str]
    ) -> Dict[str, Any]:
        """Schedule tasks for a specific day"""
        
        energy = day_type.get('energy_level', 'medium')
        max_tasks = rules.get('max_daily_tasks', 5)
        
        # Adjust based on day type
        if day_type['type'] == 'recovery':
            max_tasks = max(1, max_tasks // 2)
        elif day_type['type'] == 'high_energy':
            max_tasks = min(max_tasks + 1, 7)
        
        # Sort tasks by priority and difficulty
        def task_score(task):
            priority_score = {'high': 3, 'medium': 2, 'low': 1}.get(task.get('priority', 'medium'), 2)
            difficulty_score = {'hard': 3, 'medium': 2, 'easy': 1}.get(task.get('difficulty', 'medium'), 2)
            
            # On high energy days, prefer harder tasks
            if energy == 'high':
                return priority_score + difficulty_score
            # On recovery days, prefer easier tasks
            elif energy == 'low':
                return priority_score - difficulty_score
            else:
                return priority_score
        
        sorted_tasks = sorted(tasks[:max_tasks * 2], key=task_score, reverse=True)
        day_tasks = sorted_tasks[:max_tasks]
        
        # Apply time adjustments based on rules
        for task in day_tasks:
            original_duration = task.get('estimatedDuration', 30)
            
            # ADHD: Cap task length
            if rules.get('max_task_length'):
                task['adjustedDuration'] = min(original_duration, rules['max_task_length'])
            else:
                task['adjustedDuration'] = original_duration
            
            # OCD: Add extra time
            if rules.get('time_for_completion'):
                task['adjustedDuration'] = int(task['adjustedDuration'] * rules['time_for_completion'])
            
            # Add helper tricks
            if not task.get('helperTricks'):
                task['helperTricks'] = await self._get_day_specific_tricks(barriers, day_type)
        
        # Create schedule
        return {
            'date': day_type['date_str'],
            'dayName': day_type['day_name'],
            'theme': day_type['theme'],
            'type': day_type['type'],
            'energyLevel': energy,
            # Stable bucket key the learning loop aggregates against.
            'time_bucket': f"{day_type['type']}_{energy}",
            'motivation': day_type['motivation'],
            'tasks': day_tasks,
            'worstCaseTasks': day_tasks[:1] if day_tasks else [],
            'averageCaseTasks': day_tasks[:max(1, len(day_tasks) // 2 + 1)],
            'bestCaseTasks': day_tasks,
            'totalDuration': sum(t.get('adjustedDuration', 30) for t in day_tasks),
            'buffer_time': rules.get('buffer_between_tasks', 10) * len(day_tasks)
        }
    
    async def _get_day_specific_tricks(
        self,
        barriers: List[str],
        day_type: Dict[str, Any]
    ) -> List[str]:
        """Get motivational tricks for the day"""
        
        tricks = []
        
        if day_type['type'] == 'high_energy':
            tricks.append("Ride the energy wave - tackle something challenging!")
        elif day_type['type'] == 'recovery':
            tricks.append("Be gentle with yourself today - rest is productive too")
        
        if 'adhd' in barriers:
            tricks.append("Set a 20-minute timer and just start")
            tricks.append("Reward yourself immediately after completing this")
        
        if 'autism' in barriers:
            tricks.append("Take a sensory break if needed")
            tricks.append("Follow your routine - consistency is your superpower")
        
        if not tricks:
            tricks = [
                "One step at a time",
                "Progress over perfection",
                "You've got this!"
            ]
        
        return tricks[:3]
    
    async def _create_scenarios(
        self,
        scheduled_days: List[Dict[str, Any]],
        rules: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create worst/average/best case scenarios"""
        
        worst_case = []
        average_case = []
        best_case = []
        
        for day in scheduled_days:
            worst_case.append({
                'date': day['date'],
                'tasks': day.get('worstCaseTasks', []),
                'task_count': len(day.get('worstCaseTasks', [])),
                'description': 'Only essential tasks - for tough days'
            })
            
            average_case.append({
                'date': day['date'],
                'tasks': day.get('averageCaseTasks', []),
                'task_count': len(day.get('averageCaseTasks', [])),
                'description': 'Reasonable workload - sustainable pace'
            })
            
            best_case.append({
                'date': day['date'],
                'tasks': day.get('bestCaseTasks', []),
                'task_count': len(day.get('bestCaseTasks', [])),
                'description': 'Full schedule - for high-energy days'
            })
        
        return {
            'worst_case': {
                'name': 'Worst Case',
                'description': 'For hard days - only critical tasks',
                'days': worst_case,
                'total_tasks': sum(d['task_count'] for d in worst_case)
            },
            'average_case': {
                'name': 'Average Case',
                'description': 'Sustainable daily pace',
                'days': average_case,
                'total_tasks': sum(d['task_count'] for d in average_case)
            },
            'best_case': {
                'name': 'Best Case',
                'description': 'When feeling great',
                'days': best_case,
                'total_tasks': sum(d['task_count'] for d in best_case)
            }
        }
