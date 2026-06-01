'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ExternalLink, Star, Filter, Search } from 'lucide-react'

// Mock tools data organized by category
const toolsDatabase = {
  services: [
    {
      id: 's1',
      name: 'CADDAC',
      description: 'Centre for ADHD Awareness Canada - Resources, support, and advocacy for ADHD',
      url: 'https://caddac.ca',
      rating: 4.8,
      reviews: 156,
      barriers: ['adhd'],
      tags: ['support', 'education', 'advocacy'],
      highlight: 'Free resources and workshops',
    },
    {
      id: 's2',
      name: 'Autism Canada',
      description: 'National voice for the autism community - Programs, research, and support',
      url: 'https://autismcanada.org',
      rating: 4.7,
      reviews: 203,
      barriers: ['autism'],
      tags: ['support', 'research', 'community'],
      highlight: 'Employment programs available',
    },
    {
      id: 's3',
      name: 'ASAN',
      description: 'Autistic Self Advocacy Network - Run by and for autistic people',
      url: 'https://autisticadvocacy.org',
      rating: 4.9,
      reviews: 312,
      barriers: ['autism'],
      tags: ['advocacy', 'community', 'policy'],
      highlight: 'Autistic-led organization',
    },
    {
      id: 's4',
      name: 'Focusmate',
      description: 'Virtual coworking sessions with accountability partners worldwide',
      url: 'https://focusmate.com',
      rating: 4.6,
      reviews: 1250,
      barriers: ['adhd', 'autism'],
      tags: ['productivity', 'accountability', 'body-doubling'],
      highlight: 'Body doubling - proven for ADHD',
    },
    {
      id: 's5',
      name: 'BetterHelp',
      description: 'Online therapy platform with specialists in neurodivergence',
      url: 'https://betterhelp.com',
      rating: 4.3,
      reviews: 5420,
      barriers: ['adhd', 'autism', 'ocd', 'anxiety'],
      tags: ['therapy', 'mental-health', 'online'],
      highlight: 'Neurodivergent-friendly therapists available',
    },
    {
      id: 's6',
      name: 'Understood.org',
      description: 'Resources for learning and thinking differences',
      url: 'https://understood.org',
      rating: 4.7,
      reviews: 890,
      barriers: ['adhd', 'dyslexia', 'learning-differences'],
      tags: ['education', 'parenting', 'resources'],
      highlight: 'Free tools and expert advice',
    },
  ],
  commentaries: [
    {
      id: 'c1',
      name: 'How to ADHD',
      description: 'YouTube channel with practical ADHD strategies and community support',
      url: 'https://youtube.com/howtoadhd',
      rating: 4.9,
      reviews: 2100,
      barriers: ['adhd'],
      tags: ['video', 'education', 'community'],
      highlight: '2M+ subscribers - highly relatable',
    },
    {
      id: 'c2',
      name: 'Neuroclastic',
      description: 'Publication by autistic writers - authentic autistic perspectives',
      url: 'https://neuroclastic.com',
      rating: 4.8,
      reviews: 540,
      barriers: ['autism'],
      tags: ['articles', 'perspectives', 'advocacy'],
      highlight: 'Actually autistic writers',
    },
    {
      id: 'c3',
      name: 'ADHD Alien',
      description: 'Comics and illustrations explaining ADHD experiences',
      url: 'https://adhd-alien.com',
      rating: 4.9,
      reviews: 890,
      barriers: ['adhd'],
      tags: ['comics', 'relatable', 'education'],
      highlight: 'Visual explanations - great for sharing',
    },
    {
      id: 'c4',
      name: 'The Mighty',
      description: 'Real stories from people living with disabilities and chronic illness',
      url: 'https://themighty.com',
      rating: 4.5,
      reviews: 1200,
      barriers: ['adhd', 'autism', 'chronic-illness', 'mental-health'],
      tags: ['stories', 'community', 'support'],
      highlight: 'Diverse lived experiences',
    },
    {
      id: 'c5',
      name: 'Wrong Planet',
      description: 'Community and forums for autism spectrum - one of the oldest autism communities',
      url: 'https://wrongplanet.net',
      rating: 4.4,
      reviews: 670,
      barriers: ['autism', 'aspergers'],
      tags: ['forum', 'community', 'discussion'],
      highlight: 'Long-running autism community',
    },
  ],
  products: [
    {
      id: 'p1',
      name: 'Tiimo',
      description: 'Visual daily planner app designed for ADHD and autism',
      url: 'https://tiimo.dk',
      rating: 4.7,
      reviews: 3200,
      barriers: ['adhd', 'autism'],
      tags: ['app', 'scheduling', 'visual'],
      highlight: 'Made by neurodivergent team',
      price: '$5.99/month',
    },
    {
      id: 'p2',
      name: 'Forest App',
      description: 'Stay focused by growing virtual trees - gamified focus timer',
      url: 'https://forestapp.cc',
      rating: 4.6,
      reviews: 12000,
      barriers: ['adhd'],
      tags: ['app', 'focus', 'gamification'],
      highlight: 'Plants real trees!',
      price: '$4.99 one-time',
    },
    {
      id: 'p3',
      name: 'Time Timer',
      description: 'Visual timer showing time as a disappearing red disk',
      url: 'https://timetimer.com',
      rating: 4.8,
      reviews: 4500,
      barriers: ['adhd', 'autism'],
      tags: ['physical', 'timer', 'visual'],
      highlight: 'Recommended by therapists',
      price: '$30-50',
    },
    {
      id: 'p4',
      name: 'Loop Earplugs',
      description: 'Discreet noise-reducing earplugs for sensory overwhelm',
      url: 'https://loopearplugs.com',
      rating: 4.5,
      reviews: 8900,
      barriers: ['autism', 'adhd', 'sensory'],
      tags: ['physical', 'sensory', 'noise-reduction'],
      highlight: 'Stylish & effective',
      price: '$25-35',
    },
    {
      id: 'p5',
      name: 'Notion',
      description: 'All-in-one workspace - highly customizable for different brains',
      url: 'https://notion.so',
      rating: 4.7,
      reviews: 25000,
      barriers: ['adhd', 'autism'],
      tags: ['app', 'organization', 'notes'],
      highlight: 'Free for personal use',
      price: 'Free / $10/month',
    },
    {
      id: 'p6',
      name: 'Weighted Blanket',
      description: 'Deep pressure stimulation for anxiety and sensory needs',
      url: '#',
      rating: 4.6,
      reviews: 15000,
      barriers: ['autism', 'anxiety', 'sensory'],
      tags: ['physical', 'sensory', 'sleep'],
      highlight: 'Improves sleep quality',
      price: '$50-150',
    },
  ],
  '(tool x)': [
    {
      id: 'x1',
      name: 'r/ADHD',
      description: 'Reddit community for ADHD support and discussion',
      url: 'https://reddit.com/r/adhd',
      rating: 4.5,
      reviews: 1500000,
      barriers: ['adhd'],
      tags: ['community', 'forum', 'support'],
      highlight: '1.5M+ members',
    },
    {
      id: 'x2',
      name: 'Actually Autistic Discord',
      description: 'Discord server run by autistic adults for autistic adults',
      url: '#',
      rating: 4.7,
      reviews: 2300,
      barriers: ['autism'],
      tags: ['community', 'chat', 'support'],
      highlight: 'Real-time support',
    },
    {
      id: 'x3',
      name: 'Disability Twitter/X',
      description: 'Community hashtags: #ActuallyAutistic #ADHDTwitter',
      url: 'https://twitter.com',
      rating: 4.3,
      reviews: 5000,
      barriers: ['adhd', 'autism', 'disability'],
      tags: ['social-media', 'community', 'advocacy'],
      highlight: 'Breaking news & advocacy',
    },
    {
      id: 'x4',
      name: 'Meetup.com - ND Groups',
      description: 'Local meetup groups for neurodivergent individuals',
      url: 'https://meetup.com',
      rating: 4.4,
      reviews: 890,
      barriers: ['adhd', 'autism'],
      tags: ['in-person', 'community', 'local'],
      highlight: 'Find local ND community',
    },
  ],
}

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

  useEffect(() => {
    if (typeParam && toolsDatabase[typeParam as keyof typeof toolsDatabase]) {
      setActiveCategory(typeParam)
    }
  }, [typeParam])

  const categories = Object.keys(toolsDatabase)
  const currentTools = (toolsDatabase[activeCategory as keyof typeof toolsDatabase] || []) as Tool[]

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
              ({toolsDatabase[cat as keyof typeof toolsDatabase].length})
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
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full border-2 border-black rounded py-2 hover:bg-gray-100 font-medium"
            >
              Visit Resource
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No tools found matching your search.</p>
          <button 
            onClick={() => { setSearchQuery(''); setSelectedBarrier(null); }}
            className="mt-2 text-blue-600 hover:underline"
          >
            Clear filters
          </button>
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
