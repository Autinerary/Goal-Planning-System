"""
Agent 3: Tool Recommendation Agent
Connects users with the right resources at the right time
SIMULATION MODE: Uses curated knowledge base of tools/services/resources
"""

from typing import List, Dict, Any
from core.agents.base_agent import BaseAgent
from core.config import Config
import random

class ToolRecommendationAgent(BaseAgent):
    """Recommends services, products, articles, and other tools"""
    
    def __init__(self):
        super().__init__('tool_recommendation', 'Tool Recommendation Agent')
        self.knowledge_base = {}
    
    async def initialize(self):
        """Initialize knowledge base (simulation mode)"""
        
        # Curated knowledge base of tools by barrier type
        self.knowledge_base = {
            'services': {
                'autism': [
                    {'id': 'svc_autism_1', 'name': 'Autism Canada Support Services', 'description': 'National support network with local chapters', 'url': 'https://autismcanada.org', 'rating': 4.7, 'type': 'service'},
                    {'id': 'svc_autism_2', 'name': 'ASAN - Autistic Self Advocacy Network', 'description': 'By and for autistic people - resources and community', 'url': 'https://autisticadvocacy.org', 'rating': 4.8, 'type': 'service'},
                    {'id': 'svc_autism_3', 'name': 'Disability Services Office', 'description': 'University/college accommodation support', 'url': '#', 'rating': 4.5, 'type': 'service'},
                ],
                'adhd': [
                    {'id': 'svc_adhd_1', 'name': 'CADDAC - Centre for ADHD Awareness', 'description': 'Canadian ADHD resource center', 'url': 'https://caddac.ca', 'rating': 4.6, 'type': 'service'},
                    {'id': 'svc_adhd_2', 'name': 'CHADD', 'description': 'Children and Adults with ADHD support', 'url': 'https://chadd.org', 'rating': 4.7, 'type': 'service'},
                    {'id': 'svc_adhd_3', 'name': 'Focusmate', 'description': 'Virtual coworking and body doubling', 'url': 'https://focusmate.com', 'rating': 4.8, 'type': 'service'},
                ],
                'visible_minority': [
                    {'id': 'svc_minority_1', 'name': 'Black Professionals Network', 'description': 'Career networking for Black professionals', 'url': '#', 'rating': 4.7, 'type': 'service'},
                    {'id': 'svc_minority_2', 'name': 'Immigrant Services Association', 'description': 'Support for newcomers and immigrants', 'url': '#', 'rating': 4.5, 'type': 'service'},
                ],
                'general': [
                    {'id': 'svc_gen_1', 'name': 'BetterHelp', 'description': 'Online therapy and counseling', 'url': 'https://betterhelp.com', 'rating': 4.4, 'type': 'service'},
                    {'id': 'svc_gen_2', 'name': 'Career Counseling Services', 'description': 'Professional career guidance', 'url': '#', 'rating': 4.3, 'type': 'service'},
                ]
            },
            'products': {
                'adhd': [
                    {'id': 'prod_adhd_1', 'name': 'Tiimo App', 'description': 'Visual daily planner designed for ADHD/Autism', 'url': 'https://tiimo.dk', 'rating': 4.7, 'type': 'product'},
                    {'id': 'prod_adhd_2', 'name': 'Forest App', 'description': 'Focus timer with gamification', 'url': 'https://forestapp.cc', 'rating': 4.6, 'type': 'product'},
                    {'id': 'prod_adhd_3', 'name': 'Notion', 'description': 'Flexible workspace for organization', 'url': 'https://notion.so', 'rating': 4.8, 'type': 'product'},
                    {'id': 'prod_adhd_4', 'name': 'Time Timer', 'description': 'Visual countdown timer', 'url': 'https://timetimer.com', 'rating': 4.5, 'type': 'product'},
                ],
                'autism': [
                    {'id': 'prod_autism_1', 'name': 'Noise-canceling headphones', 'description': 'Essential for sensory management', 'url': '#', 'rating': 4.9, 'type': 'product'},
                    {'id': 'prod_autism_2', 'name': 'Routinery App', 'description': 'Routine builder with visual cues', 'url': '#', 'rating': 4.5, 'type': 'product'},
                    {'id': 'prod_autism_3', 'name': 'Sensory toolkit', 'description': 'Fidgets, stim toys, sensory items', 'url': '#', 'rating': 4.6, 'type': 'product'},
                ],
                'general': [
                    {'id': 'prod_gen_1', 'name': 'Todoist', 'description': 'Task management app', 'url': 'https://todoist.com', 'rating': 4.6, 'type': 'product'},
                    {'id': 'prod_gen_2', 'name': 'Calm App', 'description': 'Meditation and relaxation', 'url': 'https://calm.com', 'rating': 4.7, 'type': 'product'},
                ]
            },
            'commentaries': {
                'adhd': [
                    {'id': 'comm_adhd_1', 'name': 'How to ADHD (YouTube)', 'description': 'Evidence-based ADHD strategies with Jessica McCabe', 'url': 'https://youtube.com/howtoadhd', 'rating': 4.9, 'type': 'commentary'},
                    {'id': 'comm_adhd_2', 'name': 'ADHD Alien Comics', 'description': 'Relatable comics explaining ADHD experiences', 'url': 'https://adhd-alien.com', 'rating': 4.8, 'type': 'commentary'},
                    {'id': 'comm_adhd_3', 'name': 'r/ADHD Community', 'description': 'Supportive Reddit community sharing tips', 'url': 'https://reddit.com/r/adhd', 'rating': 4.5, 'type': 'commentary'},
                ],
                'autism': [
                    {'id': 'comm_autism_1', 'name': 'Actually Autistic Community', 'description': 'Lived experience perspectives', 'url': '#', 'rating': 4.7, 'type': 'commentary'},
                    {'id': 'comm_autism_2', 'name': 'Neuroclastic', 'description': 'Neurodiversity-affirming articles', 'url': 'https://neuroclastic.com', 'rating': 4.8, 'type': 'commentary'},
                    {'id': 'comm_autism_3', 'name': 'The Aspergian', 'description': 'Autistic perspectives and advice', 'url': '#', 'rating': 4.6, 'type': 'commentary'},
                ],
                'general': [
                    {'id': 'comm_gen_1', 'name': 'TED Talks on Neurodiversity', 'description': 'Inspiring talks from neurodivergent speakers', 'url': 'https://ted.com', 'rating': 4.7, 'type': 'commentary'},
                ]
            },
            'other': {
                'general': [
                    {'id': 'other_1', 'name': 'Accommodation Letter Template', 'description': 'Template for requesting workplace/school accommodations', 'url': '#', 'rating': 4.4, 'type': 'other'},
                    {'id': 'other_2', 'name': 'Self-Advocacy Script', 'description': 'Scripts for difficult conversations about needs', 'url': '#', 'rating': 4.5, 'type': 'other'},
                    {'id': 'other_3', 'name': 'Spoon Theory Guide', 'description': 'Energy management framework', 'url': '#', 'rating': 4.6, 'type': 'other'},
                ]
            }
        }
        
        self.initialized = True
        print(f"   ✓ {self.agent_name} initialized with curated knowledge base")
    
    async def cleanup(self):
        """Cleanup resources"""
        self.initialized = False
    
    async def recommend_tools(
        self,
        user_profile: dict,
        milestones: List[Dict[str, Any]],
        barriers: List[str]
    ) -> Dict[str, Any]:
        """Recommend tools for each milestone"""
        
        recommendations = {}
        all_tools = []
        
        for milestone in milestones:
            milestone_id = milestone.get('id')
            tools = await self._find_relevant_tools(
                milestone=milestone,
                barriers=barriers,
                user_profile=user_profile
            )
            recommendations[milestone_id] = tools
            all_tools.extend(tools)
        
        # Get pit stop tools (general quick-access tools)
        pit_stop_tools = await self._get_pit_stop_tools(barriers)
        
        return {
            'recommendations': recommendations,
            'pit_stop_tools': pit_stop_tools,
            'total_tools': len(all_tools),
            'confidence': 0.78,
            'explanation': f'Found {len(all_tools)} relevant tools across {len(milestones)} milestones'
        }
    
    async def _find_relevant_tools(
        self,
        milestone: Dict[str, Any],
        barriers: List[str],
        user_profile: dict
    ) -> List[Dict[str, Any]]:
        """Find relevant tools for a milestone"""
        tools = []
        barrier_keys = [b.lower().replace(' ', '_') for b in barriers]
        
        # Gather tools from each category
        for category in ['services', 'products', 'commentaries', 'other']:
            category_tools = self.knowledge_base.get(category, {})
            
            # Get barrier-specific tools
            for key in barrier_keys:
                if key in category_tools:
                    for tool in category_tools[key]:
                        tool_copy = tool.copy()
                        tool_copy['relevanceScore'] = self._calculate_relevance(tool, milestone, barriers)
                        tools.append(tool_copy)
            
            # Add general tools
            for tool in category_tools.get('general', []):
                tool_copy = tool.copy()
                tool_copy['relevanceScore'] = self._calculate_relevance(tool, milestone, barriers) * 0.8
                tools.append(tool_copy)
        
        # Sort by relevance and deduplicate
        tools = sorted(tools, key=lambda x: x.get('relevanceScore', 0), reverse=True)
        seen = set()
        unique_tools = []
        for tool in tools:
            if tool['id'] not in seen:
                seen.add(tool['id'])
                unique_tools.append(tool)
        
        return unique_tools[:6]
    
    def _calculate_relevance(
        self,
        tool: Dict[str, Any],
        milestone: Dict[str, Any],
        barriers: List[str]
    ) -> float:
        """Calculate relevance score for a tool"""
        score = tool.get('rating', 3.0) / 5.0
        
        # Boost if tool name/description matches milestone
        milestone_text = f"{milestone.get('name', '')} {milestone.get('description', '')}".lower()
        tool_text = f"{tool.get('name', '')} {tool.get('description', '')}".lower()
        
        # Simple keyword matching
        keywords = ['support', 'help', 'resource', 'community', 'accommodation', 'strategy']
        for keyword in keywords:
            if keyword in milestone_text and keyword in tool_text:
                score += 0.1
        
        return min(score, 1.0)
    
    async def _get_pit_stop_tools(self, barriers: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        """Get categorized pit stop tools for quick access"""
        
        pit_stop = {
            'services': [],
            'commentaries': [],
            'products': [],
            'other': []
        }
        
        barrier_keys = [b.lower().replace(' ', '_') for b in barriers]
        
        for category in pit_stop.keys():
            category_tools = self.knowledge_base.get(category, {})
            
            # Get barrier-specific tools
            for key in barrier_keys:
                if key in category_tools:
                    pit_stop[category].extend(category_tools[key][:2])
            
            # Add general tools
            pit_stop[category].extend(category_tools.get('general', [])[:2])
            
            # Deduplicate
            seen = set()
            unique = []
            for tool in pit_stop[category]:
                if tool['id'] not in seen:
                    seen.add(tool['id'])
                    unique.append(tool)
            pit_stop[category] = unique[:4]
        
        return pit_stop
    
    async def search_tools(
        self,
        query: str,
        barriers: List[str],
        tool_type: str = 'all'
    ) -> List[Dict[str, Any]]:
        """Search for tools (Magic Searchbar)"""
        
        results = []
        query_lower = query.lower()
        barrier_keys = [b.lower().replace(' ', '_') for b in barriers]
        
        categories = [tool_type] if tool_type != 'all' else ['services', 'products', 'commentaries', 'other']
        
        for category in categories:
            if category not in self.knowledge_base:
                continue
                
            category_tools = self.knowledge_base[category]
            
            # Search in barrier-specific and general tools
            search_pools = [category_tools.get(key, []) for key in barrier_keys]
            search_pools.append(category_tools.get('general', []))
            
            for pool in search_pools:
                for tool in pool:
                    tool_text = f"{tool.get('name', '')} {tool.get('description', '')}".lower()
                    if query_lower in tool_text:
                        tool_copy = tool.copy()
                        tool_copy['searchScore'] = tool_text.count(query_lower) * 0.3 + tool.get('rating', 3) / 5
                        results.append(tool_copy)
        
        # Deduplicate and sort
        seen = set()
        unique_results = []
        for tool in sorted(results, key=lambda x: x.get('searchScore', 0), reverse=True):
            if tool['id'] not in seen:
                seen.add(tool['id'])
                unique_results.append(tool)
        
        return unique_results[:10]
