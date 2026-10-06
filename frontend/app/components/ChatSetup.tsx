'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/funnel'
import type { GoalIdea } from './GoalHelper'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Setup as a chat: "answer by chatting" (Riipen Labs, Group 11: an optional
 * mode that "fills the same fields and reflects progress back: 'Great to
 * meet you, Sam. You're in Toronto and focused on career.'").
 *
 * The same questions as the form, one at a time, with buttons first and
 * typing optional; it fills the same answers, so everything after setup is
 * identical. It is scripted, not a chatbot: AI is used only when someone
 * types a goal in their own words, through the goal helper
 * (core/goal_helper.py), and its suggestions are labelled as AI.
 */

interface Line { from: 'bot' | 'you'; text: string; ai?: boolean }
type Step = 'age' | 'audience' | 'category' | 'goal' | 'own' | 'city' | 'done' | 'under18'

const AUDIENCE_PHRASE: Record<string, string> = {
  self: 'here for yourself',
  child: 'here for your child',
  family: 'here for a family member',
  friend: 'here for a friend',
  work: 'here for someone you teach, support or work with',
  ally: 'here as an ally',
  unsure: 'still deciding who this is for',
}

export default function ChatSetup({
  name, audiences, audienceValue, categories, ideasFor, helperIdeas,
  onAge, onAudience, onGoal, onUndoGoal, onCity, onCreate, onMore, onForm, isSubmitting,
}: {
  name: string
  audiences: { id: string; label: string }[]
  audienceValue: Record<string, string>
  categories: { id: string; label: string }[]
  ideasFor: (category: string) => string[]
  helperIdeas: GoalIdea[]
  onAge: (value: 'adult' | 'under18') => void
  onAudience: (id: string) => void
  onGoal: (category: string, goal: string) => void
  onUndoGoal: (category: string, goal: string) => void
  onCity: (city: string) => void
  onCreate: () => void
  onMore: () => void
  onForm: () => void
  isSubmitting: boolean
}) {
  const hello = name ? `Hi ${name}.` : 'Hi.'
  const [lines, setLines] = useState<Line[]>([
    { from: 'bot', text: `${hello} I'll ask a few short questions, one at a time. Tap an answer, or type when you'd like to. There are no wrong answers.` },
    { from: 'bot', text: 'First: are you 18 or older?' },
  ])
  const [step, setStep] = useState<Step>('age')
  const [chosen, setChosen] = useState({ audience: '', category: '', goal: '', city: '' })
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<{ category: string; text: string }[] | null>(null)
  const [busy, setBusy] = useState(false)
  const answers = useRef<HTMLDivElement>(null)
  const label = (id: string) => categories.find((c) => c.id === id)?.label || 'Other'

  useEffect(() => {
    track('feature_use', 'setup_chat')
  }, [])
  // Focus follows the conversation: the first answer to the new question.
  useEffect(() => {
    answers.current?.querySelector<HTMLElement>('button, input')?.focus()
  }, [step, suggestions])

  const say = (...next: Line[]) => setLines((l) => [...l, ...next])

  const age = (value: 'adult' | 'under18') => {
    onAge(value)
    if (value === 'under18') {
      say({ from: 'you', text: "I'm under 18" }, { from: 'bot', text: 'Sorry, Autinerary is only for people 18 and over right now. Soon, a trusted adult will be able to set it up with you.' })
      setStep('under18')
      return
    }
    say({ from: 'you', text: "Yes, I'm 18 or older" }, { from: 'bot', text: 'Who are you here for?' })
    setStep('audience')
  }

  const audience = (id: string, labelText: string) => {
    onAudience(id)
    setChosen((c) => ({ ...c, audience: id }))
    say(
      { from: 'you', text: labelText },
      ...(audienceValue[id] ? [{ from: 'bot' as const, text: audienceValue[id] }] : []),
      { from: 'bot', text: "Now, one goal to start with. Pick a kind of goal, or say it in your own words." },
    )
    setStep('category')
  }

  const category = (id: string) => {
    setChosen((c) => ({ ...c, category: id }))
    say({ from: 'you', text: label(id) }, { from: 'bot', text: `What would you like to do? Type it, or tap an idea.` })
    setStep('goal')
  }

  const goal = (category: string, goalText: string) => {
    const g = goalText.trim()
    if (!g) return
    onGoal(category, g)
    setChosen((c) => ({ ...c, category, goal: g }))
    setText('')
    setSuggestions(null)
    say({ from: 'you', text: g }, { from: 'bot', text: 'Where are you? A town or city helps find services near you. You can skip this.' })
    setStep('city')
  }

  const ask = async () => {
    const words = text.trim()
    if (!words || busy) return
    setBusy(true)
    say({ from: 'you', text: words })
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch(`${API_URL}/api/onboarding/goal-helper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ text: words, audience: chosen.audience || null, ideas: helperIdeas }),
        signal: AbortSignal.timeout(45000),
      })
      const json = await res.json().catch(() => null)
      if (json?.crisis) {
        say({ from: 'bot', text: [json.crisis.message, ...json.crisis.lines.map((l: any) => `${l.name}: ${l.how}.`), json.crisis.after].join(' ') })
        setSuggestions([])
      } else if (Array.isArray(json?.suggestions) && json.suggestions.length) {
        say({ from: 'bot', text: 'Here are some ways to put it. Tap one, or keep your own words.', ai: true })
        setSuggestions(json.suggestions)
        track('feature_use', 'goal_helper')
      } else {
        say({ from: 'bot', text: 'I can keep your words as they are. Tap below to use them.' })
        setSuggestions([])
      }
    } catch {
      say({ from: 'bot', text: 'I can keep your words as they are. Tap below to use them.' })
      setSuggestions([])
    } finally {
      setBusy(false)
    }
  }

  const city = (value: string) => {
    const c = value.trim()
    if (c) onCity(c)
    setChosen((x) => ({ ...x, city: c }))
    setText('')
    const where = c ? `, in ${c}` : ''
    say(
      { from: 'you', text: c || 'Skip' },
      { from: 'bot', text: `Great to meet you${name ? `, ${name}` : ''}. You're ${AUDIENCE_PHRASE[chosen.audience] || 'here'}${where}, and focused on ${label(chosen.category)}: “${chosen.goal}”.` },
      { from: 'bot', text: 'That is all your path needs. Create it now, or add more details first, like your norms. Everything else is optional.' },
    )
    setStep('done')
  }

  const restart = () => {
    if (chosen.goal) onUndoGoal(chosen.category, chosen.goal)
    setChosen({ audience: '', category: '', goal: '', city: '' })
    setLines([{ from: 'bot', text: 'No problem. Who are you here for?' }])
    setSuggestions(null)
    setText('')
    setStep('audience')
  }

  const chip = 'rounded-full border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-950 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
  const input = 'min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300'
  const send = 'rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-700'

  return (
    <section aria-labelledby="chat-setup-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="chat-setup-heading" className="text-2xl font-bold text-slate-800">Setup, as a chat</h2>
        <button type="button" onClick={onForm} className="text-sm font-medium text-indigo-800 underline underline-offset-2">Switch to the form</button>
      </div>
      <div role="log" aria-live="polite" className="mt-4 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className={`flex ${l.from === 'you' ? 'justify-end' : 'justify-start'}`}>
            <p className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2 text-sm ${l.from === 'you' ? 'bg-indigo-700 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>
              <span className="sr-only">{l.from === 'you' ? 'You: ' : 'Autinerary: '}</span>
              {l.ai && <span className="mr-1 rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-900">AI suggestions</span>}
              {l.text}
            </p>
          </div>
        ))}
      </div>

      <div ref={answers} className="mt-4 flex flex-wrap gap-2" aria-label="Your answer" role="group">
        {step === 'age' && (
          <>
            <button type="button" className={chip} onClick={() => age('adult')}>Yes, I&apos;m 18 or older</button>
            <button type="button" className={chip} onClick={() => age('under18')}>No, I&apos;m under 18</button>
          </>
        )}
        {step === 'audience' && audiences.map((a) => (
          <button key={a.id} type="button" className={chip} onClick={() => audience(a.id, a.label)}>{a.label}</button>
        ))}
        {step === 'category' && (
          <>
            {categories.map((c) => (
              <button key={c.id} type="button" className={chip} onClick={() => category(c.id)}>{c.label}</button>
            ))}
            <button type="button" className={chip} onClick={() => { setStep('own'); say({ from: 'bot', text: 'Say it in your own words. For example: “I want a job, but interviews stress me out.”' }) }}>
              In my own words
            </button>
          </>
        )}
        {step === 'goal' && (
          <>
            {ideasFor(chosen.category).slice(0, 4).map((idea) => (
              <button key={idea} type="button" className={chip} onClick={() => goal(chosen.category, idea)}>{idea}</button>
            ))}
            <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); goal(chosen.category, text) }}>
              <label htmlFor="chat-goal" className="sr-only">Your goal</label>
              <input id="chat-goal" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Type your goal" className={input} />
              <button type="submit" className={send} disabled={!text.trim()}>Send</button>
            </form>
          </>
        )}
        {step === 'own' && (
          suggestions === null ? (
            <form className="w-full space-y-1" onSubmit={(e) => { e.preventDefault(); ask() }}>
              <div className="flex gap-2">
                <label htmlFor="chat-own" className="sr-only">Your goal, in your own words</label>
                <input id="chat-own" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="What would you like to do or change?" className={input} />
                <button type="submit" className={send} disabled={!text.trim() || busy}>{busy ? 'Thinking…' : 'Send'}</button>
              </div>
              <p className="text-xs text-slate-700">An AI helper suggests ways to put it. What you type is sent to OpenAI for that, and is not saved.</p>
            </form>
          ) : (
            <>
              {suggestions.map((s) => (
                <button key={`${s.category}:${s.text}`} type="button" className={chip} onClick={() => goal(s.category, s.text)}>{s.text}</button>
              ))}
              <button type="button" className={chip} onClick={() => goal('other', [...lines].reverse().find((l) => l.from === 'you')?.text || '')}>Use my own words</button>
            </>
          )
        )}
        {step === 'city' && (
          <form className="flex w-full flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); city(text) }}>
            <label htmlFor="chat-city" className="sr-only">Town or city</label>
            <input id="chat-city" value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="e.g., Toronto" className={input} />
            <button type="submit" className={send} disabled={!text.trim()}>Send</button>
            <button type="button" className={chip} onClick={() => city('')}>Skip</button>
          </form>
        )}
        {step === 'done' && (
          <>
            <button type="button" onClick={onCreate} disabled={isSubmitting} className="rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-700">
              {isSubmitting ? 'Creating your path…' : 'Create my path'}
            </button>
            <button type="button" onClick={onMore} disabled={isSubmitting} className={chip}>Add more details first</button>
            <button type="button" onClick={restart} disabled={isSubmitting} className={chip}>Change my answers</button>
          </>
        )}
      </div>
    </section>
  )
}
