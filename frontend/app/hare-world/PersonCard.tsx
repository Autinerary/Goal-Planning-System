'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { PersonAvatar, type BoardPerson, type PeopleKind } from './PeopleBoard'
import { CallForm, CollabForm, NoteForm, TaskForm } from './SocialHub'

/**
 * A person's card in Hare World (Riipen Labs, Group 34, slide 20): name,
 * @username and pronouns, how you're connected and since when, your own
 * notes, and Remove and Block. Opens from the people lists.
 *
 * Notes are kept with your preferences, which only you can read; they are
 * never stored on the connection, which the other person can read.
 */

export interface CardPerson extends BoardPerson {
  created_at?: string | null
  /** When the request was accepted (STEP 65); empty for older connections. */
  connected_at?: string | null
  /** For someone who added you: which of their lists you're in. */
  inbound_category?: string | null
  direction?: 'incoming' | 'outgoing'
  bio?: string | null
  friend_dream?: string | null
  /** Your side and theirs (STEP 87): what each shares with the other, and whether you watch them. */
  my_shares?: 'all' | 'progress' | 'none' | null
  my_watch?: boolean | null
  their_shares?: 'all' | 'progress' | 'none' | null
}

const SHARE_CHOICES: { id: 'all' | 'progress' | 'none'; label: string; hint: string }[] = [
  { id: 'all', label: 'Share', hint: 'Your path, calendar and progress.' },
  { id: 'progress', label: 'Restrict', hint: 'Only the milestones you finish, and the moments you share with your people.' },
  { id: 'none', label: 'Private', hint: 'Nothing of your journey. You can still message each other.' },
]
const THEY_SHARE: Record<string, string> = {
  all: 'They share their path, calendar and progress with you.',
  progress: 'They share only their progress with you.',
  none: 'They keep their journey private from you.',
}

/** "Share / Restrict / Private" and "Watch" for one connection (Hare World, STEP 87). */
function Sharing({ person }: { person: CardPerson }) {
  const [shares, setShares] = useState(person.my_shares || 'all')
  const [watch, setWatch] = useState(Boolean(person.my_watch))
  const [status, setStatus] = useState('')
  const save = async (next: { shares?: string; watch?: boolean }) => {
    setStatus('')
    const res = await fetch(`/api/connections/${person.id}/sharing`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
    const d = await res.json().catch(() => null)
    if (!res.ok) {
      setStatus(d?.error || 'That didn’t save.')
      return false
    }
    // Keep the board's copy in step, so the card opens with this next time.
    if (next.shares) person.my_shares = next.shares as CardPerson['my_shares']
    if (typeof next.watch === 'boolean') person.my_watch = next.watch
    setStatus('Saved')
    return true
  }
  return (
    <div className="mt-5 rounded-xl border border-slate-200 p-4">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">What {person.name} can see of your journey</legend>
        <div className="mt-2 space-y-2">
          {SHARE_CHOICES.map((c) => (
            <label key={c.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm ${shares === c.id ? 'border-purple-600 bg-purple-50' : 'border-slate-200'}`}>
              <input
                type="radio"
                name={`share-${person.id}`}
                checked={shares === c.id}
                onChange={async () => {
                  const was = shares
                  setShares(c.id)
                  if (!(await save({ shares: c.id }))) setShares(was)
                }}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-semibold text-slate-900">{c.label}</span>
                <span className="block text-slate-800">{c.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 flex items-start gap-2 text-sm text-slate-900">
        <input
          type="checkbox"
          checked={watch}
          onChange={async (e) => {
            const on = e.target.checked
            setWatch(on)
            if (!(await save({ watch: on }))) setWatch(!on)
          }}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <span className="font-semibold">Watch {person.name}’s progress</span>
          <span className="block text-slate-800">A notification when they finish a milestone (if they share it with you, and you turned notifications on).</span>
        </span>
      </label>
      {person.their_shares && <p className="mt-3 text-xs text-slate-700">{THEY_SHARE[person.their_shares]}</p>}
      <p role="status" className="mt-1 text-xs text-emerald-800">{status}</p>
    </div>
  )
}

const KIND_WORD: Record<PeopleKind, string> = { friends: 'Friend', mentors: 'Mentor', rolemodels: 'Role model' }
const SINCE_WORD: Record<PeopleKind, string> = { friends: 'Friends', mentors: 'Your mentor', rolemodels: 'Your role model' }

function dateWords(iso?: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

export function relationLine(person: CardPerson, kind: PeopleKind): string {
  const when = dateWords(person.created_at)
  const since = dateWords(person.connected_at)
  if (!person.target_user_id) return `${KIND_WORD[kind]}, saved by name${when ? ` on ${when}` : ''}. They aren’t told and see nothing.`
  if (person.status === 'pending') return `${KIND_WORD[kind]}: request sent${when ? ` on ${when}` : ''}, waiting for them to accept.`
  if (person.direction === 'incoming') return `${person.role || 'Friends'}${since ? `, connected since ${since}` : when ? `. They asked on ${when}` : ''}.`
  if (since) return `${SINCE_WORD[kind]} since ${since}.`
  return `${KIND_WORD[kind]}, connected${when ? `. You asked on ${when}` : ''}.`
}

type Action = 'note' | 'call' | 'task' | 'goal'

export default function PersonCard({ person, kind, note, onNoteChange, onClose, onRemove, onBlock, social }: {
  person: CardPerson
  kind: PeopleKind
  note: string
  onNoteChange: (note: string) => void
  onClose: () => void
  onRemove: () => void
  /** Present only when blocking is available (STEP 65) and this is a real account. */
  onBlock?: (() => void) | null
  /** Messages, notes, calls, tasks and goals together, once STEP 66 is applied; your goals for the last. */
  social?: { goals: string[] } | null
}) {
  const [action, setAction] = useState<Action | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [draft, setDraft] = useState(note)
  const [saved, setSaved] = useState(false)
  // Block asks once more, saying what it does.
  const [confirmBlock, setConfirmBlock] = useState(false)
  const blockRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (confirmBlock) blockRef.current?.focus() }, [confirmBlock])

  // Focus the card once when it opens, and give focus back to whatever
  // opened it when it closes. onClose sits in a ref so a parent re-render
  // doesn't move focus again.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    headingRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [])

  const saveNote = () => {
    if (draft === note) return
    onNoteChange(draft.slice(0, 500))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const real = Boolean(person.target_user_id)
  const connected = real && person.status !== 'pending'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overlay-scroll" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-card-name"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <PersonAvatar person={person} size={64} />
          <div className="min-w-0 flex-1">
            <h2 id="person-card-name" ref={headingRef} tabIndex={-1} className="break-words text-xl font-bold text-slate-900 focus:outline-none">
              {person.name}
            </h2>
            {(person.username || person.pronouns) && (
              <p className="text-sm text-slate-700">
                {[person.username ? `@${person.username}` : null, person.pronouns].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-800">{relationLine(person, kind)}</p>
        {person.bio && <p className="mt-3 whitespace-pre-line text-sm text-slate-800">{person.bio}</p>}
        {person.friend_dream && <p className="mt-3 text-sm text-slate-700"><span className="font-semibold">Their dream:</span> {person.friend_dream}</p>}

        {connected && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/friend/${person.target_user_id}`}
              className="inline-flex rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
            >
              See their path and calendar
            </Link>
            {social && (
              <Link
                href={`/hare-world/messages?with=${person.target_user_id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-purple-300 px-4 py-2 text-sm font-semibold text-purple-900 hover:bg-purple-50"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> Message
              </Link>
            )}
          </div>
        )}

        {connected && social && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label={`With ${person.name}`}>
              {([
                ['note', 'Note of support'],
                ['call', 'Book a call'],
                ...(person.inbound_category === 'mentors' ? [['task', 'Suggest a task']] : []),
                ['goal', 'Work on a goal together'],
              ] as [Action, string][]).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-expanded={action === id}
                  onClick={() => setAction(action === id ? null : id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${action === id ? 'border-purple-700 bg-purple-700 text-white' : 'border-slate-300 text-slate-800 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {action && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {action === 'note' && <NoteForm people={[]} to={person.target_user_id!} />}
                {action === 'call' && <CallForm people={[]} to={person.target_user_id!} />}
                {action === 'task' && <TaskForm people={[]} to={person.target_user_id!} />}
                {action === 'goal' && <CollabForm people={[]} goals={social.goals} to={person.target_user_id!} />}
              </div>
            )}
          </div>
        )}

        {connected && person.my_shares !== undefined && person.my_shares !== null && <Sharing person={person} />}

        <div className="mt-5">
          <label htmlFor="person-card-notes" className="block text-sm font-semibold text-slate-900">Your notes</label>
          <p id="person-card-notes-help" className="text-xs text-slate-600">Only you can see these.</p>
          <textarea
            id="person-card-notes"
            value={draft}
            maxLength={500}
            rows={3}
            aria-describedby="person-card-notes-help"
            onChange={(e) => { setDraft(e.target.value); setSaved(false) }}
            onBlur={saveNote}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <button type="button" onClick={saveNote} className="text-sm font-medium text-purple-800 underline underline-offset-2">Save note</button>
            <span role="status" className="text-xs text-emerald-800">{saved ? 'Saved' : ''}</span>
          </div>
        </div>

        {confirmBlock && onBlock ? (
          <div className="mt-5 rounded-xl border border-slate-300 bg-slate-50 p-4">
            <p className="text-sm text-slate-900">
              Block {person.name}? You will no longer be connected, neither of you can find or see the other, and they can’t
              send you requests. They aren’t told. You can unblock them later in Hare World.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button ref={blockRef} type="button" onClick={onBlock} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black">
                Block {person.name}
              </button>
              <button type="button" onClick={() => setConfirmBlock(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onRemove} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50">
              Remove
            </button>
            {onBlock && real && (
              <button type="button" onClick={() => setConfirmBlock(true)} className="rounded-lg border border-slate-400 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100">
                Block
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
