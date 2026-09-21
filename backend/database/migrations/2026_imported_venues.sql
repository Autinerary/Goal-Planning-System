-- =====================================================================
-- Imported venues: provenance, de-duplication and freshness
--
-- ResourceHub can be seeded from open data rather than typed in by
-- hand. Three things have to be true before that is safe.
--
-- 1. Provenance. Every imported row has to say where it came from and
--    carry the credit its licence requires. OpenStreetMap is ODbL,
--    which means attribution is a condition of use, not a courtesy.
--
-- 2. De-duplication. An import that runs twice must not double the
--    directory, so the external identifier is unique.
--
-- 3. Freshness. This matters more here than in most products. Someone
--    plans a trip around a service, travels there, and finds it closed.
--    For the people this is built for that is not a minor annoyance, it
--    is a wasted day and a bad one. So an imported row records when it
--    was last confirmed against its source, and the interface can go
--    quiet about anything stale instead of pretending to know.
--
-- What is deliberately NOT imported: anything about how accessible or
-- autism-friendly a place is. A survey of 286 real venues in central
-- Toronto found names on 97% of them, wheelchair tags on 16%, and
-- hearing loops, quiet rooms or autism tags on none at all. That data
-- does not exist to import. Inventing it from an amenity type would be
-- fabrication of exactly the kind this product exists to replace, so
-- imported venues arrive as a place with an address and nothing more.
-- What it is like inside comes from ratings and sensory scans.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- Widen source_type to cover open data. The previous list only had
-- social and news origins, because until now everything came from a
-- person posting a link.
ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_source_type_check;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_source_type_check
    CHECK (source_type IS NULL OR source_type IN (
      'news',
      'reddit', 'twitter', 'facebook',
      'youtube', 'tiktok', 'instagram',
      'tidbits',
      'openstreetmap', 'open_data', 'operator',
      'other'
    ));

ALTER TABLE public.resources
  -- Stable identifier at the source, e.g. 'osm:node/1234567'. Distinct
  -- from source_url because a site can reorganise its URLs without the
  -- underlying record changing identity.
  ADD COLUMN IF NOT EXISTS source_ref TEXT,
  -- The credit line the licence obliges us to display.
  ADD COLUMN IF NOT EXISTS source_attribution TEXT,
  -- Last time this row was confirmed to still match its source.
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.resources.source_ref IS
  'Stable identifier at the origin, e.g. osm:node/1234567. Unique, so re-running an import updates rather than duplicates.';
COMMENT ON COLUMN public.resources.source_attribution IS
  'Credit line required by the source licence. ODbL makes this a condition of use, not a courtesy.';
COMMENT ON COLUMN public.resources.last_verified_at IS
  'When this row was last confirmed against its source. Someone travelling to a service that closed is a wasted day, so the UI goes quiet on stale rows rather than pretending to know.';

-- One row per external record. This is what makes re-import idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS resources_source_ref_key
  ON public.resources (source_ref) WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS resources_last_verified_idx
  ON public.resources (last_verified_at) WHERE last_verified_at IS NOT NULL;
