-- STEP 103 — the safety check's counts can say the check ran on the person's own device (backend core/moderation.py:
-- the checker on their own model, for the assistant, the journal and agents on their device; 9 November 2026). Until
-- this, such a line was refused (ai_safety_events.checked_by allowed only 'openai', 'rules' and 'unavailable'), so it
-- wasn't counted. Nothing else changes. Safe to run twice.
BEGIN;

ALTER TABLE public.ai_safety_events DROP CONSTRAINT IF EXISTS ai_safety_events_checked_by_check;
ALTER TABLE public.ai_safety_events ADD CONSTRAINT ai_safety_events_checked_by_check
  CHECK (checked_by IN ('openai', 'device', 'rules', 'unavailable'));

COMMIT;

NOTIFY pgrst, 'reload schema';
