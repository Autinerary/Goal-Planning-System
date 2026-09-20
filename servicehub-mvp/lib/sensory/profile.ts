/**
 * Turning measurements into something true for one particular person.
 *
 * This is the part that decides whether the whole feature is honest.
 *
 * The obvious product is a single number: "Autism friendly: 8/10".
 * It would demo well and it would be wrong. Sensory need runs in both
 * directions. One autistic person is hypersensitive to sound and finds
 * a busy room unbearable; another is hyposensitive, finds a silent room
 * uncomfortable, and seeks noise out. A low reading is good news for
 * the first and bad news for the second. Averaging them produces a
 * number that is confidently wrong for a large share of the people
 * relying on it, and the people relying on it are exactly the people
 * least well served by a confident wrong answer.
 *
 * So nothing here returns a score. It returns measured facts, each
 * paired with the reason it might matter to the person reading, drawn
 * from what they themselves told us. If they have told us nothing, it
 * says so and reports the measurements plainly rather than guessing
 * what they would want.
 */

import type { SoundAnalysis } from './audio'
import type { FlickerAnalysis } from './flicker'
import type { Calibration } from './calibration'

export interface SensoryProfile {
  soundSensitivity: 'hyper' | 'neutral' | 'hypo'
  suddenNoiseDifficulty: boolean
  comfortableDbMax: number | null
  comfortableDbMin: number | null
  flickerSensitivity: 'hyper' | 'neutral'
  brightnessSensitivity: 'hyper' | 'neutral' | 'hypo'
  comfortableLuxMax: number | null
  comfortableLuxMin: number | null
}

export interface SensoryFinding {
  sense: 'sound' | 'light'
  /** Against THIS person's profile, not in general. */
  fit: 'hard' | 'good' | 'unknown'
  /** The measurement, stated plainly and without judgement. */
  fact: string
  /** Why it matters to them, in terms of what they told us. */
  because: string
}

export interface SensoryReadout {
  findings: SensoryFinding[]
  /** True when we have no profile, so nothing could be personalised. */
  personalised: boolean
  /** One honest sentence. Never a score. */
  summary: string
  /** How much the underlying numbers deserve to be trusted. */
  caveat: string | null
}

/** Sensible defaults for levels, used only when the person gave none. */
const LOUD_DB = 75
const VERY_LOUD_DB = 85
const QUIET_DB = 45
/** Below roughly this depth, flicker is generally not consciously noticed. */
const NOTICEABLE_FLICKER_PCT = 20
const BRIGHT_LUX = 1000
const DIM_LUX = 100

export function buildReadout(
  sound: SoundAnalysis | null,
  flicker: FlickerAnalysis | null,
  lux: number | null,
  profile: SensoryProfile | null,
  calibration?: Calibration | null,
): SensoryReadout {
  const findings: SensoryFinding[] = []
  const p = profile

  // ---------------- Sound level ----------------
  if (sound) {
    const level = Math.round(sound.medianDb)
    const fact = `Around ${level} dB most of the time.`

    if (!p) {
      findings.push({ sense: 'sound', fit: 'unknown', fact,
        because: 'Tell us how you find noise and we can say whether that suits you.' })
    } else if (p.soundSensitivity === 'hypo') {
      // The direction almost every product forgets.
      const floor = p.comfortableDbMin ?? QUIET_DB
      if (level < floor) {
        findings.push({ sense: 'sound', fit: 'hard', fact,
          because: 'You said you find very quiet places uncomfortable, and this is quieter than that.' })
      } else {
        findings.push({ sense: 'sound', fit: 'good', fact,
          because: 'You said you prefer some background noise, and there is some here.' })
      }
    } else if (p.soundSensitivity === 'hyper') {
      const ceiling = p.comfortableDbMax ?? LOUD_DB
      if (level > ceiling) {
        findings.push({ sense: 'sound', fit: 'hard', fact,
          because: `You said noise is hard for you above about ${ceiling} dB.` })
      } else {
        findings.push({ sense: 'sound', fit: 'good', fact,
          because: `That is within the ${ceiling} dB you said you are comfortable with.` })
      }
    } else {
      findings.push({ sense: 'sound', fit: level > VERY_LOUD_DB ? 'hard' : 'good', fact,
        because: level > VERY_LOUD_DB
          ? 'That is loud enough that most people find it tiring over time.'
          : 'That is within a range most people find manageable.' })
    }

    // ---------------- Sudden noise, judged separately ----------------
    // Deliberately its own finding. Someone can be fine with a loud
    // steady room and floored by a quiet one that bangs, and a single
    // level reading hides exactly that difference.
    if (sound.peakAboveMedianDb >= 15 && sound.peakEventsPerMin >= 0.5) {
      const howOften = sound.peakEventsPerMin >= 2 ? 'several times a minute' : 'every minute or two'
      const peakFact = `Sudden noises reach about ${Math.round(sound.peakDb)} dB, ${howOften}.`
      if (!p) {
        findings.push({ sense: 'sound', fit: 'unknown', fact: peakFact,
          because: 'Tell us whether sudden noise is hard for you and we can flag this.' })
      } else if (p.suddenNoiseDifficulty) {
        findings.push({ sense: 'sound', fit: 'hard', fact: peakFact,
          because: 'You said sudden noise is hard for you, and this room is unpredictable.' })
      } else {
        findings.push({ sense: 'sound', fit: 'good', fact: peakFact,
          because: 'You did not flag sudden noise as a problem, so this may not bother you.' })
      }
    }
  }

  // ---------------- Flicker ----------------
  if (flicker?.hz) {
    const noticeable = flicker.modulationPct >= NOTICEABLE_FLICKER_PCT
    const fact = `Lighting pulses at ${flicker.hz} Hz, ${
      flicker.modulationPct >= 50 ? 'deeply' : noticeable ? 'noticeably' : 'only slightly'
    }.`
    if (!p) {
      findings.push({ sense: 'light', fit: 'unknown', fact,
        because: 'Tell us whether strip or LED lighting bothers you and we can flag this.' })
    } else if (p.flickerSensitivity === 'hyper' && noticeable) {
      findings.push({ sense: 'light', fit: 'hard', fact,
        because: 'You said flickering light gives you headaches or tires you out.' })
    } else if (p.flickerSensitivity === 'hyper') {
      findings.push({ sense: 'light', fit: 'good', fact,
        because: 'It is shallow enough that it is usually not noticed, even by people who react to flicker.' })
    }
  }

  // ---------------- Brightness ----------------
  if (typeof lux === 'number' && Number.isFinite(lux)) {
    // Describe the level against THIS person's thresholds where we have
    // them. Calling 800 lux "moderately lit" and then saying it is too
    // bright for you in the next breath reads as the app contradicting
    // itself, even though both halves were true.
    const brightAt = p?.comfortableLuxMax ?? BRIGHT_LUX
    const dimAt = p?.comfortableLuxMin ?? DIM_LUX
    const fact = `About ${Math.round(lux)} lux, ${
      lux >= brightAt ? 'bright' : lux <= dimAt ? 'dim' : 'moderately lit'
    }.`
    if (!p) {
      findings.push({ sense: 'light', fit: 'unknown', fact,
        because: 'Tell us how you find bright or dim spaces and we can say whether this suits you.' })
    } else if (p.brightnessSensitivity === 'hyper' && lux > (p.comfortableLuxMax ?? BRIGHT_LUX)) {
      findings.push({ sense: 'light', fit: 'hard', fact,
        because: 'You said bright light is hard for you.' })
    } else if (p.brightnessSensitivity === 'hypo' && lux < (p.comfortableLuxMin ?? DIM_LUX)) {
      findings.push({ sense: 'light', fit: 'hard', fact,
        because: 'You said dim spaces are hard for you to be in.' })
    } else {
      findings.push({ sense: 'light', fit: 'good', fact,
        because: 'That is within what you said works for you.' })
    }
  }

  const hard = findings.filter((f) => f.fit === 'hard').length
  const unknown = findings.filter((f) => f.fit === 'unknown').length

  let summary: string
  if (findings.length === 0) {
    summary = 'Nothing was measured here yet.'
  } else if (!p) {
    summary = 'Here is what was measured. Fill in how you experience sound and light and this becomes specific to you.'
  } else if (hard === 0) {
    summary = 'Nothing measured here matches what you told us you find difficult.'
  } else {
    summary = `${hard} ${hard === 1 ? 'thing' : 'things'} here may be difficult for you, based on what you told us.`
  }

  return {
    findings,
    personalised: Boolean(p) && unknown === 0,
    summary,
    caveat: calibration && calibration.source === 'uncalibrated' && sound
      ? 'Sound levels on this phone are uncalibrated, so treat the decibel figures as rough. Comparisons between places are still meaningful.'
      : null,
  }
}
