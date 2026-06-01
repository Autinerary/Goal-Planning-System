'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { X, Sparkles, Calendar, Heart } from 'lucide-react'

export default function MilestoneView() {
  const router = useRouter()
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set())

  const toggleLike = (itemId: string) => {
    setLikedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const races = [
    { id: 'race_1', name: 'Race 1', progress: 80 },
    { id: 'race_2', name: 'Race 2', progress: 25 },
  ]

  // Updated to show "Yours vs. theirs" structure
  const rows = [
    { 
      category: 'Summary',
      yours: { milestone: 'Current Milestone:', details: 'Request accommodations for classes.' },
      theirs: { milestone: 'Current Milestone:', details: 'Sarah completed this in her 2nd semester.' }
    },
    {
      category: 'Services',
      yours: { items: [
        { id: 'y_s1', text: '○ Disability Office', liked: false },
        { id: 'y_s2', text: '○ Academic Advisor', liked: false },
        { id: 'y_s3', text: '○ ...', liked: false }
      ]},
      theirs: { items: [
        { id: 't_s1', text: '○ Used same disability office', liked: false },
        { id: 't_s2', text: '○ Found peer mentor', liked: false },
        { id: 't_s3', text: '○ ...', liked: false }
      ]}
    },
    {
      category: 'Commentaries\n(Reviews/Videos/\nArticles)',
      yours: { items: [
        { id: 'y_c1', text: '○ "Accommodation Guide" video', liked: false },
        { id: 'y_c2', text: '○ Student success story', liked: false },
        { id: 'y_c3', text: '○ ...', liked: false }
      ]},
      theirs: { items: [
        { id: 't_c1', text: '○ Watched same video series', liked: false },
        { id: 't_c2', text: '○ Found helpful blog posts', liked: false },
        { id: 't_c3', text: '○ ...', liked: false }
      ]}
    },
    {
      category: 'Products',
      yours: { items: [
        { id: 'y_p1', text: '○ Tiimo app', liked: false },
        { id: 'y_p2', text: '○ Notion templates', liked: false }
      ]},
      theirs: { items: [
        { id: 't_p1', text: '○ Used similar planner app', liked: false },
        { id: 't_p2', text: '○ Created custom templates', liked: false }
      ]}
    },
    {
      category: '(Other Helpful\nTools)',
      yours: { items: [
        { id: 'y_o1', text: '○ Study group (online)', liked: false },
        { id: 'y_o2', text: '○ Peer support', liked: false }
      ]},
      theirs: { items: [
        { id: 't_o1', text: '○ Joined same study group', liked: false },
        { id: 't_o2', text: '○ Connected with mentors', liked: false }
      ]}
    },
  ]

  return (
    <div className="min-h-screen bg-white/30 backdrop-blur-sm p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-sm">
          {/* Header row */}
          <div className="grid grid-cols-[120px_1fr_1fr] md:grid-cols-[180px_1fr_1fr] border-b-2 border-slate-200 bg-slate-50">
            <div className="p-4 border-r-2 border-slate-200 flex items-center justify-center">
              <button 
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="p-4 border-r-2 border-slate-200">
              <div className="font-bold text-slate-800">Yours</div>
              <div className="text-slate-600 text-sm">Your current progress</div>
            </div>
            <div className="p-4">
              <div className="font-bold text-slate-800">Theirs</div>
              <div className="text-slate-600 text-sm">Role models' / Mentors' approach</div>
            </div>
          </div>

          {/* Data rows */}
          {rows.map((row, rowIdx) => (
            <div 
              key={rowIdx} 
              className="grid grid-cols-[120px_1fr_1fr] md:grid-cols-[180px_1fr_1fr] border-b-2 border-slate-200 last:border-b-0 hover:bg-slate-50/50 transition-colors"
            >
              <div className="p-4 border-r-2 border-slate-200 font-semibold whitespace-pre-line text-sm text-slate-700 bg-slate-50/50">
                {row.category}
              </div>
              <div className="p-4 border-r-2 border-slate-200 text-sm">
                {row.yours.milestone && (
                  <>
                    <div className="font-medium text-slate-700">{row.yours.milestone}</div>
                    <div className="text-slate-500 italic">{row.yours.details}</div>
                  </>
                )}
                {row.yours.items && row.yours.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-slate-600 hover:text-cyan-600 cursor-pointer transition-colors group">
                    <span>{item.text}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleLike(item.id)
                      }}
                      className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                        likedItems.has(item.id) ? 'opacity-100 text-red-500' : 'text-slate-400 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${likedItems.has(item.id) ? 'fill-red-500' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="p-4 text-sm">
                {row.theirs.milestone && (
                  <>
                    <div className="font-medium text-slate-700">{row.theirs.milestone}</div>
                    <div className="text-slate-500 italic">{row.theirs.details}</div>
                  </>
                )}
                {row.theirs.items && row.theirs.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-slate-600 hover:text-cyan-600 cursor-pointer transition-colors group">
                    <span>{item.text}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleLike(item.id)
                      }}
                      className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                        likedItems.has(item.id) ? 'opacity-100 text-red-500' : 'text-slate-400 hover:text-red-500'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${likedItems.has(item.id) ? 'fill-red-500' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Footer buttons */}
          <div className="p-4 flex flex-wrap gap-4 justify-end bg-slate-50 border-t-2 border-slate-200">
            <Link 
              href="/reflection?contextType=milestone"
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Journal / Reflection
            </Link>
            <Link 
              href="/calendar"
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-all"
            >
              <Calendar className="w-4 h-4" />
              Calendar View
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
