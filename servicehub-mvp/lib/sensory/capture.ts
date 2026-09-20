'use client'

/**
 * Getting the numbers off the phone's sensors.
 *
 * The one rule this file exists to enforce: nothing that could
 * reconstruct the room leaves the device. The microphone stream is
 * reduced to a level every 100 ms and the audio itself is never
 * buffered, never written down and never uploaded. The camera frame is
 * reduced to a column of row-brightness values inside a canvas and the
 * image is discarded in the same tick. What gets sent is a dozen
 * numbers.
 *
 * That is not only a privacy nicety. Recording audio in a public place
 * engages two-party consent law in plenty of jurisdictions, and a
 * product for this audience cannot be the one that quietly records
 * cafes. Deriving on-device and discarding is what makes the feature
 * lawful as well as decent.
 */

import type { AudioFrame } from './audio'

/** How often the level is sampled. 100 ms is fine enough to catch a door slam. */
const FRAME_MS = 100

export interface SoundCaptureResult {
  frames: AudioFrame[]
  /** True if the browser honoured our request to disable gain processing. */
  processingDisabled: boolean
}

/**
 * Listen for a fixed period and return a level track.
 *
 * Automatic gain control, noise suppression and echo cancellation are
 * all explicitly disabled. They exist to make speech sound good and
 * they are catastrophic for measurement: AGC alone will quietly pull a
 * loud room down and push a quiet one up until every venue reads the
 * same. Where a browser refuses to turn them off, the result says so
 * and the reading is downgraded rather than being passed off as sound.
 */
export async function captureSound(
  durationMs: number,
  onProgress?: (elapsedMs: number, currentRms: number) => void,
  signal?: AbortSignal,
): Promise<SoundCaptureResult> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  })

  const track = stream.getAudioTracks()[0]
  const settings = track.getSettings() as MediaTrackSettings & {
    autoGainControl?: boolean
    noiseSuppression?: boolean
    echoCancellation?: boolean
  }
  const processingDisabled =
    settings.autoGainControl !== true &&
    settings.noiseSuppression !== true &&
    settings.echoCancellation !== true

  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  // No smoothing: smoothing is a low-pass filter on exactly the
  // transients we are here to count.
  analyser.smoothingTimeConstant = 0
  source.connect(analyser)

  const buf = new Float32Array(analyser.fftSize)
  const frames: AudioFrame[] = []
  const started = performance.now()

  const cleanup = () => {
    try { source.disconnect() } catch { /* already torn down */ }
    // Stopping every track is what actually turns the mic indicator off.
    for (const t of stream.getTracks()) t.stop()
    void ctx.close()
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => { clearInterval(timer); reject(new DOMException('Aborted', 'AbortError')) }
      const timer = setInterval(() => {
        const elapsed = performance.now() - started
        analyser.getFloatTimeDomainData(buf)

        let sumSquares = 0
        for (let i = 0; i < buf.length; i++) sumSquares += buf[i] * buf[i]
        const rms = Math.sqrt(sumSquares / buf.length)

        frames.push({ t: elapsed, rms })
        onProgress?.(elapsed, rms)

        if (elapsed >= durationMs) {
          clearInterval(timer)
          signal?.removeEventListener('abort', onAbort)
          resolve()
        }
      }, FRAME_MS)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  } finally {
    cleanup()
  }

  return { frames, processingDisabled }
}

/**
 * Reduce one video frame to the mean brightness of each row.
 *
 * This is the whole of the flicker measurement: the rolling shutter has
 * already encoded the light's waveform as horizontal banding, so the
 * column of row averages IS the waveform. The frame is drawn to an
 * offscreen canvas, averaged, and dropped. It is never uploaded and
 * never shown.
 */
export function frameToRowMeans(video: HTMLVideoElement, maxRows = 1080): number[] | null {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return null

  // Sampling a narrow central strip: the banding runs all the way
  // across, so a full-width read costs time and adds nothing, and a
  // narrow strip is far less likely to contain a recognisable face.
  const stripWidth = Math.min(64, w)
  const sx = Math.floor((w - stripWidth) / 2)

  const canvas = document.createElement('canvas')
  canvas.width = stripWidth
  canvas.height = Math.min(h, maxRows)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.drawImage(video, sx, 0, stripWidth, h, 0, 0, stripWidth, canvas.height)
  const { data } = ctx.getImageData(0, 0, stripWidth, canvas.height)

  const rows: number[] = new Array(canvas.height)
  for (let y = 0; y < canvas.height; y++) {
    let sum = 0
    for (let x = 0; x < stripWidth; x++) {
      const i = (y * stripWidth + x) * 4
      // Rec. 601 luma. Green carries most perceived brightness.
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
    rows[y] = sum / stripWidth
  }
  // Canvas goes out of scope here; the pixels are gone.
  return rows
}

/**
 * Ambient illuminance in lux.
 *
 * AmbientLightSensor is the only way to get this honestly, and it is
 * available on very few browsers. There is a tempting alternative of
 * inferring brightness from an auto-exposed camera frame, which does
 * not work: auto-exposure is specifically designed to make every scene
 * average to mid-grey, so the frame tells you what the camera did, not
 * how bright the room is.
 *
 * So this returns null rather than a number we would have made up.
 */
export async function readAmbientLux(timeoutMs = 1500): Promise<number | null> {
  const Sensor = (window as any).AmbientLightSensor
  if (typeof Sensor !== 'function') return null
  try {
    return await new Promise<number | null>((resolve) => {
      const sensor = new Sensor({ frequency: 5 })
      const done = (v: number | null) => {
        try { sensor.stop() } catch { /* already stopped */ }
        resolve(v)
      }
      const timer = setTimeout(() => done(null), timeoutMs)
      sensor.onreading = () => { clearTimeout(timer); done(sensor.illuminance ?? null) }
      sensor.onerror = () => { clearTimeout(timer); done(null) }
      sensor.start()
    })
  } catch {
    return null
  }
}
