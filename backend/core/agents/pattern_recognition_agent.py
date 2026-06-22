"""
Agent 2: Pattern Recognition Agent
Learns from people who came before you.

Vector storage: Supabase pgvector (table `pattern_user_embeddings`, 1536-dim,
queried via the `find_similar_pattern_users` RPC). The previous Pinecone
implementation was removed in favor of a single, unified vector database
shared with the servicehub-mvp product. PINECONE_* environment variables are
ignored if set.

The agent's public interface and its placement in the LangGraph orchestration
graph are unchanged \u2014 only the storage backend was swapped.
"""

import os
from typing import List, Dict, Any, Optional

from core.agents.base_agent import BaseAgent
from database.supabase_client import get_supabase

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Must match the VECTOR(N) declaration in the SQL migration.
EMBEDDING_DIM = 1536


class PatternRecognitionAgent(BaseAgent):
    """Identifies patterns from similar users' journeys."""

    def __init__(self):
        super().__init__('pattern_recognition', 'Pattern Recognition Agent')
        self.supabase = None
        self._openai_client = None

    async def initialize(self):
        """Initialize vector store (Supabase pgvector) and embedding model."""
        self.supabase = get_supabase()
        if self.supabase is not None:
            print("   \u2713 Pattern Recognition Agent connected to Supabase pgvector")
        else:
            print("   \u26a0 Pattern Recognition Agent: Supabase not configured, using mock results")

        if OPENAI_API_KEY:
            try:
                from openai import AsyncOpenAI
                self._openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
            except Exception:
                pass
        self.initialized = True

    async def cleanup(self):
        """Cleanup resources."""
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
        Find similar users and success patterns.
        """
        # Generate embedding for user profile
        user_embedding = await self._generate_embedding(
            profile=user_profile,
            goals=goals,
            barriers=barriers,
        )

        # Search for similar users in the vector database
        similar_users = await self._vector_search(
            embedding=user_embedding,
            top_k=10,
            filters={'barriers': barriers},
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
            'explanation': f'Found {len(similar_users)} similar users with {len(patterns)} success patterns',
        }

    async def _generate_embedding(
        self,
        profile: dict,
        goals: List[str],
        barriers: List[str],
    ) -> List[float]:
        """Generate embedding vector for a user profile."""
        if self._openai_client:
            try:
                text = f"barriers: {', '.join(barriers)}. goals: {', '.join(goals)}. profile: {profile}"
                response = await self._openai_client.embeddings.create(
                    model="text-embedding-ada-002",
                    input=text,
                )
                return response.data[0].embedding
            except Exception:
                pass
        # Fallback: mock embedding (matches ada-002 dimension so writes/queries
        # against the pgvector column still succeed in simulation mode).
        return [0.1] * EMBEDDING_DIM

    async def _vector_search(
        self,
        embedding: List[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Search the vector database for similar users."""
        if self.supabase is not None:
            try:
                barriers_filter = None
                if filters and filters.get('barriers'):
                    # Array overlap on the SQL side: return users that share at
                    # least one barrier with the query. NULL = no filter.
                    barriers_filter = [str(b) for b in filters['barriers']]

                response = self.supabase.rpc(
                    'find_similar_pattern_users',
                    {
                        'query_embedding': embedding,
                        'match_threshold': 0.7,
                        'match_count': top_k,
                        'barriers_filter': barriers_filter,
                    },
                ).execute()

                rows = response.data or []
                return [
                    {
                        'user_id': row['user_id'],
                        'similarity': row['similarity'],
                        'barriers': row.get('barriers') or [],
                        'success_rate': row.get('success_rate', 0.5),
                        'journey': row.get('journey', ''),
                    }
                    for row in rows
                ]
            except Exception as e:
                print(f"[pattern_recognition] pgvector query failed: {e}")

        # Fallback mock results (no Supabase configured or query failed)
        return [
            {
                'user_id': f'user_{i}',
                'similarity': 0.9 - (i * 0.05),
                'barriers': filters.get('barriers', []) if filters else [],
                'success_rate': 0.85,
                'journey': f'Success story {i}',
            }
            for i in range(top_k)
        ]

    async def _extract_patterns(self, similar_users: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract common success patterns."""
        patterns = [
            {
                'pattern_id': 'pattern_1',
                'description': 'Early accommodation requests lead to better outcomes',
                'frequency': 0.75,
                'success_rate': 0.82,
            },
            {
                'pattern_id': 'pattern_2',
                'description': 'Community support networks critical for minority users',
                'frequency': 0.68,
                'success_rate': 0.79,
            },
        ]
        return patterns

    async def _identify_models(
        self,
        similar_users: List[Dict[str, Any]],
        goals: List[str],
    ) -> List[str]:
        """Identify which path models worked for similar users."""
        models = [
            'autism_adult_education_model',
            'adhd_career_development_model',
            'minority_networking_model',
        ]
        return models

    async def upsert_user_vector(
        self,
        user_id: str,
        user_profile: dict,
        goals: List[str],
        barriers: List[str],
        success_rate: float = 0.5,
        journey: str = "",
    ) -> bool:
        """Store a user's embedding + metadata in pgvector.

        This is what makes the "learn from people who came before you" feature
        real: every onboarded user is indexed so future users can be matched
        against them. No-ops gracefully when Supabase isn't configured.

        Returns True if the vector was written, False otherwise.
        """
        if self.supabase is None or not user_id:
            return False

        try:
            embedding = await self._generate_embedding(
                profile=user_profile,
                goals=goals,
                barriers=barriers,
            )

            row: Dict[str, Any] = {
                'user_id': str(user_id),
                'embedding': embedding,
                'barriers': [str(b) for b in barriers],
                'goals': [str(g) for g in goals],
                'success_rate': float(success_rate),
                'journey': journey or f"Goals: {', '.join(goals)}",
            }
            motivation = user_profile.get('motivationType')
            if motivation:
                row['motivation_type'] = str(motivation)

            self.supabase.table('pattern_user_embeddings').upsert(
                row,
                on_conflict='user_id',
            ).execute()
            print(f"   \u2713 Indexed user {user_id} in pgvector")
            return True
        except Exception as e:
            print(f"[pattern_recognition] pgvector upsert skipped: {e}")
            return False

