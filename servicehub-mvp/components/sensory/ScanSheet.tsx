'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Lightbulb, X, ShieldCheck, Loader2, Check } from 'lucide-react'
import { captureSound, frameToRowMeans, readAmbientLux } from '@/lib/sensory/capture'
import { analyseSound, describeSound } from '@/lib/sensory/audio'
import { analyseFlicker, describeFlicker } from '@/lib/sensory/flicker'
import { getCalibration, calibrationCaveat } from '@/lib/sensory/calibration'
import { showToast } from '@/lib/toast'

const SCAN_SECONDS = 30

type Phase = 'intro' | 'listening' | 'light' | 'review' | 'saving'

/**
 * The scan itself.
 *
 * Runs for thirty seconds, which is long enough for the percentile
 * levels to settle and to catch a few of whatever interrupts the room.
 * Shorter and a single passing lorry defines the place.
 *
 * The privacy note at the top is not boilerplate. People are being
 * asked to hold up a microphone in a cafe, and they are entitled to
 * know before they agree that nothing is being recorded. It stays on
 * screen for the whole capture rather than being a checkbox they click
 * past.
 */
export default function ScanSheet({
  resourceId,
  resourceName,
  onClose,
  onSaved,
}: {
  resourceId: string
  resourceName: string
  onClose: () => void
  onSaved?: () => void
}) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [elapsed, setElapsed] = useState(0)
  const [liveLevel, setLiveLevel] = useState(0)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Any in-flight capture must stop if this closes, or the microphone
  // indicator stays lit after the sheet is gone.
  useEffect(() => () => abortRef.current?.abort(), [])

  const runScan = useCallback(async () => {
    setError(null)
    setPhase('listening')
    const controller = new AbortController()
    abortRef.current = controller

    const calibration = getCalibration(navigator.userAgent)

    try {
      const { frames, processingDisabled } = await captureSound(
        SCAN_SECONDS * 1000,
        (ms, rms) => { setElapsed(ms); setLiveLevel(rms) },
        controller.signal,
      )

      const sound = analyseSound(frames, calibration)
      if (!sound) throw new Error('Not enough audio to describe the room.')

      // ---- Light, best effort. Failing here must not lose the sound. ----
      setPhase('light')
      let flicker = null
      let lux: number | null = null
      try {
        lux = await readAmbientLux()
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
          // One frame is enough: the rolling shutter has already written
          // the light's waveform down the rows of it.
          await new Promise((r) => setTimeout(r, 400))
          const rows = frameToRowMeans(video)
          const fps = stream.getVideoTracks()[0].getSettings().frameRate ?? 30
          if (rows) flicker = analyseFlicker(rows, fps)
          video.pause()
          video.srcObject = null
        }
        for (const t of stream.getTracks()) t.stop()
      } catch {
        // No camera permission, or no camera. Sound alone is still useful.
      }

      setResult({ sound, flicker, lux, calibration, processingDisabled })
      setPhase('review')
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setPhase('intro')
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone access was declined, so there is nothing to measure. You can still rate this place by hand.'
          : e?.message || 'Could not complete the scan.',
      )
    }
  }, [])

  const save = useCallback(async () => {
    if (!result) return
    setPhase('saving')
    const now = new Date()
    const { sound, flicker, lux, calibration, processingDisabled } = result
    try {
      const res = await fetch(`/api/venues/${resourceId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localHour: now.getHours(),
          dayOfWeek: now.getDay(),
          durationSeconds: Math.round(sound.durationSeconds),
          soundMedianDb: sound.medianDb,
          soundL10Db: sound.l10Db,
          soundL90Db: sound.l90Db,
          soundPeakDb: sound.peakDb,
          soundPeakEventsPerMin: sound.peakEventsPerMin,
          soundOnsetRate: sound.onsetRate,
          lightLux: lux,
          flickerHz: flicker?.hz ?? null,
          flickerModulationPct: flicker?.modulationPct ?? null,
          deviceModel: navigator.userAgent.slice(0, 120),
          calibrationOffsetDb: calibration.offsetDb,
          calibrationSource: calibration.source,
          // A browser that refused to switch off automatic gain has
          // levelled the room for us, so the reading is worth less.
          confidence: processingDisabled ? calibration.confidence : calibration.confidence * 0.5,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Could not save that scan')
      showToast.success('Scan added. Thanks for helping map this place.')
      onSaved?.()
      onClose()
    } catch (e: any) {
      setPhase('review')
      showToast.error(e?.message || 'Could not save that scan')
    }
  }, [result, resourceId, onSaved, onClose])

  const pct = Math.min(100, (elapsed / (SCAN_SECONDS * 1000)) * 100)

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center overflow-y-auto bg-black/50 p-4 overlay-scroll">
      <div className="surface-raised relative my-auto w-full max-w-lg rounded-2xl p-6">
        <button
          onClick={() => { abortRef.current?.abort(); onClose() }}
          className="absolute right-3 top-3 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-1 text-lg font-bold text-gray-900">Scan this place</h2>
        <p className="mb-4 text-sm text-gray-600">{resourceName}</p>

        {/* Stays visible for the whole capture, not a checkbox to click past. */}
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          <p className="text-xs text-emerald-900">
            Nothing is recorded. Your phone measures the sound level and the lighting on the
            device itself, and only the resulting numbers are saved. No audio, photo or video
            is stored or sent anywhere.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>
        )}

        {phase === 'intro' && (
          <>
            <ul className="mb-5 space-y-2 text-sm text-gray-700">
              <li className="flex gap-2"><Mic className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                Hold your phone still for {SCAN_SECONDS} seconds somewhere typical of the room.</li>
              <li className="flex gap-2"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                Then point the camera at the ceiling light for a moment, if you can.</li>
            </ul>
            <button onClick={runScan}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800">
              Start the {SCAN_SECONDS} second scan
            </button>
          </>
        )}

        {(phase === 'listening' || phase === 'light') && (
          <div className="py-4 text-center">
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mb-3 text-sm text-gray-700">
              {phase === 'listening'
                ? `Listening. ${Math.max(0, SCAN_SECONDS - Math.floor(elapsed / 1000))} seconds left.`
                : 'Checking the lighting.'}
            </p>
            {/* A live level bar, so it is visibly doing something and you
                can tell it is responding to the room rather than hanging. */}
            <div className="mx-auto h-12 w-40 rounded-lg bg-gray-100 p-1">
              <div className="h-full rounded bg-emerald-500 transition-[width] duration-100"
                   style={{ width: `${Math.min(100, liveLevel * 400)}%` }} />
            </div>
          </div>
        )}

        {phase === 'review' && result && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">{describeSound(result.sound)}</p>
            {result.flicker?.hz && (
              <p className="text-sm text-gray-700">{describeFlicker(result.flicker)}</p>
            )}
            {typeof result.lux === 'number' && (
              <p className="text-sm text-gray-700">About {Math.round(result.lux)} lux.</p>
            )}
            <p className="text-xs text-gray-500">{calibrationCaveat(result.calibration)}</p>
            {!result.processingDisabled && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                This browser would not switch off automatic microphone gain, which flattens loud
                and quiet rooms towards each other. The reading is saved as low confidence.
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={save}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700">
                Add this scan
              </button>
              <button onClick={runScan}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Redo
              </button>
            </div>
          </div>
        )}

        {phase === 'saving' && (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving
          </p>
        )}

        {/* Never displayed. It exists only so a frame can be grabbed from it. */}
        <video ref={videoRef} playsInline muted className="hidden" />
      </div>
    </div>
  )
}
