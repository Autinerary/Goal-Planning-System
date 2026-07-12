'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { ChevronLeft, Calendar, ChevronDown, ChevronUp, Smile, Meh, Frown, Loader2, Upload, Sparkles, X } from 'lucide-react'
import { buildMotivationReport, MOTIVATION_META } from '@/lib/motivation'

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
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    fetchJournals()
  }, [])

  const fetchJournals = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await axios.get(`${API_URL}/api/reflections/user/user_123`)
      setJournals(Array.isArray(response.data) ? response.data : [])
    } catch (err) {
      console.error('Error fetching journals:', err)
      // Backend (Python, port 8000) may not be running; show empty state instead of blocking error
      setJournals([])
      setError(null)
    } finally {
      setLoading(false)
    }
  }

  // Split pasted/uploaded text into entries. A line of only dashes, or a blank
  // line between paragraphs, separates entries; otherwise the whole blob is one.
  const splitEntries = (raw: string): string[] => {
    const byDivider = raw
      .split(/\n\s*(?:-{3,}|={3,}|\*{3,})\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (byDivider.length > 1) return byDivider
    const byBlank = raw
      .split(/\n\s*\n\s*\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
    return byBlank.length ? byBlank : [raw.trim()].filter(Boolean)
  }

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const texts = await Promise.all(files.map((f) => f.text().catch(() => '')))
    setImportText((prev) => [prev, ...texts].filter(Boolean).join('\n\n---\n\n'))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImportSubmit = async () => {
    const entries = splitEntries(importText)
    if (!entries.length) {
      setImportMsg('Nothing to import — paste text or choose a file first.')
      return
    }
    setImportBusy(true)
    setImportMsg(null)
    let ok = 0
    for (const text of entries) {
      try {
        await axios.post(`${API_URL}/api/reflections/`, {
          contextType: 'imported',
          contextId: 'imported',
          questions: [{ id: 'imported', question: 'Imported journal entry', answer: text }],
          freeFormText: text,
          source: 'import',
        })
        ok++
      } catch {
        /* backend may be offline; keep going */
      }
    }
    setImportBusy(false)
    setImportMsg(
      ok === entries.length
        ? `Imported ${ok} ${ok === 1 ? 'entry' : 'entries'}. They’ll be considered in your reflections.`
        : ok > 0
          ? `Imported ${ok} of ${entries.length}. Some couldn’t be saved (is the backend running?).`
          : `Couldn’t save entries — the journal backend may be offline. Your text is kept below so you can retry.`
    )
    if (ok > 0) {
      setImportText('')
      fetchJournals()
    }
  }

  // Motivation report — computed from the text of all loaded entries.
  const motivationReport = buildMotivationReport(
    journals.flatMap((j) => [
      j.summary || '',
      ...(j.questions || []).map((qa) => qa.a || ''),
    ])
  )

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
      <div className="min-h-screen bg-white/20 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600">Loading journals...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white/20 backdrop-blur-sm p-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/reflection" className="p-2 border-2 border-black rounded hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">All Entries</h1>
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
    <div className="min-h-screen bg-white/20 backdrop-blur-sm p-4 md:p-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/reflection" className="p-2 bg-white/60 backdrop-blur-lg border-2 border-slate-300 rounded-lg hover:bg-white/80 transition-all">
            <ChevronLeft className="w-5 h-5 text-slate-800" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-4xl">📖</div>
            <h1 className="text-3xl font-bold text-slate-800">All Entries</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowImport((v) => !v)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> Import entries
            </button>
            <button
              onClick={fetchJournals}
              className="px-4 py-2 bg-white/60 backdrop-blur-lg border-2 border-slate-300 text-slate-800 rounded-lg hover:bg-white/80 transition-all text-sm font-medium"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Import panel — bring in journals kept elsewhere (Notes app, files, etc.) */}
        {showImport && (
          <div className="mb-8 bg-white/70 backdrop-blur-lg border-2 border-cyan-300 rounded-xl p-6 shadow-lg">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-cyan-600" /> Import past journal entries
                </h2>
                <p className="text-sm text-slate-600 mt-1 max-w-xl">
                  Keep a journal somewhere else (phone Notes, a doc, text files)? Paste it or upload
                  files here for a mass import. Separate entries with a blank line or a line of
                  <code className="mx-1">---</code>. They&apos;ll be considered in your reflections and reports.
                </p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste your journal entries here…"
              className="w-full min-h-[160px] rounded-xl border-2 border-slate-300 p-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 resize-y bg-white/80"
            />
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.text,text/plain,text/markdown"
                multiple
                onChange={handleFilePick}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium inline-flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Choose files (.txt / .md)
              </button>
              <button
                onClick={handleImportSubmit}
                disabled={importBusy || !importText.trim()}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
              >
                {importBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {importBusy ? 'Importing…' : 'Import & consider these'}
              </button>
              {importMsg && <span className="text-sm text-slate-600">{importMsg}</span>}
            </div>
          </div>
        )}

        {/* Motivation Style report — "____ was your best Motivation Style" */}
        {motivationReport.top && (
          <div className="mb-8 bg-gradient-to-r from-indigo-500/15 to-purple-500/15 backdrop-blur-lg border-2 border-indigo-300 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-800">Your Motivation Style report</h2>
            </div>
            <p className="text-slate-800 text-lg">
              <span className="text-2xl mr-1">{MOTIVATION_META[motivationReport.top].emoji}</span>
              <span className="font-bold">{MOTIVATION_META[motivationReport.top].label}</span> was your
              best Motivation Style this month.
            </p>
            <p className="text-sm text-slate-600 mt-1">
              {MOTIVATION_META[motivationReport.top].blurb} Based on {motivationReport.entryCount}{' '}
              {motivationReport.entryCount === 1 ? 'entry' : 'entries'}.
            </p>
            <div className="mt-3 space-y-1.5">
              {motivationReport.ranked
                .filter((r) => r.score > 0)
                .slice(0, 4)
                .map((r) => {
                  const pct = Math.round((r.score / motivationReport.totalHits) * 100)
                  return (
                    <div key={r.style} className="flex items-center gap-2">
                      <span className="w-32 text-xs text-slate-700 shrink-0">
                        {MOTIVATION_META[r.style].emoji} {MOTIVATION_META[r.style].label}
                      </span>
                      <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-9 text-right">{pct}%</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/60 backdrop-blur-lg border-2 border-slate-300 rounded-xl p-6 text-center shadow-lg">
            <div className="text-4xl font-bold text-slate-800 mb-2">{journals.length}</div>
            <div className="text-sm text-slate-700">Total Entries</div>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-lg border-2 border-green-400/30 rounded-xl p-6 text-center shadow-lg">
            <div className="text-4xl font-bold text-green-700 mb-2">{sentimentCounts.positive}</div>
            <div className="text-sm text-green-800">Positive Days</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/20 to-amber-500/20 backdrop-blur-lg border-2 border-yellow-400/30 rounded-xl p-6 text-center shadow-lg">
            <div className="text-4xl font-bold text-amber-700 mb-2">{sentimentCounts.neutral}</div>
            <div className="text-sm text-amber-800">Neutral Days</div>
          </div>
          <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-lg border-2 border-red-400/30 rounded-xl p-6 text-center shadow-lg">
            <div className="text-4xl font-bold text-red-700 mb-2">{sentimentCounts.negative}</div>
            <div className="text-sm text-red-800">Challenging Days</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          {(['all', 'positive', 'neutral', 'negative'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2.5 rounded-lg capitalize font-medium transition-all ${
                filter === f 
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg scale-105' 
                  : 'bg-white/60 backdrop-blur-lg border-2 border-slate-300 text-slate-800 hover:bg-white/80'
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
              <div key={journal.id} className="bg-white/60 backdrop-blur-lg border-2 border-slate-300 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all">
                {/* Header Row */}
                <div 
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-white/40 transition-all"
                  onClick={() => setExpandedId(isExpanded ? null : journal.id)}
                >
                  {/* Sentiment Icon */}
                  <div className={`p-3 rounded-full ${sentimentData.bg} shadow-md`}>
                    <SentimentIcon className={`w-6 h-6 ${sentimentData.color}`} />
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-2 text-slate-700">
                    <Calendar className="w-4 h-4" />
                    <span className="font-mono text-sm">{journal.date}</span>
                  </div>

                  {/* Context Badge */}
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${contextTypeColors[journal.contextType] || 'bg-white/60 text-slate-800'}`}>
                    {journal.contextType}
                  </span>

                  {/* Context Name */}
                  <span className="font-medium flex-1 text-slate-800">{journal.contextName}</span>

                  {/* Expand Icon */}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-800" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-800" />
                  )}
                </div>

                {/* Summary (always visible) */}
                <div className="px-5 pb-4 -mt-2">
                  <p className="text-slate-700 italic">"{journal.summary}"</p>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t-2 border-slate-300 p-5 bg-white/40">
                    {/* Questions & Answers */}
                    {journal.questions && journal.questions.length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-bold mb-3 text-slate-800">Reflection Responses:</h4>
                        <div className="space-y-3">
                          {journal.questions.map((qa, idx) => (
                            <div key={idx} className="bg-white/60 backdrop-blur-sm p-4 rounded-lg border border-slate-300">
                              <div className="font-medium text-blue-600 text-sm mb-2">{qa.q}</div>
                              <div className="mt-1 text-slate-700 whitespace-pre-line [&>p]:indent-6 leading-relaxed">
                                {qa.a.split('\n').map((para: string, pIdx: number) => (
                                  <p key={pIdx} className={pIdx > 0 ? 'mt-2 indent-6' : ''}>{para}</p>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Insights */}
                    {journal.insights && journal.insights.length > 0 && (
                      <div>
                        <h4 className="font-bold mb-3 text-slate-800">AI Insights:</h4>
                        <div className="flex flex-wrap gap-2">
                          {journal.insights.map((insight, idx) => (
                            <span 
                              key={idx}
                              className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 backdrop-blur-sm border border-cyan-400/30 text-blue-700 rounded-full text-sm font-medium"
                            >
                              💡 {insight}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* View Full Entry Button */}
                    <div className="mt-6 pt-4 border-t border-slate-300">
                      <Link 
                        href={`/reflection?contextType=${journal.contextType}&journalId=${journal.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium flex items-center gap-1"
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
          <div className="text-center py-16 bg-white/60 backdrop-blur-lg border-2 border-slate-300 rounded-xl">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-slate-700 text-lg mb-4">No journal entries found for this filter.</p>
            <Link href="/reflection" className="text-blue-600 hover:text-blue-800 hover:underline font-medium inline-flex items-center gap-2">
              Write your first reflection →
            </Link>
          </div>
        )}

        {/* Pattern Summary */}
        {journals.length > 0 && (
          <div className="mt-10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 backdrop-blur-lg border-2 border-slate-300 rounded-xl p-8 shadow-2xl">
            <h3 className="font-bold text-2xl mb-6 text-slate-800 flex items-center gap-2">
              <span className="text-3xl">📊</span>
              Detected Patterns
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/60 backdrop-blur-sm p-5 rounded-lg border border-slate-300">
                <div className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                  <span>✓</span> Positive Pattern
                </div>
                <div className="text-sm text-slate-700">
                  Morning routines correlate with higher productivity ratings
                </div>
              </div>
              <div className="bg-white/60 backdrop-blur-sm p-5 rounded-lg border border-slate-300">
                <div className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <span>⚠</span> Warning Pattern
                </div>
                <div className="text-sm text-slate-700">
                  Extended social interactions often lead to next-day fatigue
                </div>
              </div>
              <div className="bg-white/60 backdrop-blur-sm p-5 rounded-lg border border-slate-300">
                <div className="font-semibold text-blue-600 mb-2 flex items-center gap-2">
                  <span>💡</span> Recommendation
                </div>
                <div className="text-sm text-slate-700">
                  Schedule recovery time after collaborative sessions
                </div>
              </div>
              <div className="bg-white/60 backdrop-blur-sm p-5 rounded-lg border border-slate-300">
                <div className="font-semibold text-purple-700 mb-2 flex items-center gap-2">
                  <span>🎯</span> Success Factor
                </div>
                <div className="text-sm text-slate-700">
                  Connecting with peers who understand the barriers you face boosts motivation
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
