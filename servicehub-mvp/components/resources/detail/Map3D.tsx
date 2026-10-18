'use client'

import { useEffect, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

// OpenFreeMap's Liberty style: free, no key, and it has 3D buildings from
// zoom 14 (heights from OpenStreetMap, approximate).
const STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY || ''
export const GOOGLE_3D = Boolean(GOOGLE_KEY) && process.env.NEXT_PUBLIC_MAP_3D === 'google'

const calm = () => typeof document !== 'undefined' && (document.documentElement.dataset.reduceMotion === 'on' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

let googleLoading: Promise<any> | null = null
/** Google's Maps JavaScript API with its 3D library, loaded once, only when someone opens a Google 3D view. */
function loadGoogle(): Promise<any> {
  if (googleLoading) return googleLoading
  googleLoading = new Promise((resolve, reject) => {
    const w = window as any
    if (w.google?.maps?.importLibrary) return resolve(w.google.maps.importLibrary('maps3d'))
    const cb = `autinerary3d${Date.now()}`
    w[cb] = () => resolve(w.google.maps.importLibrary('maps3d'))
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&v=weekly&loading=async&callback=${cb}`
    s.async = true
    s.onerror = () => reject(new Error('Google Maps did not load'))
    document.head.appendChild(s)
  })
  return googleLoading
}

/**
 * The 3D view of a place (the planning note, October 2026, Goal 6: "3D
 * aerial maps", with a 2D/3D toggle on a service's page). Google's
 * photorealistic 3D when the team turns it on (NEXT_PUBLIC_MAP_3D=google and
 * NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY, a Maps JavaScript key with billing:
 * docs/goals-6-11-2026-10.md has the costs); otherwise MapLibre with
 * OpenFreeMap's 3D buildings, which is free. Loaded only when someone asks
 * for it. Calm motion means no fly-in.
 */
export default function Map3D({ lat, lng, name, onFail }: { lat: number; lng: number; name: string; onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let gone = false
    let cleanup = () => {}
    const el = host.current
    if (!el) return

    if (GOOGLE_3D) {
      loadGoogle()
        .then(({ Map3DElement, Marker3DElement }) => {
          if (gone || !el) return
          const map = new Map3DElement({ center: { lat, lng, altitude: 0 }, range: 700, tilt: 60, heading: 0, mode: 'HYBRID', gestureHandling: 'COOPERATIVE' })
          map.style.display = 'block'
          map.style.height = '100%'
          map.append(new Marker3DElement({ position: { lat, lng }, label: name }))
          el.append(map)
          setReady(true)
          cleanup = () => map.remove()
        })
        .catch(() => !gone && onFail())
    } else {
      import('maplibre-gl')
        .then((ml) => {
          if (gone || !el) return
          const maplibre = (ml as any).default || ml
          let map: any
          try {
            map = new maplibre.Map({
              container: el,
              style: STYLE,
              center: [lng, lat],
              zoom: 16.5,
              pitch: 60,
              bearing: -20,
              cooperativeGestures: true,
              fadeDuration: calm() ? 0 : 300,
            })
          } catch {
            return onFail()
          }
          map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), 'top-right')
          new maplibre.Marker({ color: '#1b5d30' }).setLngLat([lng, lat]).setPopup(new maplibre.Popup().setText(name)).addTo(map)
          map.on('load', () => !gone && setReady(true))
          map.on('error', (e: any) => {
            if (!map.loaded() && e?.error) onFail()
          })
          cleanup = () => map.remove()
        })
        .catch(() => !gone && onFail())
    }
    return () => {
      gone = true
      cleanup()
    }
  }, [lat, lng, name, onFail])

  return (
    <div className="relative h-full w-full">
      <div ref={host} className="h-full w-full" role="region" aria-label={`3D view of the area around ${name}`} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-sm text-gray-700" aria-live="polite">
          Loading the 3D view…
        </div>
      )}
    </div>
  )
}
