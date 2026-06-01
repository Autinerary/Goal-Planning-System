"""
Agent 5: Adaptation Agent
Adjusts plans based on progress and reflections
SIMULATION MODE: Uses rule-based adaptation logic
"""

from typing import Dict, Any, List
from core.agents.base_agent import BaseAgent
from core.config import Config

class AdaptationAgent(BaseAgent):
    """Adapts paths based on user progress and feedback"""
    
    def __init__(self):
        super().__init__('adaptation', 'Adaptation Agent')
        self.adaptation_rules = {}
        self.adjustment_strategies = {}
    
    async def initialize(self):
        """Initialize adaptation rules and strategies"""
        
        # Adaptation rules based on different signals
        self.adaptation_rules = {
            'low_completion': {
                'threshold': 0.5,
                'action': 'reduce_workload',
                'description': 'Task completion below 50%',
                'adjustments': ['Break tasks into smaller chunks', 'Reduce daily task count', 'Add more buffer time']
            },
            'high_stress': {
                'signals': ['burnout_risk', 'sustained_negative_mood'],
                'action': 'add_recovery',
                'description': 'Stress or burnout indicators detected',
                'adjustments': ['Add recovery days', 'Reduce task difficulty', 'Schedule self-care activities']
            },
            'pattern_detected': {
                'action': 'pattern_intervention',
                'description': 'Behavioral pattern requiring intervention',
                'adjustments': ['Address root cause', 'Add preventive measures', 'Adjust triggers']
            },
            'positive_momentum': {
                'threshold': 0.8,
                'action': 'gradual_increase',
                'description': 'High completion rate and positive feedback',
                'adjustments': ['Slightly increase challenge', 'Add stretch goals', 'Celebrate and reinforce']
            },
            'energy_mismatch': {
                'action': 'reschedule',
                'description': 'Tasks scheduled during wrong energy periods',
                'adjustments': ['Move difficult tasks to high-energy times', 'Schedule easy tasks for low-energy periods']
            }
        }
        
        # Barrier-specific adjustment strategies
        self.adjustment_strategies = {
            'autism': {
                'reduce_uncertainty': 'Provide more detailed step-by-step instructions',
                'add_structure': 'Create visual schedules and checklists',
                'sensory_accommodation': 'Add sensory breaks between tasks',
                'transition_support': 'Add transition warnings before task changes'
            },
            'adhd': {
                'increase_novelty': 'Add variety and gamification elements',
                'shorten_tasks': 'Break into 15-minute maximum chunks',
                'add_rewards': 'Add immediate micro-rewards after tasks',
                'body_doubling': 'Suggest accountability partner sessions',
                'reduce_barriers': 'Pre-set everything needed before starting'
            },
            'ocd': {
                'reduce_perfectionism': 'Set "good enough" criteria before starting',
                'limit_checking': 'Add checking limits to task descriptions',
                'anxiety_management': 'Include grounding exercises',
                'gradual_exposure': 'Slowly increase challenge level'
            },
            'visible_minority': {
                'community_support': 'Connect with affinity groups',
                'cultural_alignment': 'Ensure resources are culturally relevant',
                'advocacy_skills': 'Add self-advocacy practice opportunities',
                'network_building': 'Include networking activities'
            }
        }
        
        self.initialized = True
        print(f"   ✓ {self.agent_name} initialized with adaptation rules")
    
    async def cleanup(self):
        """Cleanup resources"""
        self.initialized = False
    
    async def adapt_path(
        self,
        user_id: str,
        path_id: str,
        reflection_insights: Dict[str, Any],
        current_progress: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Adapt the path based on insights and progress"""
        
        adaptations = []
        
        # Check for low completion rates
        completion_rate = current_progress.get('completion_rate', 1.0)
        if completion_rate < self.adaptation_rules['low_completion']['threshold']:
            adaptation = await self._adapt_for_low_completion(
                path_id=path_id,
                completion_rate=completion_rate
            )
            adaptations.append(adaptation)
        
        # Check for positive momentum
        if completion_rate > self.adaptation_rules['positive_momentum']['threshold']:
            adaptation = await self._adapt_for_positive_momentum(
                path_id=path_id,
                completion_rate=completion_rate
            )
            adaptations.append(adaptation)
        
        # Check for stress indicators
        concerns = reflection_insights.get('concerns', [])
        stress_signals = [c for c in concerns if c.get('type') in self.adaptation_rules['high_stress']['signals']]
        if stress_signals:
            adaptation = await self._adapt_for_high_stress(
                path_id=path_id,
                concerns=stress_signals
            )
            adaptations.append(adaptation)
        
        # Apply pattern-based adaptations
        patterns = reflection_insights.get('patterns', [])
        for pattern in patterns:
            if pattern.get('affects_schedule', False):
                adaptation = await self._adapt_for_pattern(
                    path_id=path_id,
                    pattern=pattern
                )
                adaptations.append(adaptation)
        
        # Get barrier-specific adjustments
        user_barriers = reflection_insights.get('user_profile', {}).get('barrierTypes', [])
        barrier_adjustments = await self._get_barrier_adjustments(user_barriers, reflection_insights)
        
        # Determine if calendar needs updating
        needs_calendar_update = any(
            a.get('requires_calendar_update', False) for a in adaptations
        )
        
        # Generate updated milestones and tasks
        updated_milestones = await self._update_milestones(adaptations, barrier_adjustments)
        updated_tasks = await self._update_tasks(adaptations, barrier_adjustments)
        
        return {
            'adaptations': adaptations,
            'barrier_adjustments': barrier_adjustments,
            'updated_milestones': updated_milestones,
            'updated_tasks': updated_tasks,
            'updated_path': await self._generate_updated_path(adaptations),
            'updated_races': await self._generate_updated_races(adaptations),
            'needs_calendar_update': needs_calendar_update,
            'confidence': 0.78,
            'explanation': f'Applied {len(adaptations)} adaptations based on reflection analysis'
        }
    
    async def _adapt_for_low_completion(
        self,
        path_id: str,
        completion_rate: float
    ) -> Dict[str, Any]:
        """Adapt when completion rates are low"""
        
        rule = self.adaptation_rules['low_completion']
        
        return {
            'type': 'reduce_workload',
            'trigger': f'Completion rate ({completion_rate:.0%}) below threshold ({rule["threshold"]:.0%})',
            'actions': rule['adjustments'],
            'specific_changes': [
                'Reduce daily task count from 5 to 3',
                'Break 60-minute tasks into 2x 25-minute blocks',
                'Add 15-minute buffer between tasks'
            ],
            'requires_calendar_update': True,
            'priority': 'high',
            'explanation': 'Low completion rate detected - reducing workload to build momentum'
        }
    
    async def _adapt_for_positive_momentum(
        self,
        path_id: str,
        completion_rate: float
    ) -> Dict[str, Any]:
        """Adapt when there's positive momentum"""
        
        rule = self.adaptation_rules['positive_momentum']
        
        return {
            'type': 'gradual_increase',
            'trigger': f'Completion rate ({completion_rate:.0%}) above threshold ({rule["threshold"]:.0%})',
            'actions': rule['adjustments'],
            'specific_changes': [
                'Add one additional optional challenge task',
                'Introduce a stretch goal milestone',
                'Celebrate with a reward activity'
            ],
            'requires_calendar_update': True,
            'priority': 'medium',
            'explanation': 'Great progress! Gradually increasing challenge to maintain growth'
        }
    
    async def _adapt_for_high_stress(
        self,
        path_id: str,
        concerns: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Adapt when high stress is detected"""
        
        rule = self.adaptation_rules['high_stress']
        concern_types = [c['type'] for c in concerns]
        
        return {
            'type': 'add_recovery',
            'trigger': f'Stress indicators detected: {", ".join(concern_types)}',
            'actions': rule['adjustments'],
            'specific_changes': [
                'Add 2 recovery days this week',
                'Reduce task difficulty by one level',
                'Add daily self-care reminder',
                'Remove or postpone non-essential tasks'
            ],
            'requires_calendar_update': True,
            'priority': 'high',
            'explanation': 'Stress signals detected - prioritizing recovery and reducing pressure'
        }
    
    async def _adapt_for_pattern(
        self,
        path_id: str,
        pattern: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Adapt based on detected pattern"""
        
        return {
            'type': 'pattern_intervention',
            'trigger': pattern.get('description', 'Pattern detected'),
            'pattern_id': pattern.get('id'),
            'actions': [pattern.get('recommendation', 'Adjust based on pattern')],
            'specific_changes': [
                f"Address: {pattern.get('trigger', 'trigger')}",
                f"Prevent: {pattern.get('potential_outcome', 'outcome')}",
                pattern.get('recommendation', '')
            ],
            'requires_calendar_update': pattern.get('affects_schedule', False),
            'priority': 'medium',
            'explanation': f'Pattern intervention: {pattern.get("description", "")}'
        }
    
    async def _get_barrier_adjustments(
        self,
        barriers: List[str],
        reflection_insights: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Get barrier-specific adjustments"""
        
        adjustments = []
        barrier_keys = [b.lower().replace(' ', '_') for b in barriers]
        
        for barrier in barrier_keys:
            if barrier in self.adjustment_strategies:
                strategies = self.adjustment_strategies[barrier]
                
                # Select relevant strategies based on insights
                sentiment = reflection_insights.get('sentiment', {}).get('label', 'neutral')
                concerns = reflection_insights.get('concerns', [])
                
                selected = []
                if sentiment == 'negative' or any(c.get('severity') == 'high' for c in concerns):
                    # Add supportive strategies
                    for key, value in strategies.items():
                        if any(word in key for word in ['reduce', 'add', 'support']):
                            selected.append({'strategy': key, 'action': value})
                else:
                    # Add growth-oriented strategies
                    for key, value in list(strategies.items())[:2]:
                        selected.append({'strategy': key, 'action': value})
                
                if selected:
                    adjustments.append({
                        'barrier': barrier,
                        'strategies': selected
                    })
        
        return adjustments
    
    async def _update_milestones(
        self,
        adaptations: List[Dict[str, Any]],
        barrier_adjustments: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate updated milestones"""
        # In full implementation: Query and update actual milestones
        return [{
            'id': 'updated_milestone_1',
            'changes': [a.get('type') for a in adaptations],
            'status': 'modified'
        }]
    
    async def _update_tasks(
        self,
        adaptations: List[Dict[str, Any]],
        barrier_adjustments: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate updated tasks"""
        # In full implementation: Query and update actual tasks
        return [{
            'id': 'updated_task_1',
            'changes': [a.get('type') for a in adaptations],
            'status': 'modified'
        }]
    
    async def _generate_updated_path(self, adaptations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate updated path structure"""
        return {
            'id': 'path_adapted',
            'adaptations_applied': len(adaptations),
            'status': 'updated'
        }
    
    async def _generate_updated_races(self, adaptations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate updated races"""
        return [{
            'id': 'race_adapted',
            'adaptations_applied': len(adaptations),
            'status': 'updated'
        }]
