'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Sparkles, Loader2 } from 'lucide-react'
import { useAgentPath } from '../context/AgentPathContext'

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

const INTRO: Msg = {
  role: 'assistant',
  content:
    "Hi — I'm your assistant. Stuck on a goal, a milestone, or a barrier? Tell me what's going on and I'll help you think through practical next steps.",
}

const STARTERS = [
  "I'm stuck on my current milestone",
  'Help me break a goal into smaller steps',
  'How do I ask for an accommodation?',
  'I feel overwhelmed — where do I start?',
]

/** Read the locally cached onboarding profile (fallback context source). */
function readProfile(): any {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('autinerary_profile')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Build the context summary sent to the assistant. Prefers the live agent
 * payload (goals, current + upcoming milestones, tool recommendations) so the
 * assistant sees the full path; falls back to the cached onboarding profile.
 */
function buildContext(payload: any): string {
  const parts: string[] = []
  const profile = readProfile()
  const up = payload?.userProfile || {}

  const goals = [...(up.goals || []), ...(profile?.goals || [])].filter((g: any) => typeof g === 'string' && g.trim())
  const dreams = (up.dreams || []).filter((d: any) => typeof d === 'string' && d.trim())
  const obstacles = (up.currentChallenges || []).filter((o: any) => typeof o === 'string' && o.trim())
  const norms = [...(up.barrierTypes || []), ...(profile?.barriers || [])].filter((b: any) => typeof b === 'string' && b.trim())

  if (goals.length) parts.push(`Goals: ${Array.from(new Set(goals)).slice(0, 8).join('; ')}`)
  if (dreams.length) parts.push(`Dreams: ${dreams.slice(0, 5).join('; ')}`)
  if (obstacles.length) parts.push(`Obstacles they flagged: ${obstacles.slice(0, 6).join('; ')}`)
  if (norms.length) parts.push(`Norms they navigate: ${Array.from(new Set(norms)).slice(0, 12).join(', ')}`)

  // Current + upcoming milestones from the agent path, if present.
  const milestones = Array.isArray(payload?.milestones) ? payload.milestones : []
  if (milestones.length) {
    const names = milestones
      .map((m: any) => (typeof m?.name === 'string' ? m.name : typeof m?.title === 'string' ? m.title : null))
      .filter(Boolean)
      .slice(0, 8)
    if (names.length) parts.push(`Milestones on their path: ${names.join('; ')}`)
  }

  if (profile?.lifeStage) parts.push(`Life stage: ${profile.lifeStage}`)
  if (profile?.role) parts.push(`Role: ${profile.role}`)

  return parts.join('\n')
}

export default function AssistantPage() {
  const router = useRouter()
  const { payload } = useAgentPath()
  const [messages, setMessages] = useState<Msg[]>([INTRO])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [warmingUp, setWarmingUp] = useState(false)
  const [context, setContext] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => setContext(buildContext(payload)), [payload])
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || sending) return
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next)
    setInput('')
    setSending(true)
    // The backend sleeps when idle; if a reply is slow, reassure the user it's
    // waking up rather than broken.
    const warmTimer = setTimeout(() => setWarmingUp(true), 7000)
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Only real turns (drop the canned intro) go to the model.
          messages: next.filter((m) => m !== INTRO),
          context,
        }),
      })
      const data = await res.json().catch(() => null)
      const reply = data?.reply || "Sorry — I couldn't respond just now. Please try again."
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      clearTimeout(warmTimer)
      setWarmingUp(false)
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-tight">Assistant</div>
              <div className="text-[11px] text-slate-500 leading-tight">Here to help you get unstuck</div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gradient-to-br from-cyan-500 to-purple-500 text-white rounded-br-sm'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                {warmingUp && (
                  <span className="text-xs text-slate-500">Waking the assistant up — this first reply can take up to a minute…</span>
                )}
              </div>
            </div>
          )}

          {/* Starter chips — only before the first user message */}
          {messages.length === 1 && !sending && (
            <div className="flex flex-wrap gap-2 pt-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-cyan-300 hover:text-cyan-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="max-w-2xl mx-auto px-4 py-3 flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            rows={1}
            placeholder="Ask anything…"
            className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 max-h-32"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 text-white flex items-center justify-center disabled:opacity-40 transition-opacity"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-center text-[10px] text-slate-400 pb-2 px-4">
          The assistant can be wrong. For medical, legal, or crisis help, contact a professional.
        </p>
      </div>
    </div>
  )
}
