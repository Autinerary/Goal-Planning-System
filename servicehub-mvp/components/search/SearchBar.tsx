'use client'

import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { Search, X } from 'lucide-react'

interface SearchBarProps {
  query: string
  onQueryChange: (query: string) => void
  placeholder?: string
  showSuggestions?: boolean
}

export default function SearchBar({
  query,
  onQueryChange,
  placeholder = 'Search...',
  showSuggestions = true,
}: SearchBarProps) {
  const [localQuery, setLocalQuery] = useState(query)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestionsList, setShowSuggestionsList] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  // Debounce query changes
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      if (localQuery !== query) {
        onQueryChange(localQuery)
      }
    }, 300)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [localQuery, query, onQueryChange])

  // Fetch suggestions
  useEffect(() => {
    if (!showSuggestions || localQuery.length < 2) {
      setSuggestions([])
      setShowSuggestionsList(false)
      return
    }

    setIsLoading(true)
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(localQuery)}&limit=5`)
        if (!response.ok) {
          throw new Error('Failed to fetch suggestions')
        }
        const sugs = await response.json()
        setSuggestions(sugs)
        setShowSuggestionsList(sugs.length > 0)
      } catch (error) {
        console.error('Error fetching suggestions:', error)
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [localQuery, showSuggestions])

  // Sync with external query prop
  useEffect(() => {
    setLocalQuery(query)
  }, [query])

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestionsList(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value)
  }

  const handleClear = () => {
    setLocalQuery('')
    onQueryChange('')
    setShowSuggestionsList(false)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setLocalQuery(suggestion)
    onQueryChange(suggestion)
    setShowSuggestionsList(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onQueryChange(localQuery)
    setShowSuggestionsList(false)
  }

  return (
    <div ref={searchRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="search"
            value={localQuery}
            onChange={handleChange}
            placeholder={placeholder}
            className="block w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Search resources"
          />
          {localQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && showSuggestionsList && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500">Loading suggestions...</div>
          ) : suggestions.length > 0 ? (
            <ul role="listbox" className="py-2">
              {suggestions.map((suggestion, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                    role="option"
                  >
                    <Search className="inline w-4 h-4 mr-2 text-gray-400" aria-hidden="true" />
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500">No suggestions found</div>
          )}
        </div>
      )}
    </div>
  )
}