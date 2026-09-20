'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { showToast } from '@/lib/toast'

/**
 * How you experience sound and light.
 *
 * This is the input that lets a venue scan say something true about
 * one person rather than something average about everybody. The
 * questions are deliberately phrased in both directions: "too much"
 * and "not enough" are both real answers, and a form that only offers
 * the first tells hyposensitive people the product was not built with
 * them in mind.
 */

type Sens = 'hyper' | 'neutral' | 'hypo'

const SOUND_OPTIONS: { id: Sens; label: string; hint: string }[] = [
  { id: 'hyper', label: 'Noise is a lot for me', hint: 'Busy rooms drain or overwhelm me' },
  { id: 'neutral', label: 'Somewhere in between', hint: 'Depends on the day' },
  { id: 'hypo', label: 'I need some noise', hint: 'Silent rooms feel uncomfortable or make it harder to focus' },
]
const LIGHT_OPTIONS: { id: Sens; label: string; hint: string }[] = [
  { id: 'hyper', label: 'Bright light is a lot for me', hint: 'Glare and strong lighting are hard' },
  { id: 'neutral', label: 'Somewhere in between', hint: 'Most lighting is fine' },
  { id: 'hypo', label: 'I struggle in dim places', hint: 'Low light makes things harder, not calmer' },
]

export default function SensorySettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sound, setSound] = useState<Sens>('neutral')
  const [sudden, setSudden] = useState(false)
  const [dbMax, setDbMax] = useState<number | ''>('')
  const [dbMin, setDbMin] = useState<number | ''>('')
  const [flicker, setFlicker] = useState<'hyper' | 'neutral'>('neutral')
  const [brightness, setBrightness] = useState<Sens>('neutral')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/me/sensory-profile', { cache: 'no-store' })
        const { profile } = await res.json()
        if (profile) {
          setSound(profile.sound_sensitivity ?? 'neutral')
          setSudden(Boolean(profile.sudden_noise_difficulty))
          setDbMax(profile.comfortable_db_max ?? '')
          setDbMin(profile.comfortable_db_min ?? '')
          setFlicker(profile.flicker_sensitivity ?? 'neutral')
          setBrightness(profile.brightness_sensitivity ?? 'neutral')
        }
      } catch { /* first visit, defaults stand */ } finally { setLoading(false) }
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/me/sensory-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soundSensitivity: sound,
          suddenNoiseDifficulty: sudden,
          comfortableDbMax: dbMax === '' ? null : Number(dbMax),
          comfortableDbMin: dbMin === '' ? null : Number(dbMin),
          flickerSensitivity: flicker,
          brightnessSensitivity: brightness,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Could not save')
      showToast.success('Saved. Venue scans will now be read against this.')
    } catch (e: any) {
      showToast.error(e?.message || 'Could not save')
    } finally { setSaving(false) }
  }

  const Choice = <T extends string>(
    { value, onChange, options }:
    { value: T; onChange: (v: T) => void; options: { id: T; label: string; hint: string }[] },
  ) => (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-xl border p-3 text-left transition-colors ${
            value === o.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
          }`}
        >
          <span className="block text-sm font-medium text-gray-900">{o.label}</span>
          <span className="mt-0.5 block text-xs text-gray-600">{o.hint}</span>
        </button>
      ))}
    </div>
  )

  return (
    <>
      <Navbar />
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Sensory profile', href: '/settings/sensory' }]} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">How you experience places</h1>
        <p className="mb-4 text-sm text-gray-600">
          Venues get measured for sound and light. This is what turns those measurements into
          something about you. There is no right answer and nothing here is scored.
        </p>

        <div className="mb-6 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          <p className="text-xs text-emerald-900">
            Only you can read this. It is never shown on your public profile, never attached to a
            scan you contribute, and never pooled with anyone else&apos;s.
          </p>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading
          </p>
        ) : (
          <div className="space-y-6">
            <fieldset>
              <legend className="mb-2 font-semibold text-gray-900">Noise</legend>
              <Choice value={sound} onChange={setSound} options={SOUND_OPTIONS} />
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
              <input type="checkbox" checked={sudden} onChange={(e) => setSudden(e.target.checked)}
                     className="mt-0.5 h-4 w-4 rounded border-gray-300" />
              <span>
                <span className="block text-sm font-medium text-gray-900">
                  Sudden noise is hard, even when the room is quiet
                </span>
                <span className="mt-0.5 block text-xs text-gray-600">
                  A dropped tray, a coffee grinder, a door slam. Kept separate from loudness,
                  because a quiet room that bangs can be worse than a steadily loud one.
                </span>
              </span>
            </label>

            <fieldset>
              <legend className="mb-2 font-semibold text-gray-900">Lighting</legend>
              <Choice value={brightness} onChange={setBrightness} options={LIGHT_OPTIONS} />
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
              <input type="checkbox" checked={flicker === 'hyper'}
                     onChange={(e) => setFlicker(e.target.checked ? 'hyper' : 'neutral')}
                     className="mt-0.5 h-4 w-4 rounded border-gray-300" />
              <span>
                <span className="block text-sm font-medium text-gray-900">
                  Strip lighting or LEDs give me headaches or tire me out
                </span>
                <span className="mt-0.5 block text-xs text-gray-600">
                  Most mains lighting pulses about a hundred times a second. You cannot see it,
                  but plenty of people feel it. We can measure it and warn you.
                </span>
              </span>
            </label>

            <details className="rounded-xl border border-gray-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-gray-900">
                Set exact levels, if you know them
              </summary>
              <p className="mt-2 text-xs text-gray-600">
                Optional. Most people leave these blank and the general answers above are enough.
                A quiet library is about 40 dB, normal conversation about 60, a busy pub about 85.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-gray-700">
                  Loudest I am comfortable with
                  <input type="number" min={30} max={120} value={dbMax}
                         onChange={(e) => setDbMax(e.target.value === '' ? '' : Number(e.target.value))}
                         placeholder="dB"
                         className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm text-gray-700">
                  Quietest that still feels okay
                  <input type="number" min={0} max={90} value={dbMin}
                         onChange={(e) => setDbMin(e.target.value === '' ? '' : Number(e.target.value))}
                         placeholder="dB"
                         className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
              </div>
            </details>

            <button onClick={save} disabled={saving}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50">
              {saving ? 'Saving' : 'Save'}
            </button>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
