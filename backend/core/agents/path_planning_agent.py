"""
Agent 1: Path Planning Agent
Creates the roadmap from current state to goals
SIMULATION MODE: Uses predefined models and generates realistic paths

Learning: every reflection feeds a reward back into `path_planning_outcomes`
keyed by a stable (barriers + goal categories) signature. On the next
generation we pull the (milestone_count, est_days_avg) that has produced the
highest mean reward for users like this one and bias the new plan toward it.
Falls back to the original behavior when there isn't enough data yet.
See backend/core/learning.py and 2026_universal_agent_learning.sql.
"""

from typing import List, Dict, Any, Optional
from core.agents.base_agent import BaseAgent
from core.config import Config
from core import llm, learning
from core import memory as mem
import asyncio

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
            # Onboarding emits 'race_visible_minority' (see the norms
            # taxonomy), so the old 'visible_minority' key never matched and
            # this entire model was dead. Aliased below rather than renamed so
            # any older payload still resolves.
            'race_visible_minority': {
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
        
        # Back-compat alias for payloads written before the key was corrected.
        self.barrier_models['visible_minority'] = self.barrier_models['race_visible_minority']

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
        support_context = user_profile.get('supportContext') or {}
        support_summary = self._summarize_support_context(support_context)

        # Combine barrier models for intersectional planning
        combined_strategies = []
        combined_strengths = []
        combined_accommodations = []

        # The curated models cover 5 norms. Onboarding offers 19, so a deaf,
        # blind, wheelchair-using, low-income or LGBTQ+ user previously got an
        # empty set — no strategies, no strengths, no accommodations — from
        # exactly the tool meant to adapt to them. Rather than hand-writing 14
        # more dictionaries, anything the curated set does not cover is
        # generated for that specific norm.
        uncovered = []
        for barrier in barriers:
            barrier_key = barrier.lower().replace(' ', '_')
            if barrier_key in self.barrier_models:
                model = self.barrier_models[barrier_key]
                combined_strategies.extend(model['strategies'])
                combined_strengths.extend(model['strengths'])
                combined_accommodations.extend(model['accommodations'])
            else:
                uncovered.append(barrier)

        if uncovered:
            generated = await self._generate_barrier_model(uncovered)
            combined_strategies.extend(generated.get('strategies', []))
            combined_strengths.extend(generated.get('strengths', []))
            combined_accommodations.extend(generated.get('accommodations', []))

        # Preserve user-reported strategies and accommodations alongside the
        # curated barrier models. These are functional preferences, not
        # diagnostic claims.
        if support_context.get('strategiesWorked'):
            combined_strategies.append(str(support_context['strategiesWorked']))
        for key in ('schoolAccommodations', 'workplaceAccommodations', 'sensoryNeeds'):
            if support_context.get(key):
                combined_accommodations.append(str(support_context[key]))
        
        # Generate milestones for all goals in parallel.
        goal_milestone_lists = await asyncio.gather(*[
            self._generate_milestones_for_goal(
                goal=goal,
                goal_idx=goal_idx,
                barriers=barriers,
                strategies=combined_strategies,
                similar_patterns=similar_patterns or [],
                memory_hint=memory_hint,
                support_summary=support_summary,
            )
            for goal_idx, goal in enumerate(goals)
        ])
        all_milestones: List[Dict[str, Any]] = []
        for goal_milestones in goal_milestone_lists:
            all_milestones.extend(goal_milestones)

        # Learning loop: if past users with the same barriers+goals profile
        # achieved higher rewards on shorter (or longer) plans, prune/extend
        # accordingly. This is a bandit pick on milestone_count.
        profile_sig = learning.compute_profile_signature(barriers, goals)
        best_shape = await learning.get_best_path_shape(profile_sig, min_samples=20)
        learned_reward = float((best_shape or {}).get("reward_avg") or 0.0)
        learned_samples = int((best_shape or {}).get("sample_count") or 0)
        if (
            best_shape
            and learned_samples >= 20
            and learned_reward >= 0.25
            and isinstance(best_shape.get("milestone_count"), int)
        ):
            target = int(best_shape["milestone_count"])
            if 0 < target < len(all_milestones):
                # Keep the highest-priority milestones in original order. We
                # never grow past what the LLM/templates produced — adding
                # synthetic milestones we don't have content for would hurt.
                all_milestones = all_milestones[:target]
            target_days = best_shape.get("est_days_avg")
            if target_days and target_days > 0:
                # Bias estimatedDays toward the learned mean (50/50 blend)
                # so we move gradually rather than overcorrecting on a small
                # sample.
                for m in all_milestones:
                    current = m.get('estimatedDays') or 14
                    m['estimatedDays'] = int(round((current + target_days) / 2))

        # Helper tricks depend only on the barrier list, so compute once and
        # reuse across every task instead of calling the LLM 80 times.
        shared_helper_tricks = await self._get_helper_tricks(barriers, support_summary)

        # Generate tasks and recommended choices for every milestone in
        # parallel — these were the slowest sequential loops (one LLM round
        # trip per milestone, ~16 each) and the calls are independent.
        # Tasks were the single biggest cost: 16 of 38 LLM calls and 36.6s of
        # the 70s of LLM time in a profiled run. Batched into chunks; the
        # per-milestone method stays as the fallback for anything a batch
        # does not return.
        batched_tasks = await self._generate_tasks_batch(
            all_milestones, barriers, helper_tricks=shared_helper_tricks,
        )
        task_lists, choices_lists = await asyncio.gather(
            asyncio.gather(*[
                self._resolve_tasks_for_milestone(
                    m, barriers, batched_tasks, helper_tricks=shared_helper_tricks,
                )
                for m in all_milestones
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

        # Now that tasks exist, replace the placeholder estimate with one
        # derived from this milestone's ACTUAL work.
        self._apply_task_derived_estimates(all_milestones, task_lists)
        
        # Confidence is derived, not declared. It was a flat 0.85 whether the
        # plan was written for this user or lifted wholesale from the template
        # list. It now reports the share of milestone names actually generated
        # for them — a fully templated plan scores low, and honestly.
        if all_milestones:
            generated = sum(1 for m in all_milestones if m.get('nameSource') == 'generated')
            confidence = round(0.35 + 0.6 * (generated / len(all_milestones)), 2)
        else:
            confidence = 0.0

        return {
            'milestones': all_milestones,
            'tasks': all_tasks,
            'strategies': list(set(combined_strategies)),
            'strengths': list(set(combined_strengths)),
            'accommodations': list(set(combined_accommodations)),
            'confidence': confidence,
            'explanation': f'Generated personalized path with {len(all_milestones)} milestones for {len(goals)} goals, considering {len(barriers)} barrier types'
        }

    @staticmethod
    def _summarize_support_context(context: Dict[str, Any]) -> str:
        """Render bounded functional support context for prompts."""
        if not isinstance(context, dict):
            return ""
        values: List[str] = []
        notes = context.get('conditionSupportNotes')
        if isinstance(notes, list):
            values.extend(str(note).strip() for note in notes[:20] if str(note).strip())
        for key in (
            'therapyTypes', 'sensoryNeeds', 'strategiesWorked',
            'strategiesNotWorked', 'schoolAccommodations',
            'workplaceAccommodations', 'biggestChallenge',
            'biggestChallengeResponse', 'recentChallenge',
            'recentChallengeResponse',
        ):
            value = context.get(key)
            if isinstance(value, str) and value.strip():
                values.append(value.strip())
        return ' | '.join(values)[:5000]
    
    async def _generate_milestones_for_goal(
        self,
        goal: str,
        goal_idx: int,
        barriers: List[str],
        strategies: List[str],
        similar_patterns: List[Dict[str, Any]],
        memory_hint: str = "",
        support_summary: str = "",
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
                    + (f"Functional support needs and successful accommodations: {support_summary}\n" if support_summary else "")
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
        #
        # Provenance: every milestone records whether its NAME was generated
        # for this user or taken from the per-area template list. Previously
        # the two were indistinguishable downstream, so a template plan — the
        # same one every user in that life area receives — was presented as a
        # personalised one with nothing marking the difference.
        shells: List[Dict[str, Any]] = []
        order_counter = 0
        templated_dims: List[str] = []
        for dim_key, dim_label, _focus in dimensions:
            generated = per_dim_names.get(dim_key)
            names = generated or fallback_map[dim_key][:4]
            if not generated:
                templated_dims.append(dim_key)
            for i, template in enumerate(names):
                shells.append({
                    'id': f'milestone_g{goal_idx}_{dim_key}_{i}',
                    'raceId': f'race_{goal_idx}',
                    'name': template,
                    # 'generated' = written for this user; 'template' = generic
                    # starting point shared by everyone in this life area.
                    'nameSource': 'generated' if generated else 'template',
                    'order': order_counter,
                    'status': 'not_started' if order_counter > 0 else 'in_progress',
                    'barrierAware': True,
                    # Deterministic slice, not random.sample. A random draw
                    # made the same profile produce different strategies on
                    # every run, which is indefensible in something presented
                    # as tailored advice — and untestable.
                    'strategies': strategies[:2] if strategies else [],
                    # Placeholder until tasks exist. This used to be
                    # random.randint(7, 30) — a dice roll presented as an
                    # estimate, and worse, averaged into est_days_avg and
                    # written to path_planning_outcomes, so the path-shape
                    # learner was training on noise. Replaced with a real
                    # figure derived from the milestone's own tasks once they
                    # are generated (see _apply_task_derived_estimates).
                    'estimatedDays': 7,
                    'goal': goal,
                    'dimension': dim_key,
                    'dimensionLabel': dim_label,
                    'category': dim_key if dim_key != 'workplace' else 'career',
                })
                order_counter += 1

        # Make the degradation visible in logs. Silent template substitution is
        # how a generic plan reaches a user looking personalised.
        if templated_dims:
            reason = "LLM disabled" if not llm.is_enabled() else "LLM returned no usable names"
            print(
                f"[path_planning] TEMPLATE FALLBACK ({reason}) for "
                f"{', '.join(templated_dims)} — these milestones are generic, not generated"
            )

        # ONE call for all descriptions instead of one per milestone. Profiling
        # a single generation showed 16 of 38 LLM calls came from this loop.
        # Call count is what limits concurrency here: the work is network-bound,
        # so N users each opening 38 sockets saturates the box long before CPU
        # does. Batching cuts the per-user fan-out, which is what makes more
        # simultaneous users possible.
        descriptions = await self._enrich_descriptions_batch(
            [s['name'] for s in shells], barriers, goal, support_summary,
        )
        for shell in shells:
            shell['description'] = descriptions.get(
                shell['name'], f"{shell['name']} - tailored for {goal}",
            )

        return shells
    
    async def _generate_barrier_model(
        self,
        barriers: List[str],
    ) -> Dict[str, List[str]]:
        """Produce strategies / strengths / accommodations for norms we have no
        curated model for.

        One call covering every uncovered norm at once. Strengths are asked for
        explicitly and framed as real capabilities rather than consolations —
        a deficit-only description of someone's norm is precisely the framing
        this product exists to push back on.

        Returns empty lists when the LLM is unavailable. An empty set is honest;
        borrowing another norm's advice would not be.
        """
        empty = {'strategies': [], 'strengths': [], 'accommodations': []}
        if not llm.is_enabled() or not barriers:
            return empty

        try:
            data = await llm.complete_json(
                system=(
                    "You advise on accessibility and inclusion. For the listed "
                    "norms, give practical planning inputs. strategies = concrete "
                    "approaches that help. strengths = genuine capabilities "
                    "commonly associated with this experience, never platitudes. "
                    "accommodations = specific adjustments to ask for. Use short "
                    "snake_case phrases. 3-4 items per list. "
                    'Return JSON: {"strategies": [], "strengths": [], "accommodations": []}'
                ),
                user=f"Norms: {', '.join(barriers)}",
                temperature=0.4,
                max_tokens=400,
            )
            if not isinstance(data, dict):
                return empty
            out = {}
            for key in ('strategies', 'strengths', 'accommodations'):
                vals = data.get(key)
                out[key] = [
                    str(v).strip() for v in vals if str(v).strip()
                ][:6] if isinstance(vals, list) else []
            return out
        except Exception as e:
            print(f"[path_planning] barrier model generation skipped: {e}")
            return empty

    async def _enrich_descriptions_batch(
        self,
        names: List[str],
        barriers: List[str],
        goal: str,
        support_summary: str = "",
        chunk_size: int = 10,
    ) -> Dict[str, str]:
        """Describe many milestones in as few LLM calls as possible.

        Chunked rather than one giant call: a single request for 30 milestones
        risks truncation, and a truncated JSON body loses every description in
        it. Anything a chunk fails to return simply falls back to the caller's
        default, so a partial response degrades per-milestone instead of
        failing the whole plan.
        """
        out: Dict[str, str] = {}
        if not llm.is_enabled() or not names:
            return out

        # Chunks run concurrently. Batching alone made things WORSE in testing —
        # it cut 38 calls to 11 but ran them in a sequential loop, so wall-clock
        # went 25s -> 64s. Fewer calls AND parallel is the combination that wins.
        async def _one_chunk(i: int) -> None:
            chunk = names[i:i + chunk_size]
            listing = "\n".join(f"{j}. {n}" for j, n in enumerate(chunk))
            try:
                data = await llm.complete_json(
                    system=(
                        "You are a neurodiversity-aware life coach. For EACH numbered "
                        "milestone write ONE warm, concrete sentence (max 35 words) "
                        "describing it, tailored to the user's barriers. "
                        'Return JSON: {"descriptions": {"0": "...", "1": "..."}}'
                    ),
                    user=(
                        f"Goal: {goal}\n"
                        f"Barriers: {', '.join(barriers) or 'none'}\n"
                        f"{('Support context: ' + support_summary) if support_summary else ''}\n"
                        f"Milestones:\n{listing}"
                    ),
                    temperature=0.6,
                    max_tokens=180 * len(chunk),
                )
                mapping = (data or {}).get('descriptions') or {}
                for j, name in enumerate(chunk):
                    val = mapping.get(str(j)) or mapping.get(j)
                    if isinstance(val, str) and val.strip():
                        out[name] = val.strip()
            except Exception as e:
                print(f"[path_planning] description batch {i // chunk_size} failed: {e}")

        await asyncio.gather(*[
            _one_chunk(i) for i in range(0, len(names), chunk_size)
        ])
        return out

    async def _enrich_description(
        self,
        template: str,
        barriers: List[str],
        goal: str,
        support_summary: str = "",
    ) -> str:
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
                    + (f"Functional support needs and successful accommodations: {support_summary}\n" if support_summary else "")
                    + "Return only the sentence — no quotes, no preamble."
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
    
    @staticmethod
    def _apply_task_derived_estimates(
        milestones: List[Dict[str, Any]],
        task_lists: List[List[Dict[str, Any]]],
    ) -> None:
        """Set estimatedDays from the milestone's own tasks.

        Each task carries its own `minutes`, so the honest estimate is the work
        it actually contains, spread over a realistic pace. We assume ~45 min of
        focused effort per day rather than a full working day — this product is
        built for people with limited executive-function budget, and an estimate
        that assumes eight productive hours is not just wrong, it sets up a
        failure the user will read as their own.

        Bounded to 1-60 days so one malformed task cannot produce a milestone
        that claims to take a year.
        """
        MINUTES_PER_DAY = 45.0
        for milestone, tasks in zip(milestones, task_lists or []):
            total = 0.0
            for t in tasks or []:
                # The built task stores its length as 'estimatedDuration'; the
                # LLM's raw JSON calls it 'minutes'. Read both so this keeps
                # working whichever shape it is handed — checking only the LLM
                # key is what made the first version silently no-op and leave
                # the placeholder in place.
                raw = (
                    t.get('estimatedDuration')
                    if t.get('estimatedDuration') is not None
                    else t.get('minutes', t.get('duration'))
                )
                try:
                    total += float(raw or 0)
                except (TypeError, ValueError):
                    continue
            if total <= 0:
                continue  # keep the placeholder rather than invent a smaller lie
            milestone['estimatedDays'] = max(1, min(60, round(total / MINUTES_PER_DAY)))

    async def _generate_tasks_batch(
        self,
        milestones: List[Dict[str, Any]],
        barriers: List[str],
        helper_tricks: Optional[List[str]] = None,
        chunk_size: int = 3,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Generate tasks for many milestones per LLM call, keyed by milestone id.

        Chunk size is smaller than for descriptions because each milestone
        yields five tasks with their own name, description and duration — the
        response is roughly five times larger per item.
        """
        out: Dict[str, List[Dict[str, Any]]] = {}
        if not llm.is_enabled() or not milestones:
            return out

        async def _one_chunk(i: int) -> None:
            chunk = milestones[i:i + chunk_size]
            listing = "\n".join(
                f"{j}. [{m.get('id')}] {m.get('name')} (goal: {m.get('goal', '')})"
                for j, m in enumerate(chunk)
            )
            try:
                data = await llm.complete_json(
                    system=(
                        "You are a neurodiversity-informed planning coach. For EACH numbered "
                        "milestone, break it into 5 small sequential tasks. Each task name is a "
                        "specific imperative action of at most 9 words (e.g. 'Email the disability "
                        "office for the form'), NEVER generic phases like 'Research and gather "
                        "information'. Each description is one concrete sentence. minutes is 10-30. "
                        'Return JSON: {"milestones": {"0": {"tasks": [{"name": "...", '
                        '"description": "...", "minutes": 20}]}}}'
                    ),
                    user=(
                        f"Barriers: {', '.join(barriers) or 'none'}\n"
                        f"Milestones:\n{listing}"
                    ),
                    temperature=0.6,
                    max_tokens=520 * len(chunk),
                )
                mapping = (data or {}).get('milestones') or {}
                for j, m in enumerate(chunk):
                    entry = mapping.get(str(j)) or mapping.get(j) or {}
                    raw = entry.get('tasks') if isinstance(entry, dict) else None
                    if not isinstance(raw, list):
                        continue
                    cleaned = [
                        t for t in raw
                        if isinstance(t, dict) and str(t.get('name') or '').strip()
                    ][:5]
                    # Same 3-task floor the single-milestone path applies: a
                    # thin batch answer falls through to the fallback rather
                    # than handing the user a stub plan.
                    if len(cleaned) >= 3:
                        out[str(m.get('id'))] = cleaned
            except Exception as e:
                print(f"[path_planning] task batch {i // chunk_size} failed: {e}")

        await asyncio.gather(*[
            _one_chunk(i) for i in range(0, len(milestones), chunk_size)
        ])
        return out

    async def _resolve_tasks_for_milestone(
        self,
        milestone: Dict[str, Any],
        barriers: List[str],
        batched: Dict[str, List[Dict[str, Any]]],
        helper_tricks: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Use the batched tasks when present, otherwise fall back to a single call."""
        pre = batched.get(str(milestone.get('id')))
        return await self._generate_tasks_for_milestone(
            milestone, barriers, helper_tricks=helper_tricks, pregenerated=pre,
        )

    async def _generate_tasks_for_milestone(
        self,
        milestone: Dict[str, Any],
        barriers: List[str],
        helper_tricks: Optional[List[str]] = None,
        pregenerated: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        """Generate tasks for a milestone.

        LLM path produces specific, natural task names (not formulaic
        "Research and gather information: X" scaffolds); the template list is
        the deterministic fallback when the LLM is unavailable or returns junk.
        """

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

        # LLM: 5 small sequential tasks with concrete, action-first names.
        llm_tasks: Optional[List[Dict[str, Any]]] = pregenerated or None
        if llm_tasks is None and llm.is_enabled():
            data = await llm.complete_json(
                system=(
                    "You are a neurodiversity-informed planning coach. Break a milestone "
                    "into 5 small sequential tasks. Each task name is a specific imperative "
                    "action of at most 9 words (e.g. 'Email the disability office for the form'), "
                    "NEVER generic phases like 'Research and gather information' or 'Create action plan'. "
                    "Each description is one concrete sentence. minutes is 10-30."
                ),
                user=(
                    f"Milestone: {milestone.get('name')}\n"
                    f"Goal: {milestone.get('goal', '')}\n"
                    f"Barriers: {', '.join(barriers) or 'none'}\n"
                    'Return JSON: {"tasks": [{"name": "...", "description": "...", "minutes": 20}]}'
                ),
                temperature=0.6,
                max_tokens=500,
            )
            if isinstance(data, dict) and isinstance(data.get('tasks'), list):
                cleaned = [
                    t for t in data['tasks']
                    if isinstance(t, dict) and str(t.get('name') or '').strip()
                ][:5]
                if len(cleaned) >= 3:
                    llm_tasks = cleaned

        tasks = []
        count = len(llm_tasks) if llm_tasks else len(task_templates)
        for i in range(count):
            if llm_tasks:
                raw = llm_tasks[i]
                name = str(raw.get('name')).strip()[:120]
                description = str(raw.get('description') or f"One concrete step toward {milestone.get('name')}.").strip()[:300]
                try:
                    duration = max(5, min(45, int(raw.get('minutes') or 20)))
                except (TypeError, ValueError):
                    duration = 20
            else:
                task_name, duration = task_templates[i]
                name = f"{task_name}: {milestone['name']}"
                description = f"Part {i+1} of completing {milestone['name']}"

            # Adjust for ADHD - shorter tasks
            if 'adhd' in [b.lower() for b in barriers]:
                duration = min(duration, 20)

            tasks.append({
                'id': f'task_{milestone["id"]}_{i}',
                'milestoneId': milestone['id'],
                'name': name,
                'description': description,
                'status': 'pending',
                'estimatedDuration': duration,
                'difficulty': ['easy', 'medium', 'medium', 'easy', 'easy'][i % 5],
                'priority': 'high' if i == 0 else 'medium',
                'helperTricks': tricks,
            })

        return tasks
    
    async def _get_helper_tricks(
        self,
        barriers: List[str],
        support_summary: str = "",
    ) -> List[str]:
        """Get helper tricks based on barriers (LLM-backed with rule fallback)."""
        if llm.is_enabled():
            data = await llm.complete_json(
                system=(
                    "You are a neurodiversity coach. Generate 3 short, actionable "
                    "helper tricks (max 12 words each) for someone with the listed barriers."
                ),
                user=(
                    f"Barriers: {', '.join(barriers) or 'general'}\n"
                    + (f"Functional support needs and strategies that worked: {support_summary}\n" if support_summary else "")
                    + "Return JSON: {\"tricks\": [\"...\", \"...\", \"...\"]}"
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
        
        # Deterministic: same barriers in, same tricks out.
        return tricks[:3]
    
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
