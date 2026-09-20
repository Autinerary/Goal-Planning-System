-- =====================================================================
-- Sensory scans: measured conditions at a physical venue
--
-- A phone already carries the sensors needed to measure the two parts
-- of sensory load that are objectively measurable: sound and light.
-- Everything here is DERIVED. No audio, no video and no image is ever
-- stored or transmitted; there is deliberately nowhere to put one. The
-- capture runs in the browser, produces a handful of numbers, and the
-- numbers are what travels.
--
-- The design point that matters: there is no "autism-friendly score"
-- column, and there must never be one. Sensory need is bidirectional.
-- One autistic person is hypersensitive to sound and another is
-- hyposensitive and seeks it out, so a low reading is good for one and
-- bad for the other. A single score would be confidently wrong for a
-- large share of users. Measurements are stored raw and interpreted
-- per person against their own profile at read time.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- -------------------------------------------------------------------
-- 1. What a person finds hard, so measurements can be interpreted
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sensory_profile (
  user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 'hyper' finds it too much, 'hypo' seeks more of it, 'neutral' unbothered.
  sound_sensitivity       TEXT NOT NULL DEFAULT 'neutral'
                            CHECK (sound_sensitivity IN ('hyper','neutral','hypo')),
  -- Separate from level, because unpredictability is its own problem.
  sudden_noise_difficulty BOOLEAN NOT NULL DEFAULT false,
  comfortable_db_max      SMALLINT CHECK (comfortable_db_max BETWEEN 30 AND 120),
  comfortable_db_min      SMALLINT CHECK (comfortable_db_min BETWEEN 0 AND 90),

  -- Nobody seeks out flicker, so this one is not bidirectional.
  flicker_sensitivity     TEXT NOT NULL DEFAULT 'neutral'
                            CHECK (flicker_sensitivity IN ('hyper','neutral')),
  brightness_sensitivity  TEXT NOT NULL DEFAULT 'neutral'
                            CHECK (brightness_sensitivity IN ('hyper','neutral','hypo')),
  comfortable_lux_max     INTEGER CHECK (comfortable_lux_max BETWEEN 10 AND 100000),
  comfortable_lux_min     INTEGER CHECK (comfortable_lux_min BETWEEN 0 AND 10000),

  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sensible_db_range  CHECK (comfortable_db_min  IS NULL OR comfortable_db_max  IS NULL
                                       OR comfortable_db_min  < comfortable_db_max),
  CONSTRAINT sensible_lux_range CHECK (comfortable_lux_min IS NULL OR comfortable_lux_max IS NULL
                                       OR comfortable_lux_min < comfortable_lux_max)
);

COMMENT ON TABLE public.user_sensory_profile IS
  'How one person experiences sound and light. Used to interpret venue_scans for them. Never aggregated across users.';

-- -------------------------------------------------------------------
-- 2. One scan of one venue at one moment
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venue_scans (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id               UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Local wall-clock at the venue. A cafe at 08:00 and the same cafe at
  -- 13:00 are different places, so every reading is filed by when it was
  -- taken rather than averaged into one meaningless figure.
  local_hour                SMALLINT NOT NULL CHECK (local_hour BETWEEN 0 AND 23),
  day_of_week               SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  duration_seconds          SMALLINT NOT NULL CHECK (duration_seconds BETWEEN 5 AND 300),

  -- ---- Sound. Null when the scan was light-only. ----
  -- Percentile levels are the standard way to describe a soundscape:
  -- L90 is the floor you always hear, L10 is the level the loud moments
  -- reach. The gap between them is how spiky the room is, and the gap
  -- predicts distress better than the average does.
  sound_median_db           NUMERIC(5,2) CHECK (sound_median_db BETWEEN 0 AND 140),
  sound_l10_db              NUMERIC(5,2) CHECK (sound_l10_db    BETWEEN 0 AND 140),
  sound_l90_db              NUMERIC(5,2) CHECK (sound_l90_db    BETWEEN 0 AND 140),
  sound_peak_db             NUMERIC(5,2) CHECK (sound_peak_db   BETWEEN 0 AND 140),
  -- Sudden loud events per minute, and how abruptly sound arrives.
  sound_peak_events_per_min NUMERIC(6,2) CHECK (sound_peak_events_per_min >= 0),
  sound_onset_rate          NUMERIC(6,2) CHECK (sound_onset_rate >= 0),

  -- ---- Light. Null when the scan was sound-only. ----
  light_lux                 NUMERIC(9,2) CHECK (light_lux >= 0),
  -- Mains lighting flickers at 100 or 120 Hz. Modulation depth is how
  -- deep the dip is; shallow flicker is usually unnoticed, deep flicker
  -- is what causes headache and fatigue.
  flicker_hz                NUMERIC(6,2) CHECK (flicker_hz >= 0),
  flicker_modulation_pct    NUMERIC(5,2) CHECK (flicker_modulation_pct BETWEEN 0 AND 100),
  light_kelvin              INTEGER CHECK (light_kelvin BETWEEN 1000 AND 20000),

  -- ---- How much to trust this reading ----
  device_model              TEXT,
  calibration_offset_db     NUMERIC(5,2) NOT NULL DEFAULT 0,
  calibration_source        TEXT NOT NULL DEFAULT 'uncalibrated'
                              CHECK (calibration_source IN ('uncalibrated','model_table','user_calibrated')),
  confidence                NUMERIC(3,2) NOT NULL DEFAULT 0.5
                              CHECK (confidence BETWEEN 0 AND 1),
  notes                     TEXT CHECK (notes IS NULL OR length(notes) <= 500),

  -- A scan that measured nothing is not a scan.
  CONSTRAINT scan_measured_something CHECK (
    sound_median_db IS NOT NULL OR light_lux IS NOT NULL OR flicker_hz IS NOT NULL
  )
);

COMMENT ON TABLE public.venue_scans IS
  'Derived sound and light measurements for a venue. No raw audio, video or images are stored here or anywhere else; capture is on-device and only these numbers leave it.';

CREATE INDEX IF NOT EXISTS venue_scans_resource_idx
  ON public.venue_scans (resource_id, local_hour);
CREATE INDEX IF NOT EXISTS venue_scans_user_idx
  ON public.venue_scans (user_id, scanned_at DESC);

-- One person should not be able to flood a venue's average by standing
-- there scanning. At most one scan per person per venue per hour block.
-- date_trunc over a timestamptz is only STABLE, because the answer
-- depends on the session timezone, and an index expression has to be
-- IMMUTABLE. Pinning to UTC first yields a plain timestamp, which is.
CREATE UNIQUE INDEX IF NOT EXISTS venue_scans_one_per_hour
  ON public.venue_scans (resource_id, user_id, (date_trunc('hour', scanned_at AT TIME ZONE 'UTC')));

-- -------------------------------------------------------------------
-- 3. Row-level security
--
-- Scans are a shared public good: anyone can read them, because the
-- point is that other people benefit from your reading. But a sensory
-- profile is health-adjacent information about one person and is
-- readable only by them.
-- -------------------------------------------------------------------
ALTER TABLE public.venue_scans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sensory_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venue_scans_select_all ON public.venue_scans;
CREATE POLICY venue_scans_select_all
  ON public.venue_scans FOR SELECT USING (true);

DROP POLICY IF EXISTS venue_scans_insert_own ON public.venue_scans;
CREATE POLICY venue_scans_insert_own
  ON public.venue_scans FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS venue_scans_update_own ON public.venue_scans;
CREATE POLICY venue_scans_update_own
  ON public.venue_scans FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS venue_scans_delete_own ON public.venue_scans;
CREATE POLICY venue_scans_delete_own
  ON public.venue_scans FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS sensory_profile_own ON public.user_sensory_profile;
CREATE POLICY sensory_profile_own
  ON public.user_sensory_profile FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------------------
-- 4. Venue summary, bucketed by time of day
--
-- Returns one row per part of the day that actually has readings. The
-- scan_count travels with every row on purpose: the caller must be able
-- to say "from 2 scans" rather than presenting two readings with the
-- same confidence as fifty.
-- -------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_venue_sensory(UUID);
CREATE OR REPLACE FUNCTION public.get_venue_sensory(resource_id_in UUID)
RETURNS TABLE (
  time_bucket            TEXT,
  scan_count             INT,
  median_db              NUMERIC,
  l10_db                 NUMERIC,
  l90_db                 NUMERIC,
  peak_db                NUMERIC,
  peak_events_per_min    NUMERIC,
  onset_rate             NUMERIC,
  lux                    NUMERIC,
  flicker_hz             NUMERIC,
  flicker_modulation_pct NUMERIC,
  kelvin                 NUMERIC,
  last_scanned_at        TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN vs.local_hour >= 6  AND vs.local_hour < 11 THEN 'morning'
      WHEN vs.local_hour >= 11 AND vs.local_hour < 14 THEN 'midday'
      WHEN vs.local_hour >= 14 AND vs.local_hour < 17 THEN 'afternoon'
      WHEN vs.local_hour >= 17 AND vs.local_hour < 22 THEN 'evening'
      ELSE 'night'
    END                                                        AS time_bucket,
    COUNT(*)::INT                                              AS scan_count,
    -- Medians, not means: one passing motorbike should not redefine a cafe.
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.sound_median_db::DOUBLE PRECISION)::NUMERIC           AS median_db,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.sound_l10_db::DOUBLE PRECISION)::NUMERIC              AS l10_db,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.sound_l90_db::DOUBLE PRECISION)::NUMERIC              AS l90_db,
    MAX(vs.sound_peak_db)                                                     AS peak_db,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.sound_peak_events_per_min::DOUBLE PRECISION)::NUMERIC AS peak_events_per_min,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.sound_onset_rate::DOUBLE PRECISION)::NUMERIC          AS onset_rate,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.light_lux::DOUBLE PRECISION)::NUMERIC                 AS lux,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.flicker_hz::DOUBLE PRECISION)::NUMERIC                AS flicker_hz,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.flicker_modulation_pct::DOUBLE PRECISION)::NUMERIC    AS flicker_modulation_pct,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY vs.light_kelvin::DOUBLE PRECISION)::NUMERIC     AS kelvin,
    MAX(vs.scanned_at)                                                        AS last_scanned_at
  FROM public.venue_scans vs
  WHERE vs.resource_id = resource_id_in
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.get_venue_sensory(UUID) IS
  'Per-time-of-day sensory summary for one venue. Medians rather than means so a single passing lorry does not redefine the room. scan_count is returned so callers can disclose how thin the evidence is.';
