'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { PersonAvatar, type BoardPerson, type PeopleKind } from './PeopleBoard'

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
  direction?: 'incoming' | 'outgoing'
  bio?: string | null
  friend_dream?: string | null
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

export default function PersonCard({ person, kind, note, onNoteChange, onClose, onRemove, onBlock }: {
  person: CardPerson
  kind: PeopleKind
  note: string
  onNoteChange: (note: string) => void
  onClose: () => void
  onRemove: () => void
  /** Present only when blocking is available (STEP 65) and this is a real account. */
  onBlock?: (() => void) | null
}) {
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
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
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
          <Link
            href={`/friend/${person.target_user_id}`}
            className="mt-4 inline-flex rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
          >
            See their path and calendar
          </Link>
        )}

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
