-- =====================================================================
-- Subscriptions, free access, the petition, resource accounts (STEP 81)
--
-- The team's planning note (October 2026), Goals 9 and 11:
--
--   1. subscriptions: each person's paid plan (monthly or yearly), written
--      only by the server from Stripe's notices. access_trials: the free
--      first month, which starts the first time the paywall applies to
--      someone (so people from the beta get a full month too).
--   2. Free access (the "Khan Academy model"): access_grants (students, an
--      employer's or a government's people, and "explain your case" for
--      people who help advocate), access_codes that partners hand out, and
--      redeem_access_code(). has_access() says whether someone may use the
--      app when the paywall is on.
--   3. subscription_feedback: why someone didn't continue after the free
--      month, or cancelled. stripe_events (each Stripe notice handled once)
--      and billing_notices (the emails the consumer protection laws ask for,
--      each sent once).
--   4. petition_signatures (#FundAutinerary) and petition_counts().
--   5. Resource accounts (Goal 11): resource_accounts (service providers and
--      product vendors), listing_claims (a code sent to the listing's own
--      email, or a review by the team), listing_edits (every change, kept),
--      owns_listing() and listing_insights(); promotions (sponsored
--      placements, which show only once the team turns them on).
--   6. provider_survey_responses: what services would like in their
--      Resource Account (V1.5), and provider_emails (each email to a
--      service sent once).
--   7. spot_guide_applications: people asking to become Spot Guides.
--
-- Nothing here is visible or charged until the app's flags turn it on.
-- Writes that matter go through functions or the server; Supabase's default
-- privileges are revoked by name from every function that is not for
-- signed-out callers (STEP 80's lesson).
--
-- Run after STEP 80. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Subscriptions and the free month ----------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT CHECK (plan IS NULL OR plan IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'none'
    CHECK (status IN ('none', 'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')),
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_own_read ON public.subscriptions;
CREATE POLICY subscriptions_own_read ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.subscriptions FROM anon, authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;

COMMENT ON TABLE public.subscriptions IS
  'Each person''s paid plan, written only by the server from Stripe''s webhook (STEP 81). People read their own. trial_end: when someone subscribed during their free month, the day Stripe first charges.';

-- Stripe's notices already handled: Stripe can send one twice.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_events FROM anon, authenticated;
-- No policies: only the webhook (the service role) uses it.

COMMENT ON TABLE public.stripe_events IS
  'Stripe webhook events already handled, so a repeat is skipped (STEP 81).';

-- The emails the law asks for, each sent once: a copy of the agreement after
-- subscribing (Ontario, O. Reg. 17/05 s. 33: within 15 days), notice before a
-- free period turns into paid (Quebec, s. 187.29: 2 to 10 days before), notice
-- before a yearly plan renews (O. Reg. 17/05 s. 42: 30 to 90 days before), and
-- the free month's own reminders.
CREATE TABLE IF NOT EXISTS public.billing_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('agreement_copy', 'free_period_ending', 'free_month_ending', 'free_month_ended', 'renewal_notice', 'payment_failed', 'cancelled')),
  ref TEXT NOT NULL CHECK (char_length(ref) <= 200),
  sent_to TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, ref)
);

CREATE INDEX IF NOT EXISTS billing_notices_user_idx ON public.billing_notices (user_id, sent_at DESC);

ALTER TABLE public.billing_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_notices_own_read ON public.billing_notices;
CREATE POLICY billing_notices_own_read ON public.billing_notices FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.billing_notices FROM anon, authenticated;
GRANT SELECT ON public.billing_notices TO authenticated;

COMMENT ON TABLE public.billing_notices IS
  'Each billing email sent (STEP 81), once per kind and plan period: the proof that the notices the law asks for went out. Written by the server.';

CREATE TABLE IF NOT EXISTS public.access_trials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.access_trials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS access_trials_own_read ON public.access_trials;
CREATE POLICY access_trials_own_read ON public.access_trials FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.access_trials FROM anon, authenticated;
GRANT SELECT ON public.access_trials TO authenticated;

COMMENT ON TABLE public.access_trials IS
  'The free first month: it starts the first time the paywall applies to someone, and is never charged (STEP 81).';

-- 2. Free access --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('student', 'employee', 'government', 'advocate', 'partner', 'team')),
  source TEXT CHECK (source IS NULL OR char_length(source) <= 200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'expired')),
  case_text TEXT CHECK (case_text IS NULL OR char_length(case_text) <= 2000),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS access_grants_user_idx ON public.access_grants (user_id, status);
CREATE INDEX IF NOT EXISTS access_grants_pending_idx ON public.access_grants (created_at) WHERE status = 'pending';

ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS access_grants_own_read ON public.access_grants;
CREATE POLICY access_grants_own_read ON public.access_grants FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.access_grants FROM anon, authenticated;
GRANT SELECT ON public.access_grants TO authenticated;

COMMENT ON TABLE public.access_grants IS
  'Free access (STEP 81): students (pending until their school partners), an employer''s or government''s people (from a code), and people who explain their case and help advocate (reviewed by the team).';

CREATE TABLE IF NOT EXISTS public.access_codes (
  code TEXT PRIMARY KEY CHECK (code ~ '^[A-Z0-9-]{6,32}$'),
  kind TEXT NOT NULL CHECK (kind IN ('student', 'employee', 'government', 'partner')),
  organization TEXT NOT NULL CHECK (char_length(btrim(organization)) BETWEEN 1 AND 200),
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses INTEGER NOT NULL DEFAULT 0,
  months INTEGER NOT NULL DEFAULT 12 CHECK (months BETWEEN 1 AND 60),
  expires_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_codes FROM anon, authenticated;
-- No policies: codes are made in the SQL editor and used through redeem_access_code().

COMMENT ON TABLE public.access_codes IS
  'Codes a partner (a university, workplace, city or government) hands its people for free access (STEP 81). Made in the SQL editor.';

-- Use a partner's code: free access for its months.
CREATE OR REPLACE FUNCTION public.redeem_access_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  me UUID := auth.uid();
  c RECORD;
  ends TIMESTAMPTZ;
BEGIN
  IF me IS NULL THEN RETURN jsonb_build_object('error', 'signed_out'); END IF;
  SELECT * INTO c FROM public.access_codes WHERE code = upper(btrim(coalesce(p_code, ''))) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN RETURN jsonb_build_object('error', 'expired'); END IF;
  IF c.max_uses IS NOT NULL AND c.uses >= c.max_uses THEN RETURN jsonb_build_object('error', 'used_up'); END IF;
  IF EXISTS (SELECT 1 FROM public.access_grants g WHERE g.user_id = me AND g.source = 'code:' || c.code AND g.status = 'active') THEN
    RETURN jsonb_build_object('error', 'already');
  END IF;
  ends := now() + make_interval(months => c.months);
  UPDATE public.access_codes SET uses = uses + 1 WHERE code = c.code;
  INSERT INTO public.access_grants (user_id, kind, source, status, starts_at, ends_at)
  VALUES (me, c.kind, 'code:' || c.code, 'active', now(), ends);
  RETURN jsonb_build_object('ok', true, 'kind', c.kind, 'organization', c.organization, 'ends_at', ends);
END $$;

REVOKE ALL ON FUNCTION public.redeem_access_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_access_code(TEXT) TO authenticated;

-- Ask for free access: a student (which school), or someone explaining their
-- case who will help advocate for their town. Both wait for the team (a
-- student's becomes active when their school partners).
CREATE OR REPLACE FUNCTION public.apply_for_access(p_kind TEXT, p_source TEXT, p_case TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  me UUID := auth.uid();
  row_id UUID;
BEGIN
  IF me IS NULL THEN RETURN jsonb_build_object('error', 'signed_out'); END IF;
  IF p_kind NOT IN ('student', 'advocate') THEN RETURN jsonb_build_object('error', 'kind'); END IF;
  IF nullif(btrim(coalesce(p_source, '')), '') IS NULL THEN RETURN jsonb_build_object('error', 'source'); END IF;
  IF p_kind = 'advocate' AND char_length(btrim(coalesce(p_case, ''))) < 20 THEN RETURN jsonb_build_object('error', 'case'); END IF;
  SELECT id INTO row_id FROM public.access_grants WHERE user_id = me AND kind = p_kind AND status IN ('pending', 'active') LIMIT 1;
  IF row_id IS NOT NULL THEN
    UPDATE public.access_grants SET source = left(btrim(p_source), 200), case_text = nullif(left(btrim(coalesce(p_case, '')), 2000), '')
    WHERE id = row_id AND status = 'pending';
    RETURN jsonb_build_object('ok', true, 'id', row_id, 'again', true);
  END IF;
  INSERT INTO public.access_grants (user_id, kind, source, case_text)
  VALUES (me, p_kind, left(btrim(p_source), 200), nullif(left(btrim(coalesce(p_case, '')), 2000), ''))
  RETURNING id INTO row_id;
  RETURN jsonb_build_object('ok', true, 'id', row_id);
END $$;

REVOKE ALL ON FUNCTION public.apply_for_access(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_for_access(TEXT, TEXT, TEXT) TO authenticated;

-- Whether the caller may use the app when the paywall is on, and why. Starts
-- their free month the first time it is asked, when p_start_trial.
CREATE OR REPLACE FUNCTION public.my_access(p_start_trial BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  me UUID := auth.uid();
  s RECORD;
  g RECORD;
  t RECORD;
BEGIN
  IF me IS NULL THEN RETURN jsonb_build_object('access', false, 'reason', 'signed_out'); END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = me)
     OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = me AND p.role IN ('admin', 'moderator')) THEN
    RETURN jsonb_build_object('access', true, 'reason', 'team');
  END IF;
  SELECT * INTO g FROM public.access_grants
   WHERE user_id = me AND status = 'active' AND (ends_at IS NULL OR ends_at > now())
   ORDER BY ends_at DESC NULLS FIRST LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('access', true, 'reason', 'grant', 'kind', g.kind, 'ends_at', g.ends_at);
  END IF;
  SELECT * INTO s FROM public.subscriptions WHERE user_id = me;
  IF FOUND AND s.status IN ('active', 'trialing', 'past_due') THEN
    RETURN jsonb_build_object('access', true, 'reason', 'subscription', 'plan', s.plan, 'status', s.status,
                              'renews', NOT s.cancel_at_period_end, 'period_end', s.current_period_end, 'trial_end', s.trial_end);
  END IF;
  SELECT * INTO t FROM public.access_trials WHERE user_id = me;
  IF NOT FOUND AND p_start_trial THEN
    INSERT INTO public.access_trials (user_id, started_at, ends_at) VALUES (me, now(), now() + interval '1 month')
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO t FROM public.access_trials WHERE user_id = me;
  END IF;
  IF FOUND AND t.ends_at > now() THEN
    RETURN jsonb_build_object('access', true, 'reason', 'trial', 'trial_ends_at', t.ends_at,
                              'days_left', greatest(0, floor(extract(epoch FROM (t.ends_at - now())) / 86400))::int);
  END IF;
  RETURN jsonb_build_object('access', false, 'reason', CASE WHEN t.user_id IS NOT NULL THEN 'trial_over' ELSE 'none' END,
                            'trial_ends_at', t.ends_at,
                            'pending', EXISTS (SELECT 1 FROM public.access_grants WHERE user_id = me AND status = 'pending'));
END $$;

REVOKE ALL ON FUNCTION public.my_access(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_access(BOOLEAN) TO authenticated;

-- 3. Why someone didn't continue -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  moment TEXT NOT NULL CHECK (moment IN ('trial_end', 'cancel', 'stripe')),
  reason TEXT CHECK (reason IS NULL OR reason IN ('too_expensive', 'not_useful', 'missing_features', 'too_hard', 'found_alternative', 'just_trying', 'temporary', 'other')),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 2000),
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One reason per cancelled Stripe plan, however often Stripe repeats it.
CREATE UNIQUE INDEX IF NOT EXISTS subscription_feedback_stripe_once
  ON public.subscription_feedback (stripe_subscription_id) WHERE moment = 'stripe';

ALTER TABLE public.subscription_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_feedback_own_insert ON public.subscription_feedback;
CREATE POLICY subscription_feedback_own_insert ON public.subscription_feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND moment IN ('trial_end', 'cancel'));
DROP POLICY IF EXISTS subscription_feedback_own_read ON public.subscription_feedback;
CREATE POLICY subscription_feedback_own_read ON public.subscription_feedback FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.subscription_feedback FROM anon, authenticated;
GRANT SELECT, INSERT ON public.subscription_feedback TO authenticated;

COMMENT ON TABLE public.subscription_feedback IS
  'Why someone didn''t continue after the free month, or cancelled (STEP 81): from the app''s question, or Stripe''s cancellation reasons.';

-- 4. #FundAutinerary ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.petition_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  email TEXT NOT NULL CHECK (char_length(email) <= 320),
  email_key TEXT NOT NULL UNIQUE CHECK (email_key = lower(email_key)),
  province TEXT CHECK (province IS NULL OR province ~ '^[A-Z]{2}$'),
  ask TEXT NOT NULL CHECK (ask IN ('government', 'university', 'college', 'workplace', 'city')),
  institution TEXT CHECK (institution IS NULL OR char_length(institution) <= 200),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 500),
  show_name BOOLEAN NOT NULL DEFAULT false,
  contact_ok BOOLEAN NOT NULL DEFAULT false,
  ip_hash TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS petition_signatures_ask_idx ON public.petition_signatures (ask, institution);

ALTER TABLE public.petition_signatures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.petition_signatures FROM anon, authenticated;
-- No policies: the petition page signs through the app's server, which
-- checks the form and limits floods; counts come from petition_counts().

COMMENT ON TABLE public.petition_signatures IS
  '#FundAutinerary signatures (STEP 81): asking a government, university, college, workplace or city to fund Autinerary. One per email address.';

CREATE OR REPLACE FUNCTION public.petition_counts()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.petition_signatures),
    'by_ask', coalesce((SELECT jsonb_object_agg(ask, n) FROM (SELECT ask, count(*) AS n FROM public.petition_signatures GROUP BY ask) a), '{}'::jsonb),
    'top', coalesce((SELECT jsonb_agg(jsonb_build_object('institution', institution, 'ask', ask, 'n', n) ORDER BY n DESC)
                     FROM (SELECT institution, ask, count(*) AS n FROM public.petition_signatures
                           WHERE institution IS NOT NULL GROUP BY institution, ask ORDER BY count(*) DESC LIMIT 10) t), '[]'::jsonb),
    'recent', coalesce((SELECT jsonb_agg(jsonb_build_object('name', split_part(name, ' ', 1), 'province', province) ORDER BY created_at DESC)
                        FROM (SELECT name, province, created_at FROM public.petition_signatures WHERE show_name ORDER BY created_at DESC LIMIT 8) r), '[]'::jsonb)
  )
$$;

GRANT EXECUTE ON FUNCTION public.petition_counts() TO anon, authenticated, service_role;

-- 5. Resource accounts -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resource_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('service_provider', 'product_vendor')),
  organization TEXT NOT NULL CHECK (char_length(btrim(organization)) BETWEEN 1 AND 200),
  role_title TEXT CHECK (role_title IS NULL OR char_length(role_title) <= 120),
  website TEXT CHECK (website IS NULL OR char_length(website) <= 300),
  contact_email TEXT CHECK (contact_email IS NULL OR char_length(contact_email) <= 320),
  phone TEXT CHECK (phone IS NULL OR char_length(phone) <= 40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.resource_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS resource_accounts_own_read ON public.resource_accounts;
CREATE POLICY resource_accounts_own_read ON public.resource_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS resource_accounts_own_insert ON public.resource_accounts;
CREATE POLICY resource_accounts_own_insert ON public.resource_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS resource_accounts_own_update ON public.resource_accounts;
CREATE POLICY resource_accounts_own_update ON public.resource_accounts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.resource_accounts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.resource_accounts TO authenticated;

COMMENT ON TABLE public.resource_accounts IS
  'Resource Accounts (STEP 81): a service provider or product vendor who manages their listings in ResourceHub after claiming them.';

CREATE TABLE IF NOT EXISTS public.listing_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('resource', 'product')),
  item_id UUID NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('email_code', 'review')),
  code_hash TEXT,
  code_sent_to TEXT,
  code_expires_at TIMESTAMPTZ,
  code_sent_at TIMESTAMPTZ,
  codes_sent INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  evidence TEXT CHECK (evidence IS NULL OR char_length(evidence) <= 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (item_kind, item_id, user_id)
);

-- One verified owner per listing.
CREATE UNIQUE INDEX IF NOT EXISTS listing_claims_one_owner ON public.listing_claims (item_kind, item_id) WHERE status = 'verified';
CREATE INDEX IF NOT EXISTS listing_claims_pending_idx ON public.listing_claims (created_at) WHERE status = 'pending';

ALTER TABLE public.listing_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS listing_claims_own_read ON public.listing_claims;
CREATE POLICY listing_claims_own_read ON public.listing_claims FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.listing_claims FROM anon, authenticated;
-- Only what people may see of their own: never the code's hash.
GRANT SELECT (id, user_id, item_kind, item_id, method, code_sent_to, code_expires_at, status, created_at, verified_at) ON public.listing_claims TO authenticated;

COMMENT ON TABLE public.listing_claims IS
  'Claims to a listing (STEP 81): verified by a code sent to the email the listing publishes, or by the team. Written by the app''s server.';

CREATE TABLE IF NOT EXISTS public.listing_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('resource', 'product')),
  item_id UUID NOT NULL,
  changes JSONB NOT NULL,
  before JSONB,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'pending', 'rejected', 'reverted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS listing_edits_item_idx ON public.listing_edits (item_kind, item_id, created_at DESC);

ALTER TABLE public.listing_edits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS listing_edits_own_read ON public.listing_edits;
CREATE POLICY listing_edits_own_read ON public.listing_edits FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.listing_edits FROM anon, authenticated;
GRANT SELECT ON public.listing_edits TO authenticated;

COMMENT ON TABLE public.listing_edits IS
  'Every change a listing''s verified owner made, with what it was before, so the team can see or undo it (STEP 81).';

-- Whether the caller is the verified owner of a listing.
CREATE OR REPLACE FUNCTION public.owns_listing(p_kind TEXT, p_item UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.listing_claims c
    WHERE c.user_id = auth.uid() AND c.item_kind = p_kind AND c.item_id = p_item AND c.status = 'verified'
  )
$$;

REVOKE ALL ON FUNCTION public.owns_listing(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_listing(TEXT, UUID) TO authenticated, service_role;

-- What a listing's owner may know about it: counts only, never who.
CREATE OR REPLACE FUNCTION public.listing_insights(p_kind TEXT, p_item UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (public.owns_listing(p_kind, p_item)
          OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())) THEN
    RETURN jsonb_build_object('error', 'not_owner');
  END IF;
  IF p_kind = 'product' THEN
    RETURN jsonb_build_object(
      'reviews', (SELECT count(*) FROM public.product_reviews r WHERE r.product_id = p_item),
      'average', (SELECT round(avg(r.rating)::numeric, 2) FROM public.product_reviews r WHERE r.product_id = p_item),
      'nominations_this_month', (SELECT count(*) FROM public.choice_nominations n WHERE n.item_id = p_item AND n.month = public.choice_month())
    );
  END IF;
  RETURN jsonb_build_object(
    'saves', (SELECT count(*) FROM public.saved_resources s WHERE s.resource_id = p_item),
    'saves_30_days', (SELECT count(*) FROM public.saved_resources s WHERE s.resource_id = p_item AND s.created_at > now() - interval '30 days'),
    'on_teams', (SELECT count(*) FROM public.saved_resources s WHERE s.resource_id = p_item AND (s.status = 'current' OR coalesce(s.calls_scheduled, false))),
    'ratings', (SELECT count(*) FROM public.ratings r WHERE r.resource_id = p_item),
    'average', (SELECT round(avg(r.overall_score)::numeric, 2) FROM public.ratings r WHERE r.resource_id = p_item),
    'comments', (SELECT count(*) FROM public.resource_comments c WHERE c.resource_id = p_item AND c.status = 'visible'),
    'recommendations', (SELECT count(*) FROM public.resource_recommendations rr WHERE rr.resource_id = p_item),
    'nominations_this_month', (SELECT count(*) FROM public.choice_nominations n WHERE n.item_id = p_item AND n.month = public.choice_month()),
    'standing', (SELECT st.state FROM public.service_standing st WHERE st.resource_id = p_item)
  );
END $$;

REVOKE ALL ON FUNCTION public.listing_insights(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listing_insights(TEXT, UUID) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('resource', 'product')),
  item_id UUID NOT NULL,
  headline TEXT NOT NULL CHECK (char_length(btrim(headline)) BETWEEN 1 AND 90),
  body TEXT CHECK (body IS NULL OR char_length(body) <= 200),
  image_url TEXT CHECK (image_url IS NULL OR char_length(image_url) <= 500),
  categories TEXT[] NOT NULL DEFAULT '{}',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  provinces TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'active', 'paused', 'ended', 'rejected')),
  starts_on DATE,
  ends_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS promotions_live_idx ON public.promotions (status, starts_on, ends_on);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promotions_own_read ON public.promotions;
CREATE POLICY promotions_own_read ON public.promotions FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS promotions_own_draft ON public.promotions;
CREATE POLICY promotions_own_draft ON public.promotions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status IN ('draft', 'submitted') AND public.owns_listing(item_kind, item_id));
DROP POLICY IF EXISTS promotions_own_edit ON public.promotions;
CREATE POLICY promotions_own_edit ON public.promotions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('draft', 'submitted', 'paused', 'active'))
  WITH CHECK (user_id = auth.uid() AND status IN ('draft', 'submitted', 'paused', 'ended'));
REVOKE ALL ON public.promotions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.promotions TO authenticated;

COMMENT ON TABLE public.promotions IS
  'Sponsored placements a listing''s owner asks for (STEP 81): the team approves them, and they show, labelled "Sponsored" and chosen only by what was searched, once the team turns sponsored listings on.';

-- 6. What services would like in their account (V1.5) ---------------------------
CREATE TABLE IF NOT EXISTS public.provider_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
  wants TEXT[] NOT NULL DEFAULT '{}',
  other TEXT CHECK (other IS NULL OR char_length(other) <= 2000),
  image_same BOOLEAN,
  contact_email TEXT CHECK (contact_email IS NULL OR char_length(contact_email) <= 320),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_survey_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_survey_responses FROM anon, authenticated;
-- No policies: answers come through the app's survey page (a signed link).

COMMENT ON TABLE public.provider_survey_responses IS
  'Services'' answers to "what would you like in your Resource Account?" (STEP 81), from the link in their email.';

-- Each email to a service (the survey, "you were rated"), once per kind and
-- ref, so a batch can be sent again without repeating anyone. Services that
-- reply "stop" go in service_email_optouts (STEP 79), which every send checks.
CREATE TABLE IF NOT EXISTS public.provider_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('survey', 'reviewed')),
  ref TEXT NOT NULL CHECK (char_length(ref) <= 200),
  sent_to TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, ref)
);

ALTER TABLE public.provider_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_emails FROM anon, authenticated;
-- No policies: written by the app's server when an admin sends a batch.

COMMENT ON TABLE public.provider_emails IS
  'Emails sent to services (STEP 81): the V1.5 survey and "you were rated", each once per kind and ref.';

-- 7. Becoming a Spot Guide --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spot_guide_applications (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  area TEXT NOT NULL CHECK (char_length(btrim(area)) BETWEEN 1 AND 200),
  why TEXT CHECK (why IS NULL OR char_length(why) <= 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.spot_guide_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS spot_guide_applications_own_read ON public.spot_guide_applications;
CREATE POLICY spot_guide_applications_own_read ON public.spot_guide_applications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS spot_guide_applications_own_insert ON public.spot_guide_applications;
CREATE POLICY spot_guide_applications_own_insert ON public.spot_guide_applications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
REVOKE ALL ON public.spot_guide_applications FROM anon, authenticated;
GRANT SELECT, INSERT ON public.spot_guide_applications TO authenticated;

COMMENT ON TABLE public.spot_guide_applications IS
  'People asking to become Spot Guides (STEP 81). The team approves them by adding a row to spot_guides.';
