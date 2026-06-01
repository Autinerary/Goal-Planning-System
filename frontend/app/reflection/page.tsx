'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import { Sparkles, Send, BookOpen, Lightbulb, Target, Brain, Heart } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function ReflectionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const contextType = searchParams.get('contextType') || 'path'
  const contextId = searchParams.get('contextId') || ''
  
  const [loading, setLoading] = useState(false)
  const [answers, setAnswers] = useState({
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    q5: '',
  })

  const questions = [
    { id: 'q1', text: 'How was it/today/this period of time?', icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
    { id: 'q2', text: 'How well done do you think it was?', icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { id: 'q3', text: 'What would you improve?', icon: Brain, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' },
    { id: 'q4', text: 'What could we improve?', icon: Sparkles, color: 'text-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-200' },
    { id: 'q5', text: 'Any other thoughts or feelings?', icon: Heart, color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-200' },
  ]

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
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Main Card */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 md:p-8 shadow-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl mb-4 shadow-lg">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Journal</h1>
            <p className="text-slate-500 mt-2">Take a moment to reflect on your journey</p>
          </div>

          {/* Questions */}
          <div className="space-y-5">
            {questions.map((q) => {
              const Icon = q.icon
              return (
                <div key={q.id}>
                  <label className="flex items-center gap-2 text-slate-700 font-medium mb-2">
                    <Icon className={`w-5 h-5 ${q.color}`} />
                    Q: {q.text}
                  </label>
                  <textarea
                    value={answers[q.id as keyof typeof answers]}
                    onChange={(e) => setAnswers(prev => ({ 
                      ...prev, 
                      [q.id]: e.target.value 
                    }))}
                    className={`w-full ${q.bg} border-2 ${q.border} rounded-xl p-4 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300 transition-all resize-none text-slate-700 placeholder-slate-400`}
                    placeholder="Write your thoughts here..."
                  />
                </div>
              )
            })}
          </div>

          {/* More questions indicator */}
          <div className="text-center my-6 text-sm italic text-slate-400">
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
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all border-2 border-slate-200"
            >
              <BookOpen className="w-5 h-5" />
              See previous journals
            </Link>
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
