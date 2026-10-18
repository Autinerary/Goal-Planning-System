'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import LocationMap from './LocationMap'
import GoogleMapsEmbed, { hasGoogleMapsEmbedKey } from './GoogleMapsEmbed'

const Map3D = dynamic(() => import('./Map3D'), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-gray-100" aria-hidden="true" /> })

/**
 * A service's map, with a 2D/3D switch (the planning note, October 2026,
 * Goal 6). 2D is the map it always had (Google's embed when its key is set,
 * otherwise OpenStreetMap); 3D loads only when chosen (Map3D). If a browser
 * can't draw 3D, it says so and stays on 2D.
 */
export default function ServiceMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const [view, setView] = useState<'2d' | '3d'>('2d')
  const [failed, setFailed] = useState(false)
  const fail = useCallback(() => {
    setFailed(true)
    setView('2d')
  }, [])

  const button = (v: '2d' | '3d', label: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => setView(v)}
      disabled={v === '3d' && failed}
      className={`px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${view === v ? 'bg-blue-700 text-white' : 'bg-white text-gray-800 hover:bg-gray-50'}`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Map view" className="inline-flex overflow-hidden rounded-lg border border-gray-300">
          {button('2d', '2D map')}
          {button('3d', '3D view')}
        </div>
        {view === '3d' && <p className="text-xs text-gray-700">Drag to move. Right-drag, or Ctrl and drag, to turn and tilt. Use two fingers on a phone.</p>}
      </div>
      {failed && <p className="mb-2 text-sm text-gray-800">This browser can&apos;t show the 3D view, so here is the map.</p>}
      {view === '3d' ? (
        <div className="h-72 w-full overflow-hidden rounded-lg border border-gray-200 sm:h-96">
          <Map3D lat={lat} lng={lng} name={name} onFail={fail} />
        </div>
      ) : hasGoogleMapsEmbedKey() ? (
        <GoogleMapsEmbed lat={lat} lng={lng} name={name} />
      ) : (
        <LocationMap lat={lat} lng={lng} name={name} />
      )}
    </div>
  )
}
