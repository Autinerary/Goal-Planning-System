/**
 * The sounds for Bites and Well-Dones (the Tidbits round's planning note,
 * Goal 3: "Find & implement sound for Bites ... for Well-Dones"). Made in the
 * browser (Web Audio): a short, soft crunch for a Bite and two gentle notes
 * for a Well-Done, nothing downloaded and nothing to license. Quiet, and only
 * when someone turned "Sounds in Tidbits" on (ResourceHub's accessibility
 * settings, data-sounds on <html>): a sudden sound can be a lot.
 */
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || document.documentElement.dataset.sounds !== 'on') return null
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = ctx || new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** A Bite: a soft crunch, about a tenth of a second of filtered noise. */
export function playBite() {
  const a = audio()
  if (!a) return
  const length = Math.floor(a.sampleRate * 0.12)
  const buffer = a.createBuffer(1, length, a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2)
  const source = a.createBufferSource()
  source.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1800
  filter.Q.value = 0.8
  const gain = a.createGain()
  gain.gain.value = 0.2
  source.connect(filter).connect(gain).connect(a.destination)
  source.start()
}

/** A Well-Done: two soft notes, rising. */
export function playWellDone() {
  const a = audio()
  if (!a) return
  const now = a.currentTime
  ;[659.25, 880].forEach((freq, i) => {
    const osc = a.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const gain = a.createGain()
    const t = now + i * 0.13
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    osc.connect(gain).connect(a.destination)
    osc.start(t)
    osc.stop(t + 0.4)
  })
}
