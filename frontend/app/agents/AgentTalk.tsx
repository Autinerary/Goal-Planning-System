'use client'

/** Talking with one of the person's agents, and its review of their whole plan (lib/agents.ts). */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Agent, AnswerInfo, PLAN_REVIEW, PersonData, PlanNote, Turn, contextFor, readPlanReview } from '@/lib/agents'
import { hiddenNotice } from '@/lib/aiSafety'
import AiNote from '../components/AiNote'
import AiChatNotice from '../components/AiChatNotice'
import CrisisLines from '../components/CrisisLines'
import { runnerFor, whereItRuns } from './run'

function useWhere(agent: Agent) {
  const [where, setWhere] = useState<{ ready: boolean; words: string } | null>(null)
  useEffect(() => {
    let live = true
    whereItRuns(agent).then((w) => live && setWhere(w)).catch(() => live && setWhere({ ready: false, words: 'Couldn’t check where it runs.' }))
    return () => { live = false }
  }, [agent])
  return where
}

export function AgentTalk({ agent, data }: { agent: Agent; data: PersonData }) {
  const where = useWhere(agent)
  const [turns, setTurns] = useState<Turn[]>([])
  // Each answer's label: its model and what the safety check did (lib/aiSafety.ts), by the answer's place in turns.
  const [answers, setAnswers] = useState<Record<number, AnswerInfo>>({})
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hidden, setHidden] = useState('')

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    const next: Turn[] = [...turns, { role: 'user', content: text }]
    setTurns(next)
    setInput('')
    setBusy(true)
    setError(null)
    setHidden('')
    try {
      let info: AnswerInfo | null = null
      const reply = await runnerFor(agent, contextFor(agent, data))(next, { onAnswer: (i) => { info = i } })
      setTurns([...next, { role: 'assistant', content: reply.trim() }])
      const got = info as AnswerInfo | null
      if (got) {
        setAnswers((a) => ({ ...a, [next.length]: got }))
        setHidden(hiddenNotice(got.safety?.hidden ?? []))
      }
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label={`Talk with ${agent.name}`} className="rounded-xl border border-slate-200 p-4 space-y-3">
      <p className={`text-xs ${where?.ready === false ? 'text-amber-800' : 'text-slate-500'}`} role="status">{where?.words ?? 'Checking where it runs…'}</p>
      <AiChatNotice />
      <ol className="space-y-2" aria-live="polite">
        {turns.map((t, i) => (
          <li key={i} className={t.role === 'user' ? 'ml-8' : 'mr-8'}>
            <div className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${t.role === 'user' ? 'bg-slate-100 text-slate-900' : 'bg-indigo-50 text-slate-900'}`}>
              <span className="block text-xs text-slate-500 mb-1">{t.role === 'user' ? 'You' : `${agent.name} (AI)`}</span>
              {t.content}
            </div>
            {/* An answer left out by the check is replaced by our own words: no AI label on those. */}
            {answers[i] && !answers[i].safety?.dropped && (
              <AiNote source={{ model: answers[i].model, agent: agent.name, onDevice: answers[i].onDevice }} safety={answers[i].safety} />
            )}
            {answers[i]?.safety?.care && <CrisisLines heading="Talk to someone now" headingLevel={3} className="mt-2" />}
          </li>
        ))}
        {busy && <li className="text-sm text-slate-500">{agent.name} is thinking…</li>}
      </ol>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {hidden && <p role="status" className="text-xs text-slate-700">{hidden}</p>}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send() }}>
        <label className="sr-only" htmlFor={`talk-${agent.id}`}>Write to {agent.name}</label>
        <input id={`talk-${agent.id}`} value={input} onChange={(e) => setInput(e.target.value)} maxLength={4000}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder={`Write to ${agent.name}`} />
        <button type="submit" disabled={busy || !input.trim() || where?.ready === false}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Send</button>
      </form>
    </section>
  )
}

export function AgentPlanReview({ agent, data, cantSee }: { agent: Agent; data: PersonData; cantSee?: string }) {
  const where = useWhere(agent)
  const [notes, setNotes] = useState<PlanNote[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canSee = agent.sees.includes('plan')

  const review = async () => {
    setBusy(true)
    setError(null)
    try {
      const answer = await runnerFor(agent, contextFor(agent, data))([{ role: 'user', content: PLAN_REVIEW(data.steps) }], { json: true, maxTokens: 900 })
      setNotes(readPlanReview(answer, data.steps))
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label={`${agent.name} on your plan`} className="rounded-xl border border-slate-200 p-4 space-y-3 text-sm">
      {!canSee ? (
        <p className="text-slate-600">{cantSee ?? `To look at your plan, ${agent.name} needs to see it: turn on “My plan” in its settings.`}</p>
      ) : data.steps.length === 0 ? (
        <p className="text-slate-600">You don’t have a plan yet. Make one first, then {agent.name} can look at it.</p>
      ) : (
        <>
          <p className={`text-xs ${where?.ready === false ? 'text-amber-800' : 'text-slate-500'}`} role="status">{where?.words ?? 'Checking where it runs…'}</p>
          <button type="button" onClick={review} disabled={busy || where?.ready === false}
            className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">
            {busy ? `${agent.name} is reading your plan…` : `Look at my plan with ${agent.name}`}
          </button>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          {notes && notes.length === 0 && <p className="text-slate-600">{agent.name} had nothing to add. Your plan looks fine to it as it is.</p>}
          {notes && notes.length > 0 && (
            <ul className="space-y-2" aria-live="polite">
              {notes.map((n) => (
                <li key={n.step.id} className="rounded-lg bg-indigo-50 px-3 py-2">
                  <Link href={`/milestones/${encodeURIComponent(n.step.id)}`} className="font-medium underline">{n.step.name}</Link>
                  <span className="block text-slate-800">{n.note}</span>
                </li>
              ))}
            </ul>
          )}
          {notes && <p className="text-xs text-slate-500">Written by AI from your agent’s instructions. Not medical or clinical advice.</p>}
        </>
      )}
    </section>
  )
}
