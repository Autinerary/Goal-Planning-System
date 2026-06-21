'use client'

/**
 * Google Maps Embed (legal, no billing).
 *
 * Uses the Maps Embed API (https://developers.google.com/maps/documentation/embed/get-started)
 * which is FREE with no usage limits, and ToS-compliant for public iframe
 * embeds. All it requires is an API key with "Maps Embed API" enabled.
 *
 * Set NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY in `.env.local` to turn this on.
 * When the key is absent we render nothing — callers should fall back to the
 * existing OpenStreetMap (Leaflet) `LocationMap`.
 *
 * The iframe gives users an in-page Google Map plus the same "View larger
 * map" / "Directions" hooks the live maps.google.com site provides, so users
 * stay in Google's stack without us needing to write any JS Maps integration.
 */

interface GoogleMapsEmbedProps {
  lat: number
  lng: number
  name: string
  zoom?: number
}

export default function GoogleMapsEmbed({ lat, lng, name, zoom = 15 }: GoogleMapsEmbedProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY

  if (!apiKey) return null

  // The `place` mode shows a pin with the place name in the iframe's info
  // window. `q` accepts "lat,lng" or "Place Name, City"; "Name@lat,lng" is
  // the Google-recommended shape for an arbitrary point with a label.
  const q = `${encodeURIComponent(name)}@${lat},${lng}`
  const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${q}&zoom=${zoom}`

  return (
    <div className="w-full h-64 rounded-lg overflow-hidden border border-gray-200">
      <iframe
        title={`Map showing ${name}`}
        src={src}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  )
}

/**
 * Returns true if a Maps Embed API key is configured.
 * Components can use this to decide whether to render the Google embed or
 * the OSM fallback.
 */
export function hasGoogleMapsEmbedKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY)
}
