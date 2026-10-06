-- =====================================================================
-- Stories people share, and the weekly email (STEP 52)
--
-- Riipen Labs, Group 11 recommended "lived-experience testimonials ...
-- shared with consent" and "a value-led newsletter ... and a soft email ask
-- after the preview: 'Want these saved and emailed to you?' Never a hard
-- email wall."
--
-- public.stories: a story someone chose to share, with the consent choices
-- from docs/beta/testimonials.md. The team shortens it if needed
-- (final_text) and sets status 'awaiting_approval'; the person approves that
-- exact text in the app (/share-your-story); the team then sets 'published'
-- and it can appear on the home page. The person can withdraw it at any
-- time. Deleting the account deletes their stories.
--
-- public.newsletter_subscribers: people who asked, without an account, for
-- the weekly email and/or their Start here list by email. Nothing is sent
-- until they confirm from the email itself (double opt-in), so a typed-in
-- address can never be signed up by someone else; the token in each link
-- confirms or unsubscribes. ip_hash is a salted hash, only for limiting
-- sign-ups from one place; it cannot be turned back into an address.
--
-- Both are read and written only by the app's server (service role), which
-- checks who is asking; RLS is on with no policies.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.stories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story         TEXT        NOT NULL CHECK (length(story) BETWEEN 20 AND 1500),
  -- Written here; audio or video is recorded with the team afterwards.
  format        TEXT        NOT NULL DEFAULT 'text' CHECK (format IN ('text', 'audio', 'video')),
  role          TEXT        CHECK (role IN ('self', 'parent', 'sibling', 'family', 'professional', 'ally', 'other')),
  show_role     BOOLEAN     NOT NULL DEFAULT false,
  province      TEXT        CHECK (length(province) <= 40),
  show_province BOOLEAN     NOT NULL DEFAULT false,
  display_name  TEXT        CHECK (length(display_name) <= 40),
  name_display  TEXT        NOT NULL DEFAULT 'none' CHECK (name_display IN ('first_name', 'initials', 'none')),
  share_site    BOOLEAN     NOT NULL DEFAULT true,
  share_social  BOOLEAN     NOT NULL DEFAULT false,
  adult         BOOLEAN     NOT NULL CHECK (adult),
  status        TEXT        NOT NULL DEFAULT 'submitted'
                CHECK (status IN ('submitted', 'awaiting_approval', 'approved', 'published', 'declined', 'withdrawn')),
  -- The version the person approves and the site shows (the team may shorten it).
  final_text    TEXT        CHECK (length(final_text) <= 1500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at   TIMESTAMPTZ,
  approved_at   TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  withdrawn_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stories_user_idx ON public.stories (user_id);
CREATE INDEX IF NOT EXISTS stories_status_idx ON public.stories (status, published_at DESC);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.stories IS
  'Stories people chose to share, with their consent choices (docs/beta/testimonials.md). Service role only.';

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  email_key       TEXT        NOT NULL UNIQUE CHECK (email_key = lower(email)),
  -- Their Start here answers, for what the emails pick (lib/startHere.ts).
  role            TEXT        CHECK (length(role) <= 20),
  need            TEXT        CHECK (length(need) <= 20),
  weekly          BOOLEAN     NOT NULL DEFAULT false,
  send_list       BOOLEAN     NOT NULL DEFAULT false,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  token           TEXT        NOT NULL UNIQUE CHECK (length(token) >= 32),
  consent_text    TEXT        NOT NULL CHECK (length(consent_text) <= 500),
  ip_hash         TEXT        CHECK (length(ip_hash) <= 64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirm_sent_at TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  list_sent_at    TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  last_sent_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS newsletter_status_idx ON public.newsletter_subscribers (status, weekly);
CREATE INDEX IF NOT EXISTS newsletter_ip_idx ON public.newsletter_subscribers (ip_hash, created_at);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.newsletter_subscribers IS
  'Weekly email and emailed Start here lists, double opt-in (app/api/newsletter). Service role only.';
