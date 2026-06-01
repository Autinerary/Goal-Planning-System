"""
Agent 4: Reflection Analysis Agent
Analyzes journals and reflections to learn from user experience
SIMULATION MODE: Uses keyword-based sentiment and pattern detection
"""

from typing import Dict, Any, List
from core.agents.base_agent import BaseAgent
from core.config import Config
import re

class ReflectionAnalysisAgent(BaseAgent):
    """Analyzes reflections to detect patterns and insights"""
    
    def __init__(self):
        super().__init__('reflection_analysis', 'Reflection Analysis Agent')
        self.sentiment_keywords = {}
        self.pattern_indicators = {}
        self.coupled_events = {}
    
    async def initialize(self):
        """Initialize sentiment and pattern detection (simulation mode)"""
        
        # Keyword-based sentiment analysis
        self.sentiment_keywords = {
            'positive': [
                'great', 'amazing', 'wonderful', 'excellent', 'success', 'accomplished',
                'happy', 'excited', 'proud', 'motivated', 'energized', 'focused',
                'achieved', 'completed', 'won', 'improved', 'better', 'progress',
                'love', 'enjoy', 'thankful', 'grateful', 'confident', 'hopeful'
            ],
            'negative': [
                'struggling', 'difficult', 'hard', 'exhausted', 'tired', 'burnout',
                'overwhelmed', 'anxious', 'worried', 'stressed', 'frustrated', 'angry',
                'failed', 'can\'t', 'impossible', 'hopeless', 'stuck', 'lost',
                'sad', 'depressed', 'lonely', 'scared', 'nervous', 'confused'
            ],
            'neutral': [
                'okay', 'fine', 'normal', 'average', 'typical', 'usual',
                'sometimes', 'maybe', 'perhaps', 'not sure', 'uncertain'
            ]
        }
        
        # Pattern indicators for coupled events
        self.pattern_indicators = {
            'sleep_issues': ['didn\'t sleep', 'insomnia', 'tired', 'exhausted', 'stayed up', 'no sleep'],
            'meal_skipping': ['skipped breakfast', 'didn\'t eat', 'forgot to eat', 'no lunch', 'skipped meal'],
            'social_withdrawal': ['alone', 'isolated', 'didn\'t talk', 'avoided', 'stayed home', 'cancelled'],
            'task_avoidance': ['couldn\'t start', 'procrastinated', 'put off', 'avoided', 'didn\'t do'],
            'hyperfocus': ['lost track of time', 'hours passed', 'couldn\'t stop', 'deep focus', 'in the zone'],
            'sensory_overload': ['too loud', 'too bright', 'overwhelming', 'sensory', 'overstimulated'],
            'energy_crash': ['crash', 'sudden fatigue', 'no energy', 'drained', 'wiped out']
        }
        
        # Known coupled event patterns from "research"
        self.coupled_events = {
            'sleep_task': {
                'trigger': 'sleep_issues',
                'outcome': 'task_avoidance',
                'correlation': 0.78,
                'description': 'Poor sleep strongly correlates with task avoidance the next day',
                'recommendation': 'Prioritize sleep hygiene; on low-sleep days, reduce task load by 50%'
            },
            'meal_energy': {
                'trigger': 'meal_skipping',
                'outcome': 'energy_crash',
                'correlation': 0.72,
                'description': 'Skipping meals leads to energy crashes, especially for ADHD',
                'recommendation': 'Set meal reminders; keep easy snacks accessible'
            },
            'social_mood': {
                'trigger': 'social_withdrawal',
                'outcome': 'negative_mood',
                'correlation': 0.68,
                'description': 'Social isolation often precedes negative mood spirals',
                'recommendation': 'Schedule low-effort social connections; try text check-ins'
            },
            'hyperfocus_burnout': {
                'trigger': 'hyperfocus',
                'outcome': 'energy_crash',
                'correlation': 0.74,
                'description': 'Extended hyperfocus sessions often lead to next-day crashes',
                'recommendation': 'Set hyperfocus time limits; schedule recovery time'
            }
        }
        
        self.initialized = True
        print(f"   ✓ {self.agent_name} initialized with pattern detection")
    
    async def cleanup(self):
        """Cleanup resources"""
        self.initialized = False
    
    async def analyze_reflection(
        self,
        reflection_data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """Analyze a reflection for insights"""
        
        # Extract all text content
        text = self._extract_text(reflection_data)
        
        # Analyze sentiment
        sentiment = await self._analyze_sentiment(text)
        
        # Detect patterns and coupled events
        patterns = await self._detect_patterns(text, reflection_data)
        
        # Identify concerns and warning signs
        concerns = await self._identify_concerns(text, sentiment)
        
        # Extract actionable insights
        insights = await self._extract_insights(text, sentiment, patterns, concerns)
        
        # Get progress metrics
        progress = await self._calculate_progress(reflection_data)
        
        return {
            'sentiment': sentiment,
            'patterns': patterns,
            'concerns': concerns,
            'insights': insights,
            'progress': progress,
            'user_profile': reflection_data.get('user_profile', {}),
            'confidence': 0.82,
            'explanation': f'Analyzed reflection: {sentiment["label"]} sentiment with {len(patterns)} patterns detected'
        }
    
    def _extract_text(self, reflection_data: Dict[str, Any]) -> str:
        """Extract all text content from reflection"""
        text_parts = []
        
        # Free form text
        if reflection_data.get('freeFormText'):
            text_parts.append(reflection_data['freeFormText'])
        
        # Question answers
        for question in reflection_data.get('questions', []):
            if question.get('answer'):
                text_parts.append(question['answer'])
        
        return ' '.join(text_parts).lower()
    
    async def _analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment of text"""
        
        positive_count = sum(1 for word in self.sentiment_keywords['positive'] if word in text)
        negative_count = sum(1 for word in self.sentiment_keywords['negative'] if word in text)
        neutral_count = sum(1 for word in self.sentiment_keywords['neutral'] if word in text)
        
        total = positive_count + negative_count + neutral_count
        if total == 0:
            return {'label': 'neutral', 'score': 0.5, 'breakdown': {'positive': 0, 'negative': 0, 'neutral': 0}}
        
        positive_ratio = positive_count / total
        negative_ratio = negative_count / total
        
        if positive_ratio > 0.5:
            label = 'positive'
            score = 0.5 + (positive_ratio * 0.5)
        elif negative_ratio > 0.5:
            label = 'negative'
            score = 0.5 - (negative_ratio * 0.5)
        else:
            label = 'neutral'
            score = 0.5
        
        return {
            'label': label,
            'score': round(score, 2),
            'breakdown': {
                'positive': positive_count,
                'negative': negative_count,
                'neutral': neutral_count
            },
            'key_words': {
                'positive': [w for w in self.sentiment_keywords['positive'] if w in text][:5],
                'negative': [w for w in self.sentiment_keywords['negative'] if w in text][:5]
            }
        }
    
    async def _detect_patterns(
        self,
        text: str,
        reflection_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Detect patterns in the reflection"""
        detected_patterns = []
        detected_indicators = []
        
        # Check for pattern indicators
        for pattern_name, keywords in self.pattern_indicators.items():
            for keyword in keywords:
                if keyword in text:
                    detected_indicators.append(pattern_name)
                    break
        
        # Check for coupled event patterns
        for couple_id, couple_data in self.coupled_events.items():
            trigger = couple_data['trigger']
            outcome = couple_data['outcome']
            
            if trigger in detected_indicators:
                detected_patterns.append({
                    'type': 'coupled_event',
                    'id': couple_id,
                    'trigger': trigger,
                    'potential_outcome': outcome,
                    'correlation': couple_data['correlation'],
                    'description': couple_data['description'],
                    'recommendation': couple_data['recommendation'],
                    'affects_schedule': True
                })
        
        # Check for standalone patterns
        if 'hyperfocus' in detected_indicators and 'hyperfocus_burnout' not in [p['id'] for p in detected_patterns]:
            detected_patterns.append({
                'type': 'behavior',
                'id': 'hyperfocus_detected',
                'description': 'Hyperfocus period detected - remember to take breaks and eat',
                'recommendation': 'Set a timer for 90 minutes max, then take a 15-minute break',
                'affects_schedule': False
            })
        
        if 'sensory_overload' in detected_indicators:
            detected_patterns.append({
                'type': 'environmental',
                'id': 'sensory_overload_detected',
                'description': 'Sensory overload reported - environment adjustment needed',
                'recommendation': 'Consider noise-canceling headphones, dimmer lighting, or a quieter space',
                'affects_schedule': True
            })
        
        return detected_patterns
    
    async def _identify_concerns(
        self,
        text: str,
        sentiment: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Identify potential concerns or warning signs"""
        concerns = []
        
        # Burnout indicators
        burnout_words = ['burnout', 'exhausted', 'can\'t anymore', 'giving up', 'too much', 'overwhelmed']
        if any(word in text for word in burnout_words):
            concerns.append({
                'type': 'burnout_risk',
                'severity': 'high',
                'description': 'Burnout warning signs detected',
                'recommendation': 'Consider reducing workload and adding recovery time',
                'urgent': True
            })
        
        # Negative self-talk
        negative_self = ['i\'m stupid', 'i\'m useless', 'i can\'t do anything', 'i\'m a failure', 'what\'s wrong with me']
        if any(phrase in text for phrase in negative_self):
            concerns.append({
                'type': 'negative_self_talk',
                'severity': 'medium',
                'description': 'Negative self-talk patterns detected',
                'recommendation': 'Remember: your brain works differently, not worse. Consider cognitive reframing exercises.',
                'urgent': False
            })
        
        # Isolation
        isolation_words = ['alone', 'no one understands', 'isolated', 'by myself', 'nobody']
        if any(word in text for word in isolation_words):
            concerns.append({
                'type': 'isolation',
                'severity': 'medium',
                'description': 'Signs of social isolation detected',
                'recommendation': 'Consider reaching out to your support network or joining a community group',
                'urgent': False
            })
        
        # Sustained negative sentiment
        if sentiment['label'] == 'negative' and sentiment['breakdown']['negative'] > 5:
            concerns.append({
                'type': 'sustained_negative_mood',
                'severity': 'medium',
                'description': 'Multiple negative indicators in this reflection',
                'recommendation': 'This might be a good time to reach out to a therapist or counselor',
                'urgent': False
            })
        
        return concerns
    
    async def _extract_insights(
        self,
        text: str,
        sentiment: Dict[str, Any],
        patterns: List[Dict[str, Any]],
        concerns: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract actionable insights"""
        
        insights = {
            'what_works': [],
            'what_doesnt_work': [],
            'recommendations': [],
            'celebration_worthy': []
        }
        
        # What's working (from positive indicators)
        positive_words = sentiment.get('key_words', {}).get('positive', [])
        if 'accomplished' in positive_words or 'completed' in positive_words or 'achieved' in positive_words:
            insights['what_works'].append('Task completion strategies are working well')
            insights['celebration_worthy'].append('You completed something - celebrate this win!')
        
        if 'focused' in positive_words:
            insights['what_works'].append('Focus strategies are effective')
        
        if 'progress' in positive_words or 'better' in positive_words:
            insights['what_works'].append('You\'re making progress - keep going!')
            insights['celebration_worthy'].append('Progress detected - you\'re moving forward!')
        
        # What's not working
        negative_words = sentiment.get('key_words', {}).get('negative', [])
        if 'overwhelmed' in negative_words:
            insights['what_doesnt_work'].append('Current workload may be too high')
            insights['recommendations'].append('Consider breaking tasks into smaller pieces')
        
        if 'frustrated' in negative_words:
            insights['what_doesnt_work'].append('Something is causing frustration')
            insights['recommendations'].append('Identify the specific frustration source and address it')
        
        # Add pattern-based recommendations
        for pattern in patterns:
            if pattern.get('recommendation'):
                insights['recommendations'].append(pattern['recommendation'])
        
        # Add concern-based recommendations
        for concern in concerns:
            if concern.get('recommendation'):
                insights['recommendations'].append(concern['recommendation'])
        
        # Ensure there's always something positive
        if not insights['what_works'] and sentiment['label'] != 'negative':
            insights['what_works'].append('You took time to reflect - that\'s a positive step!')
        
        if not insights['celebration_worthy']:
            insights['celebration_worthy'].append('You\'re still here and trying - that matters!')
        
        return insights
    
    async def _calculate_progress(self, reflection_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate progress metrics from reflection"""
        
        # Simulated progress calculation
        questions = reflection_data.get('questions', [])
        
        completion_question = next((q for q in questions if 'how well' in q.get('question', '').lower()), None)
        
        return {
            'completion_rate': 0.65,  # Would be calculated from actual task data
            'mood_trend': 'stable',    # Would be calculated from historical reflections
            'energy_level': 'moderate',
            'recommendation': 'Continue current pace with added recovery time'
        }