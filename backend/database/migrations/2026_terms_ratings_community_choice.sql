-- =====================================================================
-- Terms, meetings, trusted ratings and Community's Choice (STEP 79)
--
-- The team's planning note (October 2026), Goal 2 ("Contracting System")
-- and Goal 5 ("Recommendation Nomination System"):
--
--   1. terms_acceptances: who accepted which version of the Terms and
--      Conditions, and when (at sign-up, or from the notice to people who
--      joined before there were terms).
--   2. saved_resources.meeting: a team member's first meeting (video call,
--      phone or in person; when; the link or the place), kept with the
--      person's own team, which only they can read. The calendar keeps the
--      time only: connections can read a calendar.
--   3. Rating only from experience. A person may rate a service when it is
--      in their team (a meeting arranged, signed on, or completed), when they
--      recommended it (resource_recommendations; whoever submitted it
--      recommended it), or when they used it before joining and sent proof
--      (prior_use_claims, approved by an admin). Ratings already given stay,
--      and can still be edited.
--   4. resource_comments: anyone signed in may comment on a service at any
--      time.
--   5. The rating sweep: service_standing, service_email_optouts and
--      rating_sweep(). Under 4.0 a service is warned; at 3.5 or under it has
--      two months' probation; still there after two months, it is hidden
--      (status 'hidden', nothing deleted), and it comes back as soon as its
--      ratings rise above 3.5. Only services with at least five ratings are
--      judged.
--   6. Community's Choice: nominations through the month, a ballot of the
--      most nominated in the newsletter's last week, one vote per person per
--      kind (service, product, article), winners tagged community_choice.
--      products.tags, for the badge on shop items.
--   7. The free_first_visit tag on the one listing whose page offers a free
--      first meeting.
--
-- Run after STEP 78. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Terms and Conditions ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL CHECK (version ~ '^\d{4}-\d{2}-\d{2}$'),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  via TEXT NOT NULL DEFAULT 'notice' CHECK (via IN ('signup', 'notice')),
  PRIMARY KEY (user_id, version)
);

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS terms_acceptances_own_read ON public.terms_acceptances;
CREATE POLICY terms_acceptances_own_read ON public.terms_acceptances
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS terms_acceptances_own_notice ON public.terms_acceptances;
CREATE POLICY terms_acceptances_own_notice ON public.terms_acceptances
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND via = 'notice');

GRANT SELECT, INSERT ON public.terms_acceptances TO authenticated;

-- The time is the server's, whoever writes the row.
CREATE OR REPLACE FUNCTION public.terms_acceptances_stamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.accepted_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS terms_acceptances_stamp ON public.terms_acceptances;
CREATE TRIGGER terms_acceptances_stamp BEFORE INSERT ON public.terms_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.terms_acceptances_stamp();

COMMENT ON TABLE public.terms_acceptances IS
  'Who accepted which Terms and Conditions (frontend/app/terms), when, and how: at sign-up (written by the server) or from the notice (STEP 79). Never updated or deleted, except with the account.';

-- 2. A team member's first meeting -------------------------------------------
ALTER TABLE public.saved_resources ADD COLUMN IF NOT EXISTS meeting JSONB;

COMMENT ON COLUMN public.saved_resources.meeting IS
  'The first meeting with a team member: {type: video|phone|in_person, date, time, at (ISO), link, place, free_first_visit}. Only the person reads it; the calendar task has the time only (STEP 79).';

-- 3. Rating only from experience ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.resource_recommendations (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);

ALTER TABLE public.resource_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_recommendations_own_read ON public.resource_recommendations;
CREATE POLICY resource_recommendations_own_read ON public.resource_recommendations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Written by ResourceHub's Recommend form (the service role), not directly:
-- recommending is what lets someone rate, so it takes the form.
GRANT SELECT ON public.resource_recommendations TO authenticated;

COMMENT ON TABLE public.resource_recommendations IS
  'Who recommended a service through "Recommend" (one already listed, too), so they may rate it (STEP 79). Whoever submitted a service recommended it.';

-- Whoever submitted a service recommended it.
INSERT INTO public.resource_recommendations (user_id, resource_id, created_at)
SELECT r.submitted_by, r.id, coalesce(r.created_at, now())
FROM public.resources r
WHERE r.submitted_by IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.submitted_by)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.prior_use_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS prior_use_claims_pending_idx ON public.prior_use_claims (created_at) WHERE status = 'pending';

ALTER TABLE public.prior_use_claims ENABLE ROW LEVEL SECURITY;

-- People read their own; claim_prior_use() writes them; admins review them
-- with the service role (ResourceHub's admin page).
DROP POLICY IF EXISTS prior_use_claims_own_read ON public.prior_use_claims;
CREATE POLICY prior_use_claims_own_read ON public.prior_use_claims
  FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON public.prior_use_claims TO authenticated;

COMMENT ON TABLE public.prior_use_claims IS
  'People who used a service before joining, waiting for or given leave to rate it once an admin has seen their proof (emailed to heydevs@autinerary.ca with the code) (STEP 79).';

-- Whether the caller may rate this service.
CREATE OR REPLACE FUNCTION public.can_rate(p_resource UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.saved_resources s
            WHERE s.user_id = auth.uid() AND s.resource_id = p_resource
              AND (s.status IN ('current', 'past') OR coalesce(s.calls_scheduled, false)))
    OR EXISTS (SELECT 1 FROM public.resources r WHERE r.id = p_resource AND r.submitted_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.resource_recommendations rr WHERE rr.user_id = auth.uid() AND rr.resource_id = p_resource)
    OR EXISTS (SELECT 1 FROM public.prior_use_claims c WHERE c.user_id = auth.uid() AND c.resource_id = p_resource AND c.status = 'approved')
    OR EXISTS (SELECT 1 FROM public.ratings ra WHERE ra.user_id = auth.uid() AND ra.resource_id = p_resource)
  )
$$;

REVOKE ALL ON FUNCTION public.can_rate(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_rate(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.can_rate(UUID) IS
  'Whether the signed-in caller may rate this service: in their team (meeting arranged, signed on or completed), recommended by them, used before joining (approved proof), or already rated by them (STEP 79).';

-- Each way, for the rating button and its explanation.
CREATE OR REPLACE FUNCTION public.rating_access(p_resource UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'signed_in', auth.uid() IS NOT NULL,
    'team', EXISTS (SELECT 1 FROM public.saved_resources s
                    WHERE s.user_id = auth.uid() AND s.resource_id = p_resource
                      AND (s.status IN ('current', 'past') OR coalesce(s.calls_scheduled, false))),
    'wishlist', EXISTS (SELECT 1 FROM public.saved_resources s
                        WHERE s.user_id = auth.uid() AND s.resource_id = p_resource
                          AND s.status = 'wishlist' AND NOT coalesce(s.calls_scheduled, false)),
    'recommended', EXISTS (SELECT 1 FROM public.resources r WHERE r.id = p_resource AND r.submitted_by = auth.uid())
                   OR EXISTS (SELECT 1 FROM public.resource_recommendations rr WHERE rr.user_id = auth.uid() AND rr.resource_id = p_resource),
    'used_before', EXISTS (SELECT 1 FROM public.prior_use_claims c WHERE c.user_id = auth.uid() AND c.resource_id = p_resource AND c.status = 'approved'),
    'rated', EXISTS (SELECT 1 FROM public.ratings ra WHERE ra.user_id = auth.uid() AND ra.resource_id = p_resource),
    'claim', (SELECT jsonb_build_object('code', c.code, 'status', c.status, 'created_at', c.created_at)
              FROM public.prior_use_claims c WHERE c.user_id = auth.uid() AND c.resource_id = p_resource),
    'can_rate', public.can_rate(p_resource)
  )
$$;

REVOKE ALL ON FUNCTION public.rating_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rating_access(UUID) TO authenticated, service_role;

-- "I used it before joining": a claim with a code to put in the email with
-- the proof. Only for a service that is not in the person's wishlist or team
-- and that they did not recommend.
CREATE OR REPLACE FUNCTION public.claim_prior_use(p_resource UUID, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  me UUID := auth.uid();
  claim RECORD;
BEGIN
  IF me IS NULL THEN
    RETURN jsonb_build_object('error', 'signed_out');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.resources r WHERE r.id = p_resource AND r.status IN ('approved', 'hidden')) THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF EXISTS (SELECT 1 FROM public.saved_resources s WHERE s.user_id = me AND s.resource_id = p_resource)
     OR EXISTS (SELECT 1 FROM public.resources r WHERE r.id = p_resource AND r.submitted_by = me)
     OR EXISTS (SELECT 1 FROM public.resource_recommendations rr WHERE rr.user_id = me AND rr.resource_id = p_resource) THEN
    RETURN jsonb_build_object('error', 'not_needed');
  END IF;
  INSERT INTO public.prior_use_claims (user_id, resource_id, note)
  VALUES (me, p_resource, nullif(left(btrim(coalesce(p_note, '')), 500), ''))
  ON CONFLICT (user_id, resource_id) DO NOTHING;
  SELECT c.code, c.status, c.created_at INTO claim
  FROM public.prior_use_claims c WHERE c.user_id = me AND c.resource_id = p_resource;
  RETURN jsonb_build_object('code', claim.code, 'status', claim.status, 'created_at', claim.created_at);
END $$;

REVOKE ALL ON FUNCTION public.claim_prior_use(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_prior_use(UUID, TEXT) TO authenticated;

-- Ratings: a new one only from someone who may rate; one's own may be
-- edited, but stays one's own. Every other INSERT policy goes, or it would
-- let anyone in (policies add up).
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT polname FROM pg_policy WHERE polrelid = 'public.ratings'::regclass AND polcmd = 'a'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.ratings', p.polname);
  END LOOP;
END $$;

CREATE POLICY ratings_insert_from_experience ON public.ratings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_rate(resource_id));

-- A FOR ALL policy would let people insert too: say so.
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT polname FROM pg_policy WHERE polrelid = 'public.ratings'::regclass AND polcmd = '*'
  LOOP
    RAISE NOTICE 'ratings has a FOR ALL policy, %, which also lets anyone insert a rating: check it.', p.polname;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Users can update own ratings" ON public.ratings;
CREATE POLICY "Users can update own ratings" ON public.ratings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Comments, at any time ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resource_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resource_comments_resource_idx
  ON public.resource_comments (resource_id, created_at DESC) WHERE status = 'visible';

ALTER TABLE public.resource_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_comments_read ON public.resource_comments;
CREATE POLICY resource_comments_read ON public.resource_comments
  FOR SELECT USING (status = 'visible' OR user_id = auth.uid());
DROP POLICY IF EXISTS resource_comments_write ON public.resource_comments;
CREATE POLICY resource_comments_write ON public.resource_comments
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND status = 'visible'
    AND EXISTS (SELECT 1 FROM public.resources r WHERE r.id = resource_id AND r.status = 'approved')
  );
DROP POLICY IF EXISTS resource_comments_own_delete ON public.resource_comments;
CREATE POLICY resource_comments_own_delete ON public.resource_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON public.resource_comments TO anon, authenticated;
GRANT INSERT, DELETE ON public.resource_comments TO authenticated;

COMMENT ON TABLE public.resource_comments IS
  'Comments on a service, which anyone signed in may leave at any time; ratings need experience (STEP 79). Moderators hide one with status hidden.';

-- 5. The rating sweep --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_standing (
  resource_id UUID PRIMARY KEY REFERENCES public.resources(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('good', 'warned', 'probation', 'hidden')),
  average NUMERIC(4, 2),
  ratings INTEGER NOT NULL DEFAULT 0,
  warned_at TIMESTAMPTZ,
  probation_since TIMESTAMPTZ,
  hidden_at TIMESTAMPTZ,
  restored_at TIMESTAMPTZ,
  needed_to_return INTEGER NOT NULL DEFAULT 0,
  swept_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_standing ENABLE ROW LEVEL SECURITY;
-- No policies: the sweep (service role) and the SQL editor only.

COMMENT ON TABLE public.service_standing IS
  'Each rated service''s standing after the monthly rating sweep: good, warned (under 4.0), probation (3.5 or under, two months to improve) or hidden (still 3.5 or under after it; resources.status hidden, nothing deleted) (STEP 79).';

CREATE TABLE IF NOT EXISTS public.service_email_optouts (
  email_key TEXT PRIMARY KEY CHECK (email_key = lower(email_key)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

ALTER TABLE public.service_email_optouts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.service_email_optouts IS
  'Services'' addresses that asked not to get the rating sweep''s emails (STEP 79). Added in the SQL editor when one replies "stop".';

-- The sweep. With p_apply false (the default) it changes nothing and says
-- what it would do. Returns every service that is not in good standing, and
-- every one whose standing changes.
CREATE OR REPLACE FUNCTION public.rating_sweep(
  p_apply BOOLEAN DEFAULT false,
  p_now TIMESTAMPTZ DEFAULT now(),
  p_min_ratings INTEGER DEFAULT 5,
  p_warn_below NUMERIC DEFAULT 4.0,
  p_probation_at NUMERIC DEFAULT 3.5,
  p_probation_months INTEGER DEFAULT 2
)
RETURNS TABLE (
  resource_id UUID,
  name TEXT,
  category TEXT,
  email TEXT,
  email_ok BOOLEAN,
  from_state TEXT,
  to_state TEXT,
  average NUMERIC,
  ratings INTEGER,
  needed_to_return INTEGER,
  needed_for_good INTEGER,
  probation_ends DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
#variable_conflict use_column
DECLARE
  r RECORD;
  prev TEXT;
  nxt TEXT;
  avg_now NUMERIC;
  since TIMESTAMPTZ;
  back INTEGER;
  good INTEGER;
BEGIN
  FOR r IN
    SELECT res.id, res.name, res.category, res.status,
           nullif(btrim(res.contact_info->>'email'), '') AS mail,
           count(ra.id)::int AS n,
           coalesce(sum(ra.overall_score), 0)::int AS s,
           st.state AS prev_state, st.probation_since AS prev_since
    FROM public.resources res
    JOIN public.ratings ra ON ra.resource_id = res.id
    LEFT JOIN public.service_standing st ON st.resource_id = res.id
    WHERE res.status IN ('approved', 'hidden')
    GROUP BY res.id, st.state, st.probation_since
  LOOP
    prev := coalesce(r.prev_state, 'good');
    avg_now := round(r.s::numeric / r.n, 2);
    since := r.prev_since;

    IF r.n < p_min_ratings THEN
      nxt := CASE WHEN prev = 'hidden' THEN 'hidden' ELSE 'good' END;
    ELSIF r.s::numeric / r.n >= p_warn_below THEN
      nxt := 'good';
    ELSIF r.s::numeric / r.n > p_probation_at THEN
      nxt := 'warned';
    ELSIF prev = 'hidden' THEN
      nxt := 'hidden';
    ELSIF prev = 'probation' AND since IS NOT NULL
          AND p_now >= since + make_interval(months => p_probation_months) THEN
      nxt := 'hidden';
    ELSE
      nxt := 'probation';
    END IF;

    -- How many more ratings of 5 would bring it back above 3.5, and up to 4.0.
    back := CASE WHEN r.s::numeric / r.n <= p_probation_at
                 THEN floor((p_probation_at * r.n - r.s) / (5 - p_probation_at))::int + 1 ELSE 0 END;
    good := CASE WHEN r.s::numeric / r.n < p_warn_below
                 THEN ceil((p_warn_below * r.n - r.s) / (5 - p_warn_below))::int ELSE 0 END;

    IF nxt = 'probation' AND (prev <> 'probation' OR since IS NULL) THEN since := p_now; END IF;
    IF nxt <> 'probation' AND nxt <> 'hidden' THEN since := NULL; END IF;

    IF p_apply THEN
      INSERT INTO public.service_standing AS st
        (resource_id, state, average, ratings, warned_at, probation_since, hidden_at, restored_at, needed_to_return, swept_at)
      VALUES (r.id, nxt, avg_now, r.n,
              CASE WHEN nxt = 'warned' THEN p_now END,
              since,
              CASE WHEN nxt = 'hidden' THEN p_now END,
              NULL, back, p_now)
      ON CONFLICT (resource_id) DO UPDATE SET
        state = EXCLUDED.state,
        average = EXCLUDED.average,
        ratings = EXCLUDED.ratings,
        warned_at = CASE WHEN EXCLUDED.state = 'warned' AND st.state <> 'warned' THEN p_now ELSE st.warned_at END,
        probation_since = EXCLUDED.probation_since,
        hidden_at = CASE WHEN EXCLUDED.state = 'hidden' AND st.state <> 'hidden' THEN p_now ELSE st.hidden_at END,
        restored_at = CASE WHEN st.state = 'hidden' AND EXCLUDED.state <> 'hidden' THEN p_now ELSE st.restored_at END,
        needed_to_return = EXCLUDED.needed_to_return,
        swept_at = p_now;

      IF nxt = 'hidden' AND prev <> 'hidden' THEN
        UPDATE public.resources SET status = 'hidden' WHERE id = r.id AND status = 'approved';
      ELSIF prev = 'hidden' AND nxt <> 'hidden' THEN
        UPDATE public.resources SET status = 'approved' WHERE id = r.id AND status = 'hidden';
      END IF;
    END IF;

    IF nxt <> 'good' OR prev <> nxt THEN
      resource_id := r.id;
      name := r.name;
      category := r.category;
      email := r.mail;
      email_ok := r.mail IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM public.service_email_optouts o WHERE o.email_key = lower(r.mail));
      from_state := prev;
      to_state := nxt;
      average := avg_now;
      ratings := r.n;
      needed_to_return := back;
      needed_for_good := good;
      probation_ends := CASE WHEN nxt = 'probation' THEN (since + make_interval(months => p_probation_months))::date END;
      RETURN NEXT;
    END IF;
  END LOOP;
END
$fn$;

REVOKE ALL ON FUNCTION public.rating_sweep(BOOLEAN, TIMESTAMPTZ, INTEGER, NUMERIC, NUMERIC, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rating_sweep(BOOLEAN, TIMESTAMPTZ, INTEGER, NUMERIC, NUMERIC, INTEGER) TO service_role;

COMMENT ON FUNCTION public.rating_sweep(BOOLEAN, TIMESTAMPTZ, INTEGER, NUMERIC, NUMERIC, INTEGER) IS
  'The monthly rating sweep (frontend/app/api/cron/rating-sweep): with p_apply false it only reports. Under 4.0 warned; 3.5 or under, probation; still so two months on, hidden; back above 3.5, restored. Needs five ratings to judge (STEP 79).';

-- 6. Community's Choice ------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.products.tags IS
  'Tags on a shop item; community_choice for a month''s winner (STEP 79).';

-- The month a moment falls in, in Toronto: 'YYYY-MM'.
CREATE OR REPLACE FUNCTION public.choice_month(p_at TIMESTAMPTZ DEFAULT now())
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT to_char(p_at AT TIME ZONE 'America/Toronto', 'YYYY-MM')
$$;

GRANT EXECUTE ON FUNCTION public.choice_month(TIMESTAMPTZ) TO anon, authenticated, service_role;

-- Which kind of item this is: a service, an article (commentary, news and
-- posts) or a shop product; NULL when it cannot be nominated (not live).
CREATE OR REPLACE FUNCTION public.choice_kind_of(p_item UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (SELECT CASE WHEN lower(coalesce(r.category, '')) = 'commentary'
                   OR r.source_type IN ('news', 'reddit', 'twitter', 'facebook', 'youtube', 'tiktok', 'instagram')
                 THEN 'article' ELSE 'service' END
     FROM public.resources r WHERE r.id = p_item AND r.status = 'approved'),
    (SELECT 'product' FROM public.products pr WHERE pr.id = p_item AND pr.status = 'active')
  )
$$;

GRANT EXECUTE ON FUNCTION public.choice_kind_of(UUID) TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.choice_nominations (
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  kind TEXT NOT NULL CHECK (kind IN ('service', 'product', 'article')),
  item_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (month, kind, item_id, user_id)
);

CREATE INDEX IF NOT EXISTS choice_nominations_count_idx ON public.choice_nominations (month, kind, item_id);

ALTER TABLE public.choice_nominations ENABLE ROW LEVEL SECURITY;

-- People see and take back their own; choice_nominate() adds them.
DROP POLICY IF EXISTS choice_nominations_own_read ON public.choice_nominations;
CREATE POLICY choice_nominations_own_read ON public.choice_nominations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS choice_nominations_own_delete ON public.choice_nominations;
CREATE POLICY choice_nominations_own_delete ON public.choice_nominations
  FOR DELETE TO authenticated USING (user_id = auth.uid() AND month = public.choice_month());

GRANT SELECT, DELETE ON public.choice_nominations TO authenticated;

COMMENT ON TABLE public.choice_nominations IS
  'Community''s Choice nominations, by month (Toronto time), kind and item: anyone signed in may nominate, up to ten of each kind a month (STEP 79).';

-- Nominate this month (or take a nomination back).
CREATE OR REPLACE FUNCTION public.choice_nominate(p_item UUID, p_on BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  me UUID := auth.uid();
  m TEXT := public.choice_month();
  k TEXT := public.choice_kind_of(p_item);
  mine INTEGER;
BEGIN
  IF me IS NULL THEN RETURN jsonb_build_object('error', 'signed_out'); END IF;
  IF k IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF NOT p_on THEN
    DELETE FROM public.choice_nominations WHERE month = m AND kind = k AND item_id = p_item AND user_id = me;
    RETURN jsonb_build_object('nominated', false, 'month', m, 'kind', k);
  END IF;
  SELECT count(*) INTO mine FROM public.choice_nominations WHERE month = m AND kind = k AND user_id = me;
  IF mine >= 10 AND NOT EXISTS (SELECT 1 FROM public.choice_nominations WHERE month = m AND kind = k AND item_id = p_item AND user_id = me) THEN
    RETURN jsonb_build_object('error', 'too_many', 'month', m, 'kind', k);
  END IF;
  INSERT INTO public.choice_nominations (month, kind, item_id, user_id) VALUES (m, k, p_item, me)
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('nominated', true, 'month', m, 'kind', k);
END $$;

REVOKE ALL ON FUNCTION public.choice_nominate(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.choice_nominate(UUID, BOOLEAN) TO authenticated;

CREATE TABLE IF NOT EXISTS public.choice_ballots (
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  kind TEXT NOT NULL CHECK (kind IN ('service', 'product', 'article')),
  item_id UUID NOT NULL,
  rank INTEGER NOT NULL,
  nominations INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (month, kind, item_id)
);

ALTER TABLE public.choice_ballots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS choice_ballots_read ON public.choice_ballots;
CREATE POLICY choice_ballots_read ON public.choice_ballots FOR SELECT USING (true);

GRANT SELECT ON public.choice_ballots TO anon, authenticated;

COMMENT ON TABLE public.choice_ballots IS
  'Each month''s Community''s Choice ballot: the most nominated of each kind, made once, when the last newsletter of the month goes out (STEP 79).';

-- The month's ballot: the most nominated of each kind, ties to the first
-- nominated. Made once; later calls leave it as it is.
CREATE OR REPLACE FUNCTION public.choice_build_ballot(
  p_month TEXT,
  p_services INTEGER DEFAULT 5,
  p_products INTEGER DEFAULT 3,
  p_articles INTEGER DEFAULT 3
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  made INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM public.choice_ballots WHERE month = p_month) THEN
    SELECT count(*) INTO made FROM public.choice_ballots WHERE month = p_month;
    RETURN made;
  END IF;
  INSERT INTO public.choice_ballots (month, kind, item_id, rank, nominations)
  SELECT p_month, kind, item_id, rank, n
  FROM (
    SELECT c.kind, c.item_id, count(*)::int AS n,
           row_number() OVER (PARTITION BY c.kind ORDER BY count(*) DESC, min(c.created_at), c.item_id) AS rank
    FROM public.choice_nominations c
    WHERE c.month = p_month AND public.choice_kind_of(c.item_id) = c.kind
    GROUP BY c.kind, c.item_id
  ) ranked
  WHERE rank <= CASE kind WHEN 'service' THEN p_services WHEN 'product' THEN p_products ELSE p_articles END;
  GET DIAGNOSTICS made = ROW_COUNT;
  RETURN made;
END $$;

REVOKE ALL ON FUNCTION public.choice_build_ballot(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.choice_build_ballot(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

CREATE TABLE IF NOT EXISTS public.choice_votes (
  month TEXT NOT NULL,
  kind TEXT NOT NULL,
  voter TEXT NOT NULL CHECK (voter ~ '^(u|s):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  item_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (month, kind, voter),
  FOREIGN KEY (month, kind, item_id) REFERENCES public.choice_ballots (month, kind, item_id) ON DELETE CASCADE
);

ALTER TABLE public.choice_votes ENABLE ROW LEVEL SECURITY;
-- No policies: votes go through the app's vote page, which checks the
-- person's sign-in or their newsletter link (u: an account, s: a subscriber).

COMMENT ON TABLE public.choice_votes IS
  'Community''s Choice votes: one per person per kind per month, for an item on that month''s ballot (STEP 79).';

CREATE TABLE IF NOT EXISTS public.choice_winners (
  month TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('service', 'product', 'article')),
  item_id UUID NOT NULL,
  votes INTEGER NOT NULL,
  nominations INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (month, kind)
);

ALTER TABLE public.choice_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS choice_winners_read ON public.choice_winners;
CREATE POLICY choice_winners_read ON public.choice_winners FOR SELECT USING (true);

GRANT SELECT ON public.choice_winners TO anon, authenticated;

COMMENT ON TABLE public.choice_winners IS
  'Each month''s Community''s Choice winners, one per kind (STEP 79). Winners carry the community_choice tag.';

-- The month's winners: the most votes (at least one), ties to the most
-- nominated, then the ballot's order. With p_apply, saved and tagged.
CREATE OR REPLACE FUNCTION public.choice_tally(p_month TEXT, p_apply BOOLEAN DEFAULT false)
RETURNS TABLE (kind TEXT, item_id UUID, name TEXT, votes INTEGER, nominations INTEGER, saved BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
#variable_conflict use_column
DECLARE
  w RECORD;
BEGIN
  FOR w IN
    SELECT DISTINCT ON (b.kind) b.kind AS k, b.item_id AS item, b.nominations AS noms,
           count(v.voter)::int AS n
    FROM public.choice_ballots b
    LEFT JOIN public.choice_votes v ON v.month = b.month AND v.kind = b.kind AND v.item_id = b.item_id
    WHERE b.month = p_month
    GROUP BY b.kind, b.item_id, b.nominations, b.rank
    HAVING count(v.voter) > 0
    ORDER BY b.kind, count(v.voter) DESC, b.nominations DESC, b.rank
  LOOP
    kind := w.k;
    item_id := w.item;
    name := coalesce((SELECT r.name FROM public.resources r WHERE r.id = w.item),
                     (SELECT pr.name FROM public.products pr WHERE pr.id = w.item));
    votes := w.n;
    nominations := w.noms;
    saved := EXISTS (SELECT 1 FROM public.choice_winners cw WHERE cw.month = p_month AND cw.kind = w.k);
    IF p_apply AND NOT saved THEN
      INSERT INTO public.choice_winners (month, kind, item_id, votes, nominations)
      VALUES (p_month, w.k, w.item, w.n, w.noms);
      IF w.k = 'product' THEN
        UPDATE public.products SET tags = array_append(tags, 'community_choice')
        WHERE id = w.item AND NOT ('community_choice' = ANY (tags));
      ELSE
        UPDATE public.resources SET tags = array_append(tags, 'community_choice')
        WHERE id = w.item AND NOT ('community_choice' = ANY (tags));
      END IF;
      saved := true;
    END IF;
    RETURN NEXT;
  END LOOP;
END
$fn$;

REVOKE ALL ON FUNCTION public.choice_tally(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.choice_tally(TEXT, BOOLEAN) TO service_role;

COMMENT ON FUNCTION public.choice_tally(TEXT, BOOLEAN) IS
  'A month''s Community''s Choice winners (frontend/app/api/cron/choice-tally); with p_apply, saved in choice_winners and tagged community_choice (STEP 79).';

-- 7. A free first visit ------------------------------------------------------
UPDATE public.resources SET tags = array_append(tags, 'free_first_visit')
 WHERE source_ref = 'operator:funding-inclusion-canada-barrier-free-benefits'
   AND NOT ('free_first_visit' = ANY (tags));
