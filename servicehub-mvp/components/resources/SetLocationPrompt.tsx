'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, LocateFixed } from 'lucide-react'

/**
 * Shown on the home page to signed-in users whose profile has no location,
 * so "Recommended" can be about places near them. Two ways in: type a city,
 * or let the browser share an approximate position (rounded to ~1 km on the
 * server before anything is stored).
 */
export default function SetLocationPrompt() {
  const router = useRouter()
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [country, setCountry] = useState('')
  const [saving, setSaving] = useState<'idle' | 'typed' | 'device'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function save(body: Record<string, unknown>, mode: 'typed' | 'device') {
    setSaving(mode)
    setError(null)
    try {
      const res = await fetch('/api/me/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not save your location. Please try again.')
        return
      }
      const place = [data.location?.city, data.location?.province].filter(Boolean).join(', ')
      setSaved(place || 'your area')
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSaving('idle')
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!city.trim()) {
      setError('Please enter a city.')
      return
    }
    save({ city, province, country }, 'typed')
  }

  function useDeviceLocation() {
    if (!('geolocation' in navigator)) {
      setError("This browser can't share a location. Please type your city instead.")
      return
    }
    setSaving('device')
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => save({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'device'),
      (err) => {
        setSaving('idle')
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was declined. You can type your city instead.'
            : "Couldn't get your location. You can type your city instead."
        )
      },
      // City-level is all that is needed; low accuracy is faster and kinder
      // to battery.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  }

  if (saved) {
    return (
      <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">
        Location set to {saved}. Recommendations now show places near you.
      </div>
    )
  }

  const busy = saving !== 'idle'

  return (
    <section
      className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-5"
      aria-labelledby="set-location-heading"
    >
      <div className="mb-1 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-blue-600" aria-hidden="true" />
        <h2 id="set-location-heading" className="text-lg font-semibold text-gray-900">
          Set your location to see places near you
        </h2>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Without it, recommendations can&apos;t tell which places are close to you. Your location is
        private. If you use your device&apos;s location, we only keep an approximate point (within about 1 km).
      </p>

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <label htmlFor="loc-city" className="mb-1 block text-xs font-medium text-gray-700">City</label>
          <input
            id="loc-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g., Ottawa"
            autoComplete="address-level2"
            maxLength={100}
          />
        </div>
        <div>
          <label htmlFor="loc-province" className="mb-1 block text-xs font-medium text-gray-700">Province / state</label>
          <input
            id="loc-province"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g., Ontario"
            autoComplete="address-level1"
            maxLength={100}
          />
        </div>
        <div>
          <label htmlFor="loc-country" className="mb-1 block text-xs font-medium text-gray-700">Country</label>
          <input
            id="loc-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g., Canada"
            autoComplete="country-name"
            maxLength={100}
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving === 'typed' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={useDeviceLocation}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline disabled:opacity-50"
      >
        <LocateFixed className="h-4 w-4" aria-hidden="true" />
        {saving === 'device' ? 'Getting your location…' : "Use my device's location instead"}
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
