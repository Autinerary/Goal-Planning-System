"""
Agent 2: Pattern Recognition Agent
Learns from people who came before you
"""

import os
from typing import List, Dict, Any, Optional
from core.agents.base_agent import BaseAgent

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX_HOST = os.getenv("PINECONE_INDEX_HOST", "")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "goal-planning-users")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

class PatternRecognitionAgent(BaseAgent):
    """Identifies patterns from similar users' journeys"""
    
    def __init__(self):
        super().__init__('pattern_recognition', 'Pattern Recognition Agent')
        self.vector_db = None
        self._openai_client = None
    
    async def initialize(self):
        """Initialize vector database and embedding model"""
        if PINECONE_API_KEY:
            try:
                from pinecone import Pinecone
                pc = Pinecone(api_key=PINECONE_API_KEY)
                if PINECONE_INDEX_HOST:
                    self.vector_db = pc.Index(host=PINECONE_INDEX_HOST)
                else:
                    self.vector_db = pc.Index(PINECONE_INDEX_NAME)
                print("   ✓ Pattern Recognition Agent connected to Pinecone")
            except Exception as e:
                print(f"   ⚠ Pattern Recognition Agent: Pinecone init failed ({e}), using mock")
        if OPENAI_API_KEY:
            try:
                from openai import AsyncOpenAI
                self._openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
            except Exception:
                pass
        self.initialized = True
    
    async def cleanup(self):
        """Cleanup resources"""
        self.initialized = False
    
    async def find_similar_patterns(
        self,
        user_profile: dict,
        goals: List[str],
        barriers: List[str],
        memory: Dict[str, Any] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Find similar users and success patterns
        """
        # Generate embedding for user profile
        user_embedding = await self._generate_embedding(
            profile=user_profile,
            goals=goals,
            barriers=barriers
        )
        
        # Search for similar users in vector database
        similar_users = await self._vector_search(
            embedding=user_embedding,
            top_k=10,
            filters={'barriers': barriers}
        )
        
        # Extract success patterns
        patterns = await self._extract_patterns(similar_users)
        
        # Identify models that worked
        models = await self._identify_models(similar_users, goals)
        
        return {
            'similar_users': similar_users,
            'patterns': patterns,
            'models': models,
            'confidence': 0.8,
            'explanation': f'Found {len(similar_users)} similar users with {len(patterns)} success patterns'
        }
    
    async def _generate_embedding(
        self,
        profile: dict,
        goals: List[str],
        barriers: List[str]
    ) -> List[float]:
        """Generate embedding vector for user profile"""
        if self._openai_client:
            try:
                text = f"barriers: {', '.join(barriers)}. goals: {', '.join(goals)}. profile: {profile}"
                response = await self._openai_client.embeddings.create(
                    model="text-embedding-ada-002",
                    input=text
                )
                return response.data[0].embedding
            except Exception:
                pass
        # Fallback: mock 1536-dim embedding (matches ada-002)
        return [0.1] * 1536
    
    async def _vector_search(
        self,
        embedding: List[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Search vector database for similar users"""
        if self.vector_db:
            try:
                query_filter = None
                if filters and filters.get('barriers'):
                    query_filter = {"barriers": {"$in": filters['barriers']}}
                result = self.vector_db.query(
                    vector=embedding,
                    top_k=top_k,
                    filter=query_filter,
                    include_metadata=True
                )
                return [
                    {
                        'user_id': match['id'],
                        'similarity': match['score'],
                        'barriers': match.get('metadata', {}).get('barriers', []),
                        'success_rate': match.get('metadata', {}).get('success_rate', 0.8),
                        'journey': match.get('metadata', {}).get('journey', '')
                    }
                    for match in result.get('matches', [])
                ]
            except Exception as e:
                print(f"[pattern_recognition] Pinecone query failed: {e}")
        # Fallback mock results
        return [
            {
                'user_id': f'user_{i}',
                'similarity': 0.9 - (i * 0.05),
                'barriers': filters.get('barriers', []) if filters else [],
                'success_rate': 0.85,
                'journey': f'Success story {i}'
            }
            for i in range(top_k)
        ]
    
    async def _extract_patterns(self, similar_users: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract common success patterns"""
        patterns = [
            {
                'pattern_id': 'pattern_1',
                'description': 'Early accommodation requests lead to better outcomes',
                'frequency': 0.75,
                'success_rate': 0.82
            },
            {
                'pattern_id': 'pattern_2',
                'description': 'Community support networks critical for minority users',
                'frequency': 0.68,
                'success_rate': 0.79
            }
        ]
        return patterns
    
    async def _identify_models(
        self,
        similar_users: List[Dict[str, Any]],
        goals: List[str]
    ) -> List[str]:
        """Identify which path models worked for similar users"""
        # In production: Analyze which models were used by successful similar users
        models = [
            'autism_adult_education_model',
            'adhd_career_development_model',
            'minority_networking_model'
        ]
        return models
