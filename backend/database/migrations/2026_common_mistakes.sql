-- ============================================================================
-- "Top mistakes at this stage" (Odosa).
--
-- Reflections already carry a real, keyword-detected `indicators` array
-- (task_avoidance, sleep_issues, social_withdrawal, sensory_overload,
-- energy_crash — see reflection_analysis_agent.py's pattern_indicators) and a
-- context_id. Milestone ids are structural — milestone_g{goal_idx}_{dim}_{i}
-- — so the SAME context_id is shared by every user whose Nth milestone in a
-- given life dimension is this one, which is exactly what "at this stage"
-- needs: real cross-user aggregation, not per-user noise.
--
-- No invented percentages. A stage with fewer than min_samples reflections
-- returns nothing, and the UI shows nothing rather than a number built on
-- two people.
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_common_mistakes(
  p_context_id  TEXT,
  min_samples   INT DEFAULT 5,
  max_results   INT DEFAULT 5
)
RETURNS TABLE (
  indicator   TEXT,
  pct         REAL,
  sample_size INT
)
LANGUAGE SQL
STABLE
AS $$
  WITH scoped AS (
    SELECT r.indicators
    FROM public.reflections r
    WHERE r.context_id = p_context_id
  ),
  total AS (
    SELECT COUNT(*)::INT AS n FROM scoped
  ),
  unnested AS (
    SELECT unnest(indicators) AS indicator
    FROM scoped
  ),
  counted AS (
    SELECT indicator, COUNT(*)::INT AS n
    FROM unnested
    -- Only genuinely negative indicators belong on a "what not to do" list.
    -- 'hyperfocus' is detected from the same pipeline but is not a mistake.
    WHERE indicator IN (
      'task_avoidance', 'sleep_issues', 'social_withdrawal',
      'sensory_overload', 'energy_crash', 'meal_skipping'
    )
    GROUP BY indicator
  )
  SELECT
    c.indicator,
    ROUND((c.n::REAL / t.n) * 100)::REAL AS pct,
    t.n AS sample_size
  FROM counted c, total t
  WHERE t.n >= min_samples
  ORDER BY c.n DESC
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION public.get_common_mistakes(TEXT, INT, INT) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_common_mistakes(TEXT, INT, INT) IS
  'Real, cross-user "what not to do" list per milestone stage, from reflection indicators. Empty below min_samples — never a fabricated percentage.';
