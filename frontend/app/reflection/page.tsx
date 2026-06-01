'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import { Sparkles, Send, BookOpen, Lightbulb, Target, Brain, Heart, Sun, Moon, Palette } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type Theme = 'dark' | 'light' | 'colorful'

function ReflectionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const contextType = searchParams.get('contextType') || 'path'
  const contextId = searchParams.get('contextId') || ''
  
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')
  const [showThemeMenu, setShowThemeMenu] = useState(false)
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

  const questions = [
    { id: 'q1', text: 'How was it/today/this period of time?', icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
    { id: 'q2', text: 'How well done do you think it was?', icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { id: 'q3', text: 'What would you improve?', icon: Brain, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' },
    { id: 'q4', text: 'What could we improve?', icon: Sparkles, color: 'text-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-200' },
    { id: 'q5', text: 'Any other thoughts or feelings?', icon: Heart, color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-200' },
  ]

  // Theme configurations
  const themeConfigs = {
    dark: {
      bg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
      card: 'bg-white/10 backdrop-blur-lg border-white/20',
      text: 'text-white',
      textSecondary: 'text-slate-300',
    },
    light: {
      bg: 'bg-gradient-to-br from-slate-50 via-white to-slate-100',
      card: 'bg-white border-slate-200',
      text: 'text-slate-800',
      textSecondary: 'text-slate-600',
    },
    colorful: {
      bg: 'bg-gradient-to-br from-pink-200 via-purple-200 to-cyan-200',
      card: 'bg-white/90 backdrop-blur-lg border-purple-300',
      text: 'text-slate-800',
      textSecondary: 'text-slate-600',
    },
  }

  const currentTheme = themeConfigs[theme]

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await axios.post(`${API_URL}/api/reflections/`, {
        contextType,
        contextId: contextId || 'default',
        questions: questions.map((q) => ({
          id: q.id,
          question: q.text,
          answer: answers[q.id as keyof typeof answers] || ''
        })),
        freeFormText: Object.values(answers).join('\n')
      })
      alert('Reflection submitted successfully!')
      router.push('/path')
    } catch (error) {
      console.error('Error:', error)
      alert('Error submitting reflection')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen ${currentTheme.bg} p-4 md:p-8 relative overflow-hidden`}>
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
            className="p-3 bg-white/20 backdrop-blur-lg rounded-full border-2 border-white/30 hover:bg-white/30 transition-all shadow-lg"
            title="Change theme"
          >
            <Palette className="w-5 h-5 text-white" />
          </button>
          {showThemeMenu && (
            <div className="absolute top-14 right-0 bg-white/90 backdrop-blur-lg rounded-xl border-2 border-white/30 shadow-2xl p-2 min-w-[150px]">
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
                  theme === 'colorful' ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' : 'hover:bg-slate-100 text-slate-700'
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
        {/* Main Card */}
        <div className={`${currentTheme.card} rounded-2xl border-2 p-6 md:p-8 shadow-2xl`}>
          {/* Header with Animal and Pencil */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-4">
              {/* Animal with Pencil */}
              <div className="relative">
                <div className="text-6xl animate-bounce" style={{ animationDuration: '1.5s' }}>
                  🐰
                </div>
                <div className="absolute -top-2 -right-4 text-3xl animate-pulse" style={{ animationDuration: '1s' }}>
                  ✏️
                </div>
              </div>
            </div>
            <h1 className={`text-3xl font-bold ${currentTheme.text} mb-2`}>Journal</h1>
            <p className={`${currentTheme.textSecondary} mt-2`}>Take a moment to reflect on your journey</p>
          </div>

          {/* Questions */}
          <div className="space-y-5">
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
                    className={`w-full ${theme === 'dark' ? 'bg-white/10 border-white/20 text-white placeholder-slate-400' : `${q.bg} ${q.border} text-slate-700 placeholder-slate-400`} border-2 rounded-xl p-4 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-300 transition-all resize-none`}
                    placeholder="Write your thoughts here..."
                  />
                </div>
              )
            })}
          </div>

          {/* More questions indicator */}
          <div className={`text-center my-6 text-sm italic ${currentTheme.textSecondary}`}>
            (more questions coming soon...)
          </div>

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
                  ? 'bg-white/10 text-white border-white/20 hover:bg-white/20' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              } rounded-xl font-bold transition-all border-2`}
            >
              <BookOpen className="w-5 h-5" />
              See previous journals
            </Link>
          </div>
        </div>
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
