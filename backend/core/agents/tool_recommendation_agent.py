"""
Agent 3: Tool Recommendation Agent
Connects users with the right resources at the right time.

Source of truth: ServiceHub's `resources` table in the shared Supabase
project — the same rows the ResourceHub app shows. Read directly (not over
HTTP) so ratings come from the real `ratings` table and a resource added in
ResourceHub is recommendable here immediately.

There is deliberately NO local catalogue. This agent used to carry ~30
hardcoded tools with invented ratings (4.7/4.8/4.9) that were merged into
every result and, because relevance was scored off that rating, systematically
outranked the real resources. If Supabase is unreachable the agent now returns
nothing rather than inventing tools.

Learning: every reflection feeds a reward back into `tool_outcomes` keyed by
(tool_id, barrier). On the next recommendation we add the learned mean
reward to the static relevance score so tools that have actually helped
people with the same barriers get ranked higher. The same `tool_outcomes`
table is read by the ServiceHub scorer, so the loop is shared across
products. See backend/core/learning.py and 2026_universal_agent_learning.sql.
"""

import json
import os
from typing import List, Dict, Any, Optional

from core.agents.base_agent import BaseAgent
from database.supabase_client import get_supabase
from core.config import Config
from core import llm, learning
import random

SERVICE_HUB_URL = os.getenv("SERVICE_HUB_URL", "http://localhost:3001")

class ToolRecommendationAgent(BaseAgent):
    """Recommends services, products, articles, and other tools"""
    
    def __init__(self):
        super().__init__('tool_recommendation', 'Tool Recommendation Agent')
        self.supabase = None
        self._resource_pool = None
        self._barrier_fit = None
    
    async def initialize(self):
        """Connect to the shared Supabase project.

        There is no local tool catalogue any more. Every tool this agent can
        recommend is a row in ServiceHub's `resources` table — the same table
        the ResourceHub app reads and writes — so a resource added there is
        immediately recommendable here, and nothing is invented.
        """
        self.supabase = get_supabase()
        # Per-run caches, reset at the top of each recommend_tools() call.
        self._resource_pool = None
        self._barrier_fit = None

        self.initialized = True
        source = "ServiceHub resources" if self.supabase else "NO SOURCE (Supabase unavailable)"
        rank = "LLM-ranked" if llm.is_enabled() else "rating-ranked"
        print(f"   ✓ {self.agent_name} initialized — {source}, {rank}")

    
    async def cleanup(self):
        """Cleanup resources"""
        self.initialized = False
    
    async def recommend_tools(
        self,
        user_profile: dict,
        milestones: List[Dict[str, Any]],
        barriers: List[str],
        similar_patterns: List[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Recommend tools for each milestone"""

        # Fresh pool + fresh barrier-fit scores per run. The agent instance is
        # reused across requests, and both caches are user-specific — the fit
        # scores are keyed to THIS user's barriers, and the pool must pick up
        # resources added to ResourceHub since the last run.
        self._resource_pool = None
        self._barrier_fit = None

        recommendations = {}
        all_tools = []

        # Pull learned per-(tool, barrier) reward scores ONCE for the whole
        # batch — avoids N Supabase round-trips inside the milestone loop.
        learned_scores = await learning.get_tool_outcome_scores(
            barriers=barriers, min_samples=10,
        )

        for milestone in milestones:
            milestone_id = milestone.get('id')
            tools = await self._find_relevant_tools(
                milestone=milestone,
                barriers=barriers,
                user_profile=user_profile,
                learned_scores=learned_scores,
            )
            recommendations[milestone_id] = tools
            all_tools.extend(tools)
        
        # Get pit stop tools (general quick-access tools)
        pit_stop_tools = await self._get_pit_stop_tools(barriers)

        # Per-category "how it helps" bullets (Odosa). ONE batched LLM call over
        # the unique tools, matched back onto every recommendation instance by
        # name. The milestone view renders tool.helpsWith directly.
        if llm.is_enabled() and barriers:
            pit_flat = [t for arr in (pit_stop_tools or {}).values() for t in (arr or [])]
            unique: Dict[str, Dict[str, Any]] = {}
            for t in all_tools + pit_flat:
                nm = (t.get('name') or '').strip()
                if nm and nm not in unique:
                    unique[nm] = t
                if len(unique) >= 24:
                    break
            if unique:
                try:
                    help_map = await self._generate_helps_with(list(unique.values()), barriers)
                    for arr in list(recommendations.values()) + list((pit_stop_tools or {}).values()):
                        for t in (arr or []):
                            hw = help_map.get((t.get('name') or '').strip())
                            if hw:
                                t['helpsWith'] = hw
                except Exception as e:
                    print(f"[tool_recommendation] helpsWith generation skipped: {e}")

        explanation = f'Found {len(all_tools)} relevant tools across {len(milestones)} milestones'
        if llm.is_enabled() and all_tools:
            sample_names = [t.get('name', '') for t in all_tools[:5]]
            text = await llm.complete_text(
                system=(
                    "You are a coach explaining tool recommendations. "
                    "In one warm sentence (max 35 words), explain why these tools fit the user's barriers."
                ),
                user=(
                    f"Barriers: {', '.join(barriers) or 'none'}\n"
                    f"Sample tools: {sample_names}\n"
                    "Return just the sentence."
                ),
                temperature=0.6,
                max_tokens=100,
            )
            if text:
                explanation = text

        # Confidence is derived, not declared. It used to be a flat 0.78
        # regardless of whether we found anything. It now reflects how much
        # real evidence is behind these picks: the mean relevance of what we
        # actually returned, damped by how much of it carries community
        # ratings. No catalogue → no recommendations → zero confidence.
        if all_tools:
            mean_relevance = sum(t.get('relevanceScore', 0) for t in all_tools) / len(all_tools)
            rated = sum(1 for t in all_tools if (t.get('reviews') or 0) > 0)
            evidence = 0.6 + 0.4 * (rated / len(all_tools))
            confidence = round(min(mean_relevance * evidence, 1.0), 2)
        else:
            confidence = 0.0

        return {
            'recommendations': recommendations,
            'pit_stop_tools': pit_stop_tools,
            'total_tools': len(all_tools),
            'confidence': confidence,
            'explanation': explanation
        }

    async def _generate_helps_with(
        self,
        tools: List[Dict[str, Any]],
        barriers: List[str],
    ) -> Dict[str, List[Dict[str, Any]]]:
        """One batched LLM pass mapping tools → the user's barrier categories.

        Returns {tool_name: [{category, points:[1-2 bullets]}]}, where category
        is drawn verbatim from `barriers` and points are grounded in the tool's
        description (no invented features). Empty dict on any failure.
        """
        tool_lines = [
            {
                'name': t.get('name'),
                'type': t.get('type'),
                'description': (t.get('description') or '')[:160],
            }
            for t in tools
            if t.get('name')
        ]
        if not tool_lines:
            return {}

        data = await llm.complete_json(
            system=(
                "You match assistive tools to a user's barrier categories and explain the help. "
                "For each tool, pick the 1-2 MOST relevant categories from the provided barrier "
                "list (use the barrier text verbatim as `category`), and write 1-2 short bullet "
                "points (max 12 words each) on how THAT tool specifically helps with THAT "
                "category. Ground every point in the tool's description; never invent features."
            ),
            user=(
                f"Barrier categories: {json.dumps(barriers)}\n"
                f"Tools: {json.dumps(tool_lines)}\n"
                'Return JSON: {"tools": [{"name": "...", "helpsWith": '
                '[{"category": "...", "points": ["...", "..."]}]}]}'
            ),
            temperature=0.4,
            max_tokens=2000,
        )

        out: Dict[str, List[Dict[str, Any]]] = {}
        if not isinstance(data, dict):
            return out
        for t in (data.get('tools') or []):
            if not isinstance(t, dict):
                continue
            name = str(t.get('name') or '').strip()
            groups = t.get('helpsWith')
            if not name or not isinstance(groups, list):
                continue
            cleaned: List[Dict[str, Any]] = []
            for g in groups[:2]:
                if not isinstance(g, dict):
                    continue
                cat = str(g.get('category') or '').strip()
                pts = [str(p).strip() for p in (g.get('points') or []) if str(p).strip()][:2]
                if cat and pts:
                    cleaned.append({'category': cat, 'points': pts})
            if cleaned:
                out[name] = cleaned
        return out

    async def _find_relevant_tools(
        self,
        milestone: Dict[str, Any],
        barriers: List[str],
        user_profile: dict,
        learned_scores: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        """Rank the real ServiceHub resource pool for one milestone.

        Every candidate is a real row. Ranking blends three real signals:
        the LLM's fit score for the user's barriers, the resource's actual
        community rating, and the learned reward from `tool_outcomes`. When
        the pool is empty this returns [] — it never substitutes invented
        tools to fill the space.
        """
        scores = learned_scores or {}
        pool = await self._fetch_resource_pool()
        if not pool:
            return []

        fit = await self._barrier_fit_scores(pool, barriers)

        ranked: List[Dict[str, Any]] = []
        for tool in pool:
            t = tool.copy()
            base = self._calculate_relevance(t, milestone, barriers, fit)
            t['relevanceScore'] = self._blend_learned_score(base, t.get('id'), scores)
            ranked.append(t)

        ranked.sort(key=lambda x: x.get('relevanceScore', 0), reverse=True)
        return ranked[:6]

    async def _fetch_resource_pool(self) -> List[Dict[str, Any]]:
        """Load approved ServiceHub resources with their REAL rating figures.

        `rating` is the mean of actual community ratings and `reviews` is how
        many there are. An unrated resource gets rating=None / reviews=0 —
        never a placeholder number, so the UI can say "not yet rated" instead
        of implying social proof that does not exist.

        Cached for the run; one query for resources, one for ratings.
        """
        if self._resource_pool is not None:
            return self._resource_pool

        if self.supabase is None:
            self.supabase = get_supabase()
        if self.supabase is None:
            print("[tool_recommendation] Supabase unavailable — recommending nothing this run")
            self._resource_pool = []
            return []

        try:
            res = (
                self.supabase.table('resources')
                .select('id, name, description, category, contact_info, image_url, price')
                .eq('status', 'approved')
                .limit(500)
                .execute()
            )
            rows = res.data or []
        except Exception as e:
            print(f"[tool_recommendation] resources query failed — recommending nothing: {e}")
            self._resource_pool = []
            return []

        # Real ratings, aggregated per resource.
        agg: Dict[str, Dict[str, float]] = {}
        try:
            rat = self.supabase.table('ratings').select('resource_id, overall_score').execute()
            for r in (rat.data or []):
                rid = r.get('resource_id')
                score = r.get('overall_score')
                if not rid or score is None:
                    continue
                a = agg.setdefault(rid, {'sum': 0.0, 'count': 0.0})
                a['sum'] += float(score)
                a['count'] += 1
        except Exception as e:
            # Ratings are a ranking signal, not a requirement. Missing them
            # means unrated resources, not fabricated ones.
            print(f"[tool_recommendation] ratings query failed, continuing unrated: {e}")

        pool: List[Dict[str, Any]] = []
        for r in rows:
            rid = r.get('id')
            a = agg.get(rid)
            contact = r.get('contact_info') or {}
            pool.append({
                'id': f"sh_{rid}",
                'resourceId': rid,
                'name': r.get('name') or 'Resource',
                'description': r.get('description') or '',
                'url': contact.get('website') or f"{SERVICE_HUB_URL}/resources/{rid}",
                'imageUrl': r.get('image_url'),
                'price': r.get('price'),
                # REAL figures, or honest absence.
                'rating': round(a['sum'] / a['count'], 2) if a and a['count'] else None,
                'reviews': int(a['count']) if a else 0,
                'category': r.get('category') or 'other',
                'type': self._tool_type_for(r.get('category')),
                'source': 'servicehub',
            })

        self._resource_pool = pool
        print(f"[tool_recommendation] pool: {len(pool)} approved ServiceHub resources")
        return pool

    @staticmethod
    def _tool_type_for(category: Optional[str]) -> str:
        """Map a ServiceHub resource category onto the four buckets the UI groups by."""
        c = (category or '').lower()
        if c in ('app', 'store'):
            return 'product'
        if c in ('book', 'workshop'):
            return 'commentary'
        if c in ('therapist', 'school', 'doctor', 'support_group', 'organization', 'park', 'recreation'):
            return 'service'
        return 'other'

    async def _barrier_fit_scores(
        self,
        pool: List[Dict[str, Any]],
        barriers: List[str],
    ) -> Dict[str, float]:
        """Ask the LLM how well each real resource fits the user's barriers.

        One batched call per run, scoring resources that already exist. The
        LLM ranks; it never invents a resource. Without a key (or on failure)
        every resource scores neutral and ranking falls back to real ratings
        plus learned rewards.
        """
        if self._barrier_fit is not None:
            return self._barrier_fit

        neutral = {t['id']: 0.5 for t in pool}
        if not llm.is_enabled() or not barriers or not pool:
            self._barrier_fit = neutral
            return neutral

        # Cap the batch so the prompt stays affordable on a large catalogue.
        subset = pool[:60]
        listing = "\n".join(
            f"{i}. {t['name']} — {(t['description'] or '')[:110]}"
            for i, t in enumerate(subset)
        )
        try:
            raw = await llm.complete_text(
                system=(
                    "You rate how useful each listed resource is for a person facing "
                    "specific barriers. Return ONLY a JSON object mapping the item NUMBER "
                    "to a score from 0.0 (irrelevant) to 1.0 (highly relevant). No prose."
                ),
                user=f"Barriers: {', '.join(barriers)}\n\nResources:\n{listing}",
                temperature=0.2,
                max_tokens=900,
            )
            parsed = json.loads((raw or '').strip().removeprefix('```json').removeprefix('```').removesuffix('```'))
            out = dict(neutral)
            for k, v in parsed.items():
                try:
                    idx = int(k)
                    if 0 <= idx < len(subset):
                        out[subset[idx]['id']] = max(0.0, min(1.0, float(v)))
                except (ValueError, TypeError):
                    continue
            self._barrier_fit = out
            return out
        except Exception as e:
            print(f"[tool_recommendation] barrier-fit scoring skipped, ranking on ratings: {e}")
            self._barrier_fit = neutral
            return neutral

    def _blend_learned_score(
        self,
        base_score: float,
        tool_id: Optional[str],
        learned_scores: Dict[str, Dict[str, Any]],
    ) -> float:
        """Add the learned reward bias to a static relevance score.

        Formula: blended = 0.7 * base + 0.3 * normalized_learned_reward
        normalized_learned_reward = (reward_avg + 1) / 2 ∈ [0, 1]

        For tools we have no history for, learned_reward defaults to neutral
        (0.5) so the agent doesn't get punished for surfacing a brand-new
        tool that simply hasn't been judged yet.
        """
        if not tool_id:
            return base_score
        row = learned_scores.get(str(tool_id))
        if not row:
            return base_score
        try:
            raw = float(row.get('reward_avg', 0.0) or 0.0)
        except (TypeError, ValueError):
            return base_score
        # Map reward in [-1, 1] to [0, 1].
        learned_norm = max(0.0, min(1.0, (raw + 1.0) / 2.0))
        return 0.7 * base_score + 0.3 * learned_norm

    def _calculate_relevance(
        self,
        tool: Dict[str, Any],
        milestone: Dict[str, Any],
        barriers: List[str],
        fit: Optional[Dict[str, float]] = None,
    ) -> float:
        """Score one real resource against one milestone.

        Weighted from signals that all exist: the LLM's barrier-fit score, the
        resource's actual community rating, and word overlap with the
        milestone. An unrated resource contributes nothing from the rating
        term rather than defaulting to a middling score — previously
        `tool.get('rating', 3.0)` gave unrated resources a free 0.6, which is
        how hardcoded tools carrying invented 4.7s beat real ones.
        """
        # Barrier fit (LLM), neutral 0.5 when unscored.
        score = 0.55 * (fit or {}).get(tool.get('id'), 0.5)

        # Real community rating, only when the resource actually has one.
        rating = tool.get('rating')
        reviews = tool.get('reviews') or 0
        if rating is not None and reviews > 0:
            # Confidence-weighted: a 5.0 from one person counts for less than
            # a 4.5 from twenty.
            confidence = min(reviews / 10.0, 1.0)
            score += 0.30 * (float(rating) / 5.0) * confidence

        # Word overlap with what this milestone is actually about.
        milestone_text = f"{milestone.get('name', '')} {milestone.get('description', '')}".lower()
        tool_text = f"{tool.get('name', '')} {tool.get('description', '')}".lower()
        m_words = {w for w in milestone_text.split() if len(w) > 4}
        t_words = {w for w in tool_text.split() if len(w) > 4}
        if m_words and t_words:
            overlap = len(m_words & t_words) / len(m_words)
            score += 0.15 * min(overlap * 2, 1.0)

        return min(score, 1.0)
    
    async def _get_pit_stop_tools(self, barriers: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        """Quick-access shelf, grouped from the same real resource pool.

        This is what fills the Pit Stop Shop on the race track. Empty groups
        stay empty — the shop shows what ResourceHub actually holds.
        """
        pit_stop: Dict[str, List[Dict[str, Any]]] = {
            'services': [], 'commentaries': [], 'products': [], 'other': [],
        }
        pool = await self._fetch_resource_pool()
        if not pool:
            return pit_stop

        fit = await self._barrier_fit_scores(pool, barriers)
        # Best-fitting first, so the shelf reflects this user's barriers.
        ordered = sorted(pool, key=lambda t: fit.get(t.get('id'), 0.5), reverse=True)

        bucket = {'service': 'services', 'commentary': 'commentaries',
                  'product': 'products', 'other': 'other'}
        for t in ordered:
            group = bucket.get(t.get('type'), 'other')
            if len(pit_stop[group]) < 4:
                pit_stop[group].append(t)
        return pit_stop

    async def search_tools(
        self,
        query: str,
        barriers: List[str],
        tool_type: str = 'all'
    ) -> List[Dict[str, Any]]:
        """Search the real resource pool (Magic Searchbar).

        Matches against actual ServiceHub rows. Ranking uses the real rating
        where one exists; an unrated resource is ranked on text match alone
        rather than being handed a default score.
        """
        pool = await self._fetch_resource_pool()
        if not pool:
            return []

        q = (query or '').lower().strip()
        if not q:
            return []

        wanted = None
        if tool_type != 'all':
            wanted = {'services': 'service', 'products': 'product',
                      'commentaries': 'commentary', 'other': 'other'}.get(tool_type, tool_type)

        results = []
        for tool in pool:
            if wanted and tool.get('type') != wanted:
                continue
            text = f"{tool.get('name', '')} {tool.get('description', '')}".lower()
            hits = text.count(q)
            if not hits:
                continue
            t = tool.copy()
            score = hits * 0.3
            rating, reviews = tool.get('rating'), tool.get('reviews') or 0
            if rating is not None and reviews > 0:
                score += (float(rating) / 5.0) * min(reviews / 10.0, 1.0)
            t['searchScore'] = score
            results.append(t)

        results.sort(key=lambda x: x.get('searchScore', 0), reverse=True)
        return results[:10]
