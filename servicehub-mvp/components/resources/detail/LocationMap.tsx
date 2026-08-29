'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

// Fix Leaflet default icon issue with Next.js
if (typeof window !== 'undefined') {
  import('leaflet').then((L) => {
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    })
  })
}

// Dynamically import Leaflet to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), {
  ssr: false,
})
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), {
  ssr: false,
})
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), {
  ssr: false,
})
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), {
  ssr: false,
})

interface LocationMapProps {
  lat: number
  lng: number
  name: string
}

/**
 * Map for a resource's location.
 *
 * Odosa: "map image is broken in mobile & laptop view". Leaflet measures its
 * container once at init and lays tiles out against that measurement. Here the
 * container is a dynamic import inside a responsive column, so the map
 * frequently initialised before the layout had settled — it then painted tiles
 * for a size the container no longer had, leaving the rest grey. Nothing about
 * the map data was wrong, which is why it looked broken rather than empty.
 *
 * invalidateSize() re-measures and repaints. Called once after mount, and again
 * whenever the container actually changes size, which covers rotation, a
 * sidebar opening, and the browser being resized.
 */
export default function LocationMap({ lat, lng, name }: LocationMapProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  // Guards against the map ever being handed NaN, which renders a grey box
  // with no error at all.
  const [valid] = useState(() => Number.isFinite(lat) && Number.isFinite(lng))

  useEffect(() => {
    if (!valid) return
    const el = wrapperRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const resize = () => mapRef.current?.invalidateSize?.()
    // Two frames out: one for layout, one for the tile layer to attach.
    const t = setTimeout(resize, 250)
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    window.addEventListener('orientationchange', resize)

    return () => {
      clearTimeout(t)
      ro.disconnect()
      window.removeEventListener('orientationchange', resize)
    }
  }, [valid])

  if (!valid) {
    return (
      <div className="w-full h-64 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-500">
        Location coordinates aren&apos;t available for this resource.
      </div>
    )
  }

  return (
    <div
      ref={wrapperRef}
      className="w-full h-64 sm:h-72 rounded-lg overflow-hidden border border-gray-200"
    >
      <MapContainer
        center={[lat, lng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        // Re-measure as soon as the instance exists, before the observer
        // has had a chance to fire.
        ref={(instance: any) => {
          mapRef.current = instance
          if (instance) setTimeout(() => instance.invalidateSize?.(), 0)
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]}>
          <Popup>{name}</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
