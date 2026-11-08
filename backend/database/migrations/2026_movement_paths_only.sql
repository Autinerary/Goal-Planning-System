-- STEP 100 — the order of pages opened keeps addresses only (the compliance checklist, November 2026: "No unnecessary
-- data"). profiles.movement (app/api/me/movement) kept each page's whole address, so what followed a "?" or "#" came
-- along: what someone searched, and the codes in links that work without signing in (a check-in, stopping an email).
-- The app now keeps the address only, and saves the log only once someone allows counting (lib/consent.ts); this
-- takes the rest off the logs already saved, keeping each visit's address, label and time. Nothing else changes.
--
-- The column is not made by an earlier STEP (it was added by hand on the live database), so this does nothing where
-- it doesn't exist. Safe to run twice.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'movement'
  ) THEN
    RAISE NOTICE 'profiles.movement does not exist here: nothing to do';
    RETURN;
  END IF;

  EXECUTE $sql$
    UPDATE public.profiles p
    SET movement = jsonb_set(
      p.movement,
      '{visits}',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'path', split_part(split_part(v ->> 'path', '?', 1), '#', 1),
            'label', COALESCE(v ->> 'label', ''),
            'at', COALESCE(v ->> 'at', '')
          ) ORDER BY t.ord)
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(p.movement -> 'visits') = 'array' THEN p.movement -> 'visits' ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS t(v, ord)
        WHERE jsonb_typeof(v) = 'object' AND jsonb_typeof(v -> 'path') = 'string'
      ), '[]'::jsonb)
    )
    WHERE jsonb_typeof(p.movement) = 'object'
      AND jsonb_typeof(p.movement -> 'visits') = 'array'
  $sql$;
END $$;
