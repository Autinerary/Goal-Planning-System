'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

/**
 * Map for a resource's location.
 *
 * The whole map is ONE dynamic import rather than four. Previously
 * MapContainer, TileLayer, Marker and Popup were each wrapped in
 * next/dynamic, giving four independent lazy boundaries whose mount order
 * relative to the map's React context was not guaranteed.
 *
 * Sizing is handled inside LocationMapInner via useMap(); see the note there
 * on why a ref on a dynamic component could never have worked.
 */
const LocationMapInner = dynamic(() => import('./LocationMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 animate-pulse" aria-hidden="true" />
  ),
})

interface LocationMapProps {
  lat: number
  lng: number
  name: string
}

export default function LocationMap({ lat, lng, name }: LocationMapProps) {
  // Guards against the map being handed NaN, which renders a grey box with no
  // error at all — indistinguishable from the sizing bug when reporting it.
  const [valid] = useState(() => Number.isFinite(lat) && Number.isFinite(lng))

  if (!valid) {
    return (
      <div className="w-full h-64 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-500">
        Location coordinates aren&apos;t available for this resource.
      </div>
    )
  }

  return (
    <div className="w-full h-64 sm:h-72 rounded-lg overflow-hidden border border-gray-200">
      <LocationMapInner lat={lat} lng={lng} name={name} />
    </div>
  )
}
