-- =====================================================================
-- Shared starter models (STEP 96)
--
-- Settings, Models, "Share my model": someone who tuned a small open model on their own laptop, from their own
-- scrubbed writing (STEP 95), can share the adapter the training made (a small add-on, a few MB) for others in their
-- community to start from and tune a little with their own writing. Nothing about the owner is public: not their id,
-- not their writing, and the files' folder is named after the adapter, never the person.
--
--   shared_adapters              one per shared adapter
--     owner_id                   who shared it; readable by nobody but the server
--     title, description         what the owner wrote about it, checked for personal information before it's public
--     community_tags             from a fixed list (autism, adhd, ..., caregivers, students, work; core/community_tags.py)
--     base_model                 the model it was tuned from: Llama 3.2 1B or 3B (the scripts' models)
--     file_path                  its folder in Storage, shared-adapters/<id>/: adapters.safetensors, adapter_config.json
--     scrubber_version           the scrubber that checked its training set (STEP 95)
--     consent_id                 that training set's approval (training_set_consents)
--     moderation_status          pending (not public), approved (public), rejected, or removed by a moderator
--     moderation_checks          what each check found: the scrub review, the memory check (run on the owner's computer
--                                and reported by them), the description check, the crowd its tags point to, who it's
--                                shared with, what it was built on, the files. Never any text
--     visibility                 who can see it, the owner's choice: everyone (listed in Community models), people (only
--                                those the owner picked from their connections) or link (anyone with its private link)
--     link_token                 the private link's key, for visibility 'link' only; readable by nobody but the server
--     built_on                   the shared model it was tuned from, so Community models shows which came from which:
--                                a graph of models, never of people
--   shared_adapter_access        the people an owner shared an adapter with (visibility 'people')
--   shared_adapter_ratings       1 to 5 stars, one per person per adapter
--
-- Shared with everyone, an approved adapter is public, and then only its title, description, tags, base model, what it
-- was built on and dates. Shared with people, only they see it; by link, only through the server with its key. Only
-- the owner can edit theirs (title, description, tags), and an edit takes it out of view until it's checked again;
-- only the server sets the moderation status and who can see it. Reports go to ResourceHub's moderation queue
-- (community_reports, target 'adapter'), where Remove takes it down. Written by the server (service role); switched
-- on by SHARED_ADAPTERS=on.
-- Run after STEP 95. Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.shared_adapters (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title              TEXT        NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 80),
  description        TEXT        NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  community_tags     TEXT[]      NOT NULL DEFAULT '{}' CHECK (
                       cardinality(community_tags) <= 6
                       AND community_tags <@ ARRAY['autism', 'adhd', 'dyspraxia', 'tourette', 'dyslexia',
                                                   'learning-disability', 'anxiety', 'depression', 'ocd',
                                                   'mental-health', 'sensory-processing', 'vision', 'hearing',
                                                   'communication', 'intellectual-disability', 'chronic-illness',
                                                   'physical-disability', 'low-income', 'newcomer', 'rural',
                                                   'lgbtq', 'racialized', 'caregivers', 'students', 'work']::TEXT[]),
  base_model         TEXT        NOT NULL CHECK (base_model IN ('mlx-community/Llama-3.2-1B-Instruct-bf16',
                                                                'mlx-community/Llama-3.2-3B-Instruct-bf16')),
  file_path          TEXT        NOT NULL,
  scrubber_version   TEXT        NOT NULL CHECK (length(scrubber_version) BETWEEN 1 AND 120),
  consent_id         UUID        REFERENCES public.training_set_consents(id) ON DELETE SET NULL,
  moderation_status  TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'removed')),
  moderation_checks  JSONB       NOT NULL DEFAULT '{}'::JSONB,
  visibility         TEXT        NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'people', 'link')),
  link_token         TEXT        UNIQUE CHECK (link_token IS NULL OR link_token ~ '^[A-Za-z0-9_-]{24,64}$'),
  built_on           UUID        REFERENCES public.shared_adapters(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The folder is the adapter's own id, so a download link never carries the owner's.
  CONSTRAINT shared_adapters_file_path_is_id CHECK (file_path = id::TEXT),
  CONSTRAINT shared_adapters_link_only_for_links CHECK ((visibility = 'link') = (link_token IS NOT NULL)),
  CONSTRAINT shared_adapters_not_built_on_itself CHECK (built_on IS DISTINCT FROM id)
);

-- The people an owner shared an adapter with (visibility 'people'), from their connections; set by the server.
CREATE TABLE IF NOT EXISTS public.shared_adapter_access (
  adapter_id  UUID        NOT NULL REFERENCES public.shared_adapters(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (adapter_id, user_id)
);
CREATE INDEX IF NOT EXISTS shared_adapter_access_user_idx ON public.shared_adapter_access (user_id);

CREATE INDEX IF NOT EXISTS shared_adapters_public_idx
  ON public.shared_adapters (created_at DESC) WHERE moderation_status = 'approved' AND visibility = 'everyone';
CREATE INDEX IF NOT EXISTS shared_adapters_built_on_idx ON public.shared_adapters (built_on) WHERE built_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS shared_adapters_owner_idx ON public.shared_adapters (owner_id, created_at DESC);

-- The owner edits only what they wrote, and that takes the adapter out of public view until the server checks it
-- again. The server (and a moderator's resolve, which runs as the function's owner) set the status.
CREATE OR REPLACE FUNCTION public.shared_adapters_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.title IS DISTINCT FROM OLD.title
          OR NEW.description IS DISTINCT FROM OLD.description
          OR NEW.community_tags IS DISTINCT FROM OLD.community_tags)
     AND OLD.moderation_status = 'approved' THEN
    NEW.moderation_status := 'pending';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS shared_adapters_on_update ON public.shared_adapters;
CREATE TRIGGER shared_adapters_on_update
  BEFORE UPDATE ON public.shared_adapters
  FOR EACH ROW EXECUTE FUNCTION public.shared_adapters_on_update();

ALTER TABLE public.shared_adapters ENABLE ROW LEVEL SECURITY;

-- Anyone: approved adapters shared with everyone. Someone signed in: those, the ones shared with them, and their own in
-- any state (and every one, for an admin, for the moderation queue). One shared by link only through the server, with
-- its key. is_admin() is for signed-in people only, so it isn't in anon's policy.
DROP POLICY IF EXISTS shared_adapters_read_approved ON public.shared_adapters;
CREATE POLICY shared_adapters_read_approved ON public.shared_adapters
  FOR SELECT TO anon
  USING (moderation_status = 'approved' AND visibility = 'everyone');

DROP POLICY IF EXISTS shared_adapters_read ON public.shared_adapters;
CREATE POLICY shared_adapters_read ON public.shared_adapters
  FOR SELECT TO authenticated
  USING ((moderation_status = 'approved'
          AND (visibility = 'everyone'
               OR (visibility = 'people' AND EXISTS (SELECT 1 FROM public.shared_adapter_access s
                                                     WHERE s.adapter_id = shared_adapters.id AND s.user_id = auth.uid()))))
         OR owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS shared_adapters_owner_update ON public.shared_adapters;
CREATE POLICY shared_adapters_owner_update ON public.shared_adapters
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS shared_adapters_owner_delete ON public.shared_adapters;
CREATE POLICY shared_adapters_owner_delete ON public.shared_adapters
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Supabase grants new tables to anon and authenticated directly. The public columns only: never the owner, the
-- folder, the approval, the checks or the link's key; the owner may change only what they wrote; only the server adds
-- one or changes who can see it.
REVOKE ALL ON public.shared_adapters FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, title, description, community_tags, base_model, scrubber_version, moderation_status, visibility,
              built_on, created_at, updated_at)
  ON public.shared_adapters TO anon, authenticated;
GRANT UPDATE (title, description, community_tags) ON public.shared_adapters TO authenticated;
GRANT DELETE ON public.shared_adapters TO authenticated;
GRANT ALL ON public.shared_adapters TO service_role;

COMMENT ON TABLE public.shared_adapters IS
  'STEP 96: adapters people shared for their community to start from, with everyone, with people they picked, or by private link. Never who shared one.';

-- A person sees which adapters were shared with them; who else an adapter was shared with, only the server knows.
ALTER TABLE public.shared_adapter_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shared_adapter_access_own_read ON public.shared_adapter_access;
CREATE POLICY shared_adapter_access_own_read ON public.shared_adapter_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
REVOKE ALL ON public.shared_adapter_access FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shared_adapter_access TO authenticated;
GRANT ALL ON public.shared_adapter_access TO service_role;

-- ---- Ratings ----------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shared_adapter_ratings (
  adapter_id  UUID        NOT NULL REFERENCES public.shared_adapters(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (adapter_id, user_id)
);

ALTER TABLE public.shared_adapter_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shared_adapter_ratings_own_read ON public.shared_adapter_ratings;
CREATE POLICY shared_adapter_ratings_own_read ON public.shared_adapter_ratings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.shared_adapter_ratings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shared_adapter_ratings TO authenticated;
GRANT ALL ON public.shared_adapter_ratings TO service_role;

-- ---- Reports go to ResourceHub's moderation queue ------------------------------------------------------------------

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.community_reports'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.community_reports DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.community_reports ADD CONSTRAINT community_reports_target_type_check
  CHECK (target_type IN ('post', 'answer', 'user', 'adapter'));

-- The same as before, with Remove taking a reported adapter down too.
CREATE OR REPLACE FUNCTION public.community_resolve_report(
  p_report_id     UUID,
  p_status        TEXT,
  p_note          TEXT DEFAULT NULL,
  p_remove_target BOOLEAN DEFAULT FALSE,
  p_lock_post     BOOLEAN DEFAULT FALSE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_report public.community_reports%ROWTYPE;
BEGIN
  IF v_caller IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('resolved_kept', 'resolved_removed', 'resolved_warned') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_report FROM public.community_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_report.status <> 'open' THEN
    RAISE EXCEPTION 'Report already resolved' USING ERRCODE = '55000';
  END IF;

  IF p_remove_target AND v_report.target_type = 'post' THEN
    UPDATE public.community_posts
       SET is_deleted = TRUE, deleted_by = v_caller, deleted_at = now()
     WHERE id = v_report.target_id AND is_deleted = FALSE;
  ELSIF p_remove_target AND v_report.target_type = 'answer' THEN
    UPDATE public.community_answers
       SET is_deleted = TRUE, deleted_by = v_caller, deleted_at = now()
     WHERE id = v_report.target_id AND is_deleted = FALSE;
  ELSIF p_remove_target AND v_report.target_type = 'adapter' THEN
    UPDATE public.shared_adapters
       SET moderation_status = 'removed'
     WHERE id = v_report.target_id AND moderation_status <> 'removed';
  END IF;
  IF p_lock_post AND v_report.target_type = 'post' THEN
    UPDATE public.community_posts
       SET is_locked = TRUE, locked_reason = left(p_note, 500), locked_by = v_caller, locked_at = now()
     WHERE id = v_report.target_id;
  END IF;

  UPDATE public.community_reports
     SET status = p_status, resolved_by = v_caller, resolved_at = now(),
         resolution_note = left(p_note, 1000)
   WHERE id = p_report_id;
END
$$;

REVOKE ALL ON FUNCTION public.community_resolve_report(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_resolve_report(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;

-- ---- Storage: private; files go up and come down only through links the server signs -------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shared-adapters', 'shared-adapters', FALSE, 104857600, ARRAY['application/octet-stream', 'application/json'])
ON CONFLICT (id) DO UPDATE
   SET public = FALSE,
       file_size_limit = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;
