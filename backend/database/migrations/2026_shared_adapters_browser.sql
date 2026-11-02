-- =====================================================================
-- Models tuned in the browser can be shared too (STEP 98)
--
-- Build my training set, "Approve and tune my model here", tunes Qwen3 0.6B in the person's own browser (frontend
-- lib/tune/). Its adapter is shared like one tuned on a laptop (Share my model, STEP 96): the same checks, the same two
-- files, with Qwen/Qwen3-0.6B as its base model, and it's used, or tuned further, in the browser (Community models).
-- Only the list of base models changes: STEP 96 allowed the laptop scripts' two.
--
-- Safe to run twice.
-- =====================================================================
BEGIN;

-- STEP 96 wrote the rule inline, so Postgres named it; whatever its name, the rule on base_model goes, then the new one.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.shared_adapters'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) LIKE '%base_model%'
  LOOP
    EXECUTE format('ALTER TABLE public.shared_adapters DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.shared_adapters ADD CONSTRAINT shared_adapters_base_model_check
  CHECK (base_model IN ('mlx-community/Llama-3.2-1B-Instruct-bf16',
                        'mlx-community/Llama-3.2-3B-Instruct-bf16',
                        'Qwen/Qwen3-0.6B'));

COMMENT ON COLUMN public.shared_adapters.base_model IS
  'STEP 98: the model it was tuned from: Llama 3.2 1B or 3B (the laptop scripts), or Qwen3 0.6B (tuned in the browser).';

COMMIT;
