'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ear, Sun, AlertTriangle, CheckCircle2, HelpCircle, Radar, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { buildReadout, type SensoryProfile } from '@/lib/sensory/profile'
import ScanSheet from './ScanSheet'

/**
 * What this place is actually like, for the person reading.
 *
 * Every number on screen is accompanied by how many scans it came from.
 * Two readings and fifty readings cannot be shown with the same
 * authority, and the only defence against that is saying the count out
 * loud every time.
 *
 * There is no overall score here, by design. See lib/sensory/profile.ts.
 */

const BUCKET_LABELS: Record<string, string> = {
  morning: 'Morning',
  midday: 'Midday',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Late',
}
const BUCKET_ORDER = ['morning', 'midday', 'afternoon', 'evening', 'night']

interface Bucket {
  time_bucket: string
  scan_count: number
  median_db: number | null
  l10_db: number | null
  l90_db: number | null
  peak_db: number | null
  peak_events_per_min: number | null
  onset_rate: number | null
  lux: number | null
  flicker_hz: number | null
  flicker_modulation_pct: number | null
  last_scanned_at: string
}

export default function SensoryPanel({
  resourceId,
  resourceName,
  signedIn,
}: {
  resourceId: string
  resourceName: string
  signedIn: boolean
}) {
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [profile, setProfile] = useState<SensoryProfile | null>(null)
  const [minScans, setMinScans] = useState(3)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/venues/${resourceId}/sensory`, { cache: 'no-store' })
      const data = await res.json()
      const rows: Bucket[] = (data.buckets ?? []).sort(
        (a: Bucket, b: Bucket) => BUCKET_ORDER.indexOf(a.time_bucket) - BUCKET_ORDER.indexOf(b.time_bucket),
      )
      setBuckets(rows)
      setProfile(data.profile ?? null)
      setMinScans(data.minScansForSummary ?? 3)
      setActive((cur) => cur ?? rows[0]?.time_bucket ?? null)
    } catch {
      setBuckets([])
    } finally {
      setLoading(false)
    }
  }, [resourceId])

  useEffect(() => { load() }, [load])

  const bucket = buckets.find((b) => b.time_bucket === active) ?? null

  // The stored columns are re-shaped into the same structures the pure
  // analysis produces, so aggregated venue data and a single fresh scan
  // are interpreted by exactly the same code path.
  const readout = bucket
    ? buildReadout(
        bucket.median_db != null ? {
          medianDb: Number(bucket.median_db),
          l10Db: Number(bucket.l10_db ?? bucket.median_db),
          l90Db: Number(bucket.l90_db ?? bucket.median_db),
          peakDb: Number(bucket.peak_db ?? bucket.median_db),
          variabilityDb: Number(bucket.l10_db ?? 0) - Number(bucket.l90_db ?? 0),
          peakAboveMedianDb: Number(bucket.peak_db ?? 0) - Number(bucket.median_db ?? 0),
          peakEventsPerMin: Number(bucket.peak_events_per_min ?? 0),
          onsetRate: Number(bucket.onset_rate ?? 0),
          frameCount: 0,
          durationSeconds: 0,
        } : null,
        bucket.flicker_hz != null ? {
          hz: Number(bucket.flicker_hz),
          modulationPct: Number(bucket.flicker_modulation_pct ?? 0),
          confidence: 1,
          mains: Number(bucket.flicker_hz) === 100 ? 50 : 60,
        } : null,
        bucket.lux != null ? Number(bucket.lux) : null,
        profile,
      )
    : null

  const total = buckets.reduce((s, b) => s + b.scan_count, 0)

  return (
    <section className="surface rounded-2xl p-6" aria-labelledby="sensory-heading">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 id="sensory-heading" className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Radar className="h-5 w-5 text-indigo-600" aria-hidden="true" />
          What it is like inside
        </h2>
        {signedIn && (
          <button
            onClick={() => setScanning(true)}
            className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800"
          >
            Scan this place
          </button>
        )}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading
        </p>
      ) : total === 0 ? (
        <p className="py-4 text-sm text-gray-600">
          Nobody has measured this place yet. A scan takes thirty seconds, records nothing, and
          tells the next person what the room is actually like before they travel to it.
        </p>
      ) : (
        <>
          <p className="mb-4 text-xs text-gray-500">
            Measured on {total} {total === 1 ? 'visit' : 'visits'}. A place changes through the day,
            so readings are kept apart rather than averaged into one figure.
          </p>

          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Time of day">
            {buckets.map((b) => (
              <button
                key={b.time_bucket}
                role="tab"
                aria-selected={active === b.time_bucket}
                onClick={() => setActive(b.time_bucket)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active === b.time_bucket
                    ? 'bg-indigo-600 text-white'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {BUCKET_LABELS[b.time_bucket] ?? b.time_bucket}
                <span className={active === b.time_bucket ? 'ml-1.5 text-indigo-200' : 'ml-1.5 text-gray-400'}>
                  {b.scan_count}
                </span>
              </button>
            ))}
          </div>

          {bucket && readout && (
            <>
              {/* Thin evidence is disclosed before the numbers, not after. */}
              {bucket.scan_count < minScans && (
                <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Only {bucket.scan_count} {bucket.scan_count === 1 ? 'scan' : 'scans'} at this time of
                  day. That is one person&apos;s visit, not a description of the place. Treat it as a hint.
                </p>
              )}

              <p className="mb-3 text-sm font-semibold text-gray-900">{readout.summary}</p>

              <ul className="space-y-2">
                {readout.findings.map((f, i) => {
                  const Icon = f.fit === 'hard' ? AlertTriangle : f.fit === 'good' ? CheckCircle2 : HelpCircle
                  const tone =
                    f.fit === 'hard' ? 'border-rose-200 bg-rose-50 text-rose-900'
                    : f.fit === 'good' ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-gray-200 bg-gray-50 text-gray-700'
                  return (
                    <li key={i} className={`flex items-start gap-2 rounded-lg border p-3 ${tone}`}>
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="text-sm">
                        <span className="font-medium">{f.fact}</span>{' '}
                        <span className="opacity-90">{f.because}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>

              {readout.caveat && <p className="mt-3 text-xs text-gray-500">{readout.caveat}</p>}

              {!profile && signedIn && (
                <p className="mt-3 text-xs text-gray-600">
                  <Link href="/settings/sensory" className="font-medium text-indigo-700 underline">
                    Tell us how you experience sound and light
                  </Link>{' '}
                  and this becomes specific to you instead of general.
                </p>
              )}

              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <Ear className="h-3 w-3" aria-hidden="true" /> measured, not rated
                </span>
                <span className="inline-flex items-center gap-1">
                  <Sun className="h-3 w-3" aria-hidden="true" /> no audio or images are ever stored
                </span>
              </p>
            </>
          )}
        </>
      )}

      {scanning && (
        <ScanSheet
          resourceId={resourceId}
          resourceName={resourceName}
          onClose={() => setScanning(false)}
          onSaved={load}
        />
      )}
    </section>
  )
}
