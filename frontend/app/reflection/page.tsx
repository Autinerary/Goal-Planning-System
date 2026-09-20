'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import { Sparkles, Send, BookOpen, Lightbulb, Target, Brain, Heart, Sun, Moon, Palette } from 'lucide-react'
import { playPageTurnSound } from '@/lib/taskSound'
import AgentInsightsBanner from '../components/AgentInsightsBanner'
import { useAgentPath } from '../context/AgentPathContext'
import { createClient } from '@/lib/supabase/client'
import { toast } from '../components/Toaster'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type Theme = 'dark' | 'light' | 'colorful'
type LearningOutcome = '' | 'helped' | 'no_change' | 'made_worse' | 'not_sure'

function ReflectionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const contextType = searchParams.get('contextType') || 'path'
  const contextId = searchParams.get('contextId') || ''
  const { reflectionAnalysis, adaptation } = useAgentPath()
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [mode, setMode] = useState<'landing' | 'write'>('landing')
  const [learningOutcome, setLearningOutcome] = useState<LearningOutcome>('')
  const [completionPercent, setCompletionPercent] = useState(50)
  const [answers, setAnswers] = useState({
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    q5: '',
  })

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('journalTheme') as Theme
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  // Save theme to localStorage
  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem('journalTheme', newTheme)
    setShowThemeMenu(false)
  }

  /**
   * The thing being reflected on, named.
   *
   * The first question used to read "How was it/today/this period of time?"
   * — three guesses at the subject, separated by slashes, because the copy
   * did not know what the person had opened. It does: contextType is in the
   * URL. A tester suggested exactly this ("maybe a 'How was the thing you
   * are writing about?'"), so the form now names the subject instead of
   * listing possibilities.
   */
  const SUBJECTS: Record<string, string> = {
    path: 'your path',
    race: 'this goal',
    milestone: 'this milestone',
    task: 'this task',
    calendar: 'today',
    imported: 'this entry',
  }
  const subject = SUBJECTS[contextType] || 'this'

  const questions = [
    { id: 'q1', text: `How did ${subject} go?`, icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
    { id: 'q2', text: 'How well do you think it went?', icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    // q3 and q4 were "What would you improve?" and "What could we improve?".
    // Read one after the other those are the same question, and the reader
    // has to spot a single pronoun to tell them apart. One is about their
    // own approach, the other is feedback on the product; say so.
    { id: 'q3', text: 'What would you do differently next time?', icon: Brain, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' },
    { id: 'q4', text: 'What could Autinerary have done better?', icon: Sparkles, color: 'text-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-200' },
    { id: 'q5', text: 'Anything else on your mind?', icon: Heart, color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-200' },
  ]

  // Theme configurations
  const themeConfigs = {
    dark: {
      bg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
      card: 'surface-veil-dark',
      text: 'text-slate-900',
      textSecondary: 'text-slate-700',
    },
    light: {
      bg: 'bg-gradient-to-br from-slate-50 via-white to-slate-100',
      card: 'bg-white border-slate-200',
      text: 'text-slate-900',
      textSecondary: 'text-slate-600',
    },
    colorful: {
      bg: 'bg-gradient-to-br from-pink-200 via-purple-200 to-cyan-200',
      card: 'surface',
      text: 'text-slate-900',
      textSecondary: 'text-slate-700',
    },
  }

  const currentTheme = themeConfigs[theme]

  const handleSubmit = async () => {
    // Paper/page-turn cue so the entry clearly registered (Liam).
    playPageTurnSound()
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      await axios.post(`${API_URL}/api/reflections/`, {
        contextType,
        contextId: contextId || 'default',
        questions: questions.map((q) => ({
          id: q.id,
          question: q.text,
          answer: answers[q.id as keyof typeof answers] || ''
        })),
        freeFormText: Object.values(answers).join('\n'),
        learningFeedback: learningOutcome ? {
          outcome: learningOutcome,
          completionRate: completionPercent / 100,
          usedToolIds: [],
          pathHelpful: ['path', 'race', 'milestone', 'task'].includes(contextType)
            ? learningOutcome === 'helped'
              ? true
              : learningOutcome === 'made_worse'
                ? false
                : null
            : null,
          calendarHelpful: contextType === 'calendar'
            ? learningOutcome === 'helped'
              ? true
              : learningOutcome === 'made_worse'
                ? false
                : null
            : null,
        } : undefined,
      }, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      })
      toast.success('Reflection saved.')
      router.push('/reflection/history')
    } catch (error) {
      console.error('Error:', error)
      toast.error('Could not save your reflection. Your text is still here. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8 relative overflow-hidden surface-veil">
      <div className="max-w-4xl mx-auto mb-4 relative z-10 space-y-3">
        <AgentInsightsBanner agent="reflection_analysis" />
        <AgentInsightsBanner agent="adaptation" />
      </div>
      <style>{`
        @keyframes deskBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes penWrite{0%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}100%{transform:rotate(-5deg)}}
        @keyframes lampGlow{0%,100%{opacity:0.4}50%{opacity:0.8}}
      `}</style>

      {/* Background decorations */}
      {theme === 'dark' && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        </div>
      )}
      {theme === 'colorful' && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 w-64 h-64 bg-pink-300/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-300/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
          <div className="absolute top-1/2 right-1/4 w-72 h-72 bg-cyan-300/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        </div>
      )}
      
      {/* Theme Switch Button */}
      <div className="fixed top-6 right-6 z-50">
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="p-3 rounded-full border-2 border-white/30 hover:bg-white/30 transition-all shadow-lg surface-veil"
            title="Change theme"
          >
            <Palette className="w-5 h-5 text-slate-700" />
          </button>
          {showThemeMenu && (
            <div className="absolute top-14 right-0 rounded-xl p-2 min-w-[150px] surface">
              <button
                onClick={() => handleThemeChange('dark')}
                className={`w-full text-left px-4 py-2 rounded-lg mb-1 flex items-center gap-2 ${
                  theme === 'dark' ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Moon className="w-4 h-4" />
                Dark
              </button>
              <button
                onClick={() => handleThemeChange('light')}
                className={`w-full text-left px-4 py-2 rounded-lg mb-1 flex items-center gap-2 ${
                  theme === 'light' ? 'bg-slate-200 text-slate-800' : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Sun className="w-4 h-4" />
                Light
              </button>
              <button
                onClick={() => handleThemeChange('colorful')}
                className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 ${
                  theme === 'colorful' ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white' : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Palette className="w-4 h-4" />
                Colorful
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10">
      <div className="max-w-2xl mx-auto">
        {/* ── Landing Screen: choose new entry or view history ── */}
        {mode === 'landing' ? (
          <div className={`${currentTheme.card} rounded-2xl border-2 p-8 md:p-12 shadow-2xl`}>
            {/* Back to path */}
            <button
              onClick={() => router.push('/path')}
              className={`mb-4 text-sm ${currentTheme.textSecondary} hover:underline flex items-center gap-1`}
            >
              ← Back
            </button>
            {/* Desk scene */}
            <div className="text-center mb-8">
              <div className="relative inline-block mb-4">
                <div className="relative flex items-end justify-center gap-1">
                  <div className="flex flex-col items-center mr-2">
                    <div className="text-2xl" style={{ animation: 'lampGlow 3s ease-in-out infinite' }}>💡</div>
                    <div className="w-0.5 h-4 bg-amber-600 rounded" />
                  </div>
                  <div style={{ animation: 'deskBob 3s ease-in-out infinite' }}>
                    <div className="text-5xl">🐰</div>
                  </div>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-3 bg-amber-700 rounded-t-sm" />
                  <div className="text-lg mb-1 mr-1">📚</div>
                  <div style={{ animation: 'deskBob 3s ease-in-out infinite', animationDelay: '0.5s' }}>
                    <div className="text-4xl">🐢</div>
                  </div>
                  <div className="text-lg mb-1 ml-1">☕</div>
                </div>
              </div>
              <h1 className={`text-3xl font-bold ${currentTheme.text} mb-2`}>Journal</h1>
              <p className={`${currentTheme.textSecondary} mt-1`}>What would you like to do?</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setMode('write')}
                className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                  <Send className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-slate-800 text-lg">New Entry</span>
                <span className="text-sm text-slate-500">Write a new journal reflection</span>
              </button>

              <Link
                href="/reflection/history"
                className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-purple-50 to-cyan-50 border border-purple-200 rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-cyan-500 flex items-center justify-center shadow-md">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-slate-800 text-lg">All Entries</span>
                <span className="text-sm text-slate-500">Read your past journal entries</span>
              </Link>
            </div>
          </div>
        ) : (
        /* ── Write Mode: the entry form ── */
        <div className={`${currentTheme.card} rounded-2xl border-2 p-6 md:p-8 shadow-2xl`}>
          {/* Back to landing */}
          <button onClick={() => setMode('landing')} className={`mb-4 text-sm ${currentTheme.textSecondary} hover:underline flex items-center gap-1`}>
            ← Back
          </button>
          {/*
            Desk scene. A tester reported the props looking scattered: coffee
            hovering off the table, the pencil over the bunny's head, the
            lamp beside the bunny rather than above it. All three had the
            same cause.

            The desk was a fixed w-48 bar, absolutely positioned and centred,
            while the props were a content-width flex row — so the row was
            wider than the desk and the outermost prop, the coffee, hung past
            its edge. The pencil was absolutely positioned inside a bunny div
            that was never `relative`, so it resolved against the whole row
            and landed on the bunny's head instead of beside its paw. The
            lamp sat in its own column to the left.

            Now the desk is a sibling of the row inside an inline-block
            wrapper, so `w-full` is exactly the row's width and every prop
            stands on it. The bunny is its own positioning context, holding
            its pencil and sitting under its lamp.
          */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-4">
              <div className="flex items-end justify-center gap-3 px-3">
                {/* Bunny, with its lamp above and its pencil in hand */}
                <div className="relative" style={{ animation: 'deskBob 3s ease-in-out infinite' }}>
                  <div
                    className="absolute -top-6 left-1/2 -translate-x-1/2 text-xl"
                    style={{ animation: 'lampGlow 3s ease-in-out infinite' }}
                  >
                    💡
                  </div>
                  <div className="text-5xl leading-none">🐰</div>
                  <div
                    className="absolute bottom-1 -right-2 text-base"
                    style={{ animation: 'penWrite 1.5s ease-in-out infinite' }}
                  >
                    ✏️
                  </div>
                </div>
                {/* Books */}
                <div className="text-lg leading-none">📚</div>
                {/* Turtle reading */}
                <div style={{ animation: 'deskBob 3s ease-in-out infinite', animationDelay: '0.5s' }}>
                  <div className="text-4xl leading-none">🐢</div>
                </div>
                {/* Coffee */}
                <div className="text-lg leading-none">☕</div>
              </div>
              {/* Desk surface — spans the row above it, so nothing floats. */}
              <div className="h-2 w-full rounded-lg bg-amber-700" />
            </div>
            <h1 className={`text-3xl font-bold ${currentTheme.text} mb-2`}>Journal</h1>
            <p className={`${currentTheme.textSecondary} mt-1`}>Take a moment to reflect on your journey</p>
            {/*
              Removed: "Auto-journal captures your progress as you go".

              A tester asked what it meant, having reasonably assumed it was
              auto-save. It is neither. There is no auto-journal anywhere in
              the codebase — the string was the only trace of it. Promising a
              feature that does not exist is worse than saying nothing,
              especially next to a form someone is about to trust with their
              writing. If auto-capture gets built, this line can come back.
            */}
          </div>

          {/* Questions */}
          {(() => {
            const themes: string[] = (reflectionAnalysis?.keyThemes || reflectionAnalysis?.themes || []) as string[]
            const sentiment: string | undefined = reflectionAnalysis?.overallSentiment || reflectionAnalysis?.sentiment
            const recs: any[] = (adaptation?.recommendations || adaptation?.adjustments || []) as any[]
            const hasAny = (themes && themes.length) || sentiment || (recs && recs.length)
            if (!hasAny) return null
            return (
              <div className={`mb-6 p-4 rounded-xl border-2 ${theme === 'dark' ? 'bg-white/80 border-slate-300 text-slate-800' : 'bg-purple-50 border-purple-200 text-slate-700'}`}>
                <div className="font-bold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Agent insights from past reflections</div>
                {sentiment && <div className="text-sm mb-1">Sentiment: <span className="font-semibold capitalize">{sentiment}</span></div>}
                {themes && themes.length > 0 && (
                  <div className="text-sm mb-2">
                    <span className="font-semibold">Recurring themes: </span>
                    {themes.slice(0, 5).join(' · ')}
                  </div>
                )}
                {recs && recs.length > 0 && (
                  <ul className="text-sm list-disc pl-4 space-y-1">
                    {recs.slice(0, 3).map((r: any, i: number) => (
                      <li key={i}>{typeof r === 'string' ? r : (r.description || r.action || r.title)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })()}

          <div className="space-y-6">
            {questions.map((q) => {
              const Icon = q.icon
              return (
                <div key={q.id}>
                  <label className={`flex items-center gap-2 ${currentTheme.text} font-medium mb-2`}>
                    <Icon className={`w-5 h-5 ${q.color}`} />
                    Q: {q.text}
                  </label>
                  <textarea
                    value={answers[q.id as keyof typeof answers]}
                    onChange={(e) => setAnswers(prev => ({ 
                      ...prev, 
                      [q.id]: e.target.value 
                    }))}
                    className={`w-full ${theme === 'dark' ? 'bg-white/80 border-slate-300 text-slate-900 placeholder-slate-400' : `${q.bg} ${q.border} text-slate-700 placeholder-slate-400`} border-2 rounded-xl p-4 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-300 transition-all resize-none`}
                    placeholder="Write your thoughts here..."
                  />
                </div>
              )
            })}
          </div>

          <fieldset className={`mt-6 rounded-xl border-2 p-4 ${theme === 'dark' ? 'border-white/20 bg-white/10' : 'border-slate-200 bg-white/70'}`}>
            {/*
              A tester read the old copy and asked: "is this a feedback form,
              or something that is fed into AI? What alternative does it
              bring?" Fair questions that the text did not answer — it said
              "only this direct answer can change future agent behavior",
              which is written for someone who already knows there is a
              learning loop behind it.

              What is actually true, and now what it says: the answer is
              scoped to this user (close_adaptation_loop takes user_id_in),
              it is the only input to that loop, and "Not sure" is recorded
              but carries no reward. Nothing here trains anything for anyone
              else, and the journal text is never scored.
            */}
            <legend className={`px-2 font-semibold ${currentTheme.text}`}>Did this suggestion help you?</legend>
            <p className={`mb-1 text-sm ${currentTheme.textSecondary}`}>
              Optional. This is the one thing that changes what Autinerary suggests to <em>you</em> next
              time: say it helped and you will see more like it, say it made things worse and you will
              see less.
            </p>
            <p className={`mb-3 text-xs ${currentTheme.textSecondary}`}>
              It stays on your account and is not used to train anything for anyone else. What you write
              above is never graded or read as a rating, only this answer counts. &ldquo;Not sure&rdquo;
              is recorded and changes nothing.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: 'helped', label: 'Helped' },
                { id: 'no_change', label: 'No change' },
                { id: 'made_worse', label: 'Made it worse' },
                { id: 'not_sure', label: 'Not sure' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={learningOutcome === option.id}
                  onClick={() => setLearningOutcome(option.id as LearningOutcome)}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                    learningOutcome === option.id
                      ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-cyan-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {learningOutcome && learningOutcome !== 'not_sure' && (
              <div className="mt-4">
                <div className={`text-sm font-medium ${currentTheme.text} mb-2`}>
                  How much did you complete? <span className="font-bold text-cyan-700">{completionPercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={completionPercent}
                  aria-label="How much did you complete?"
                  onChange={(event) => setCompletionPercent(Number(event.target.value))}
                  onInput={(event) => setCompletionPercent(Number((event.target as HTMLInputElement).value))}
                  className="block w-full h-2 rounded-full appearance-none cursor-pointer accent-cyan-600"
                  style={{ background: `linear-gradient(to right, #0891b2 ${completionPercent}%, #e2e8f0 ${completionPercent}%)` }}
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>0%</span><span>100%</span>
                </div>
              </div>
            )}
          </fieldset>

          {/* Removed "(more questions coming soon...)" — a note to ourselves
              that shipped to users, telling them the form is unfinished
              right at the point they are deciding whether to submit it. */}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-amber-200 transition-all disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
              {loading ? 'Submitting...' : 'Submit'}
            </button>
            <Link 
              href="/reflection/history"
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 ${
                theme === 'dark' 
                  ? 'bg-white/80 text-slate-800 border-slate-300 hover:bg-white' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              } rounded-xl font-bold transition-all border-2`}
            >
              <BookOpen className="w-5 h-5" />
              See previous journals
            </Link>
          </div>
        </div>
        )}
      </div>
      </div>
    </div>
  )
}

export default function ReflectionView() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>}>
      <ReflectionContent />
    </Suspense>
  )
}
