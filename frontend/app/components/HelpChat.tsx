'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Send, Sparkles } from 'lucide-react'
import { FEEDBACK_EMAIL, feedbackMailto } from '@/lib/feedback'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STARTERS = ['How do I rate a service?', 'How do I delete my account?', 'Is Autinerary free?', 'How do I claim my listing?']

/**
 * The help chat (the products round's planning note, Goal 11): questions
 * about using Autinerary, answered with AI from what the Help page, the
 * terms and the privacy page say (lib/helpKnowledge.ts). Labelled as AI, not
 * saved, and always one step from a person (heydevs@).
 */
export default function HelpChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || busy) return
    const next: Message[] = [...messages, { role: 'user', content: question }]
    setMessages(next)
    setText('')
    setBusy(true)
    const res = await fetch('/api/help/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setMessages([...next, { role: 'assistant', content: d?.reply || d?.error || `I can’t answer just now. Please email ${FEEDBACK_EMAIL}.` }])
    setBusy(false)
    input.current?.focus()
  }

  return (
    <section id="ask" aria-labelledby="ask-heading" className="mt-12 scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="ask-heading" className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <Sparkles className="h-5 w-5 text-indigo-700" aria-hidden="true" /> Ask a question
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        Answers are written with AI, from what this page, the terms and the privacy page say. They can be wrong; nothing you type is
        saved by Autinerary.{' '}
        <Link href="/help#ai" className="font-medium text-indigo-800 underline underline-offset-2">
          How Autinerary uses AI
        </Link>
      </p>
      <div className="mt-4 space-y-3" aria-live="polite">
        {messages.map((m, i) => (
          <p key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-slate-900 ${m.role === 'user' ? 'ml-auto bg-indigo-50' : 'bg-slate-100'}`}>
            <span className="sr-only">{m.role === 'user' ? 'You: ' : 'Help chat: '}</span>
            {m.content}
          </p>
        ))}
        {busy && <p className="text-sm text-slate-700">Thinking…</p>}
      </div>
      {messages.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-800 hover:bg-slate-50">
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void ask(text)
        }}
        className="mt-4 flex gap-2"
      >
        <label htmlFor="help-q" className="sr-only">
          Your question
        </label>
        <input ref={input} id="help-q" value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} placeholder="Ask about using Autinerary…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
        <button type="submit" disabled={busy || !text.trim()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">
          <Send className="h-4 w-4" aria-hidden="true" /> Ask
        </button>
      </form>
      <p className="mt-3 text-sm text-slate-700">
        Rather ask a person?{' '}
        <a href={feedbackMailto('', { kind: 'question' })} className="font-medium text-indigo-800 underline underline-offset-2">
          Email {FEEDBACK_EMAIL}
        </a>
        . In a crisis, call 911, or call or text 9-8-8.
      </p>
    </section>
  )
}
