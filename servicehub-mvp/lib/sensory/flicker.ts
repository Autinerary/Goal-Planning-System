/**
 * Detecting light flicker with nothing but the phone camera.
 *
 * Mains-powered lighting does not emit steadily. It pulses at twice the
 * supply frequency, so 100 Hz on a 50 Hz grid and 120 Hz on 60 Hz.
 * Incandescent bulbs smooth this out with thermal inertia; cheap LED
 * and fluorescent fittings often do not, and can swing between full
 * output and nearly nothing on every cycle. That deep, fast pulsing is
 * invisible to conscious sight and is a documented cause of headache,
 * eye strain and fatigue. It is also the thing nobody can tell you
 * about a room before you walk into it.
 *
 * The trick is that a phone camera has a rolling shutter: it exposes
 * one row of the sensor slightly after the row above it. Under a
 * flickering light, rows exposed at the bright part of the cycle come
 * out lighter than rows exposed at the dim part, so the flicker is
 * written into a single still frame as horizontal banding. Reading
 * brightness down the rows recovers the waveform.
 *
 * Because the rows of one frame are read over roughly one frame period,
 * the row index is a time axis sampled at about height * fps, which is
 * tens of kilohertz. That is far above the 100 to 120 Hz being looked
 * for, so there is plenty of headroom.
 *
 * Pure functions over a row-brightness array. No camera needed to test.
 */

export interface FlickerAnalysis {
  /** Detected fundamental, normally 100 or 120. Null if nothing stood out. */
  hz: number | null
  /** Percent modulation: how deep the pulsing is, 0 steady to 100 full on-off. */
  modulationPct: number
  /** 0..1 confidence that this is real flicker and not sensor noise. */
  confidence: number
  /** Mains frequency implied by the detection. */
  mains: 50 | 60 | null
}

/** The only fundamentals worth testing: twice 50 Hz and twice 60 Hz. */
const CANDIDATES: { hz: number; mains: 50 | 60 }[] = [
  { hz: 100, mains: 50 },
  { hz: 120, mains: 60 },
]

/**
 * Magnitude of one frequency in a signal, via Goertzel.
 *
 * Cheaper and clearer than a full FFT when only two frequencies are of
 * interest, which is the case here.
 */
export function goertzel(samples: number[], targetHz: number, sampleRateHz: number): number {
  const n = samples.length
  if (n === 0 || sampleRateHz <= 0) return 0
  const k = (n * targetHz) / sampleRateHz
  const w = (2 * Math.PI * k) / n
  const cosine = Math.cos(w)
  const sine = Math.sin(w)
  const coeff = 2 * cosine

  let q1 = 0
  let q2 = 0
  for (let i = 0; i < n; i++) {
    const q0 = coeff * q1 - q2 + samples[i]
    q2 = q1
    q1 = q0
  }
  const real = q1 - q2 * cosine
  const imag = q2 * sine
  // Normalised so the result does not grow with sample count.
  return (2 * Math.sqrt(real * real + imag * imag)) / n
}

/**
 * Remove the constant level and any smooth top-to-bottom gradient.
 *
 * Lenses are darker at the edges than the centre, and a room is often
 * brighter at the top of frame than the bottom. Both put large low
 * frequency energy into the row signal. Without removing them the
 * detector would happily report flicker in a photograph of a wall.
 */
export function detrend(rowMeans: number[]): number[] {
  const n = rowMeans.length
  if (n < 2) return rowMeans.map(() => 0)
  // Least-squares straight line, subtracted.
  let sx = 0, sy = 0, sxx = 0, sxy = 0
  for (let i = 0; i < n; i++) {
    sx += i; sy += rowMeans[i]; sxx += i * i; sxy += i * rowMeans[i]
  }
  const denom = n * sxx - sx * sx
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  return rowMeans.map((v, i) => v - (slope * i + intercept))
}

/**
 * @param rowMeans   mean brightness of each sensor row, 0..255, top to bottom
 * @param fps        frame rate the row readout is spread across
 */
export function analyseFlicker(rowMeans: number[], fps: number): FlickerAnalysis {
  const none: FlickerAnalysis = { hz: null, modulationPct: 0, confidence: 0, mains: null }
  if (rowMeans.length < 64 || fps <= 0) return none

  // Rows of one frame are read out across roughly one frame period, so
  // the row axis is time sampled at height * fps.
  const rowSampleRate = rowMeans.length * fps

  const signal = detrend(rowMeans)
  // Typical magnitude of the detrended signal, used as the noise floor
  // to judge whether a peak means anything.
  const rms = Math.sqrt(signal.reduce((s, v) => s + v * v, 0) / signal.length)
  if (rms < 0.05) return none // a genuinely flat wall

  let best: { hz: number; mains: 50 | 60; mag: number } | null = null
  for (const c of CANDIDATES) {
    // Nyquist guard: the row rate must comfortably exceed the target.
    if (c.hz * 2.5 > rowSampleRate) continue
    const mag = goertzel(signal, c.hz, rowSampleRate)
    if (!best || mag > best.mag) best = { hz: c.hz, mains: c.mains, mag }
  }
  if (!best) return none

  // A real flicker line stands well clear of the broadband noise.
  const snr = best.mag / rms
  if (snr < 0.35) return none

  // Percent modulation, the standard definition: the swing between the
  // brightest and darkest part of the cycle over their sum.
  const mean = rowMeans.reduce((s, v) => s + v, 0) / rowMeans.length
  const hi = Math.max(...rowMeans)
  const lo = Math.min(...rowMeans)
  const modulationPct = hi + lo > 0 ? ((hi - lo) / (hi + lo)) * 100 : 0

  return {
    hz: best.hz,
    mains: best.mains,
    modulationPct: Math.round(Math.min(100, modulationPct) * 100) / 100,
    confidence: Math.round(Math.min(1, snr) * 100) / 100,
    // mean is deliberately unused in the output: absolute brightness
    // comes from the ambient light sensor, not from an auto-exposed frame.
  }
}

/** Plain description. No judgement; that belongs in profile.ts. */
export function describeFlicker(f: FlickerAnalysis): string {
  if (!f.hz) return 'No flicker detected in the lighting.'
  const depth =
    f.modulationPct >= 50 ? 'strongly' :
    f.modulationPct >= 20 ? 'noticeably' : 'slightly'
  return `Lighting pulses ${depth} at ${f.hz} Hz, which is typical of LED or fluorescent fittings.`
}
