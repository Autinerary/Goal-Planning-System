'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Wrench, MessageSquare, Package, Users, ArrowRight } from 'lucide-react'

export default function PitStopView() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])

  const toolCategories = [
    { 
      name: 'Services', 
      icon: Wrench,
      description: 'Professional support & organizations',
      count: 6,
      highlighted: true 
    },
    { 
      name: 'Commentaries', 
      icon: MessageSquare,
      description: 'Articles, videos & perspectives',
      count: 5,
      highlighted: true 
    },
    { 
      name: 'Products', 
      icon: Package,
      description: 'Apps, tools & physical products',
      count: 6,
      highlighted: false 
    },
    { 
      name: 'Communities', 
      icon: Users,
      description: 'Forums, groups & social',
      count: 4,
      highlighted: false 
    },
  ]

  // Mock search results
  const mockSearchResults = [
    { id: 1, name: 'Focusmate', type: 'Service', match: 'Body doubling for focus' },
    { id: 2, name: 'Time Timer', type: 'Product', match: 'Visual time management' },
    { id: 3, name: 'How to ADHD', type: 'Commentary', match: 'Practical ADHD strategies' },
    { id: 4, name: 'r/ADHD', type: 'Community', match: 'Support community' },
  ]

  const handleSearch = () => {
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    // Simulate AI search
    setTimeout(() => {
      setSearchResults(mockSearchResults.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.match.toLowerCase().includes(searchQuery.toLowerCase())
      ))
      setIsSearching(false)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold mb-6">3.5. Pit Stop View</h1>

      <div className="border-2 border-black rounded-lg p-6 max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold underline">Pit Stop</h2>
          <p className="italic text-sm text-gray-600">(For Immediate Inquiries/tasks)</p>
        </div>

        {/* Magic Searchbar */}
        <div className="mb-8">
          <label className="font-bold block mb-2">Magic Searchbar:</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="What are you looking for? (e.g., 'help with focus', 'ADHD apps')"
              className="w-full border-2 border-black rounded p-3 pr-12 bg-gray-800 text-white placeholder-gray-400"
            />
            <button 
              onClick={handleSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-700 rounded"
            >
              <Search className="w-5 h-5 text-white" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            AI-powered search matches you with the most relevant tools for your barriers
          </p>
        </div>

        {/* Search Results */}
        {(isSearching || searchResults.length > 0) && (
          <div className="mb-8 border-2 border-black rounded p-4 bg-blue-50">
            <h3 className="font-bold mb-3">
              {isSearching ? '🔍 Searching...' : `✨ Found ${searchResults.length} matches:`}
            </h3>
            {!isSearching && (
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <Link
                    key={result.id}
                    href={`/tools?type=${result.type.toLowerCase()}`}
                    className="flex items-center justify-between p-3 bg-white rounded border hover:shadow-md"
                  >
                    <div>
                      <span className="font-medium">{result.name}</span>
                      <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded">{result.type}</span>
                      <div className="text-sm text-gray-600">{result.match}</div>
                    </div>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ))}
                <button 
                  onClick={() => setSearchResults([])}
                  className="text-sm text-gray-500 hover:underline"
                >
                  Clear results
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tools Grid */}
        <div className="mb-6">
          <label className="font-bold block mb-3">Tools:</label>
          <div className="grid grid-cols-2 gap-4">
            {toolCategories.map((tool, idx) => {
              const IconComponent = tool.icon
              const urlType = tool.name === 'Communities' ? '(tool x)' : tool.name.toLowerCase()
              return (
                <Link
                  key={idx}
                  href={`/tools?type=${urlType}`}
                  className={`border-2 border-black rounded p-4 hover:bg-gray-100 transition-colors ${
                    tool.highlighted ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <IconComponent className="w-5 h-5" />
                    <span className={`${tool.highlighted ? 'font-bold' : ''}`}>
                      {tool.name}
                    </span>
                    <span className="ml-auto text-sm text-gray-500">({tool.count})</span>
                  </div>
                  <p className="text-sm text-gray-600">{tool.description}</p>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Quick Access */}
        <div className="border-t-2 border-black pt-4 mt-4">
          <h3 className="font-bold mb-3">Quick Access - Popular Tools:</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { name: 'Tiimo', type: 'products' },
              { name: 'Focusmate', type: 'services' },
              { name: 'How to ADHD', type: 'commentaries' },
              { name: 'r/ADHD', type: '(tool x)' },
            ].map((tool, idx) => (
              <Link
                key={idx}
                href={`/tools?type=${tool.type}`}
                className="px-3 py-1 border border-black rounded-full text-sm hover:bg-gray-100"
              >
                {tool.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Vertical dots - other tools indicator */}
        <div className="text-center my-6">
          <div className="inline-block text-gray-400">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="text-lg leading-tight">⋮</div>
            ))}
          </div>
        </div>

        {/* Other tools note */}
        <div className="text-center text-sm text-gray-500 italic">
          (more tools being added based on community feedback)
        </div>
      </div>
    </div>
  )
}
