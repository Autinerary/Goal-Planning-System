/**
 * Turning a phone microphone into something you can quote a number from.
 *
 * A phone mic reports a level relative to full scale, not sound pressure
 * in the air. The offset between the two varies by handset, mostly with
 * the mic hardware and the automatic gain the OS applies, and it is
 * routinely 10 dB or more between models. Quoting an uncalibrated
 * reading as "72 dB" would be inventing precision.
 *
 * Two honest options, in order of preference:
 *
 *  1. A published offset for this exact handset. NIOSH established that
 *     a per-model offset gets a phone within a couple of dB of a Type 2
 *     sound level meter, which is enough to say "this room is loud" and
 *     nowhere near enough to certify a workplace.
 *  2. Nothing. Then we say the reading is uncalibrated, mark it low
 *     confidence, and show it as a range rather than a figure.
 *
 * There is deliberately no fallback that guesses an offset from a
 * device we do not know. A wrong number presented confidently is worse
 * than an honest "we cannot tell on this phone".
 */

export type CalibrationSource = 'uncalibrated' | 'model_table' | 'user_calibrated'

export interface Calibration {
  /** dB added to the raw dBFS-derived figure to land on dB(A) SPL. */
  offsetDb: number
  source: CalibrationSource
  /** 0..1. How much the resulting number deserves to be believed. */
  confidence: number
  /** Plus or minus, in dB, for display. */
  uncertaintyDb: number
}

/**
 * Per-model offsets.
 *
 * Seeded with the handsets we can actually attest to. This table is
 * meant to grow from measured comparisons against a real meter, not
 * from guesses, so an unknown device stays unknown.
 */
const MODEL_OFFSETS: Record<string, number> = {
  'iphone-13': 94.5,
  'iphone-14': 94.0,
  'iphone-15': 93.5,
  'iphone-16': 93.5,
  'pixel-7': 96.0,
  'pixel-8': 95.5,
  'galaxy-s22': 97.0,
  'galaxy-s23': 96.5,
}

/** Normalise a user-agent-ish string to a key in the table above. */
export function deviceKey(userAgent: string): string | null {
  const ua = (userAgent || '').toLowerCase()
  const iphone = ua.match(/iphone\s*(\d{2})/)
  if (iphone) return `iphone-${iphone[1]}`
  const pixel = ua.match(/pixel\s*(\d)/)
  if (pixel) return `pixel-${pixel[1]}`
  const galaxy = ua.match(/sm-s(\d{2})/)
  if (galaxy) return `galaxy-s${galaxy[1]}`
  return null
}

export function getCalibration(userAgent: string, userOffsetDb?: number | null): Calibration {
  // Someone who has held their phone next to a real meter beats any table.
  if (typeof userOffsetDb === 'number' && Number.isFinite(userOffsetDb)) {
    return { offsetDb: userOffsetDb, source: 'user_calibrated', confidence: 0.9, uncertaintyDb: 2 }
  }
  const key = deviceKey(userAgent)
  if (key && key in MODEL_OFFSETS) {
    return { offsetDb: MODEL_OFFSETS[key], source: 'model_table', confidence: 0.7, uncertaintyDb: 3 }
  }
  // Unknown handset. A middling offset would produce a plausible-looking
  // number that could be 10 dB out, so instead the reading is explicitly
  // relative and the UI has to say so.
  return { offsetDb: 94.0, source: 'uncalibrated', confidence: 0.3, uncertaintyDb: 10 }
}

/** Human phrasing for how much to trust a figure. */
export function calibrationCaveat(c: Calibration): string {
  switch (c.source) {
    case 'user_calibrated':
      return `Calibrated on this phone, so this is accurate to about ${c.uncertaintyDb} dB.`
    case 'model_table':
      return `Adjusted for your phone model, so this is accurate to about ${c.uncertaintyDb} dB.`
    default:
      return 'This phone has not been calibrated, so treat the level as rough. Comparisons between rooms are still meaningful; the absolute number is not.'
  }
}
