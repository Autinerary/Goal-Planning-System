'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X, Sparkles, Calendar } from 'lucide-react'

export default function MilestoneView() {
  const router = useRouter()

  const races = [
    { id: 'race_1', name: 'Race 1', progress: 80 },
    { id: 'race_2', name: 'Race 2', progress: 25 },
  ]

  const rows = [
    { 
      category: 'Summary',
      race1: { milestone: 'Current Milestone:', details: 'Request accommodations for classes.' },
      race2: { milestone: 'Current Milestone:', details: 'Build portfolio for job applications.' }
    },
    {
      category: 'Services',
      race1: { items: ['○ Disability Office', '○ Academic Advisor', '○ ...'] },
      race2: { items: ['~'] }
    },
    {
      category: 'Commentaries\n(Reviews/Videos/\nArticles)',
      race1: { items: ['○ "Accommodation Guide" video', '○ Student success story', '○ ...'] },
      race2: { items: ['~'] }
    },
    {
      category: 'Products',
      race1: { items: ['○ Tiimo app', '○ Notion templates'] },
      race2: { items: ['~'] }
    },
    {
      category: '(Other Helpful\nTools)',
      race1: { items: ['○ Study group (online)', '○ Peer support'] },
      race2: { items: ['~'] }
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
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
            {races.map((race, idx) => (
              <div key={race.id} className={`p-4 ${idx === 0 ? 'border-r-2 border-slate-200' : ''}`}>
                <div className="font-bold text-slate-800">{race.name}:...</div>
                <div className="text-slate-600">
                  Progress: <span className="text-emerald-500 font-bold">{race.progress}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                    style={{ width: `${race.progress}%` }}
                  />
                </div>
              </div>
            ))}
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
                {row.race1.milestone && (
                  <>
                    <div className="font-medium text-slate-700">{row.race1.milestone}</div>
                    <div className="text-slate-500 italic">{row.race1.details}</div>
                  </>
                )}
                {row.race1.items && row.race1.items.map((item, i) => (
                  <div key={i} className="text-slate-600 hover:text-cyan-600 cursor-pointer transition-colors">{item}</div>
                ))}
              </div>
              <div className="p-4 text-sm">
                {row.race2.milestone && (
                  <>
                    <div className="font-medium text-slate-700">{row.race2.milestone}</div>
                    <div className="text-slate-500 italic">{row.race2.details}</div>
                  </>
                )}
                {row.race2.items && row.race2.items.map((item, i) => (
                  <div key={i} className="text-slate-400">{item}</div>
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
