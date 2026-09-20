/**
 * Describing a room's sound from a short recording.
 *
 * The naive measure is an average level, and it is close to useless
 * here. A steady 75 dB hum in a busy cafe is tolerable for most people.
 * A room that sits at 60 dB but is punctuated every half minute by a
 * 95 dB coffee grinder is the one people leave. The average of the
 * second room can be lower than the first.
 *
 * So this computes the shape of the soundscape rather than its
 * loudness:
 *
 *   L90  the level exceeded 90% of the time. The floor you always hear.
 *   L50  the median. What the room mostly sounds like.
 *   L10  the level exceeded 10% of the time. Where the loud moments sit.
 *   L10 - L90  how spiky the room is. This is the number that matters.
 *   peak events  how often it jumps well above its own median.
 *   onset rate   how abruptly sound arrives, which is what makes a
 *                noise startling rather than merely loud.
 *
 * Percentile levels are the standard descriptors in environmental
 * acoustics, so these are comparable with how noise is actually
 * surveyed rather than being invented for this app.
 *
 * Pure functions over a frame array. Nothing here touches a microphone,
 * so all of it is testable without one.
 */

import type { Calibration } from './calibration'

/** One analysis window. `rms` is linear amplitude, 0..1. */
export interface AudioFrame {
  /** Milliseconds since capture began. */
  t: number
  /** Root-mean-square amplitude of the window, linear. */
  rms: number
}

export interface SoundAnalysis {
  medianDb: number
  l10Db: number
  l90Db: number
  peakDb: number
  /**
   * L10 minus L90: how much the room varies from moment to moment while
   * you sit in it. Sustained variation only.
   */
  variabilityDb: number
  /**
   * Peak minus median: how far the worst moments go above normal.
   *
   * This is the one that catches a quiet room with a coffee grinder.
   * L10 minus L90 does NOT: if the grinder runs 3% of the time, it
   * never reaches the 10% exceedance level, and the variability reads
   * as zero for the room people actually walk out of.
   */
  peakAboveMedianDb: number
  /** Events exceeding the median by PEAK_THRESHOLD_DB, per minute. */
  peakEventsPerMin: number
  /** Abrupt level rises per minute. */
  onsetRate: number
  frameCount: number
  durationSeconds: number
}

/** A jump this far above the room's own median counts as an event. */
const PEAK_THRESHOLD_DB = 12
/** A rise this fast between adjacent frames counts as an onset. */
const ONSET_THRESHOLD_DB = 8
/** Below this, treat as digital silence rather than taking log of zero. */
const FLOOR_RMS = 1e-7

/** Linear RMS to dB relative to full scale. */
export function rmsToDbfs(rms: number): number {
  return 20 * Math.log10(Math.max(rms, FLOOR_RMS))
}

/**
 * Level exceeded p% of the time, the convention in acoustics. L90 is a
 * quiet level and L10 is a loud one, so the percentile is inverted
 * relative to a plain statistical percentile.
 */
export function exceedanceLevel(sortedAsc: number[], percentExceeded: number): number {
  if (sortedAsc.length === 0) return Number.NaN
  const idx = (1 - percentExceeded / 100) * (sortedAsc.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedAsc[lo]
  // Linear interpolation, so a short capture does not quantise hard.
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo)
}

export function analyseSound(frames: AudioFrame[], calibration: Calibration): SoundAnalysis | null {
  if (frames.length < 8) return null

  const dbfs = frames.map((f) => rmsToDbfs(f.rms))
  const spl = dbfs.map((d) => d + calibration.offsetDb)
  const sorted = [...spl].sort((a, b) => a - b)

  const l90 = exceedanceLevel(sorted, 90)
  const l50 = exceedanceLevel(sorted, 50)
  const l10 = exceedanceLevel(sorted, 10)
  const peak = sorted[sorted.length - 1]

  const durationSeconds = Math.max(
    (frames[frames.length - 1].t - frames[0].t) / 1000,
    // A single-frame duration floor, so a very short capture cannot
    // divide by zero and report an infinite event rate.
    frames.length / 1000,
  )
  const minutes = durationSeconds / 60

  // Count excursions, not frames. A grinder running for three seconds is
  // one event a person notices, not sixty.
  let peakEvents = 0
  let inEvent = false
  for (const level of spl) {
    const over = level > l50 + PEAK_THRESHOLD_DB
    if (over && !inEvent) peakEvents += 1
    inEvent = over
  }

  let onsets = 0
  for (let i = 1; i < spl.length; i++) {
    if (spl[i] - spl[i - 1] >= ONSET_THRESHOLD_DB) onsets += 1
  }

  const round = (n: number) => Math.round(n * 100) / 100
  return {
    medianDb: round(l50),
    l10Db: round(l10),
    l90Db: round(l90),
    peakDb: round(peak),
    variabilityDb: round(l10 - l90),
    peakAboveMedianDb: round(peak - l50),
    peakEventsPerMin: round(minutes > 0 ? peakEvents / minutes : 0),
    onsetRate: round(minutes > 0 ? onsets / minutes : 0),
    frameCount: frames.length,
    durationSeconds: round(durationSeconds),
  }
}

/**
 * Plain description of the soundscape, with no judgement attached.
 *
 * Deliberately not "good" or "bad". Whether a spiky room is a problem
 * depends entirely on who is reading, and that comparison happens in
 * profile.ts against their own answers.
 */
export function describeSound(a: SoundAnalysis): string {
  // Judged on how far the worst moments go above normal, not on L10
  // minus L90. A room that is quiet except for a grinder has almost no
  // L10-L90 spread and is still the room people leave.
  const spiky =
    a.peakAboveMedianDb >= 25 ? 'with loud interruptions' :
    a.peakAboveMedianDb >= 15 ? 'with noticeable interruptions' :
    a.variabilityDb >= 10     ? 'up and down' : 'steady'
  const events =
    a.peakEventsPerMin >= 2   ? 'several a minute' :
    a.peakEventsPerMin >= 0.5 ? 'now and then' : 'rarely'
  const base = `Around ${Math.round(a.medianDb)} dB, ${spiky}`
  return a.peakAboveMedianDb >= 15
    ? `${base}, happening ${events}.`
    : `${base}.`
}
