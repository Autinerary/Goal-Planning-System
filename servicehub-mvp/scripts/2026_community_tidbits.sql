-- ServiceHub: Tidbits community platform (Reddit x StackOverflow for barriers).
--
-- Fully-functional. No MVP cuts. Owned by ResourceHub (this app) with entry
-- points from goal-planning (Hare World pit-stop + milestone screens).
--
-- Requirements covered
-- ====================
--   * Opt-in community participation (users explicitly enable a community profile)
--   * Pseudonym always — real name never surfaces in community surfaces
--   * Public/private profile + per-field visibility (calendar, tasks, paths, posts)
--   * One-way follow when profile is public
--   * Threaded answers + votes + accepted-answer
--   * MANDATORY "Solved" line on accept: key_insight + tldr (1-3 sentences)
--   * Image uploads via Supabase Storage (existing `resource-images` bucket reused)
--   * Rich-text (markdown) posts + answers
--   * Badges/karma — both automatic (reputation events) and admin-grantable
--   * Admin lock/delete + flag/report queue (resolver workflow)
--   * Barrier tags (free-text) + category tags (enum) so posts are findable
--   * Search-friendly indexes (trigram on title/body, btree on activity)
--
-- Idempotent. Run once in the Supabase SQL editor.

-- pg_trgm is already enabled for the rest of ServiceHub (resources search). Be
-- defensive — CREATE EXTENSION IF NOT EXISTS is a no-op when already present.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- 1. COMMUNITY PROFILE  (one row per user who opts in)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_profiles (
    user_id            UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    pseudonym          TEXT NOT NULL UNIQUE,
    bio                TEXT,
    avatar_url         TEXT,
    is_public          BOOLEAN NOT NULL DEFAULT TRUE,
    -- Per-section visibility, only honored when is_public = TRUE.
    show_posts         BOOLEAN NOT NULL DEFAULT TRUE,
    show_answers      BOOLEAN NOT NULL DEFAULT TRUE,
    show_paths         BOOLEAN NOT NULL DEFAULT FALSE,
    show_tasks         BOOLEAN NOT NULL DEFAULT FALSE,
    show_calendar      BOOLEAN NOT NULL DEFAULT FALSE,
    -- Karma cache: maintained by triggers below. Computing on every read is
    -- too expensive once the platform scales.
    karma              INTEGER NOT NULL DEFAULT 0,
    -- Status flags.
    is_suspended       BOOLEAN NOT NULL DEFAULT FALSE,
    suspended_reason   TEXT,
    suspended_until    TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_profiles_karma_idx
    ON public.community_profiles(karma DESC);
CREATE INDEX IF NOT EXISTS community_profiles_pseudonym_lower_idx
    ON public.community_profiles(lower(pseudonym));

ALTER TABLE public.community_profiles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. POSTS  (the question / problem)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_posts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title              TEXT NOT NULL CHECK (length(title) BETWEEN 8 AND 250),
    body_markdown      TEXT NOT NULL CHECK (length(body_markdown) BETWEEN 20 AND 30000),
    -- Tags: free-text barriers + curated categories. Both arrays so a post
    -- can match multiple search filters.
    barrier_tags       TEXT[] NOT NULL DEFAULT '{}',
    category_tags      TEXT[] NOT NULL DEFAULT '{}',
    -- Image URLs uploaded via the existing /api/community/storage/upload route.
    image_urls         TEXT[] NOT NULL DEFAULT '{}',
    -- Vote / activity cache: maintained by triggers below.
    upvotes            INTEGER NOT NULL DEFAULT 0,
    downvotes          INTEGER NOT NULL DEFAULT 0,
    score              INTEGER GENERATED ALWAYS AS (upvotes - downvotes) STORED,
    answer_count       INTEGER NOT NULL DEFAULT 0,
    view_count         INTEGER NOT NULL DEFAULT 0,
    -- "Solved" workflow: only set when an answer is accepted. Both fields are
    -- mandatory when accepted_answer_id is non-null (enforced via CHECK).
    accepted_answer_id UUID,
    solved_tldr        TEXT CHECK (length(solved_tldr) <= 600),
    solved_key_insight TEXT CHECK (length(solved_key_insight) <= 280),
    -- Admin moderation.
    is_locked          BOOLEAN NOT NULL DEFAULT FALSE,
    locked_reason      TEXT,
    locked_by          UUID REFERENCES public.profiles(id),
    locked_at          TIMESTAMPTZ,
    is_deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by         UUID REFERENCES public.profiles(id),
    deleted_at         TIMESTAMPTZ,
    -- Tracking.
    last_activity_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- "Solved" is all-or-nothing: if accepted, both TLDR + key_insight must
    -- be present and non-empty. This is the requirement from the spec.
    CONSTRAINT community_posts_solved_consistent CHECK (
        accepted_answer_id IS NULL
        OR (
            solved_tldr        IS NOT NULL AND length(trim(solved_tldr))        > 0
            AND solved_key_insight IS NOT NULL AND length(trim(solved_key_insight)) > 0
        )
    )
);

CREATE INDEX IF NOT EXISTS community_posts_author_idx
    ON public.community_posts(author_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_posts_recent_idx
    ON public.community_posts(last_activity_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_posts_top_idx
    ON public.community_posts(score DESC, last_activity_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_posts_unanswered_idx
    ON public.community_posts(created_at DESC) WHERE answer_count = 0 AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_posts_solved_idx
    ON public.community_posts(last_activity_at DESC)
    WHERE accepted_answer_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_posts_barrier_tags_idx
    ON public.community_posts USING GIN(barrier_tags);
CREATE INDEX IF NOT EXISTS community_posts_category_tags_idx
    ON public.community_posts USING GIN(category_tags);
CREATE INDEX IF NOT EXISTS community_posts_title_trgm_idx
    ON public.community_posts USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS community_posts_body_trgm_idx
    ON public.community_posts USING GIN(body_markdown gin_trgm_ops);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. ANSWERS  (threaded — answers can reply to answers)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_answers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    -- Self-referential parent for threaded replies. NULL = top-level answer.
    parent_id       UUID REFERENCES public.community_answers(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body_markdown   TEXT NOT NULL CHECK (length(body_markdown) BETWEEN 10 AND 30000),
    image_urls      TEXT[] NOT NULL DEFAULT '{}',
    upvotes         INTEGER NOT NULL DEFAULT 0,
    downvotes       INTEGER NOT NULL DEFAULT 0,
    score           INTEGER GENERATED ALWAYS AS (upvotes - downvotes) STORED,
    -- Accepted = this answer was chosen as THE solution. There is exactly
    -- one accepted answer per post, enforced via the partial unique index
    -- below + the accepted_answer_id pointer on the post.
    is_accepted     BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_at     TIMESTAMPTZ,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by      UUID REFERENCES public.profiles(id),
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_answers_post_idx
    ON public.community_answers(post_id, created_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_answers_parent_idx
    ON public.community_answers(parent_id, created_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS community_answers_author_idx
    ON public.community_answers(author_id, created_at DESC) WHERE is_deleted = FALSE;
-- Only one accepted answer per post.
CREATE UNIQUE INDEX IF NOT EXISTS community_answers_one_accepted_per_post_idx
    ON public.community_answers(post_id) WHERE is_accepted = TRUE;

ALTER TABLE public.community_answers ENABLE ROW LEVEL SECURITY;

-- Now that community_answers exists, wire the post -> accepted_answer FK.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_accepted_answer_fk'
    ) THEN
        ALTER TABLE public.community_posts
            ADD CONSTRAINT community_posts_accepted_answer_fk
            FOREIGN KEY (accepted_answer_id)
            REFERENCES public.community_answers(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================================================
-- 4. VOTES  (one row per (user, target). target = post OR answer)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_votes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voter_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type  TEXT NOT NULL CHECK (target_type IN ('post', 'answer')),
    target_id    UUID NOT NULL,
    value        SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- A given user has at most one vote per target.
    UNIQUE(voter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS community_votes_target_idx
    ON public.community_votes(target_type, target_id);

ALTER TABLE public.community_votes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. FOLLOWS  (one-way; follower -> followee, both must have profiles)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_follows (
    follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    followee_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS community_follows_follower_idx
    ON public.community_follows(follower_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_follows_followee_idx
    ON public.community_follows(followee_id, created_at DESC);

ALTER TABLE public.community_follows ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. REPORTS  (flag queue for moderation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_reports (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type   TEXT NOT NULL CHECK (target_type IN ('post', 'answer', 'user')),
    target_id     UUID NOT NULL,
    reason        TEXT NOT NULL CHECK (length(reason) BETWEEN 5 AND 1000),
    status        TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'resolved_kept', 'resolved_removed', 'resolved_warned')),
    resolved_by   UUID REFERENCES public.profiles(id),
    resolution_note TEXT,
    resolved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- A user can only report a given target once.
    UNIQUE(reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS community_reports_open_idx
    ON public.community_reports(created_at DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS community_reports_target_idx
    ON public.community_reports(target_type, target_id);

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 7. BADGES  (catalog + grants)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_badges (
    slug          TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT NOT NULL,
    icon          TEXT NOT NULL,
    tier          TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
    -- Threshold-based auto-award. NULL = admin grant only.
    auto_metric   TEXT,                       -- e.g. 'karma', 'posts', 'accepted'
    auto_threshold INTEGER
);

ALTER TABLE public.community_badges ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.community_badge_grants (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_slug    TEXT NOT NULL REFERENCES public.community_badges(slug) ON DELETE CASCADE,
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by    UUID REFERENCES public.profiles(id),  -- NULL = auto-granted
    UNIQUE(user_id, badge_slug)
);

CREATE INDEX IF NOT EXISTS community_badge_grants_user_idx
    ON public.community_badge_grants(user_id, granted_at DESC);

ALTER TABLE public.community_badge_grants ENABLE ROW LEVEL SECURITY;

-- Seed the default badge catalog. Idempotent via ON CONFLICT DO NOTHING.
INSERT INTO public.community_badges (slug, name, description, icon, tier, auto_metric, auto_threshold) VALUES
    ('first_post',      'First Post',      'Posted your first question',          '✍️', 'bronze', 'posts',    1),
    ('helpful',         'Helpful',         'Received 5 upvotes on an answer',     '🙌', 'bronze', 'karma',    25),
    ('problem_solver',  'Problem Solver',  'Had an answer accepted as solved',    '🧩', 'silver', 'accepted', 1),
    ('mentor',          'Mentor',          '10 of your answers were accepted',    '🎓', 'gold',   'accepted', 10),
    ('community_pillar','Community Pillar','Reached 1000 karma',                  '🏛️', 'gold',   'karma',    1000),
    ('streak_starter',  'Streak Starter',  'Posted on 3 consecutive days',        '🔥', 'bronze', NULL,       NULL)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 8. TRIGGER MAINTENANCE  (keep caches in sync without RPC round-trips)
-- =============================================================================

-- 8a. updated_at bump on every UPDATE to community_profiles.
CREATE OR REPLACE FUNCTION public._community_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_profiles_touch ON public.community_profiles;
CREATE TRIGGER community_profiles_touch
BEFORE UPDATE ON public.community_profiles
FOR EACH ROW EXECUTE FUNCTION public._community_touch_updated_at();

DROP TRIGGER IF EXISTS community_posts_touch ON public.community_posts;
CREATE TRIGGER community_posts_touch
BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public._community_touch_updated_at();

DROP TRIGGER IF EXISTS community_answers_touch ON public.community_answers;
CREATE TRIGGER community_answers_touch
BEFORE UPDATE ON public.community_answers
FOR EACH ROW EXECUTE FUNCTION public._community_touch_updated_at();

-- 8b. Vote -> upvote/downvote caches on the target post or answer + karma
-- on the target's author.
CREATE OR REPLACE FUNCTION public._community_apply_vote()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    delta_up   INTEGER := 0;
    delta_down INTEGER := 0;
    delta_karma INTEGER := 0;
    target_author UUID;
BEGIN
    -- Compute deltas for INSERT / UPDATE / DELETE in one place.
    IF TG_OP = 'INSERT' THEN
        IF NEW.value = 1 THEN delta_up := 1; ELSE delta_down := 1; END IF;
        delta_karma := NEW.value;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.value = 1 THEN delta_up := -1; ELSE delta_down := -1; END IF;
        IF NEW.value = 1 THEN delta_up := delta_up + 1; ELSE delta_down := delta_down + 1; END IF;
        delta_karma := NEW.value - OLD.value;
    ELSE  -- DELETE
        IF OLD.value = 1 THEN delta_up := -1; ELSE delta_down := -1; END IF;
        delta_karma := -OLD.value;
    END IF;

    -- Apply to the target. Karma flows to the author of the target.
    IF (COALESCE(NEW.target_type, OLD.target_type)) = 'post' THEN
        UPDATE public.community_posts
           SET upvotes = upvotes + delta_up,
               downvotes = downvotes + delta_down,
               last_activity_at = now()
         WHERE id = COALESCE(NEW.target_id, OLD.target_id)
         RETURNING author_id INTO target_author;
    ELSE
        UPDATE public.community_answers
           SET upvotes = upvotes + delta_up,
               downvotes = downvotes + delta_down
         WHERE id = COALESCE(NEW.target_id, OLD.target_id)
         RETURNING author_id INTO target_author;
        -- Bubble activity up to the parent post.
        UPDATE public.community_posts
           SET last_activity_at = now()
         WHERE id = (
            SELECT post_id FROM public.community_answers
             WHERE id = COALESCE(NEW.target_id, OLD.target_id)
         );
    END IF;

    -- Karma update. Self-votes don't change karma (the voter == author case
    -- still passes through here, so we guard explicitly).
    IF target_author IS NOT NULL
       AND target_author <> COALESCE(NEW.voter_id, OLD.voter_id) THEN
        UPDATE public.community_profiles
           SET karma = karma + delta_karma
         WHERE user_id = target_author;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_votes_apply ON public.community_votes;
CREATE TRIGGER community_votes_apply
AFTER INSERT OR UPDATE OR DELETE ON public.community_votes
FOR EACH ROW EXECUTE FUNCTION public._community_apply_vote();

-- 8c. New answer -> bump answer_count + last_activity_at on the post.
CREATE OR REPLACE FUNCTION public._community_answer_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.community_posts
           SET answer_count = answer_count + 1,
               last_activity_at = now()
         WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
        UPDATE public.community_posts
           SET answer_count = GREATEST(answer_count - 1, 0)
         WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.community_posts
           SET answer_count = GREATEST(answer_count - 1, 0)
         WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS community_answers_count ON public.community_answers;
CREATE TRIGGER community_answers_count
AFTER INSERT OR UPDATE OR DELETE ON public.community_answers
FOR EACH ROW EXECUTE FUNCTION public._community_answer_change();

-- =============================================================================
-- 9. RPCs
-- =============================================================================

-- 9a. Accept an answer atomically. Marks the answer as accepted, clears any
-- prior accepted answer on the same post, sets the post's solved fields,
-- grants the karma bonus to the answer author, and grants the
-- problem_solver badge to both the asker (for accepting) and the answerer.
--
-- Solved metadata is MANDATORY — empty tldr/key_insight returns an error
-- so the spec's "Solved line" requirement can't be bypassed.
CREATE OR REPLACE FUNCTION public.community_accept_answer(
    p_post_id         UUID,
    p_answer_id       UUID,
    p_acting_user_id  UUID,
    p_tldr            TEXT,
    p_key_insight    TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_post_author    UUID;
    v_answer_author  UUID;
    v_answer_post_id UUID;
    v_is_admin       BOOLEAN;
BEGIN
    -- Validate solved metadata up front.
    IF p_tldr IS NULL OR length(trim(p_tldr)) = 0 THEN
        RAISE EXCEPTION 'Solved TLDR is required';
    END IF;
    IF p_key_insight IS NULL OR length(trim(p_key_insight)) = 0 THEN
        RAISE EXCEPTION 'Solved key insight is required';
    END IF;

    -- Load post + answer in a way that locks them for the duration of the txn.
    SELECT author_id INTO v_post_author
      FROM public.community_posts
     WHERE id = p_post_id AND is_deleted = FALSE
     FOR UPDATE;
    IF v_post_author IS NULL THEN
        RAISE EXCEPTION 'Post not found or deleted';
    END IF;

    SELECT author_id, post_id INTO v_answer_author, v_answer_post_id
      FROM public.community_answers
     WHERE id = p_answer_id AND is_deleted = FALSE
     FOR UPDATE;
    IF v_answer_author IS NULL OR v_answer_post_id <> p_post_id THEN
        RAISE EXCEPTION 'Answer not found, deleted, or does not belong to the post';
    END IF;

    -- Permission: post author OR admin.
    SELECT (role = 'admin') INTO v_is_admin
      FROM public.profiles WHERE id = p_acting_user_id;
    IF v_post_author <> p_acting_user_id AND COALESCE(v_is_admin, FALSE) = FALSE THEN
        RAISE EXCEPTION 'Only the post author or an admin can accept an answer';
    END IF;

    -- Clear any previously accepted answer on this post.
    UPDATE public.community_answers
       SET is_accepted = FALSE,
           accepted_at = NULL
     WHERE post_id = p_post_id AND is_accepted = TRUE AND id <> p_answer_id;

    -- Accept the new answer.
    UPDATE public.community_answers
       SET is_accepted = TRUE,
           accepted_at = now()
     WHERE id = p_answer_id;

    -- Stamp the post.
    UPDATE public.community_posts
       SET accepted_answer_id = p_answer_id,
           solved_tldr        = p_tldr,
           solved_key_insight = p_key_insight,
           last_activity_at   = now()
     WHERE id = p_post_id;

    -- Karma bonus for an accepted answer (StackOverflow convention: +15).
    IF v_answer_author <> v_post_author THEN
        UPDATE public.community_profiles
           SET karma = karma + 15
         WHERE user_id = v_answer_author;
    END IF;

    -- Auto-grant the problem_solver badge to the answerer (idempotent).
    INSERT INTO public.community_badge_grants (user_id, badge_slug, granted_by)
    VALUES (v_answer_author, 'problem_solver', NULL)
    ON CONFLICT (user_id, badge_slug) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.community_accept_answer(UUID, UUID, UUID, TEXT, TEXT) TO authenticated, service_role;

-- 9b. Cast or change a vote. Self-votes return without effect.
CREATE OR REPLACE FUNCTION public.community_cast_vote(
    p_voter_id     UUID,
    p_target_type  TEXT,
    p_target_id    UUID,
    p_value        SMALLINT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_author UUID;
BEGIN
    IF p_value NOT IN (-1, 0, 1) THEN
        RAISE EXCEPTION 'Vote value must be -1, 0, or 1';
    END IF;

    -- Identify the target author so we can block self-votes early.
    IF p_target_type = 'post' THEN
        SELECT author_id INTO v_target_author
          FROM public.community_posts WHERE id = p_target_id;
    ELSIF p_target_type = 'answer' THEN
        SELECT author_id INTO v_target_author
          FROM public.community_answers WHERE id = p_target_id;
    ELSE
        RAISE EXCEPTION 'Invalid target_type %', p_target_type;
    END IF;
    IF v_target_author IS NULL THEN
        RAISE EXCEPTION 'Vote target not found';
    END IF;
    IF v_target_author = p_voter_id THEN
        -- Silent no-op: self-votes are a UX dead-end, not an error.
        RETURN;
    END IF;

    -- Upsert: 0 = retract the vote, +/-1 = set it.
    IF p_value = 0 THEN
        DELETE FROM public.community_votes
         WHERE voter_id = p_voter_id
           AND target_type = p_target_type
           AND target_id = p_target_id;
    ELSE
        INSERT INTO public.community_votes (voter_id, target_type, target_id, value)
        VALUES (p_voter_id, p_target_type, p_target_id, p_value)
        ON CONFLICT (voter_id, target_type, target_id)
        DO UPDATE SET value = EXCLUDED.value, created_at = now();
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.community_cast_vote(UUID, TEXT, UUID, SMALLINT) TO authenticated, service_role;

-- 9c. Award badges whose threshold has been crossed. Called after big events
-- (post created, answer accepted, karma change). Cheap re-runs are fine.
CREATE OR REPLACE FUNCTION public.community_award_threshold_badges(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_karma     INTEGER;
    v_posts     INTEGER;
    v_accepted  INTEGER;
    v_awarded   INTEGER := 0;
    v_badge     RECORD;
BEGIN
    SELECT karma INTO v_karma FROM public.community_profiles WHERE user_id = p_user_id;
    IF v_karma IS NULL THEN
        RETURN 0;
    END IF;
    SELECT COUNT(*) INTO v_posts FROM public.community_posts
     WHERE author_id = p_user_id AND is_deleted = FALSE;
    SELECT COUNT(*) INTO v_accepted FROM public.community_answers
     WHERE author_id = p_user_id AND is_accepted = TRUE AND is_deleted = FALSE;

    FOR v_badge IN
        SELECT slug, auto_metric, auto_threshold
          FROM public.community_badges
         WHERE auto_metric IS NOT NULL
           AND auto_threshold IS NOT NULL
    LOOP
        IF (v_badge.auto_metric = 'karma'    AND v_karma    >= v_badge.auto_threshold)
        OR (v_badge.auto_metric = 'posts'    AND v_posts    >= v_badge.auto_threshold)
        OR (v_badge.auto_metric = 'accepted' AND v_accepted >= v_badge.auto_threshold)
        THEN
            INSERT INTO public.community_badge_grants (user_id, badge_slug, granted_by)
            VALUES (p_user_id, v_badge.slug, NULL)
            ON CONFLICT (user_id, badge_slug) DO NOTHING;
            IF FOUND THEN
                v_awarded := v_awarded + 1;
            END IF;
        END IF;
    END LOOP;
    RETURN v_awarded;
END;
$$;

GRANT EXECUTE ON FUNCTION public.community_award_threshold_badges(UUID) TO authenticated, service_role;

-- =============================================================================
-- 10. RLS policies
--
-- Anonymous users can read public surfaces (feed + non-deleted posts/answers).
-- Authenticated users can read all and write their own. Service-role bypasses
-- RLS as always.
-- =============================================================================

-- Posts: anyone can SELECT non-deleted; only the author can UPDATE/DELETE
-- their own. Admin operations go through SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS community_posts_select  ON public.community_posts;
CREATE POLICY community_posts_select  ON public.community_posts
    FOR SELECT USING (is_deleted = FALSE);

DROP POLICY IF EXISTS community_posts_insert  ON public.community_posts;
CREATE POLICY community_posts_insert  ON public.community_posts
    FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS community_posts_update  ON public.community_posts;
CREATE POLICY community_posts_update  ON public.community_posts
    FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- Answers — same shape as posts.
DROP POLICY IF EXISTS community_answers_select  ON public.community_answers;
CREATE POLICY community_answers_select  ON public.community_answers
    FOR SELECT USING (is_deleted = FALSE);

DROP POLICY IF EXISTS community_answers_insert  ON public.community_answers;
CREATE POLICY community_answers_insert  ON public.community_answers
    FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS community_answers_update  ON public.community_answers;
CREATE POLICY community_answers_update  ON public.community_answers
    FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- Votes: a user reads + writes their own only.
DROP POLICY IF EXISTS community_votes_owner  ON public.community_votes;
CREATE POLICY community_votes_owner  ON public.community_votes
    FOR ALL USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);

-- Follows: public who-follows-whom; only the follower can write their own row.
DROP POLICY IF EXISTS community_follows_select  ON public.community_follows;
CREATE POLICY community_follows_select  ON public.community_follows
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS community_follows_write  ON public.community_follows;
CREATE POLICY community_follows_write  ON public.community_follows
    FOR ALL USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

-- Profiles: anyone reads public profiles; the owner reads/writes their own.
DROP POLICY IF EXISTS community_profiles_select  ON public.community_profiles;
CREATE POLICY community_profiles_select  ON public.community_profiles
    FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);

DROP POLICY IF EXISTS community_profiles_owner  ON public.community_profiles;
CREATE POLICY community_profiles_owner  ON public.community_profiles
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reports: only the reporter sees their own report; service-role / admin
-- routes use the admin client (which bypasses RLS) for the moderation queue.
DROP POLICY IF EXISTS community_reports_owner  ON public.community_reports;
CREATE POLICY community_reports_owner  ON public.community_reports
    FOR ALL USING (auth.uid() = reporter_id) WITH CHECK (auth.uid() = reporter_id);

-- Badges + grants: world-readable.
DROP POLICY IF EXISTS community_badges_read  ON public.community_badges;
CREATE POLICY community_badges_read  ON public.community_badges
    FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS community_badge_grants_read  ON public.community_badge_grants;
CREATE POLICY community_badge_grants_read  ON public.community_badge_grants
    FOR SELECT USING (TRUE);

COMMENT ON TABLE public.community_profiles IS
    'Opt-in community identity layer. Pseudonym always shown — never real name. Per-section visibility honored when is_public = TRUE.';
COMMENT ON TABLE public.community_posts IS
    'Tidbits posts (questions/problems). solved_tldr + solved_key_insight are mandatory when accepted_answer_id is set.';
COMMENT ON TABLE public.community_answers IS
    'Threaded answers. Self-referential parent_id allows replies-to-replies. Exactly one accepted answer per post.';
COMMENT ON FUNCTION public.community_accept_answer(UUID, UUID, UUID, TEXT, TEXT) IS
    'Atomically accept an answer + set the post-level Solved line (TLDR + key insight). Rejects empty solved metadata.';
