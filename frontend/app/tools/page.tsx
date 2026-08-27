'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ExternalLink, Star, Filter, Search } from 'lucide-react'
import AgentInsightsBanner from '../components/AgentInsightsBanner'
import { useAgentPath } from '../context/AgentPathContext'
import { resolveToolLink } from '@/lib/toolLink'
import { goHubHref } from '@/lib/serviceHub'

// Mock tools data organized by category
// The hardcoded tool catalogue that used to live here has been removed.
// Tools now come from the Tool Recommendation Agent, which reads
// ServiceHub's real `resources` table. Nothing is padded in locally.

const barrierColors: Record<string, string> = {
  adhd: 'bg-orange-100 text-orange-700',
  autism: 'bg-blue-100 text-blue-700',
  ocd: 'bg-purple-100 text-purple-700',
  anxiety: 'bg-yellow-100 text-yellow-700',
  sensory: 'bg-green-100 text-green-700',
  'mental-health': 'bg-pink-100 text-pink-700',
}

// Tool type definition
interface Tool {
  id: string
  name: string
  description: string
  url: string
  rating: number
  reviews: number
  barriers: string[]
  tags: string[]
  highlight: string
  price?: string
}

function ToolsContent() {
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')?.toLowerCase() || 'services'
  const [activeCategory, setActiveCategory] = useState(typeParam)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBarrier, setSelectedBarrier] = useState<string | null>(null)
  const { toolRecommendation, payload } = useAgentPath()

  // Merge the static demo catalogue with the agent's pit-stop tools so the
  // user sees their personalised recommendations alongside the curated set.
  const userBarriers: string[] = (payload?.userProfile?.barrierTypes || []) as string[]
  const agentBucketToTool = (t: any): Tool => ({
    id: t.id,
    name: t.name,
    description: t.description || '',
    url: t.url || '#',
    rating: typeof t.rating === 'number' ? t.rating : 4.5,
    reviews: 0,
    barriers: userBarriers.map((b) => b.toLowerCase()),
    tags: [t.type || 'tool'],
    highlight: (t.description || '').split('.')[0] || 'Recommended by your agents',
  })
  const agentByCategory: Record<string, Tool[]> = {}
  const pit = toolRecommendation?.pit_stop_tools || {}
  ;(['services', 'commentaries', 'products', 'other'] as const).forEach((cat) => {
    const arr = (pit as any)[cat] || []
    agentByCategory[cat] = arr.map(agentBucketToTool)
  })
  // Agent tools ONLY. This used to spread the whole hardcoded `toolsDatabase`
  // onto the end of each category — a merge, not a fallback — so the mock
  // catalogue (CADDAC, Autism Canada, ASAN, Focusmate) appeared on every load
  // no matter what the agents returned. The agent now sources these from
  // ServiceHub's real resources table, so there is nothing to pad them with.
  const mergedToolsByCategory: Record<string, Tool[]> = {
    services: agentByCategory.services || [],
    commentaries: agentByCategory.commentaries || [],
    products: agentByCategory.products || [],
    other: agentByCategory.other || [],
  }

  const CATEGORY_KEYS = ['services', 'commentaries', 'products', 'other'] as const

  useEffect(() => {
    if (typeParam && (CATEGORY_KEYS as readonly string[]).includes(typeParam)) {
      setActiveCategory(typeParam)
    }
  }, [typeParam])

  const categories = CATEGORY_KEYS as unknown as string[]
  const currentTools = (mergedToolsByCategory[activeCategory] || []) as Tool[]

  // Filter tools
  const filteredTools = currentTools.filter((tool: Tool) => {
    const matchesSearch = searchQuery === '' || 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesBarrier = !selectedBarrier || tool.barriers.includes(selectedBarrier)
    
    return matchesSearch && matchesBarrier
  })

  // Get unique barriers from current category
  const availableBarriers = [...new Set(currentTools.flatMap((t: Tool) => t.barriers))]

  return (
    <div className="min-h-screen bg-white/20 backdrop-blur-sm p-8">
      <div className="max-w-6xl mx-auto mb-4">
        <AgentInsightsBanner agent="tool_recommendation" />
      </div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/pit-stop" className="p-2 border-2 border-black rounded hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Tools & Resources</h1>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 border-2 border-black rounded capitalize ${
              activeCategory === cat 
                ? 'bg-gray-800 text-white font-bold' 
                : 'hover:bg-gray-100'
            }`}
          >
            {cat === '(tool x)' ? 'Communities' : cat}
            <span className="ml-2 text-sm opacity-70">
              ({(mergedToolsByCategory[cat] || []).length})
            </span>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full border-2 border-black rounded pl-10 pr-4 py-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5" />
          <select
            value={selectedBarrier || ''}
            onChange={(e) => setSelectedBarrier(e.target.value || null)}
            className="border-2 border-black rounded px-3 py-2"
          >
            <option value="">All barriers</option>
            {availableBarriers.map(b => (
              <option key={b} value={b}>{b.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTools.map((tool: Tool) => (
          <div 
            key={tool.id}
            className="border-2 border-black rounded-lg p-4 hover:shadow-lg transition-shadow"
          >
            {/* Tool Header */}
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg">{tool.name}</h3>
              <div className="flex items-center gap-1 text-yellow-500">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-sm text-black">{tool.rating}</span>
                <span className="text-xs text-gray-500">({tool.reviews.toLocaleString()})</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-600 text-sm mb-3">{tool.description}</p>

            {/* Highlight */}
            {tool.highlight && (
              <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-1 text-sm mb-3">
                ⭐ {tool.highlight}
              </div>
            )}

            {/* Price (if available) */}
            {tool.price && (
              <div className="text-sm text-gray-600 mb-3">
                💰 {tool.price}
              </div>
            )}

            {/* Barriers */}
            <div className="flex flex-wrap gap-1 mb-3">
              {tool.barriers.map((barrier: string) => (
                <span 
                  key={barrier}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${barrierColors[barrier] || 'bg-gray-100'}`}
                >
                  {barrier.toUpperCase()}
                </span>
              ))}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mb-4">
              {tool.tags.map((tag: string) => (
                <span 
                  key={tag}
                  className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* Action Button */}
            {(() => {
              const link = resolveToolLink(tool.url, tool.name)
              return (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full border-2 border-black rounded py-2 hover:bg-gray-100 font-medium"
                >
                  {link.usable ? 'Visit Resource' : 'Find on ResourceHub'}
                  <ExternalLink className="w-4 h-4" />
                </a>
              )
            })()}
          </div>
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {currentTools.length === 0 ? (
            /* Nothing from the agent at all — distinct from "your filters
               excluded everything", and previously masked by the mock
               catalogue that was appended to every category. */
            <>
              <p className="font-medium text-gray-700">No {activeCategory} recommended yet.</p>
              <p className="mt-1 text-sm">
                These come from ResourceHub as your agents match resources to your goals.
              </p>
              <a
                href={goHubHref('/')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-blue-600 hover:underline font-medium"
              >
                Browse ResourceHub →
              </a>
            </>
          ) : (
            <>
              <p>No tools found matching your search.</p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedBarrier(null); }}
                className="mt-2 text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      )}

      {/* Category Description */}
      <div className="mt-8 border-2 border-black rounded-lg p-6 bg-gray-50">
        <h3 className="font-bold text-lg mb-2">About {activeCategory === '(tool x)' ? 'Communities' : activeCategory}</h3>
        <p className="text-gray-600">
          {activeCategory === 'services' && 
            "Professional services and organizations that provide support, resources, and advocacy for people facing systematic barriers."}
          {activeCategory === 'commentaries' && 
            "Articles, videos, and perspectives from people with lived experience - sharing relatable content and education."}
          {activeCategory === 'products' && 
            "Apps, tools, and physical products designed to help with productivity, focus, and daily life management."}
          {activeCategory === '(tool x)' && 
            "Online communities and forums where you can connect with others who understand your experiences."}
        </p>
      </div>
    </div>
  )
}

export default function ToolsPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading tools...</div>}>
      <ToolsContent />
    </Suspense>
  )
}
