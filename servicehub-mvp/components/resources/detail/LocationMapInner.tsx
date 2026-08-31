'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Leaflet's default marker icons resolve to paths that don't exist under the
// Next bundler, so point them at the CDN copies.
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

/**
 * Keeps the map's idea of its own size honest.
 *
 * Leaflet measures its container once at init and lays tiles out against that
 * measurement. If it initialises before layout settles — which it routinely
 * does inside a responsive column below the fold — it paints tiles for a size
 * the container no longer has, and the rest stays grey. That is Odosa's
 * "map image is broken", and the map data was never the problem.
 *
 * This reads the map from context via useMap() rather than a ref. The previous
 * attempt put a ref on a next/dynamic-wrapped MapContainer, and next/dynamic
 * does not forward refs — so the ref was never populated and invalidateSize()
 * was never actually called.
 */
function KeepSized() {
  const map = useMap()

  useEffect(() => {
    const invalidate = () => map.invalidateSize()

    // Once layout has settled, then again a beat later for slow tile attach.
    const t1 = setTimeout(invalidate, 60)
    const t2 = setTimeout(invalidate, 350)

    const container = map.getContainer()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(invalidate) : null
    ro?.observe(container)

    // Below the fold it can mount at a size it never actually renders at;
    // re-measure the moment it's genuinely on screen.
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) invalidate() }, { threshold: 0.01 })
      : null
    io?.observe(container)

    window.addEventListener('orientationchange', invalidate)
    window.addEventListener('resize', invalidate)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      ro?.disconnect()
      io?.disconnect()
      window.removeEventListener('orientationchange', invalidate)
      window.removeEventListener('resize', invalidate)
    }
  }, [map])

  return null
}

export interface LocationMapInnerProps {
  lat: number
  lng: number
  name: string
}

export default function LocationMapInner({ lat, lng, name }: LocationMapInnerProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]}>
        <Popup>{name}</Popup>
      </Marker>
      <KeepSized />
    </MapContainer>
  )
}
