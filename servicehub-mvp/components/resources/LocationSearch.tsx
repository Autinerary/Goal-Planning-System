'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, MapPin, X } from 'lucide-react'
import type { Location } from '@/types/database'

interface LocationSearchProps {
  value: Location | null
  onChange: (location: Location | null) => void
  error?: string
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  address?: {
    house_number?: string
    road?: string
    city?: string
    town?: string
    village?: string
    state?: string
    province?: string
    postcode?: string
    country?: string
  }
}

export default function LocationSearch({ value, onChange, error }: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(value)
  const searchRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  // Initialize form fields from selected location
  const [address, setAddress] = useState(value?.address || '')
  const [city, setCity] = useState(value?.city || '')
  const [province, setProvince] = useState(value?.province || '')
  const [postalCode, setPostalCode] = useState(value?.postal_code || '')
  const [lat, setLat] = useState(value?.lat?.toString() || '')
  const [lng, setLng] = useState(value?.lng?.toString() || '')

  // Sync selected location with form fields
  useEffect(() => {
    if (selectedLocation) {
      setAddress(selectedLocation.address || '')
      setCity(selectedLocation.city || '')
      setProvince(selectedLocation.province || '')
      setPostalCode(selectedLocation.postal_code || '')
      setLat(selectedLocation.lat?.toString() || '')
      setLng(selectedLocation.lng?.toString() || '')
      onChange(selectedLocation)
    }
  }, [selectedLocation, onChange])

  // Sync value prop with local state
  useEffect(() => {
    if (value) {
      setSelectedLocation(value)
    }
  }, [value])

  // Search Nominatim API
  useEffect(() => {
    if (query.length < 3) {
      setResults([])
      setShowResults(false)
      return
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'ServiceHub Resource Submission',
            },
          }
        )

        if (!response.ok) {
          throw new Error('Failed to fetch location suggestions')
        }

        const data = await response.json()
        setResults(data as NominatimResult[])
        setShowResults(data.length > 0)
      } catch (error) {
        console.error('Error fetching location suggestions:', error)
        setResults([])
        setShowResults(false)
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [query])

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectResult = (result: NominatimResult) => {
    const addressParts: string[] = []
    if (result.address?.house_number) addressParts.push(result.address.house_number)
    if (result.address?.road) addressParts.push(result.address.road)
    const fullAddress = addressParts.join(' ') || result.display_name.split(',')[0]

    const location: Location = {
      address: fullAddress,
      city: result.address?.city || result.address?.town || result.address?.village || '',
      province: result.address?.state || result.address?.province || '',
      postal_code: result.address?.postcode || '',
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    }

    setSelectedLocation(location)
    setQuery(fullAddress)
    setShowResults(false)
    onChange(location)
  }

  const handleManualUpdate = () => {
    const location: Location = {
      address: address || undefined,
      city: city || undefined,
      province: province || undefined,
      postal_code: postalCode || undefined,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
    }

    setSelectedLocation(location)
    onChange(location)
  }

  const handleClear = () => {
    setQuery('')
    setSelectedLocation(null)
    setAddress('')
    setCity('')
    setProvince('')
    setPostalCode('')
    setLat('')
    setLng('')
    onChange(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Location <span className="text-gray-500 text-xs">(Optional)</span>
        </label>
      </div>

      {/* Address Search */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.length >= 3 && setShowResults(true)}
            placeholder="Search for address..."
            className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {showResults && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
            ) : results.length > 0 ? (
              <div className="py-2">
                {results.map((result, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectResult(result)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 text-sm text-gray-700"
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                      <span className="line-clamp-2">{result.display_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
            )}
          </div>
        )}
      </div>

      {/* Manual Entry Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-900 mb-1">
            Address
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value)
              handleManualUpdate()
            }}
            onBlur={handleManualUpdate}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-900 mb-1">
            City
          </label>
          <input
            id="city"
            type="text"
            value={city}
            onChange={(e) => {
              setCity(e.target.value)
              handleManualUpdate()
            }}
            onBlur={handleManualUpdate}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="province" className="block text-sm font-medium text-gray-900 mb-1">
            Province/State
          </label>
          <input
            id="province"
            type="text"
            value={province}
            onChange={(e) => {
              setProvince(e.target.value)
              handleManualUpdate()
            }}
            onBlur={handleManualUpdate}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="postal-code" className="block text-sm font-medium text-gray-900 mb-1">
            Postal/Zip Code
          </label>
          <input
            id="postal-code"
            type="text"
            value={postalCode}
            onChange={(e) => {
              setPostalCode(e.target.value)
              handleManualUpdate()
            }}
            onBlur={handleManualUpdate}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="lat" className="block text-sm font-medium text-gray-900 mb-1">
            Latitude <span className="text-gray-500 text-xs">(auto-filled)</span>
          </label>
          <input
            id="lat"
            type="number"
            step="any"
            value={lat}
            onChange={(e) => {
              setLat(e.target.value)
              handleManualUpdate()
            }}
            onBlur={handleManualUpdate}
            placeholder="Auto-filled from address"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="lng" className="block text-sm font-medium text-gray-900 mb-1">
            Longitude <span className="text-gray-500 text-xs">(auto-filled)</span>
          </label>
          <input
            id="lng"
            type="number"
            step="any"
            value={lng}
            onChange={(e) => {
              setLng(e.target.value)
              handleManualUpdate()
            }}
            onBlur={handleManualUpdate}
            placeholder="Auto-filled from address"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}