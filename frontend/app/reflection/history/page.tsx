'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { ChevronLeft, Calendar, ChevronDown, ChevronUp, Smile, Meh, Frown, Loader2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Journal {
  id: string
  date: string
  contextType: string
  contextName: string
  sentiment: 'positive' | 'neutral' | 'negative'
  summary: string
  questions: { q: string; a: string }[]
  insights: string[]
}

const sentimentIcons = {
  positive: { icon: Smile, color: 'text-green-500', bg: 'bg-green-100' },
  neutral: { icon: Meh, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  negative: { icon: Frown, color: 'text-red-500', bg: 'bg-red-100' },
}

const contextTypeColors: Record<string, string> = {
  path: 'bg-purple-100 text-purple-700',
  milestone: 'bg-blue-100 text-blue-700',
  task: 'bg-green-100 text-green-700',
  calendar: 'bg-orange-100 text-orange-700',
  race: 'bg-pink-100 text-pink-700',
}

export default function JournalHistory() {
  const [journals, setJournals] = useState<Journal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchJournals()
  }, [])

  const fetchJournals = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_URL}/api/reflections/user/user_123`)
      setJournals(response.data)
      setError(null)
    } catch (err) {
      console.error('Error fetching journals:', err)
      setError('Failed to load journals. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const filteredJournals = filter === 'all' 
    ? journals 
    : journals.filter(j => j.sentiment === filter)

  const sentimentCounts = {
    all: journals.length,
    positive: journals.filter(j => j.sentiment === 'positive').length,
    neutral: journals.filter(j => j.sentiment === 'neutral').length,
    negative: journals.filter(j => j.sentiment === 'negative').length,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600">Loading journals...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/reflection" className="p-2 border-2 border-black rounded hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Previous Journals</h1>
        </div>
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={fetchJournals}
            className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/reflection" className="p-2 border-2 border-black rounded hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Previous Journals</h1>
        <button 
          onClick={fetchJournals}
          className="ml-auto px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border-2 border-black rounded p-4 text-center">
          <div className="text-3xl font-bold">{journals.length}</div>
          <div className="text-sm text-gray-600">Total Entries</div>
        </div>
        <div className="border-2 border-black rounded p-4 text-center bg-green-50">
          <div className="text-3xl font-bold text-green-600">{sentimentCounts.positive}</div>
          <div className="text-sm text-gray-600">Positive Days</div>
        </div>
        <div className="border-2 border-black rounded p-4 text-center bg-yellow-50">
          <div className="text-3xl font-bold text-yellow-600">{sentimentCounts.neutral}</div>
          <div className="text-sm text-gray-600">Neutral Days</div>
        </div>
        <div className="border-2 border-black rounded p-4 text-center bg-red-50">
          <div className="text-3xl font-bold text-red-600">{sentimentCounts.negative}</div>
          <div className="text-sm text-gray-600">Challenging Days</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'positive', 'neutral', 'negative'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 border-2 border-black rounded capitalize ${
              filter === f ? 'bg-gray-200 font-bold' : 'hover:bg-gray-100'
            }`}
          >
            {f} ({sentimentCounts[f]})
          </button>
        ))}
      </div>

      {/* Journal List */}
      <div className="space-y-4">
        {filteredJournals.map((journal) => {
          const sentimentData = sentimentIcons[journal.sentiment] || sentimentIcons.neutral
          const SentimentIcon = sentimentData.icon
          const isExpanded = expandedId === journal.id

          return (
            <div key={journal.id} className="border-2 border-black rounded-lg overflow-hidden">
              {/* Header Row */}
              <div 
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(isExpanded ? null : journal.id)}
              >
                {/* Sentiment Icon */}
                <div className={`p-2 rounded-full ${sentimentData.bg}`}>
                  <SentimentIcon className={`w-6 h-6 ${sentimentData.color}`} />
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span className="font-mono">{journal.date}</span>
                </div>

                {/* Context Badge */}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${contextTypeColors[journal.contextType] || 'bg-gray-100 text-gray-700'}`}>
                  {journal.contextType}
                </span>

                {/* Context Name */}
                <span className="font-medium flex-1">{journal.contextName}</span>

                {/* Expand Icon */}
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>

              {/* Summary (always visible) */}
              <div className="px-4 pb-4 -mt-2">
                <p className="text-gray-700 italic">"{journal.summary}"</p>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t-2 border-black p-4 bg-gray-50">
                  {/* Questions & Answers */}
                  {journal.questions && journal.questions.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-bold mb-2">Reflection Responses:</h4>
                      <div className="space-y-3">
                        {journal.questions.map((qa, idx) => (
                          <div key={idx} className="bg-white p-3 rounded border">
                            <div className="font-medium text-gray-600 text-sm">{qa.q}</div>
                            <div className="mt-1">{qa.a}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Insights */}
                  {journal.insights && journal.insights.length > 0 && (
                    <div>
                      <h4 className="font-bold mb-2">AI Insights:</h4>
                      <div className="flex flex-wrap gap-2">
                        {journal.insights.map((insight, idx) => (
                          <span 
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                          >
                            💡 {insight}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View Full Entry Button */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Link 
                      href={`/reflection?contextType=${journal.contextType}&journalId=${journal.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View full entry →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filteredJournals.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No journal entries found for this filter.</p>
          <Link href="/reflection" className="text-blue-600 hover:underline mt-2 inline-block">
            Write your first reflection →
          </Link>
        </div>
      )}

      {/* Pattern Summary */}
      {journals.length > 0 && (
        <div className="mt-8 border-2 border-black rounded-lg p-6 bg-blue-50">
          <h3 className="font-bold text-lg mb-4">📊 Detected Patterns</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded border">
              <div className="font-medium text-green-600">✓ Positive Pattern</div>
              <div className="text-sm text-gray-600 mt-1">
                Morning routines correlate with higher productivity ratings
              </div>
            </div>
            <div className="bg-white p-4 rounded border">
              <div className="font-medium text-red-600">⚠ Warning Pattern</div>
              <div className="text-sm text-gray-600 mt-1">
                Extended social interactions often lead to next-day fatigue
              </div>
            </div>
            <div className="bg-white p-4 rounded border">
              <div className="font-medium text-blue-600">💡 Recommendation</div>
              <div className="text-sm text-gray-600 mt-1">
                Schedule recovery time after collaborative sessions
              </div>
            </div>
            <div className="bg-white p-4 rounded border">
              <div className="font-medium text-purple-600">🎯 Success Factor</div>
              <div className="text-sm text-gray-600 mt-1">
                Connecting with peers who understand your barriers boosts motivation
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
