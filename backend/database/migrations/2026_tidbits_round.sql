-- =====================================================================
-- The Tidbits round (STEP 83)
--
-- The team's planning note for Tidbits (October 2026), with the testers'
-- feedback of 31 August and the 5Qs report:
--
--   1. Community groups people join (community_groups, members). Writing a
--      Tidbit, even anonymously, needs a group.
--   2. Tidbits beside questions (community_posts.kind): a Tidbit (at most 500
--      words) or a Tadbit (at most 1000), drafts, anonymous Tidbits, the
--      source (our own, or a review of an article elsewhere, with its links),
--      the team's byline ("Autinerary"), and the automatic moderation flag.
--      Only the server publishes: people can no longer write posts or answers
--      straight into the tables (the app's routes check, filter words and
--      save), and drafts and anonymous Tidbits are hidden from direct reads.
--   3. Bites (a Tidbit someone read) and Well-Dones (a Tidbit they rated),
--      counted on the post; "Best" orders by a Bayesian average of
--      Well-Dones.
--   4. Integrated Resources: the services and products a Tidbit mentions.
--   5. The community rules, accepted once (before posting, or a first
--      rating).
--   6. Wait times (the 5Qs report: "Waittime is a universal bug"): how long
--      people waited (asked with a rating) and what the service says (its
--      Resource Account), on each listing.
--   7. Sponsored listings in more places (search, Tidbits, Paths), with a
--      budget and a cost per click, paid for with Stripe; clicks and views
--      counted once a day per person, and only the server records them.
--
-- Nothing is shown differently until the apps use it; sponsored listings stay
-- off until the team turns them on. Supabase's default privileges are
-- revoked by name from every function that is not for signed-out callers.
--
-- Run after STEP 82. Idempotent. Safe to re-run.
-- =====================================================================

-- 1. Community groups --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 300),
  sort_order INTEGER NOT NULL DEFAULT 100,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_groups_read ON public.community_groups;
CREATE POLICY community_groups_read ON public.community_groups FOR SELECT USING (true);
REVOKE ALL ON public.community_groups FROM anon, authenticated;
GRANT SELECT ON public.community_groups TO anon, authenticated;

COMMENT ON TABLE public.community_groups IS
  'Tidbits groups people join (STEP 83). Writing a Tidbit needs one; the team adds more in the SQL editor. Who is in a group is private: only the count is public.';

INSERT INTO public.community_groups (slug, name, description, sort_order) VALUES
  ('autistic-adults', 'Autistic adults', 'Life, work and friendship as an autistic adult.', 10),
  ('adhd', 'ADHD', 'Routines, focus and everything else with ADHD.', 20),
  ('audhd', 'AuDHD', 'Autistic and ADHD: when both apply.', 30),
  ('parents', 'Parents and caregivers', 'Raising and supporting a neurodivergent child or adult.', 40),
  ('siblings', 'Siblings', 'Brothers and sisters of neurodivergent people.', 50),
  ('teens-young-adults', 'Teens and young adults', 'School, first jobs and growing up.', 60),
  ('students', 'College and university students', 'Accommodations, studying and campus life.', 70),
  ('learning-differences', 'Learning differences', 'Dyslexia and other learning disabilities.', 80),
  ('tourette-tics', 'Tourette and tics', 'Tourette syndrome and tic disorders.', 90),
  ('anxiety-ocd', 'Anxiety and OCD', 'Living with anxiety and OCD.', 100),
  ('newcomers', 'New to Canada', 'Finding your way around services as a newcomer.', 110),
  ('work', 'Work and careers', 'Getting and keeping work, and asking for accommodations.', 120),
  ('professionals-allies', 'Professionals and allies', 'Teachers, clinicians, employers and friends.', 130)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.community_group_members (
  group_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_group_members_user_idx ON public.community_group_members (user_id);

ALTER TABLE public.community_group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_group_members_own ON public.community_group_members;
CREATE POLICY community_group_members_own ON public.community_group_members FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.community_group_members FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_group_members TO authenticated;

COMMENT ON TABLE public.community_group_members IS
  'Who is in each Tidbits group (STEP 83). People see and change only their own memberships.';

CREATE OR REPLACE FUNCTION public.community_group_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  g UUID := coalesce(NEW.group_id, OLD.group_id);
BEGIN
  UPDATE public.community_groups SET member_count = (SELECT count(*) FROM public.community_group_members m WHERE m.group_id = g) WHERE id = g;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.community_group_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_community_group_count ON public.community_group_members;
CREATE TRIGGER trg_community_group_count
  AFTER INSERT OR DELETE ON public.community_group_members
  FOR EACH ROW EXECUTE FUNCTION public.community_group_count();

-- 2. Tidbits beside questions ---------------------------------------------------------
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'question',
  ADD COLUMN IF NOT EXISTS length_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.community_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS external_platform TEXT,
  ADD COLUMN IF NOT EXISTS external_platform_url TEXT,
  ADD COLUMN IF NOT EXISTS byline TEXT,
  ADD COLUMN IF NOT EXISTS word_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bite_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS well_done_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS well_done_sum INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_flag TEXT,
  ADD COLUMN IF NOT EXISTS auto_flag_reason TEXT;

-- "Best": the average Well-Done, pulled toward 3.5 until there are a few (a
-- Bayesian average with three imaginary 3.5s), so one 5 doesn't beat many 4s.
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS well_done_score NUMERIC GENERATED ALWAYS AS ((well_done_sum + 10.5) / (well_done_count + 3)) STORED;

-- Existing posts are published questions; when they were posted is when they were published.
UPDATE public.community_posts SET published_at = created_at WHERE published_at IS NULL AND status = 'published';

DO $$
BEGIN
  -- A draft can be short or untitled; a published post keeps the old minimums.
  ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_title_check;
  ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_body_markdown_check;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_title_length') THEN
    ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_title_length CHECK (length(title) <= 250 AND (status = 'draft' OR length(title) >= 8));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_body_length') THEN
    ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_body_length CHECK (length(body_markdown) <= 30000 AND (status = 'draft' OR length(body_markdown) >= 20));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_kind_check') THEN
    ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_kind_check CHECK (kind IN ('question', 'tidbit'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_status_check') THEN
    ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_status_check CHECK (status IN ('draft', 'published'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_length_type_check') THEN
    ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_length_type_check CHECK (
      (kind = 'tidbit' AND coalesce(length_type, '') IN ('tidbit', 'tadbit')) OR (kind = 'question' AND length_type IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_tidbit_group') THEN
    ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_tidbit_group CHECK (kind <> 'tidbit' OR status = 'draft' OR group_id IS NOT NULL OR byline IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_anonymous_tidbit') THEN
    ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_anonymous_tidbit CHECK (NOT is_anonymous OR kind = 'tidbit');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_source_check') THEN
    ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_source_check CHECK (
      source IN ('internal', 'external')
      AND (source = 'external' OR (external_url IS NULL AND external_platform IS NULL AND external_platform_url IS NULL))
      AND (external_url IS NULL OR (external_url ~ '^https://[^[:space:]<>"]+$' AND char_length(external_url) <= 500))
      AND (external_platform_url IS NULL OR (external_platform_url ~ '^https://[^[:space:]<>"]+$' AND char_length(external_platform_url) <= 300))
      AND (external_platform IS NULL OR char_length(external_platform) BETWEEN 1 AND 60));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_byline_check') THEN
    ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_byline_check CHECK (byline IS NULL OR byline = 'autinerary');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_auto_flag_check') THEN
    ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_auto_flag_check CHECK (
      (auto_flag IS NULL OR auto_flag = 'review') AND (auto_flag_reason IS NULL OR char_length(auto_flag_reason) <= 300));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS community_posts_tidbits_idx ON public.community_posts (kind, status, published_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_posts_best_idx ON public.community_posts (well_done_score DESC, published_at DESC) WHERE is_deleted = FALSE AND status = 'published';
CREATE INDEX IF NOT EXISTS community_posts_group_idx ON public.community_posts (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS community_posts_flagged_idx ON public.community_posts (auto_flag) WHERE auto_flag IS NOT NULL;

COMMENT ON COLUMN public.community_posts.kind IS 'question: asked of the community (answers, an accepted solution). tidbit: a short article, a Tidbit (at most 500 words) or a Tadbit (at most 1000) (STEP 83).';
COMMENT ON COLUMN public.community_posts.is_anonymous IS 'Published without the pseudonym (Tidbits only). The author is still stored, for moderation, and is hidden from direct reads (STEP 83).';
COMMENT ON COLUMN public.community_posts.byline IS 'autinerary: written by the Autinerary team; set only by the server (STEP 83).';
COMMENT ON COLUMN public.community_posts.auto_flag IS 'review: the automatic moderation asked a moderator to look (STEP 83). Slurs are refused before saving; swear words are bleeped.';

-- What people can't set themselves (counters, the team's byline, moderation,
-- when it was published), the word limits, and the group rule.
CREATE OR REPLACE FUNCTION public.community_posts_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  lim INTEGER;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.bite_count := 0; NEW.well_done_count := 0; NEW.well_done_sum := 0; NEW.item_count := 0;
      NEW.byline := NULL; NEW.auto_flag := NULL; NEW.auto_flag_reason := NULL; NEW.published_at := NULL;
    ELSE
      NEW.bite_count := OLD.bite_count; NEW.well_done_count := OLD.well_done_count; NEW.well_done_sum := OLD.well_done_sum;
      NEW.item_count := OLD.item_count; NEW.byline := OLD.byline; NEW.auto_flag := OLD.auto_flag;
      NEW.auto_flag_reason := OLD.auto_flag_reason; NEW.published_at := OLD.published_at;
    END IF;
  END IF;
  NEW.word_count := CASE WHEN btrim(coalesce(NEW.body_markdown, '')) = '' THEN 0
                         ELSE coalesce(array_length(regexp_split_to_array(btrim(NEW.body_markdown), '\s+'), 1), 0) END;
  -- Checked when a Tidbit is written or published, not when its counts change
  -- (a Well-Done must still count after its author leaves the group).
  IF NEW.kind = 'tidbit' AND NEW.status = 'published' AND (
    TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.body_markdown IS DISTINCT FROM NEW.body_markdown
    OR OLD.length_type IS DISTINCT FROM NEW.length_type OR OLD.group_id IS DISTINCT FROM NEW.group_id
  ) THEN
    lim := CASE NEW.length_type WHEN 'tadbit' THEN 1000 ELSE 500 END;
    IF NEW.word_count > lim THEN
      RAISE EXCEPTION 'Keep it short and sweet: at most % words', lim USING ERRCODE = 'P0001', HINT = 'too_long';
    END IF;
    IF NEW.byline IS NULL AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.group_id IS DISTINCT FROM NEW.group_id)
       AND NOT EXISTS (SELECT 1 FROM public.community_group_members m WHERE m.group_id = NEW.group_id AND m.user_id = NEW.author_id) THEN
      RAISE EXCEPTION 'Join the group first' USING ERRCODE = 'P0001', HINT = 'not_member';
    END IF;
  END IF;
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.community_posts_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_community_posts_before_write ON public.community_posts;
CREATE TRIGGER trg_community_posts_before_write
  BEFORE INSERT OR UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.community_posts_before_write();

-- Drafts are their author's; an anonymous Tidbit is read through the app,
-- which leaves out who wrote it. Admins keep their own read policy.
DROP POLICY IF EXISTS community_posts_select ON public.community_posts;
CREATE POLICY community_posts_select ON public.community_posts
  FOR SELECT USING (is_deleted = FALSE AND (author_id = auth.uid() OR (status = 'published' AND is_anonymous = FALSE)));

-- Posts and answers are written only by the app's routes, which check who may,
-- filter the words and save. A moderator still locks a post as themselves.
REVOKE INSERT, UPDATE, DELETE ON public.community_posts FROM anon, authenticated;
GRANT UPDATE (is_locked, locked_reason, locked_by, locked_at) ON public.community_posts TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.community_answers FROM anon, authenticated;

ALTER TABLE public.community_answers
  ADD COLUMN IF NOT EXISTS auto_flag TEXT,
  ADD COLUMN IF NOT EXISTS auto_flag_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_answers_auto_flag_check') THEN
    ALTER TABLE public.community_answers ADD CONSTRAINT community_answers_auto_flag_check CHECK (
      (auto_flag IS NULL OR auto_flag = 'review') AND (auto_flag_reason IS NULL OR char_length(auto_flag_reason) <= 300));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS community_answers_flagged_idx ON public.community_answers (auto_flag) WHERE auto_flag IS NOT NULL;

-- 3. Bites and Well-Dones ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_post_reads (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_post_reads_user_idx ON public.community_post_reads (user_id, read_at DESC);

ALTER TABLE public.community_post_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_post_reads_own ON public.community_post_reads;
CREATE POLICY community_post_reads_own ON public.community_post_reads FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.community_post_reads FROM anon, authenticated;
GRANT SELECT ON public.community_post_reads TO authenticated;

COMMENT ON TABLE public.community_post_reads IS
  'Bites: a Tidbit someone read to the end (STEP 83). Recorded by the app; people see their own.';

CREATE TABLE IF NOT EXISTS public.community_post_ratings (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_post_ratings_user_idx ON public.community_post_ratings (user_id, updated_at DESC);

ALTER TABLE public.community_post_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_post_ratings_own ON public.community_post_ratings;
CREATE POLICY community_post_ratings_own ON public.community_post_ratings FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.community_post_ratings FROM anon, authenticated;
GRANT SELECT ON public.community_post_ratings TO authenticated;

COMMENT ON TABLE public.community_post_ratings IS
  'Well-Dones: a Tidbit someone rated, 1 to 5 (STEP 83). Recorded by the app; never your own Tidbit; people see their own ("Previous Well-Dones").';

CREATE OR REPLACE FUNCTION public.community_post_rating_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_posts p
     WHERE p.id = NEW.post_id AND p.kind = 'tidbit' AND p.status = 'published' AND p.is_deleted = FALSE AND p.author_id <> NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Only someone else''s published Tidbit' USING ERRCODE = 'P0001', HINT = 'not_rateable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.community_post_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p UUID := coalesce(NEW.post_id, OLD.post_id);
BEGIN
  IF TG_TABLE_NAME = 'community_post_ratings' THEN
    UPDATE public.community_posts
       SET well_done_count = (SELECT count(*) FROM public.community_post_ratings r WHERE r.post_id = p),
           well_done_sum = (SELECT coalesce(sum(rating), 0) FROM public.community_post_ratings r WHERE r.post_id = p)
     WHERE id = p;
  ELSIF TG_TABLE_NAME = 'community_post_reads' THEN
    UPDATE public.community_posts SET bite_count = (SELECT count(*) FROM public.community_post_reads r WHERE r.post_id = p) WHERE id = p;
  ELSE
    UPDATE public.community_posts SET item_count = (SELECT count(*) FROM public.community_post_items i WHERE i.post_id = p) WHERE id = p;
  END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.community_post_rating_check() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.community_post_counts() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_community_post_rating_check ON public.community_post_ratings;
CREATE TRIGGER trg_community_post_rating_check
  BEFORE INSERT OR UPDATE ON public.community_post_ratings
  FOR EACH ROW EXECUTE FUNCTION public.community_post_rating_check();
DROP TRIGGER IF EXISTS trg_community_post_rating_counts ON public.community_post_ratings;
CREATE TRIGGER trg_community_post_rating_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.community_post_ratings
  FOR EACH ROW EXECUTE FUNCTION public.community_post_counts();
DROP TRIGGER IF EXISTS trg_community_post_read_counts ON public.community_post_reads;
CREATE TRIGGER trg_community_post_read_counts
  AFTER INSERT OR DELETE ON public.community_post_reads
  FOR EACH ROW EXECUTE FUNCTION public.community_post_counts();

-- 4. Integrated Resources ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_post_items (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('resource', 'product')),
  item_id UUID NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, item_kind, item_id)
);

ALTER TABLE public.community_post_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_post_items_read ON public.community_post_items;
-- Seen with a post you can see (the posts rule applies inside).
CREATE POLICY community_post_items_read ON public.community_post_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id));
REVOKE ALL ON public.community_post_items FROM anon, authenticated;
GRANT SELECT ON public.community_post_items TO anon, authenticated;

COMMENT ON TABLE public.community_post_items IS
  'Integrated Resources: the services and products a Tidbit mentions, shown at its end (STEP 83). Saved by the app.';

DROP TRIGGER IF EXISTS trg_community_post_item_counts ON public.community_post_items;
CREATE TRIGGER trg_community_post_item_counts
  AFTER INSERT OR DELETE ON public.community_post_items
  FOR EACH ROW EXECUTE FUNCTION public.community_post_counts();

-- 5. The community rules ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_rules_acceptances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_rules_acceptances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_rules_acceptances_own ON public.community_rules_acceptances;
CREATE POLICY community_rules_acceptances_own ON public.community_rules_acceptances FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.community_rules_acceptances FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.community_rules_acceptances TO authenticated;

COMMENT ON TABLE public.community_rules_acceptances IS
  'When someone read and agreed to the community rules (STEP 83): shown once, before a first post, answer or rating; again when the rules change (version).';

-- 6. Wait times -----------------------------------------------------------------------------
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS wait_bucket TEXT;
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS wait_stated TEXT,
  ADD COLUMN IF NOT EXISTS wait_stated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wait_reported TEXT,
  ADD COLUMN IF NOT EXISTS wait_reports INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ratings_wait_bucket_check') THEN
    ALTER TABLE public.ratings ADD CONSTRAINT ratings_wait_bucket_check CHECK (
      wait_bucket IS NULL OR wait_bucket IN ('no_wait', 'under_1_month', '1_3_months', '3_6_months', '6_12_months', 'over_1_year'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_wait_check') THEN
    ALTER TABLE public.resources ADD CONSTRAINT resources_wait_check CHECK (
      (wait_stated IS NULL OR wait_stated IN ('no_wait', 'under_1_month', '1_3_months', '3_6_months', '6_12_months', 'over_1_year'))
      AND (wait_reported IS NULL OR wait_reported IN ('no_wait', 'under_1_month', '1_3_months', '3_6_months', '6_12_months', 'over_1_year')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS resources_wait_idx ON public.resources (wait_reported, wait_stated) WHERE wait_reported IS NOT NULL OR wait_stated IS NOT NULL;

COMMENT ON COLUMN public.ratings.wait_bucket IS 'How long the rater waited from first contact to the service starting (optional; STEP 83).';
COMMENT ON COLUMN public.resources.wait_stated IS 'The wait the service itself states, from its Resource Account; wait_stated_at says when (STEP 83).';
COMMENT ON COLUMN public.resources.wait_reported IS 'The middle answer of the last two years'' ratings that said how long they waited; wait_reports how many (STEP 83).';

-- The middle of what raters said, over the last two years.
CREATE OR REPLACE FUNCTION public.resource_wait_from_ratings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r UUID := coalesce(NEW.resource_id, OLD.resource_id);
  order_of TEXT[] := ARRAY['no_wait', 'under_1_month', '1_3_months', '3_6_months', '6_12_months', 'over_1_year'];
  answers INTEGER[];
  n INTEGER;
BEGIN
  SELECT array_agg(array_position(order_of, rt.wait_bucket) ORDER BY array_position(order_of, rt.wait_bucket))
    INTO answers
    FROM public.ratings rt
   WHERE rt.resource_id = r AND rt.wait_bucket IS NOT NULL AND rt.created_at > now() - interval '2 years';
  n := coalesce(array_length(answers, 1), 0);
  UPDATE public.resources
     SET wait_reported = CASE WHEN n = 0 THEN NULL ELSE order_of[answers[(n + 1) / 2]] END,
         wait_reports = n
   WHERE id = r;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.resource_wait_from_ratings() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_resource_wait_from_ratings ON public.ratings;
CREATE TRIGGER trg_resource_wait_from_ratings
  AFTER INSERT OR DELETE OR UPDATE OF wait_bucket ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.resource_wait_from_ratings();

CREATE OR REPLACE FUNCTION public.resource_wait_stated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.wait_stated IS DISTINCT FROM OLD.wait_stated THEN
    NEW.wait_stated_at := CASE WHEN NEW.wait_stated IS NULL THEN NULL ELSE now() END;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.resource_wait_stated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_resource_wait_stated_at ON public.resources;
CREATE TRIGGER trg_resource_wait_stated_at
  BEFORE UPDATE OF wait_stated ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.resource_wait_stated_at();

-- 7. Sponsored listings in more places, paid by the click -------------------------------
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS placements TEXT[] NOT NULL DEFAULT '{search}',
  ADD COLUMN IF NOT EXISTS bid_cents INTEGER,
  ADD COLUMN IF NOT EXISTS budget_cents INTEGER,
  ADD COLUMN IF NOT EXISTS spent_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impressions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotions_placements_check') THEN
    ALTER TABLE public.promotions ADD CONSTRAINT promotions_placements_check CHECK (
      placements <@ ARRAY['search', 'tidbits', 'paths']::TEXT[] AND cardinality(placements) >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotions_money_check') THEN
    ALTER TABLE public.promotions ADD CONSTRAINT promotions_money_check CHECK (
      (bid_cents IS NULL OR bid_cents BETWEEN 5 AND 2000)
      AND (budget_cents IS NULL OR budget_cents BETWEEN 500 AND 1000000)
      AND spent_cents >= 0 AND impressions >= 0 AND clicks >= 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS promotions_checkout_once ON public.promotions (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;

COMMENT ON COLUMN public.promotions.placements IS 'Where it may show: search, tidbits (beside a Tidbit on its topic), paths (one of three suggestions in the app) (STEP 83).';
COMMENT ON COLUMN public.promotions.budget_cents IS 'What the owner paid (Stripe): it stops when spent_cents reaches it. Null: arranged with the team, no budget (STEP 83).';

-- An owner edits their words, places and dates; the money and the counts are the server's.
CREATE OR REPLACE FUNCTION public.promotions_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.budget_cents := NULL; NEW.spent_cents := 0; NEW.impressions := 0; NEW.clicks := 0;
      NEW.paid_at := NULL; NEW.stripe_checkout_session_id := NULL;
    ELSE
      NEW.budget_cents := OLD.budget_cents; NEW.spent_cents := OLD.spent_cents; NEW.impressions := OLD.impressions;
      NEW.clicks := OLD.clicks; NEW.paid_at := OLD.paid_at; NEW.stripe_checkout_session_id := OLD.stripe_checkout_session_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.promotions_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_promotions_guard ON public.promotions;
CREATE TRIGGER trg_promotions_guard
  BEFORE INSERT OR UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.promotions_guard();

CREATE TABLE IF NOT EXISTS public.promotion_events (
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('impression', 'click')),
  viewer_key TEXT NOT NULL CHECK (char_length(viewer_key) BETWEEN 8 AND 128),
  day DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Toronto')::date),
  placement TEXT NOT NULL CHECK (placement IN ('search', 'tidbits', 'paths')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (promotion_id, kind, viewer_key, day)
);

ALTER TABLE public.promotion_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promotion_events FROM anon, authenticated;

COMMENT ON TABLE public.promotion_events IS
  'A sponsored listing seen or clicked, once a day per person (a scrambled key, never who), for its counts and its cost (STEP 83). Written only through promotion_record().';

-- Count a view or a click once a day per person, only for a promotion that is
-- showing, in a place it asked for (a click, only after a view). A click costs the bid, never more than
-- what is left of the budget, and a sponsored listing whose budget is spent ends.
CREATE OR REPLACE FUNCTION public.promotion_record(p_promotion UUID, p_kind TEXT, p_viewer_key TEXT, p_placement TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  added INTEGER;
  pr public.promotions%ROWTYPE;
BEGIN
  SELECT * INTO pr FROM public.promotions WHERE id = p_promotion FOR UPDATE;
  IF NOT FOUND OR pr.status <> 'active' OR NOT (p_placement = ANY (pr.placements)) THEN
    RETURN jsonb_build_object('counted', false);
  END IF;
  -- A click counts only from someone counted seeing it that day.
  IF p_kind = 'click' AND NOT EXISTS (
    SELECT 1 FROM public.promotion_events e
     WHERE e.promotion_id = p_promotion AND e.kind = 'impression' AND e.viewer_key = p_viewer_key
       AND e.day = (now() AT TIME ZONE 'America/Toronto')::date) THEN
    RETURN jsonb_build_object('counted', false);
  END IF;
  INSERT INTO public.promotion_events (promotion_id, kind, viewer_key, placement)
  VALUES (p_promotion, p_kind, p_viewer_key, p_placement)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  IF added = 0 THEN
    RETURN jsonb_build_object('counted', false);
  END IF;
  IF p_kind = 'impression' THEN
    UPDATE public.promotions SET impressions = impressions + 1 WHERE id = p_promotion;
    RETURN jsonb_build_object('counted', true, 'ended', false);
  END IF;
  UPDATE public.promotions
     SET clicks = clicks + 1,
         spent_cents = CASE WHEN budget_cents IS NULL THEN spent_cents + coalesce(bid_cents, 0)
                            ELSE least(budget_cents, spent_cents + coalesce(bid_cents, 0)) END,
         status = CASE WHEN budget_cents IS NOT NULL AND spent_cents + coalesce(bid_cents, 0) >= budget_cents THEN 'ended' ELSE status END
   WHERE id = p_promotion
   RETURNING * INTO pr;
  RETURN jsonb_build_object('counted', true, 'ended', pr.status = 'ended');
END $$;

REVOKE ALL ON FUNCTION public.promotion_record(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promotion_record(UUID, TEXT, TEXT, TEXT) TO service_role;
