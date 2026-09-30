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
from core.condition_taxonomy import match_keys
from core.embedding_privacy import EMBEDDING_TEXT_VERSION, build_embedding_text
from database.supabase_client import get_supabase

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Must match the VECTOR(N) declaration in the SQL migration.
EMBEDDING_DIM = 1536

# How many threshold-passing candidates to pull before the condition filter.
# The filter used to run in SQL as an exact-string array overlap; matching on
# normalised conditions needs the taxonomy, which lives in Python, so the RPC
# is called unfiltered and the rows are filtered here. That is exact while
# fewer rows than this pass the threshold (pattern_user_embeddings holds 61
# today). Past that, the filter only sees the best-ranked CANDIDATE_POOL rows,
# and _vector_search logs when that happens. Kept under PostgREST's 1000-row
# response cap.
CANDIDATE_POOL = 500


def apply_condition_filter(
    rows: List[Dict[str, Any]],
    query_barriers: List[str],
    top_k: int,
) -> List[Dict[str, Any]]:
    """Keep rows that share a real condition with the query, in RPC order.

    Conditions are compared by condition_taxonomy.match_keys, so spelling
    variants match and placeholder answers ("Prefer not to share", "No current
    barriers") never count as something in common. A query with no matchable
    condition is not filtered, the same as a query with no barriers at all.
    """
    query_keys = match_keys(query_barriers)
    if not query_keys:
        return list(rows)[:top_k]
    return [r for r in rows if match_keys(r.get('barriers')) & query_keys][:top_k]


class PatternRecognitionAgent(BaseAgent):
    """Identifies patterns from similar users' journeys."""

    def __init__(self):
        super().__init__('pattern_recognition', 'Pattern Recognition Agent')
        self.supabase = None
        self._openai_client = None
        # Populated on each find_similar_patterns() call so the orchestrator
        # can attribute future reward back to these retrieved users.
        self.last_retrieved_user_ids: List[str] = []

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
        user_id: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Find similar users and success patterns.

        Similarity is based on profile embeddings and barriers. Ambiguous
        reflection-derived feedback is intentionally excluded from ranking.
        """
        # Generate embedding for user profile
        user_embedding = await self._generate_embedding(
            profile=user_profile,
            goals=goals,
            barriers=barriers,
        )

        # Bound in one place: the confidence below divides by this, and a
        # denominator that drifts from what we actually requested would make
        # the number quietly wrong.
        requested = 10

        # No embedding means no search. Querying with a placeholder vector
        # returns matches that have nothing to do with this person.
        if user_embedding is None:
            similar_users = []
        else:
            similar_users = await self._vector_search(
                embedding=user_embedding,
                top_k=requested,
                filters={'barriers': barriers},
                query_user_id=user_id,
            )

        # Keep retrieved ids for auditing only. They are not rewarded from a
        # broad reflection because that would not establish causality.
        self.last_retrieved_user_ids = [
            str(u.get('userId') or u.get('user_id'))
            for u in similar_users
            if (u.get('userId') or u.get('user_id'))
        ]

        # Extract success patterns
        patterns = await self._extract_patterns(similar_users)

        # Identify models that worked
        models = await self._identify_models(similar_users, goals)

        # Confidence here is about RETRIEVAL, and the only trustworthy signal is
        # how many comparable users we found.
        #
        # The RPC's "similarity" cannot carry it: that field is a ranking score,
        # not a cosine value — it adds a success-rate bias and a personalisation
        # term, so every row comes back at ~1.016 (measured). Averaging it
        # saturates at 1.0 no matter how good or bad the matches are, which is
        # worse than useless because it looks like certainty.
        #
        # What IS meaningful: the RPC only returns rows already past
        # match_threshold, so the count reflects how many genuinely comparable
        # people exist. Six matches out of ten requested is real information;
        # zero means nobody to learn from, which must read as 0.0.
        if similar_users:
            confidence = round(min(len(similar_users) / float(requested), 1.0), 2)
        else:
            confidence = 0.0

        return {
            'similar_users': similar_users,
            'patterns': patterns,
            'models': models,
            'confidence': confidence,
            'explanation': f'Found {len(similar_users)} similar users with {len(patterns)} success patterns',
            'retrieved_user_ids': self.last_retrieved_user_ids,
        }

    async def _generate_embedding(
        self,
        profile: dict,
        goals: List[str],
        barriers: List[str],
    ) -> Optional[List[float]]:
        """Embed a profile, or return None if that is not possible.

        The text sent to OpenAI comes from build_embedding_text, which uses
        only normalised conditions, allow-listed goal words, a coarse age band
        and the motivation option. It used to be the stringified onboarding
        dict, which carried the user's email and id to a third party on every
        call. Raw fields are still stored in our own database unchanged.

        On failure this returns None rather than a placeholder vector. The old
        fallback returned [0.1] * 1536 and upsert stored it: every user indexed
        that way would sit at cosine 1.0 from every other one, a cluster of
        perfect matches that are not similar at all. None of the 61 stored
        vectors is that placeholder today; this keeps it that way.
        """
        if not self._openai_client:
            return None
        text = build_embedding_text(barriers=barriers, goals=goals, profile=profile)
        try:
            response = await self._openai_client.embeddings.create(
                model="text-embedding-ada-002",
                input=text,
            )
            vector = response.data[0].embedding
        except Exception as e:
            print(f"[pattern_recognition] embedding failed: {e}")
            return None
        if len(vector) != EMBEDDING_DIM:
            print(f"[pattern_recognition] unexpected embedding size {len(vector)}")
            return None
        return vector

    async def _vector_search(
        self,
        embedding: List[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        query_user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search the vector database for similar users.

        `query_user_id` is forwarded to the RPC so it can personalize the
        ranking via `pattern_user_feedback`. Non-UUID values (e.g. demo
        'user_123') are silently dropped so the RPC still runs in its
        non-personalized mode.
        """
        if self.supabase is not None:
            try:
                query_barriers = [str(b) for b in ((filters or {}).get('barriers') or [])]
                filtered = bool(match_keys(query_barriers))

                rpc_args: Dict[str, Any] = {
                    'query_embedding': embedding,
                    'match_threshold': 0.7,
                    # Over-fetch when filtering, so the filter below has the
                    # whole threshold-passing set to choose from.
                    'match_count': CANDIDATE_POOL if filtered else top_k,
                    # The condition filter runs in apply_condition_filter, not
                    # in SQL: the SQL version compared raw strings, so "ADHD"
                    # missed "adhd" and "Prefer not to share" matched itself.
                    'barriers_filter': None,
                    # ALWAYS pass query_user_id (None → SQL NULL). Two overloads
                    # of find_similar_pattern_users exist in the DB (4-arg legacy
                    # + 5-arg), and omitting the param makes the call ambiguous —
                    # PostgREST rejects it with PGRST203 and the agent silently
                    # fell back to 0 patterns on EVERY run. Passing all five
                    # params resolves to the 5-arg version, whose NULL branch
                    # behaves exactly like the legacy function; a real user id
                    # additionally excludes the user from their own matches.
                    'query_user_id': query_user_id,
                }

                response = self.supabase.rpc(
                    'find_similar_pattern_users',
                    rpc_args,
                ).execute()

                rows = response.data or []
                if filtered and len(rows) >= CANDIDATE_POOL:
                    print(f"[pattern_recognition] {len(rows)} candidates reached "
                          f"CANDIDATE_POOL; the condition filter only saw the "
                          f"top {CANDIDATE_POOL} by score")
                rows = apply_condition_filter(rows, query_barriers, top_k)
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

        # No fabricated social proof. Downstream agents already support an
        # empty pattern set and will use curated/default planning instead.
        return []

    async def _extract_patterns(self, similar_users: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Return only patterns actually supported by retrieved outcome data.

        The current vector rows do not contain enough structured observations
        to calculate frequencies or success rates, so making up aggregate
        values would be false social proof. Keep this empty until a real
        aggregation query is available.
        """
        return []

    async def _identify_models(
        self,
        similar_users: List[Dict[str, Any]],
        goals: List[str],
    ) -> List[str]:
        """Identify path models backed by retrieved outcomes."""
        return []

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
            if embedding is None:
                # Leave any existing row alone rather than overwrite it with
                # nothing useful; the user can be re-indexed later.
                print(f"[pattern_recognition] not indexing {user_id}: no embedding")
                return False

            # Raw barriers and goals are stored exactly as before -- only the
            # text sent out for embedding was anonymised.
            row: Dict[str, Any] = {
                'user_id': str(user_id),
                'embedding': embedding,
                'barriers': [str(b) for b in barriers],
                'goals': [str(g) for g in goals],
                'success_rate': float(success_rate),
                'journey': journey or f"Goals: {', '.join(goals)}",
                # Which text the vector was built from. Vectors from different
                # text versions are not comparable; this is how the backfill
                # and the experiments tell them apart.
                'embedding_text_version': EMBEDDING_TEXT_VERSION,
            }
            motivation = user_profile.get('motivationType')
            if motivation:
                row['motivation_type'] = str(motivation)

            try:
                self.supabase.table('pattern_user_embeddings').upsert(
                    row,
                    on_conflict='user_id',
                ).execute()
            except Exception as e:
                # Deployed before STEP 42 added the column: still index the
                # user rather than fail onboarding over a bookkeeping field.
                if 'embedding_text_version' not in str(e):
                    raise
                row.pop('embedding_text_version')
                self.supabase.table('pattern_user_embeddings').upsert(
                    row,
                    on_conflict='user_id',
                ).execute()
            print(f"   \u2713 Indexed user {user_id} in pgvector")
            return True
        except Exception as e:
            print(f"[pattern_recognition] pgvector upsert skipped: {e}")
            return False

