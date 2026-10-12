'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Flag, Send } from 'lucide-react'
import BackButton from '../../components/BackButton'
import { PersonAvatar } from '../PeopleBoard'
import type { Person } from '@/lib/social'

/**
 * Messages with your people (Riipen Labs, Group 34: messages went to the
 * wrong person and were never shown). Only people you're connected to can
 * message each other, and the database checks it (STEP 66). You can unsend
 * what you sent, report what you got, and block from the person's card.
 * New messages are checked every few seconds while the page is open.
 */

type Message = { id: string; from_me: boolean; content: string; kind: string; created_at: string; read_at: string | null }
type Conversation = { person: Person; last: { content: string; kind: string; from_me: boolean; created_at: string }; unread: number }

const time = (iso: string) => {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return d.toLocaleString(undefined, today ? { timeStyle: 'short' } : { dateStyle: 'medium', timeStyle: 'short' })
}

export default function Messages() {
  const router = useRouter()
  const params = useSearchParams()
  const withId = params.get('with')

  const [list, setList] = useState<{ available: boolean; conversations: Conversation[]; people: Person[] } | null>(null)
  const [thread, setThread] = useState<{ person: Person | null; messages: Message[] } | null>(null)
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)
  const [reporting, setReporting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const lastCount = useRef(0)

  const loadList = useCallback(() => {
    fetch('/api/social/messages', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setList(j) })
      .catch(() => {})
  }, [])

  const loadThread = useCallback(() => {
    if (!withId) return
    fetch(`/api/social/messages?with=${withId}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setThread({ person: j.person || null, messages: j.messages || [] }) })
      .catch(() => {})
  }, [withId])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { setThread(null); lastCount.current = 0; loadThread() }, [loadThread])

  // Check for new messages every 8 seconds while the page is in view.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') { loadThread(); loadList() } }
    const timer = setInterval(tick, 8000)
    return () => clearInterval(timer)
  }, [loadThread, loadList])

  // Keep the newest message in view when one arrives.
  useEffect(() => {
    const n = thread?.messages.length || 0
    if (n > lastCount.current) endRef.current?.scrollIntoView({ block: 'end' })
    lastCount.current = n
  }, [thread])

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!withId || !text.trim() || sending) return
    setSending(true)
    setStatus('')
    try {
      const res = await fetch('/api/social/messages', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: withId, content: text }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus(json.error || 'Your message could not be sent.'); return }
      setText('')
      setThread((t) => (t ? { ...t, messages: [...t.messages, json.message] } : t))
      loadList()
    } finally {
      setSending(false)
    }
  }

  const unsend = async (m: Message) => {
    const res = await fetch('/api/social/messages', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }) })
    setStatus(res.ok ? 'Unsent.' : 'That message could not be unsent.')
    if (res.ok) setThread((t) => (t ? { ...t, messages: t.messages.filter((x) => x.id !== m.id) } : t))
  }

  const report = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reporting) return
    const res = await fetch('/api/social/report', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message_id: reporting, reason }) })
    setStatus(res.ok ? 'Reported. The team will look at it. You can also block them from their card in Hare World.' : 'The message could not be reported. Please try again.')
    setReporting(null)
    setReason('')
  }

  const started = new Set((list?.conversations || []).map((c) => c.person.id))
  const others = (list?.people || []).filter((p) => !started.has(p.id))
  const person = thread?.person || list?.people.find((p) => p.id === withId) || null

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <BackButton fallback="/hare-world" />
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-700">
          Only people you’re connected to can message you. Report a message from the message itself, or block someone from their card in{' '}
          <Link href="/hare-world" className="font-medium text-purple-800 underline underline-offset-2">Hare World</Link>.
        </p>

        {list && !list.available && (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-sm">Messages aren’t switched on yet. They will be soon.</p>
        )}

        {list?.available && (
          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            {/* Conversations: hidden on a phone while one is open */}
            <nav aria-label="Conversations" className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${withId ? 'hidden md:block' : ''}`}>
              {list.conversations.length === 0 && others.length === 0 && (
                <p className="p-3 text-sm text-slate-700">Connect with someone in Hare World, then you can message them here.</p>
              )}
              <ul className="space-y-1">
                {list.conversations.map((c) => (
                  <li key={c.person.id}>
                    <Link
                      href={`/hare-world/messages?with=${c.person.id}`}
                      aria-current={c.person.id === withId ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-xl p-2 ${c.person.id === withId ? 'bg-purple-50' : 'hover:bg-slate-50'}`}
                    >
                      <PersonAvatar person={c.person as any} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-slate-900">{c.person.name}</span>
                          {c.unread > 0 && <span className="shrink-0 rounded-full bg-purple-700 px-2 py-0.5 text-xs font-semibold text-white">{c.unread}<span className="sr-only"> new</span></span>}
                        </span>
                        <span className="block truncate text-xs text-slate-700">
                          {c.last.from_me ? 'You: ' : ''}{c.last.kind === 'support' ? 'Note of support: ' : ''}{c.last.content}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {others.length > 0 && (
                <>
                  <p className="mt-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Start a conversation</p>
                  <ul className="mt-1 space-y-1">
                    {others.map((p) => (
                      <li key={p.id}>
                        <Link href={`/hare-world/messages?with=${p.id}`} aria-current={p.id === withId ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl p-2 ${p.id === withId ? 'bg-purple-50' : 'hover:bg-slate-50'}`}>
                          <PersonAvatar person={p as any} size={32} />
                          <span className="truncate text-sm font-medium text-slate-900">{p.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </nav>

            {/* The conversation */}
            <section aria-label={person ? `Conversation with ${person.name}` : 'Conversation'} className={`flex min-h-[60vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm ${withId ? '' : 'hidden md:flex'}`}>
              {!withId ? (
                <p className="m-auto p-6 text-sm text-slate-700">Choose someone to see your messages.</p>
              ) : (
                <>
                  <header className="flex items-center gap-3 border-b border-slate-100 p-3">
                    <button type="button" onClick={() => router.push('/hare-world/messages')} aria-label="Back to conversations" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden">
                      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    {person && <PersonAvatar person={person as any} size={36} />}
                    <h2 className="min-w-0 flex-1 truncate font-semibold text-slate-900">{person?.name || 'Messages'}</h2>
                    {person && <Link href={`/friend/${person.id}`} className="text-xs font-semibold text-purple-800 underline underline-offset-2">Their path</Link>}
                  </header>

                  <div className="flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite" aria-relevant="additions">
                    {!thread && <p className="text-sm text-slate-600">Loading…</p>}
                    {thread && thread.messages.length === 0 && <p className="text-sm text-slate-700">No messages yet. Say hello.</p>}
                    {thread?.messages.map((m) => (
                      <div key={m.id} className={`flex ${m.from_me ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${m.kind === 'support' ? 'border border-pink-300 bg-pink-50 text-slate-900' : m.from_me ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-900'}`}>
                          {m.kind === 'support' && <p className="text-xs font-semibold text-pink-900">Note of support</p>}
                          <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                          <p className={`mt-1 flex flex-wrap items-center gap-2 text-[0.6875rem] ${m.from_me && m.kind !== 'support' ? 'text-purple-100' : 'text-slate-600'}`}>
                            <span>{time(m.created_at)}{m.from_me && m.read_at ? ' · seen' : ''}</span>
                            {m.from_me ? (
                              <button type="button" onClick={() => unsend(m)} className="underline underline-offset-2">Unsend</button>
                            ) : (
                              <button type="button" onClick={() => { setReporting(m.id); setReason('') }} className="inline-flex items-center gap-1 underline underline-offset-2">
                                <Flag className="h-3 w-3" aria-hidden="true" /> Report
                              </button>
                            )}
                          </p>
                          {reporting === m.id && (
                            <form onSubmit={report} className="mt-2 space-y-2 rounded-lg bg-white p-2 text-slate-900">
                              <label htmlFor={`report-${m.id}`} className="block text-xs font-semibold">What’s wrong? (optional)</label>
                              <input id={`report-${m.id}`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                              <div className="flex gap-2">
                                <button type="submit" className="rounded bg-red-700 px-3 py-1 text-xs font-semibold text-white">Report</button>
                                <button type="button" onClick={() => setReporting(null)} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancel</button>
                              </div>
                            </form>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={endRef} />
                  </div>

                  <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-100 p-3">
                    <label htmlFor="message-text" className="sr-only">Message {person?.name || ''}</label>
                    <textarea
                      id="message-text"
                      value={text}
                      rows={1}
                      maxLength={2000}
                      onChange={(e) => { setText(e.target.value); setStatus('') }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
                      placeholder="Write a message"
                      className="max-h-32 min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
                    />
                    <button type="submit" disabled={!text.trim() || sending} aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-40">
                      <Send className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </form>
                </>
              )}
              <p role="status" className="px-3 pb-2 text-sm text-slate-800">{status}</p>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
