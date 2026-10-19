-- =====================================================================
-- The products round (STEP 82)
--
-- The team's planning note for products (October 2026):
--
--   1. products: the brand, its qualities (Goal 4: what people with norms
--      need, from servicehub-mvp/lib/shop/taxonomy.json) and their values,
--      where to get it (buy links), where people recommend it, where the
--      facts came from (source_ref, last_verified_at, import_batch), a price
--      that can be "varies", and status 'pending' for products waiting to be
--      checked. Suggesting a product no longer puts it live at once: only
--      the server publishes.
--   2. Community's Choice of the year (choice_year_winners,
--      choice_tally_year): the most votes over the year's months.
--   3. Users' Choice (Goal 8): the highest-rated item for each kind of
--      person, by norm and by connection to the norm (users_choice,
--      users_choice_build).
--   4. The Vendor Account (Goal 10): a product's vendor (vendor_user_id),
--      vendor_payment_accounts (Stripe Connect), and orders written only by
--      the server; vendors see their own orders.
--   5. Discounts (Goal 10): discount_events (Autism Acceptance Month, back
--      to school, a launch...), product_discounts (a vendor opts in, with a
--      percent or a price) and vendor_notifications.
--   6. Taste profiles (v1.5): sensory_preferences (what someone likes and
--      avoids) and taste_profiles (groups found by clustering on the
--      server; only groups of 10 or more are ever described).
--
-- Nothing here charges anyone or shows a discount until the apps' flags
-- turn it on. Supabase's default privileges are revoked by name from every
-- function that is not for signed-out callers (STEP 80's lesson).
--
-- Run after STEP 81. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Products --------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS qualities TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quality_values JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS buy_links JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS community_links JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS maker_url TEXT,
  ADD COLUMN IF NOT EXISTS price_note TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_ref TEXT,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_batch TEXT,
  ADD COLUMN IF NOT EXISTS vendor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- A price can be "varies" (books, films, food sold in many stores).
ALTER TABLE public.products ALTER COLUMN price DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_source_ref_key') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_source_ref_key UNIQUE (source_ref);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_status_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_status_check CHECK (status IN ('draft', 'pending', 'active', 'archived', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_source_type_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_source_type_check CHECK (source_type IS NULL OR source_type IN ('operator', 'community', 'vendor'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_buy_links_array') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_buy_links_array CHECK (jsonb_typeof(buy_links) = 'array' AND jsonb_typeof(community_links) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS products_qualities_idx ON public.products USING gin (qualities);
CREATE INDEX IF NOT EXISTS products_vendor_idx ON public.products (vendor_user_id) WHERE vendor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_import_batch_idx ON public.products (import_batch) WHERE import_batch IS NOT NULL;

COMMENT ON COLUMN public.products.qualities IS
  'What the product is like for people with norms (ids from servicehub-mvp/lib/shop/taxonomy.json: tagless, fragrance_free, noise_reduction...). Each was checked on the maker''s or seller''s own pages (STEP 82).';
COMMENT ON COLUMN public.products.buy_links IS
  'Where to get it: [{label, url}] (the maker, a Canadian store, an app store, where to watch). ResourceHub doesn''t sell these unless vendor_user_id is set and the shop''s checkout is on.';
COMMENT ON COLUMN public.products.vendor_user_id IS
  'The vendor (a Resource Account) who sells this product through ResourceHub, if any (STEP 82).';

-- Suggesting a product waits to be checked; only the server makes one live.
DROP POLICY IF EXISTS products_insert ON public.products;
CREATE POLICY products_insert ON public.products
  FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid() AND status IN ('draft', 'pending'));
DROP POLICY IF EXISTS products_update ON public.products;
CREATE POLICY products_update ON public.products
  FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND status IN ('draft', 'pending'))
  WITH CHECK (submitted_by = auth.uid() AND status IN ('draft', 'pending'));

-- 2. Community's Choice of the year ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.choice_year_winners (
  year INTEGER NOT NULL CHECK (year BETWEEN 2026 AND 2100),
  kind TEXT NOT NULL CHECK (kind IN ('service', 'product', 'article')),
  item_id UUID NOT NULL,
  votes INTEGER NOT NULL,
  months_won INTEGER NOT NULL,
  nominations INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (year, kind)
);

ALTER TABLE public.choice_year_winners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS choice_year_winners_read ON public.choice_year_winners;
CREATE POLICY choice_year_winners_read ON public.choice_year_winners FOR SELECT USING (true);
REVOKE ALL ON public.choice_year_winners FROM anon, authenticated;
GRANT SELECT ON public.choice_year_winners TO anon, authenticated;

COMMENT ON TABLE public.choice_year_winners IS
  'Community''s Choice of the year, one per kind (STEP 82): the most votes over the year''s monthly ballots, ties to the most months won, then the most nominations. Winners carry the community_choice_year tag.';

-- The year's winners. With p_apply, saved and tagged.
CREATE OR REPLACE FUNCTION public.choice_tally_year(p_year INTEGER, p_apply BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  out JSONB := '[]'::jsonb;
  w RECORD;
BEGIN
  FOR w IN
    WITH v AS (
      SELECT kind, item_id, count(*) AS votes
      FROM public.choice_votes
      WHERE month LIKE p_year::text || '-%'
      GROUP BY kind, item_id
    ), ranked AS (
      SELECT v.kind, v.item_id, v.votes,
             (SELECT count(*) FROM public.choice_winners cw WHERE cw.kind = v.kind AND cw.item_id = v.item_id AND cw.month LIKE p_year::text || '-%') AS months_won,
             (SELECT count(*) FROM public.choice_nominations n WHERE n.item_id = v.item_id AND n.month LIKE p_year::text || '-%') AS nominations,
             row_number() OVER (PARTITION BY v.kind ORDER BY v.votes DESC,
               (SELECT count(*) FROM public.choice_winners cw WHERE cw.kind = v.kind AND cw.item_id = v.item_id AND cw.month LIKE p_year::text || '-%') DESC,
               (SELECT count(*) FROM public.choice_nominations n WHERE n.item_id = v.item_id AND n.month LIKE p_year::text || '-%') DESC,
               v.item_id) AS rk
      FROM v
    )
    SELECT * FROM ranked WHERE rk = 1 AND votes > 0
  LOOP
    out := out || jsonb_build_object('kind', w.kind, 'item_id', w.item_id, 'votes', w.votes, 'months_won', w.months_won, 'nominations', w.nominations);
    IF p_apply THEN
      INSERT INTO public.choice_year_winners (year, kind, item_id, votes, months_won, nominations)
      VALUES (p_year, w.kind, w.item_id, w.votes, w.months_won, w.nominations)
      ON CONFLICT (year, kind) DO UPDATE SET item_id = EXCLUDED.item_id, votes = EXCLUDED.votes, months_won = EXCLUDED.months_won, nominations = EXCLUDED.nominations;
      IF w.kind = 'product' THEN
        UPDATE public.products SET tags = array_append(tags, 'community_choice_year') WHERE id = w.item_id AND NOT ('community_choice_year' = ANY (tags));
      ELSE
        UPDATE public.resources SET tags = array_append(tags, 'community_choice_year') WHERE id = w.item_id AND NOT ('community_choice_year' = ANY (tags));
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('year', p_year, 'applied', p_apply, 'winners', out);
END $$;

REVOKE ALL ON FUNCTION public.choice_tally_year(INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.choice_tally_year(INTEGER, BOOLEAN) TO service_role;

-- 3. Users' Choice --------------------------------------------------------------
-- "Type of user": a norm the raters share (norm:autism), or how they are
-- connected to a norm (connection:lived, connection:direct_support...). For
-- each kind of item and each group of it (a service's category, a
-- product's category), the item those raters rated highest, from at least
-- p_min of their ratings.
CREATE TABLE IF NOT EXISTS public.users_choice (
  period TEXT NOT NULL CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  kind TEXT NOT NULL CHECK (kind IN ('service', 'product', 'article')),
  grouping TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type ~ '^(norm|connection):[a-z0-9_]+$'),
  item_id UUID NOT NULL,
  average NUMERIC(3, 2) NOT NULL,
  ratings INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (period, kind, grouping, user_type)
);

CREATE INDEX IF NOT EXISTS users_choice_item_idx ON public.users_choice (item_id, period DESC);

ALTER TABLE public.users_choice ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_choice_read ON public.users_choice;
CREATE POLICY users_choice_read ON public.users_choice FOR SELECT USING (true);
REVOKE ALL ON public.users_choice FROM anon, authenticated;
GRANT SELECT ON public.users_choice TO anon, authenticated;

COMMENT ON TABLE public.users_choice IS
  'Users'' Choice (STEP 82): for each kind of item and its category, the one rated highest by each type of user (a shared norm, or a connection to a norm), from at least three of their ratings, averaging 4 or more. Worked out each month by users_choice_build(); every month is kept, and the newest is shown.';

CREATE OR REPLACE FUNCTION public.users_choice_build(p_min INTEGER DEFAULT 3, p_period TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n INTEGER;
  per TEXT := coalesce(p_period, to_char(now() AT TIME ZONE 'America/Toronto', 'YYYY-MM'));
BEGIN
  WITH rated AS (
    -- Services and articles (resources), with each rater's norms and connections.
    SELECT CASE WHEN r2.category = 'commentary' THEN 'article' ELSE 'service' END AS kind,
           lower(coalesce(r2.category, 'other')) AS grouping, rt.resource_id AS item_id, rt.overall_score::numeric AS score,
           coalesce(rt.rater_diagnostics, '{}'::jsonb) AS diag, coalesce(rt.rater_relationships, '{}'::jsonb) AS rel
    FROM public.ratings rt JOIN public.resources r2 ON r2.id = rt.resource_id
    WHERE r2.status = 'approved' AND rt.overall_score IS NOT NULL
    UNION ALL
    SELECT 'product', lower(p.category), pr.product_id, pr.rating::numeric,
           coalesce(pr.rater_diagnostics, '{}'::jsonb), coalesce(pr.rater_relationships, '{}'::jsonb)
    FROM public.product_reviews pr JOIN public.products p ON p.id = pr.product_id
    WHERE p.status = 'active'
  ), typed AS (
    SELECT kind, grouping, item_id, score, 'norm:' || lower(regexp_replace(k, '[^a-zA-Z0-9]+', '_', 'g')) AS user_type
    FROM rated, LATERAL jsonb_object_keys(CASE WHEN jsonb_typeof(diag) = 'object' THEN diag ELSE '{}'::jsonb END) AS k
    UNION ALL
    SELECT kind, grouping, item_id, score, 'connection:' || v
    FROM rated, LATERAL (SELECT DISTINCT value AS v FROM jsonb_each_text(CASE WHEN jsonb_typeof(rel) = 'object' THEN rel ELSE '{}'::jsonb END)) x
    WHERE v IN ('lived', 'direct_support', 'indirect_support', 'ally')
  ), agg AS (
    SELECT kind, grouping, user_type, item_id, round(avg(score), 2) AS average, count(*) AS ratings
    FROM typed GROUP BY kind, grouping, user_type, item_id
    HAVING count(*) >= p_min
  ), best AS (
    SELECT *, row_number() OVER (PARTITION BY kind, grouping, user_type ORDER BY average DESC, ratings DESC, item_id) AS rk FROM agg
  )
  INSERT INTO public.users_choice (period, kind, grouping, user_type, item_id, average, ratings)
  SELECT per, kind, grouping, user_type, item_id, average, ratings FROM best WHERE rk = 1 AND average >= 4
  ON CONFLICT (period, kind, grouping, user_type) DO UPDATE SET item_id = EXCLUDED.item_id, average = EXCLUDED.average, ratings = EXCLUDED.ratings, computed_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('period', per, 'winners', n, 'min_ratings', p_min);
END $$;

REVOKE ALL ON FUNCTION public.users_choice_build(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.users_choice_build(INTEGER, TEXT) TO service_role;

-- 4. Vendors, payments and orders -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_payment_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE NOT NULL,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  details_submitted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_payment_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendor_payment_accounts_own_read ON public.vendor_payment_accounts;
CREATE POLICY vendor_payment_accounts_own_read ON public.vendor_payment_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.vendor_payment_accounts FROM anon, authenticated;
GRANT SELECT ON public.vendor_payment_accounts TO authenticated;

COMMENT ON TABLE public.vendor_payment_accounts IS
  'A vendor''s Stripe Connect account, for selling through ResourceHub (STEP 82). Written only by the server from Stripe.';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS vendor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_once ON public.orders (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_vendor_idx ON public.orders (vendor_user_id, created_at DESC);

-- Orders are written only by the server (from Stripe); people read their own,
-- and a vendor reads the orders for their products.
DROP POLICY IF EXISTS orders_owner ON public.orders;
DROP POLICY IF EXISTS orders_own_read ON public.orders;
CREATE POLICY orders_own_read ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid() OR vendor_user_id = auth.uid());
DROP POLICY IF EXISTS order_items_owner ON public.order_items;
DROP POLICY IF EXISTS order_items_read ON public.order_items;
CREATE POLICY order_items_read ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR o.vendor_user_id = auth.uid()))
);
REVOKE ALL ON public.orders, public.order_items FROM anon, authenticated;
GRANT SELECT ON public.orders, public.order_items TO authenticated;

-- A return is started by the buyer; everything after is the server's.
DROP POLICY IF EXISTS returns_owner ON public.order_returns;
DROP POLICY IF EXISTS returns_own_read ON public.order_returns;
CREATE POLICY returns_own_read ON public.order_returns FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.vendor_user_id = auth.uid())
);
DROP POLICY IF EXISTS returns_own_start ON public.order_returns;
CREATE POLICY returns_own_start ON public.order_returns FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND status = 'return_started'
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid() AND o.status IN ('shipped', 'delivered'))
);
REVOKE ALL ON public.order_returns FROM anon, authenticated;
GRANT SELECT, INSERT ON public.order_returns TO authenticated;

-- 5. Discounts -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  kind TEXT NOT NULL CHECK (kind IN ('norm', 'season', 'launch', 'other')),
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  suggested_percent INTEGER CHECK (suggested_percent IS NULL OR suggested_percent BETWEEN 1 AND 90),
  notify_days_before INTEGER NOT NULL DEFAULT 30 CHECK (notify_days_before BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

ALTER TABLE public.discount_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS discount_events_read ON public.discount_events;
CREATE POLICY discount_events_read ON public.discount_events FOR SELECT USING (true);
REVOKE ALL ON public.discount_events FROM anon, authenticated;
GRANT SELECT ON public.discount_events TO anon, authenticated;

COMMENT ON TABLE public.discount_events IS
  'Times of year vendors can offer a discount (STEP 82): norm months, back to school, launches. Made by the team in the SQL editor or ResourceHub''s admin; vendors are told ahead and opt in.';

-- The first events (the team adds more): dates that are the same every year.
INSERT INTO public.discount_events (slug, name, description, kind, starts_on, ends_on, suggested_percent, notify_days_before) VALUES
  ('back-to-school-2027', 'Back to school', 'Discounts for the start of the school year.', 'season', '2027-08-15', '2027-09-15', 15, 45),
  ('autism-acceptance-month-2027', 'Autism Acceptance Month', 'April: discounts for Autism Acceptance Month.', 'norm', '2027-04-01', '2027-04-30', 15, 45),
  ('adhd-awareness-month-2027', 'ADHD Awareness Month', 'October: discounts for ADHD Awareness Month.', 'norm', '2027-10-01', '2027-10-31', 15, 45)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.product_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.discount_events(id) ON DELETE CASCADE,
  vendor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  percent INTEGER CHECK (percent IS NULL OR percent BETWEEN 1 AND 90),
  sale_price DECIMAL(10, 2) CHECK (sale_price IS NULL OR sale_price >= 0),
  -- A code for the vendor's own store, for products ResourceHub doesn't sell.
  code TEXT CHECK (code IS NULL OR code ~ '^[A-Za-z0-9_-]{3,30}$'),
  starts_on DATE,
  ends_on DATE,
  opted_in BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (percent IS NOT NULL OR sale_price IS NOT NULL OR NOT opted_in),
  CHECK (event_id IS NOT NULL OR (starts_on IS NOT NULL AND ends_on IS NOT NULL AND ends_on >= starts_on))
);

CREATE UNIQUE INDEX IF NOT EXISTS product_discounts_one_per_event ON public.product_discounts (product_id, event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_discounts_product_idx ON public.product_discounts (product_id);

ALTER TABLE public.product_discounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_discounts_read ON public.product_discounts;
CREATE POLICY product_discounts_read ON public.product_discounts FOR SELECT USING (opted_in OR vendor_user_id = auth.uid());
REVOKE ALL ON public.product_discounts FROM anon, authenticated;
GRANT SELECT ON public.product_discounts TO anon, authenticated;
-- Written by the app's server, after checking the vendor sells the product.

COMMENT ON TABLE public.product_discounts IS
  'A vendor''s discount on a product (STEP 82): for a discount event (opted in or out), or their own dates (a launch). Shown in the shop only during its dates, once the team turns discounts on.';

CREATE TABLE IF NOT EXISTS public.vendor_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('discount_event', 'order', 'review', 'listing')),
  ref TEXT NOT NULL CHECK (char_length(ref) <= 200),
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  body TEXT CHECK (body IS NULL OR char_length(body) <= 1000),
  link TEXT CHECK (link IS NULL OR char_length(link) <= 500),
  emailed_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, ref)
);

CREATE INDEX IF NOT EXISTS vendor_notifications_user_idx ON public.vendor_notifications (user_id, created_at DESC);

ALTER TABLE public.vendor_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendor_notifications_own_read ON public.vendor_notifications;
CREATE POLICY vendor_notifications_own_read ON public.vendor_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS vendor_notifications_own_mark ON public.vendor_notifications;
CREATE POLICY vendor_notifications_own_mark ON public.vendor_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.vendor_notifications FROM anon, authenticated;
GRANT SELECT ON public.vendor_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.vendor_notifications TO authenticated;

COMMENT ON TABLE public.vendor_notifications IS
  'Notices to a Resource Account (STEP 82): an upcoming discount event to opt in to, an order, a review. Each once (user, kind, ref); also emailed when emailed_at is set.';

-- 6. Taste profiles (v1.5) ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sensory_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  likes TEXT[] NOT NULL DEFAULT '{}',
  avoids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cardinality(likes) <= 40 AND cardinality(avoids) <= 40)
);

ALTER TABLE public.sensory_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sensory_preferences_own ON public.sensory_preferences;
CREATE POLICY sensory_preferences_own ON public.sensory_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.sensory_preferences FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensory_preferences TO authenticated;

COMMENT ON TABLE public.sensory_preferences IS
  'What someone likes and avoids in products (quality ids: crunchy, soft_fabric, fragrance_free...), optional, only theirs to see (STEP 82). Used for taste profiles.';

CREATE TABLE IF NOT EXISTS public.taste_profile_groups (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  top_likes TEXT[] NOT NULL DEFAULT '{}',
  top_avoids TEXT[] NOT NULL DEFAULT '{}',
  size INTEGER NOT NULL CHECK (size >= 10),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.taste_profile_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS taste_profile_groups_read ON public.taste_profile_groups;
CREATE POLICY taste_profile_groups_read ON public.taste_profile_groups FOR SELECT USING (true);
REVOKE ALL ON public.taste_profile_groups FROM anon, authenticated;
GRANT SELECT ON public.taste_profile_groups TO anon, authenticated;

COMMENT ON TABLE public.taste_profile_groups IS
  'Taste profiles found by clustering (STEP 82, v1.5): groups of at least 10 people with similar likes and avoids. Only the group''s description is public, never who is in it.';

CREATE TABLE IF NOT EXISTS public.taste_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES public.taste_profile_groups(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.taste_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS taste_profiles_own_read ON public.taste_profiles;
CREATE POLICY taste_profiles_own_read ON public.taste_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.taste_profiles FROM anon, authenticated;
GRANT SELECT ON public.taste_profiles TO authenticated;

COMMENT ON TABLE public.taste_profiles IS
  'Which taste profile each person is in (STEP 82, v1.5), written by the clustering job; people see only their own.';
