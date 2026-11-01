-- =====================================================================
-- What a person approved for their own training set, and Journal entries saved at last (STEP 95)
--
-- Settings, Models, "Build my training set": a person picks their own journal entries, reflections and plan notes,
-- reads each one scrubbed (names, contact details, addresses, schools, employers, dates of birth and diagnoses
-- replaced with placeholders), and downloads the set to train a small open model on their own laptop. This records
-- that they approved it: which items, when, and which scrubber checked them. Never the text: the set is made in their
-- browser and not kept here (api/routes/training.py).
--
--   item_refs         [{"kind": "reflection" | "note", "id": "<uuid>" or "<uuid>:<n>"}], the items approved
--   item_count        how many
--   scrubber_version  core/scrubber.py's version and what found names, e.g. "2026-10-31.1+en_core_web_sm-3.8.0"
--
-- Written only by the server (service role), after it checks the items are the person's own and the version is the
-- scrubber that runs now. A person reads their own records; nobody changes them. They go with the account and are in
-- the data download.
--
-- And the Journal: on production, reflections.user_id still pointed at public.users, a table from the first schema
-- that nothing writes to (0 rows on 31 October 2026), so every reflection anyone wrote failed to save (the backend
-- logs "persist_reflection skipped" and carries on) and there were 0 reflections. It now points at auth.users, and a
-- person's reflections go with their account. Existing rows aren't re-checked (NOT VALID); there are none.
--
-- Run after STEP 94. Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.training_set_consents (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_refs         JSONB       NOT NULL,
  item_count        INT         NOT NULL CHECK (item_count BETWEEN 1 AND 5000),
  scrubber_version  TEXT        NOT NULL CHECK (length(scrubber_version) BETWEEN 1 AND 120),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ids and kinds only, so no text can be stored here by mistake.
ALTER TABLE public.training_set_consents DROP CONSTRAINT IF EXISTS training_set_consents_refs_shape;
ALTER TABLE public.training_set_consents ADD CONSTRAINT training_set_consents_refs_shape CHECK (
  CASE WHEN jsonb_typeof(item_refs) = 'array'
       THEN jsonb_array_length(item_refs) = item_count
            AND NOT jsonb_path_exists(item_refs, '$[*] ? (@.type() != "object")')
            AND NOT jsonb_path_exists(item_refs, '$[*].keyvalue() ? (@.key != "kind" && @.key != "id")')
            AND NOT jsonb_path_exists(item_refs, '$[*] ? (!exists(@.kind) || !exists(@.id))')
            AND NOT jsonb_path_exists(item_refs, '$[*] ? (!(@.kind == "reflection" || @.kind == "note"))')
            AND NOT jsonb_path_exists(item_refs,
              '$[*] ? (!(@.id like_regex "^[0-9a-fA-F-]{36}(:([0-9]{1,2}|free))?$"))')
       ELSE false END
);

CREATE INDEX IF NOT EXISTS training_set_consents_user_idx
  ON public.training_set_consents (user_id, created_at DESC);

ALTER TABLE public.training_set_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_set_consents_read_own ON public.training_set_consents;
CREATE POLICY training_set_consents_read_own ON public.training_set_consents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Supabase grants new tables to anon and authenticated directly: read-only for the person, nothing for anon.
REVOKE ALL ON public.training_set_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.training_set_consents TO authenticated;
GRANT ALL ON public.training_set_consents TO service_role;

COMMENT ON TABLE public.training_set_consents IS
  'STEP 95: which of their own items a person approved for a training set, when, and with which scrubber. Ids only, never text; written by the server.';

-- ---- The Journal's reflections belong to the account (auth.users), not the first schema's users table ------------

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname FROM pg_constraint con
    WHERE con.conrelid = 'public.reflections'::regclass
      AND con.contype = 'f'
      AND con.confrelid = to_regclass('public.users')
  LOOP
    EXECUTE format('ALTER TABLE public.reflections DROP CONSTRAINT %I', c.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.reflections'::regclass AND conname = 'reflections_user_id_auth_fkey') THEN
    ALTER TABLE public.reflections ADD CONSTRAINT reflections_user_id_auth_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
