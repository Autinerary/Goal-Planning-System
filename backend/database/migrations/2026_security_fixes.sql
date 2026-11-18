-- ============================================================================
-- STEP 105: the database half of the 17 November 2026 review (the team's private list of what was found)
--
-- Paste it BEFORE the 18 November 2026 code is pushed: the repository is public, and the code shows where these doors
-- were. The code from before it keeps working with this in place; until the new code is live, ResourceHub's "how
-- people with these norms rated it" breakdowns are empty and a trusted person's new listing waits for review.
-- Safe to run twice.
--
--  1. Notifications: only the server creates them (anyone, even signed out, could put one with any link into
--     anyone's bell). People can delete their own.
--  2. Reviewers' details (their conditions, relationships, groups, connection types) leave the public rows of
--     ratings and product reviews for private tables only the server reads. Anyone could read them with the public
--     key, next to the reviewer's account.
--  3. Listings: a person can only add a listing as "pending" and not as "Autinerary's Own", and can't approve
--     their own.
--  4. Venue scans (who scanned which place, and when) are no longer readable by everyone; the sensory summary is
--     still public.
--  5. Pictures: only the person who uploaded a picture can replace it. Ideal Self portraits get a private bucket.
--  6. Banned and suspended accounts can't post, answer, vote, rate, review or comment.
--  7. profiles.email always equals the sign-in email; people could set it to anyone's.
--  8. The ResourceHub reward function: the server only, with the reward kept between -1 and 1.
--  9. Peer vouches: readable only by the two people involved.
-- 10. Columns only the server sets: post locks (moderators only), "helpful" counts, which listing or product a
--     rating is about, verified norms, and a community profile's suspension and karma.
-- 11. The moderation queue gets the columns the code writes; only the server writes it.
-- 12. Journal entries: people can read their own (Life Stats counted them only at night).
-- 13. community_post_view(): counting a Tidbit's views in one step.
-- 14. collab_group_removals: someone removed from a group can't rejoin by themselves.
-- 15. The first version's unused tables are closed to the public key.
-- 16. Columns and a table that only one-off scripts created, so a rebuilt database matches production.
-- ============================================================================
BEGIN;

-- 1. Notifications ------------------------------------------------------------
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
REVOKE INSERT ON public.notifications FROM anon, authenticated;
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
GRANT DELETE ON public.notifications TO authenticated;

-- 2. Reviewers' details ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rating_rater_context (
  rating_id              UUID PRIMARY KEY,
  rater_diagnostics      JSONB  NOT NULL DEFAULT '{}',
  rater_relationships    JSONB  NOT NULL DEFAULT '{}',
  rater_org_ids          UUID[] NOT NULL DEFAULT '{}',
  rater_connection_types JSONB  NOT NULL DEFAULT '{}',
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.product_review_rater_context (
  review_id              UUID PRIMARY KEY,
  rater_diagnostics      JSONB  NOT NULL DEFAULT '{}',
  rater_relationships    JSONB  NOT NULL DEFAULT '{}',
  rater_org_ids          UUID[] NOT NULL DEFAULT '{}',
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rating_rater_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_review_rater_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rating_rater_context FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.product_review_rater_context FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rating_rater_context TO service_role;
GRANT ALL ON public.product_review_rater_context TO service_role;
COMMENT ON TABLE public.rating_rater_context IS
  'STEP 105: each rater''s details at the time of their rating (conditions and severity, relationships, groups, connection types), by rating id. Server only: the ratings rows keep these columns empty.';
COMMENT ON TABLE public.product_review_rater_context IS
  'STEP 105: each product reviewer''s details at the time of their review, by review id. Server only: product_reviews keeps these columns empty.';

-- What the app writes into a rating or a review goes to the private table, and the row keeps the columns empty.
-- Named zz_ so it runs after any other BEFORE trigger that reads the row. Writers don't change.
CREATE OR REPLACE FUNCTION public.keep_rater_details_private()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target UUID;
BEGIN
  IF TG_TABLE_NAME = 'ratings_all' THEN
    IF TG_OP = 'INSERT' THEN
      -- An upsert that ends up updating the person's existing rating keeps the details under that rating's id.
      SELECT r.id INTO target FROM public.ratings_all r WHERE r.resource_id = NEW.resource_id AND r.user_id = NEW.user_id;
      target := coalesce(target, NEW.id);
      IF NEW.rater_diagnostics IS DISTINCT FROM '{}'::jsonb OR NEW.rater_relationships IS DISTINCT FROM '{}'::jsonb
         OR NEW.rater_org_ids IS DISTINCT FROM '{}'::uuid[] OR NEW.rater_connection_types IS DISTINCT FROM '{}'::jsonb THEN
        INSERT INTO public.rating_rater_context AS c
          (rating_id, rater_diagnostics, rater_relationships, rater_org_ids, rater_connection_types, updated_at)
        VALUES (target, coalesce(NEW.rater_diagnostics, '{}'), coalesce(NEW.rater_relationships, '{}'),
                coalesce(NEW.rater_org_ids, '{}'), coalesce(NEW.rater_connection_types, '{}'), now())
        ON CONFLICT (rating_id) DO UPDATE SET
          rater_diagnostics = EXCLUDED.rater_diagnostics,
          rater_relationships = EXCLUDED.rater_relationships,
          rater_org_ids = EXCLUDED.rater_org_ids,
          rater_connection_types = EXCLUDED.rater_connection_types,
          updated_at = now();
      END IF;
    ELSIF NEW.rater_diagnostics IS DISTINCT FROM OLD.rater_diagnostics OR NEW.rater_relationships IS DISTINCT FROM OLD.rater_relationships
          OR NEW.rater_org_ids IS DISTINCT FROM OLD.rater_org_ids OR NEW.rater_connection_types IS DISTINCT FROM OLD.rater_connection_types THEN
      -- An update keeps what it didn't change.
      INSERT INTO public.rating_rater_context AS c
        (rating_id, rater_diagnostics, rater_relationships, rater_org_ids, rater_connection_types, updated_at)
      VALUES (OLD.id, coalesce(NEW.rater_diagnostics, '{}'), coalesce(NEW.rater_relationships, '{}'),
              coalesce(NEW.rater_org_ids, '{}'), coalesce(NEW.rater_connection_types, '{}'), now())
      ON CONFLICT (rating_id) DO UPDATE SET
        rater_diagnostics = CASE WHEN NEW.rater_diagnostics IS DISTINCT FROM OLD.rater_diagnostics THEN EXCLUDED.rater_diagnostics ELSE c.rater_diagnostics END,
        rater_relationships = CASE WHEN NEW.rater_relationships IS DISTINCT FROM OLD.rater_relationships THEN EXCLUDED.rater_relationships ELSE c.rater_relationships END,
        rater_org_ids = CASE WHEN NEW.rater_org_ids IS DISTINCT FROM OLD.rater_org_ids THEN EXCLUDED.rater_org_ids ELSE c.rater_org_ids END,
        rater_connection_types = CASE WHEN NEW.rater_connection_types IS DISTINCT FROM OLD.rater_connection_types THEN EXCLUDED.rater_connection_types ELSE c.rater_connection_types END,
        updated_at = now();
    END IF;
    NEW.rater_diagnostics := '{}';
    NEW.rater_relationships := '{}';
    NEW.rater_org_ids := '{}';
    NEW.rater_connection_types := '{}';
  ELSIF TG_TABLE_NAME = 'product_reviews' THEN
    IF TG_OP = 'INSERT' THEN
      SELECT pr.id INTO target FROM public.product_reviews pr WHERE pr.product_id = NEW.product_id AND pr.user_id = NEW.user_id;
      target := coalesce(target, NEW.id);
      IF NEW.rater_diagnostics IS DISTINCT FROM '{}'::jsonb OR NEW.rater_relationships IS DISTINCT FROM '{}'::jsonb
         OR NEW.rater_org_ids IS DISTINCT FROM '{}'::uuid[] THEN
        INSERT INTO public.product_review_rater_context AS c
          (review_id, rater_diagnostics, rater_relationships, rater_org_ids, updated_at)
        VALUES (target, coalesce(NEW.rater_diagnostics, '{}'), coalesce(NEW.rater_relationships, '{}'),
                coalesce(NEW.rater_org_ids, '{}'), now())
        ON CONFLICT (review_id) DO UPDATE SET
          rater_diagnostics = EXCLUDED.rater_diagnostics,
          rater_relationships = EXCLUDED.rater_relationships,
          rater_org_ids = EXCLUDED.rater_org_ids,
          updated_at = now();
      END IF;
    ELSIF NEW.rater_diagnostics IS DISTINCT FROM OLD.rater_diagnostics OR NEW.rater_relationships IS DISTINCT FROM OLD.rater_relationships
          OR NEW.rater_org_ids IS DISTINCT FROM OLD.rater_org_ids THEN
      INSERT INTO public.product_review_rater_context AS c
        (review_id, rater_diagnostics, rater_relationships, rater_org_ids, updated_at)
      VALUES (OLD.id, coalesce(NEW.rater_diagnostics, '{}'), coalesce(NEW.rater_relationships, '{}'),
              coalesce(NEW.rater_org_ids, '{}'), now())
      ON CONFLICT (review_id) DO UPDATE SET
        rater_diagnostics = CASE WHEN NEW.rater_diagnostics IS DISTINCT FROM OLD.rater_diagnostics THEN EXCLUDED.rater_diagnostics ELSE c.rater_diagnostics END,
        rater_relationships = CASE WHEN NEW.rater_relationships IS DISTINCT FROM OLD.rater_relationships THEN EXCLUDED.rater_relationships ELSE c.rater_relationships END,
        rater_org_ids = CASE WHEN NEW.rater_org_ids IS DISTINCT FROM OLD.rater_org_ids THEN EXCLUDED.rater_org_ids ELSE c.rater_org_ids END,
        updated_at = now();
    END IF;
    NEW.rater_diagnostics := '{}';
    NEW.rater_relationships := '{}';
    NEW.rater_org_ids := '{}';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.keep_rater_details_private() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.forget_rater_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'ratings_all' THEN
    DELETE FROM public.rating_rater_context WHERE rating_id = OLD.id;
  ELSE
    DELETE FROM public.product_review_rater_context WHERE review_id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.forget_rater_details() FROM PUBLIC, anon, authenticated;

-- What is already there moves now (other triggers off for this one update: it changes nothing else).
INSERT INTO public.rating_rater_context (rating_id, rater_diagnostics, rater_relationships, rater_org_ids, rater_connection_types)
SELECT r.id, r.rater_diagnostics, r.rater_relationships, r.rater_org_ids, r.rater_connection_types
FROM public.ratings_all r
WHERE r.rater_diagnostics <> '{}'::jsonb OR r.rater_relationships <> '{}'::jsonb
   OR r.rater_org_ids <> '{}'::uuid[] OR r.rater_connection_types <> '{}'::jsonb
ON CONFLICT (rating_id) DO UPDATE SET
  rater_diagnostics = EXCLUDED.rater_diagnostics,
  rater_relationships = EXCLUDED.rater_relationships,
  rater_org_ids = EXCLUDED.rater_org_ids,
  rater_connection_types = EXCLUDED.rater_connection_types,
  updated_at = now();
INSERT INTO public.product_review_rater_context (review_id, rater_diagnostics, rater_relationships, rater_org_ids)
SELECT pr.id, pr.rater_diagnostics, pr.rater_relationships, pr.rater_org_ids
FROM public.product_reviews pr
WHERE pr.rater_diagnostics <> '{}'::jsonb OR pr.rater_relationships <> '{}'::jsonb OR pr.rater_org_ids <> '{}'::uuid[]
ON CONFLICT (review_id) DO UPDATE SET
  rater_diagnostics = EXCLUDED.rater_diagnostics,
  rater_relationships = EXCLUDED.rater_relationships,
  rater_org_ids = EXCLUDED.rater_org_ids,
  updated_at = now();

ALTER TABLE public.ratings_all DISABLE TRIGGER USER;
UPDATE public.ratings_all
   SET rater_diagnostics = '{}', rater_relationships = '{}', rater_org_ids = '{}', rater_connection_types = '{}'
 WHERE rater_diagnostics <> '{}'::jsonb OR rater_relationships <> '{}'::jsonb
    OR rater_org_ids <> '{}'::uuid[] OR rater_connection_types <> '{}'::jsonb;
ALTER TABLE public.ratings_all ENABLE TRIGGER USER;
ALTER TABLE public.product_reviews DISABLE TRIGGER USER;
UPDATE public.product_reviews
   SET rater_diagnostics = '{}', rater_relationships = '{}', rater_org_ids = '{}'
 WHERE rater_diagnostics <> '{}'::jsonb OR rater_relationships <> '{}'::jsonb OR rater_org_ids <> '{}'::uuid[];
ALTER TABLE public.product_reviews ENABLE TRIGGER USER;

DROP TRIGGER IF EXISTS zz_keep_rater_details_private ON public.ratings_all;
CREATE TRIGGER zz_keep_rater_details_private
  BEFORE INSERT OR UPDATE ON public.ratings_all
  FOR EACH ROW EXECUTE FUNCTION public.keep_rater_details_private();
DROP TRIGGER IF EXISTS zz_keep_rater_details_private ON public.product_reviews;
CREATE TRIGGER zz_keep_rater_details_private
  BEFORE INSERT OR UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.keep_rater_details_private();
DROP TRIGGER IF EXISTS forget_rater_details ON public.ratings_all;
CREATE TRIGGER forget_rater_details
  AFTER DELETE ON public.ratings_all
  FOR EACH ROW EXECUTE FUNCTION public.forget_rater_details();
DROP TRIGGER IF EXISTS forget_rater_details ON public.product_reviews;
CREATE TRIGGER forget_rater_details
  AFTER DELETE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.forget_rater_details();

-- Users' Choice (STEP 82) reads the details from the private tables now, and leaves out anything held for review.
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
           coalesce(c.rater_diagnostics, rt.rater_diagnostics, '{}'::jsonb) AS diag,
           coalesce(c.rater_relationships, rt.rater_relationships, '{}'::jsonb) AS rel
    FROM public.ratings rt
    JOIN public.resources r2 ON r2.id = rt.resource_id
    LEFT JOIN public.rating_rater_context c ON c.rating_id = rt.id
    WHERE r2.status = 'approved' AND rt.overall_score IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.moderation_queue mq
                       WHERE mq.item_type = 'rating' AND mq.item_id = rt.id AND mq.status = 'pending')
    UNION ALL
    SELECT 'product', lower(p.category), pr.product_id, pr.rating::numeric,
           coalesce(pc.rater_diagnostics, pr.rater_diagnostics, '{}'::jsonb),
           coalesce(pc.rater_relationships, pr.rater_relationships, '{}'::jsonb)
    FROM public.product_reviews pr
    JOIN public.products p ON p.id = pr.product_id
    LEFT JOIN public.product_review_rater_context pc ON pc.review_id = pr.id
    WHERE p.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM public.moderation_queue mq
                       WHERE mq.item_type = 'product_review' AND mq.item_id = pr.id AND mq.status = 'pending')
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

-- 3. Listings -------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can create resources" ON public.resources;
DROP POLICY IF EXISTS resources_insert_pending_own ON public.resources;
CREATE POLICY resources_insert_pending_own ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND status = 'pending' AND NOT coalesce(is_first_party, false));
DROP POLICY IF EXISTS "Users can update own submitted resources" ON public.resources;
CREATE POLICY "Users can update own submitted resources" ON public.resources
  FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid()) WITH CHECK (submitted_by = auth.uid());

-- Whatever a person sends, a listing they add is pending and not the team's own, and an edit keeps its status.
-- Invoker rights on purpose: current_user is 'authenticated' only when a person writes directly (as STEP 68 does).
CREATE OR REPLACE FUNCTION public.pin_resource_server_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'pending';
      NEW.is_first_party := false;
      NEW.submitted_by := auth.uid();
    ELSE
      NEW.status := OLD.status;
      NEW.is_first_party := OLD.is_first_party;
      NEW.submitted_by := OLD.submitted_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pin_resource_server_columns ON public.resources;
CREATE TRIGGER pin_resource_server_columns
  BEFORE INSERT OR UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.pin_resource_server_columns();

-- 4. Venue scans ------------------------------------------------------------------
DROP POLICY IF EXISTS venue_scans_select_all ON public.venue_scans;
DROP POLICY IF EXISTS venue_scans_select_own ON public.venue_scans;
CREATE POLICY venue_scans_select_own ON public.venue_scans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- The summary reads every scan of a venue, and returns times of day and medians, never who or when exactly.
ALTER FUNCTION public.get_venue_sensory(UUID) SECURITY DEFINER;
ALTER FUNCTION public.get_venue_sensory(UUID) SET search_path = public;
REVOKE ALL ON FUNCTION public.get_venue_sensory(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_venue_sensory(UUID) TO anon, authenticated, service_role;

-- 5. Pictures ---------------------------------------------------------------------
DROP POLICY IF EXISTS "resource_images_auth_update" ON storage.objects;
CREATE POLICY "resource_images_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'resource-images' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'resource-images' AND owner = auth.uid());
-- Ideal Self portraits: private, written and read by the server, shown through links that last an hour.
INSERT INTO storage.buckets (id, name, public)
VALUES ('portraits', 'portraits', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- 6. Banned and suspended accounts --------------------------------------------------
CREATE OR REPLACE FUNCTION public.refuse_banned_writer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  -- The server (no signed-in person) checks for itself.
  IF me IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = me AND p.role = 'banned')
     OR EXISTS (SELECT 1 FROM public.community_profiles cp
                 WHERE cp.user_id = me AND cp.is_suspended
                   AND (cp.suspended_until IS NULL OR cp.suspended_until > now())) THEN
    RAISE EXCEPTION 'This account can''t post right now.' USING ERRCODE = 'P0001', HINT = 'unavailable';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.refuse_banned_writer() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('community_posts', 'INSERT'),
      ('community_answers', 'INSERT'),
      ('community_votes', 'INSERT OR UPDATE'),
      ('community_post_ratings', 'INSERT OR UPDATE'),
      ('resource_comments', 'INSERT OR UPDATE'),
      ('ratings_all', 'INSERT OR UPDATE'),
      ('rating_helpful_votes', 'INSERT'),
      ('product_reviews', 'INSERT OR UPDATE')
    ) AS v(tbl, ops)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS refuse_banned_writer ON public.%I', t.tbl);
      EXECUTE format('CREATE TRIGGER refuse_banned_writer BEFORE %s ON public.%I FOR EACH ROW EXECUTE FUNCTION public.refuse_banned_writer()', t.ops, t.tbl);
    END IF;
  END LOOP;
END $$;

-- 7. profiles.email -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.own_sign_in_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.email::text FROM auth.users u WHERE u.id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.own_sign_in_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.own_sign_in_email() TO authenticated, service_role;

-- Anyone's sign-in email, for the server only (a profile the server makes without one gets it).
CREATE OR REPLACE FUNCTION public.sign_in_email_of(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.email::text FROM auth.users u WHERE u.id = p_user_id
$$;
REVOKE ALL ON FUNCTION public.sign_in_email_of(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_in_email_of(UUID) TO service_role;

-- A person's own write can't set it: an edit keeps it, and a new profile gets their sign-in email. A profile the
-- server makes without an email gets the sign-in email too.
CREATE OR REPLACE FUNCTION public.keep_profile_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.email := OLD.email;
    ELSIF NEW.id = auth.uid() THEN
      NEW.email := public.own_sign_in_email();
    ELSE
      NEW.email := NULL;
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.email IS NULL THEN
    NEW.email := public.sign_in_email_of(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS keep_profile_email ON public.profiles;
CREATE TRIGGER keep_profile_email
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.keep_profile_email();

-- When the sign-in email is set or changed, the profile follows. Never blocks a sign-up or an email change.
CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id AND email IS DISTINCT FROM NEW.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'profiles.email not synced for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_profile_email_from_auth() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sync_profile_email_from_auth ON auth.users;
CREATE TRIGGER sync_profile_email_from_auth
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email_from_auth();

-- And every profile now: anything set by hand goes back to the sign-in email.
UPDATE public.profiles p
   SET email = u.email
  FROM auth.users u
 WHERE u.id = p.id AND p.email IS DISTINCT FROM u.email;

-- 8. The ResourceHub reward function ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attribute_servicehub_reward(
    p_user_id     UUID,
    p_resource_id UUID,
    p_reward      REAL,
    p_window_days INTEGER DEFAULT 30
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows_credited INTEGER := 0;
    v_reward REAL := greatest(-1, least(1, p_reward));
BEGIN
    IF p_user_id IS NULL OR p_resource_id IS NULL THEN
        RETURN 0;
    END IF;

    -- Pure no-op when reward is exactly zero. Neutral ratings carry no
    -- learning signal and we don't want to inflate reward_count.
    IF v_reward IS NULL OR v_reward = 0 THEN
        RETURN 0;
    END IF;

    WITH credited AS (
        INSERT INTO public.servicehub_agent_outcomes
            (agent_name, decision_key, reward_sum, reward_count, last_seen)
        SELECT
            d.agent_name,
            d.decision_key,
            v_reward,
            1,
            now()
        FROM public.servicehub_agent_decisions d
        WHERE d.user_id = p_user_id
          AND d.resource_id = p_resource_id
          AND d.decided_at > now() - (least(greatest(coalesce(p_window_days, 30), 1), 90) * INTERVAL '1 day')
        ON CONFLICT (agent_name, decision_key)
        DO UPDATE SET
            reward_sum   = public.servicehub_agent_outcomes.reward_sum + EXCLUDED.reward_sum,
            reward_count = public.servicehub_agent_outcomes.reward_count + 1,
            last_seen    = now()
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_rows_credited FROM credited;

    RETURN v_rows_credited;
END;
$$;
REVOKE ALL ON FUNCTION public.attribute_servicehub_reward(UUID, UUID, REAL, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attribute_servicehub_reward(UUID, UUID, REAL, INTEGER) TO service_role;

-- 9. Peer vouches -----------------------------------------------------------------------
DROP POLICY IF EXISTS peer_vouches_read ON public.peer_vouches;
CREATE POLICY peer_vouches_read ON public.peer_vouches
  FOR SELECT TO authenticated USING (auth.uid() IN (voucher_id, vouchee_id));

-- 10. Columns only the server sets ----------------------------------------------------------
-- A post's lock: moderators and admins only (people kept a column grant for it, so an author could unlock).
CREATE OR REPLACE FUNCTION public.guard_post_lock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.is_locked IS DISTINCT FROM OLD.is_locked
          OR NEW.locked_reason IS DISTINCT FROM OLD.locked_reason
          OR NEW.locked_by IS DISTINCT FROM OLD.locked_by
          OR NEW.locked_at IS DISTINCT FROM OLD.locked_at)
     AND NOT public.is_admin()
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'moderator') THEN
    RAISE EXCEPTION 'Only the team can lock or unlock a post.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_post_lock ON public.community_posts;
CREATE TRIGGER guard_post_lock
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_lock();

-- A rating or a product review: its "helpful" count (kept by the votes table's trigger), and which listing or
-- product and whose it is, can't be changed by its author.
CREATE OR REPLACE FUNCTION public.pin_rating_server_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.helpful_count := 0;
    ELSE
      NEW.helpful_count := OLD.helpful_count;
      NEW.resource_id := OLD.resource_id;
      NEW.user_id := OLD.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pin_rating_server_columns ON public.ratings_all;
CREATE TRIGGER pin_rating_server_columns
  BEFORE INSERT OR UPDATE ON public.ratings_all
  FOR EACH ROW EXECUTE FUNCTION public.pin_rating_server_columns();

CREATE OR REPLACE FUNCTION public.pin_product_review_server_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.helpful_count := 0;
    ELSE
      NEW.helpful_count := OLD.helpful_count;
      NEW.product_id := OLD.product_id;
      NEW.user_id := OLD.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pin_product_review_server_columns ON public.product_reviews;
CREATE TRIGGER pin_product_review_server_columns
  BEFORE INSERT OR UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.pin_product_review_server_columns();

-- A norm marked verified (by a professional or a group) is verified by the server, not by its owner.
CREATE OR REPLACE FUNCTION public.pin_norm_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verification_method := 'self';
      NEW.verified_at := NULL;
      NEW.verified_by_org_id := NULL;
    ELSE
      NEW.verification_method := OLD.verification_method;
      NEW.verified_at := OLD.verified_at;
      NEW.verified_by_org_id := OLD.verified_by_org_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pin_norm_verification ON public.user_barriers;
CREATE TRIGGER pin_norm_verification
  BEFORE INSERT OR UPDATE ON public.user_barriers
  FOR EACH ROW EXECUTE FUNCTION public.pin_norm_verification();

-- A suspension, and karma, are set by the team and the app: the profile's owner could clear their own suspension
-- (its FOR ALL owner policy covers every column).
CREATE OR REPLACE FUNCTION public.pin_community_profile_standing()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_suspended := false;
      NEW.suspended_until := NULL;
      NEW.suspended_reason := NULL;
      NEW.karma := 0;
    ELSE
      NEW.is_suspended := OLD.is_suspended;
      NEW.suspended_until := OLD.suspended_until;
      NEW.suspended_reason := OLD.suspended_reason;
      NEW.karma := OLD.karma;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pin_community_profile_standing ON public.community_profiles;
CREATE TRIGGER pin_community_profile_standing
  BEFORE INSERT OR UPDATE ON public.community_profiles
  FOR EACH ROW EXECUTE FUNCTION public.pin_community_profile_standing();

-- 11. The moderation queue ---------------------------------------------------------------------
ALTER TABLE public.moderation_queue
  ADD COLUMN IF NOT EXISTS submitted_by UUID,
  ADD COLUMN IF NOT EXISTS agent_decision TEXT,
  ADD COLUMN IF NOT EXISTS agent_confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS agent_reasons JSONB,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS admin_override BOOLEAN;
CREATE INDEX IF NOT EXISTS moderation_queue_submitted_by_idx ON public.moderation_queue (submitted_by);
CREATE INDEX IF NOT EXISTS moderation_queue_pending_idx ON public.moderation_queue (created_at DESC) WHERE status = 'pending';
-- "Is this rating or review held?" (servicehub-mvp/lib/moderation/queue.ts)
CREATE INDEX IF NOT EXISTS moderation_queue_item_idx ON public.moderation_queue (item_type, item_id, status);
REVOKE INSERT, UPDATE, DELETE ON public.moderation_queue FROM anon, authenticated;

-- 12. Journal entries: your own -------------------------------------------------------------------
DROP POLICY IF EXISTS reflections_read_own ON public.reflections;
CREATE POLICY reflections_read_own ON public.reflections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 13. A Tidbit's views, counted in one step ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.community_post_view(p_post_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.community_posts
     SET view_count = view_count + 1
   WHERE id = p_post_id AND is_deleted = FALSE AND status = 'published';
$$;
REVOKE ALL ON FUNCTION public.community_post_view(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_post_view(UUID) TO anon, authenticated, service_role;

-- 14. Removed from a group ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collab_group_removals (
  group_id   UUID NOT NULL REFERENCES public.collab_groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  removed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  removed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
ALTER TABLE public.collab_group_removals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.collab_group_removals FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.collab_group_removals TO service_role;
COMMENT ON TABLE public.collab_group_removals IS
  'STEP 105: people a group''s leader removed. They can''t rejoin by themselves (app/api/collab-groups/membership). Server only.';

-- 15. The first version's unused tables (database/schema.sql): nothing uses them, so nobody reads or writes
--     them with the public key.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'paths', 'races', 'milestones', 'tasks', 'stats', 'tools', 'milestone_tools',
                           'recommended_choices', 'motivation_wheels', 'agent_responses', 'connections', 'reflection_questions']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

-- 16. Made by one-off scripts until now (servicehub-mvp/scripts), so a rebuilt database matches production.
--     The two vector search functions are in servicehub-mvp/lib/supabase/vector-functions.sql: run that file on a
--     new database (not repeated here, so production's own versions aren't replaced).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS movement JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_profiles_preferences ON public.profiles USING gin (preferences);
CREATE INDEX IF NOT EXISTS idx_profiles_movement ON public.profiles USING gin (movement);
CREATE TABLE IF NOT EXISTS public.recommendation_memory (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recommendation_memory_user_idx ON public.recommendation_memory (user_id, created_at DESC);
ALTER TABLE public.recommendation_memory ENABLE ROW LEVEL SECURITY;

COMMIT;

NOTIFY pgrst, 'reload schema';
