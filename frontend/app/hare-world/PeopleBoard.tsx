'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Plus, Search } from 'lucide-react'

/**
 * Hare World's people, laid out as Riipen Labs, Group 34 drew it (slide 19):
 * for friends, mentors and role models, a "Find" box with Add and Search next
 * to a "Your …" list, and your top role models as cards. Choosing a person
 * opens their card (PersonCard). The three lists used to be narrow columns
 * with a small icon button each.
 */

export type PeopleKind = 'friends' | 'mentors' | 'rolemodels'

export interface BoardPerson {
  id: string
  name: string
  role: string
  status: string
  icon: string
  target_user_id?: string | null
  avatar_url?: string | null
  username?: string | null
  pronouns?: string | null
}

const COPY: Record<PeopleKind, { find: string; yours: string; add: string; search: string; empty: string }> = {
  friends: {
    find: 'Find your friends',
    yours: 'Your friends',
    add: 'Add by name (a friend)',
    search: 'Search on Autinerary (for friends)',
    empty: 'No friends yet. Add someone you know, or search for people on Autinerary.',
  },
  mentors: {
    find: 'Find your mentors',
    yours: 'Your mentors',
    add: 'Add by name (a mentor)',
    search: 'Search on Autinerary (for mentors)',
    empty: 'No mentors yet. A mentor is someone who guides you: a teacher, a coach, or someone a step ahead.',
  },
  rolemodels: {
    find: 'Find your role models',
    yours: 'Your top role models',
    add: 'Add by name (a role model)',
    search: 'Search on Autinerary (for role models)',
    empty: 'No role models yet. A role model is someone you look up to. They don’t need to be on Autinerary.',
  },
}

export function PersonAvatar({ person, size = 40 }: { person: BoardPerson; size?: number }) {
  if (person.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={person.avatar_url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="keep-colors grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {person.icon || '👤'}
    </span>
  )
}

function FindBox({ kind, onAdd, extra, className = '' }: { kind: PeopleKind; onAdd: (kind: PeopleKind, mode: 'search' | 'manual') => void; extra?: ReactNode; className?: string }) {
  const c = COPY[kind]
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="text-center text-lg font-bold text-slate-900">{c.find}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Each name starts with the words on the button, so voice control
            ("click Add by name") finds it (WCAG 2.5.3). */}
        <button
          type="button"
          onClick={() => onAdd(kind, 'manual')}
          aria-label={c.add}
          className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl bg-pink-50 text-slate-900 hover:bg-pink-100"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
          <span className="text-base font-semibold">Add</span>{' '}
          <span className="text-xs text-slate-600">by name</span>
        </button>
        <button
          type="button"
          onClick={() => onAdd(kind, 'search')}
          aria-label={c.search}
          className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl bg-pink-50 text-slate-900 hover:bg-pink-100"
        >
          <Search className="h-6 w-6" aria-hidden="true" />
          <span className="text-base font-semibold">Search</span>{' '}
          <span className="text-xs text-slate-600">on Autinerary</span>
        </button>
      </div>
      {extra && <div className="mt-3 text-center text-sm">{extra}</div>}
    </div>
  )
}

function statusLine(p: BoardPerson, describe: (p: BoardPerson) => string): string {
  if (p.status === 'pending' && p.target_user_id) return 'Request sent'
  return [p.pronouns, describe(p)].filter(Boolean).join(' · ')
}

function PersonChip({ person, describe, onOpen }: { person: BoardPerson; describe: (p: BoardPerson) => string; onOpen: () => void }) {
  const line = statusLine(person, describe)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl bg-pink-50 p-3 text-left hover:bg-pink-100"
    >
      <PersonAvatar person={person} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-slate-900">{person.name}</span>
        {line && <span className="block truncate text-xs text-slate-700">{line}</span>}
      </span>
    </button>
  )
}

function YourList({ kind, people, describe, onOpen, className = '' }: {
  kind: PeopleKind
  people: BoardPerson[]
  describe: (p: BoardPerson) => string
  onOpen: (p: BoardPerson, kind: PeopleKind) => void
  className?: string
}) {
  const c = COPY[kind]
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="text-lg font-bold text-slate-900">
        {c.yours} {people.length > 0 && <span className="font-normal text-slate-600">({people.length})</span>}
      </h3>
      {people.length === 0 ? (
        <p className="mt-3 text-sm text-slate-700">{c.empty}</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {people.map((p) => (
            <li key={p.id}>
              <PersonChip person={p} describe={describe} onOpen={() => onOpen(p, kind)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TopRoleModels({ people, describe, onOpen, className = '' }: {
  people: BoardPerson[]
  describe: (p: BoardPerson) => string
  onOpen: (p: BoardPerson, kind: PeopleKind) => void
  className?: string
}) {
  const top = people.slice(0, 3)
  const rest = people.slice(3)
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="text-lg font-bold text-slate-900">
        {COPY.rolemodels.yours} {people.length > 3 && <span className="font-normal text-slate-600">(3 of {people.length})</span>}
      </h3>
      {people.length === 0 ? (
        <p className="mt-3 text-sm text-slate-700">{COPY.rolemodels.empty}</p>
      ) : (
        <>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {top.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onOpen(p, 'rolemodels')}
                  className="flex h-full w-full flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center hover:border-purple-300 hover:bg-purple-50"
                >
                  <PersonAvatar person={p} size={56} />
                  <span className="font-medium text-slate-900">{p.name}</span>
                  {statusLine(p, describe) && <span className="text-xs text-slate-700">{statusLine(p, describe)}</span>}
                </button>
              </li>
            ))}
          </ul>
          {rest.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">All your role models</summary>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {rest.map((p) => (
                  <li key={p.id}>
                    <PersonChip person={p} describe={describe} onOpen={() => onOpen(p, 'rolemodels')} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  )
}

export default function PeopleBoard({ friends, mentors, roleModels, visible, describe, onAdd, onOpen }: {
  friends: BoardPerson[]
  mentors: BoardPerson[]
  roleModels: BoardPerson[]
  /** The search filter at the top of Hare World. */
  visible: (p: BoardPerson) => boolean
  /** The subtitle under a name (role, or "Chose you as a mentor"). */
  describe: (p: BoardPerson) => string
  onAdd: (kind: PeopleKind, mode: 'search' | 'manual') => void
  onOpen: (p: BoardPerson, kind: PeopleKind) => void
}) {
  return (
    <div className="space-y-6">
      <section id="friends" aria-label="Friends" className="grid scroll-mt-24 gap-4 md:grid-cols-3">
        <FindBox kind="friends" onAdd={onAdd} />
        <YourList kind="friends" people={friends.filter(visible)} describe={describe} onOpen={onOpen} className="md:col-span-2" />
      </section>
      <section id="mentors" aria-label="Mentors" className="grid scroll-mt-24 gap-4 md:grid-cols-3">
        <YourList kind="mentors" people={mentors.filter(visible)} describe={describe} onOpen={onOpen} className="order-2 md:order-1 md:col-span-2" />
        <FindBox kind="mentors" onAdd={onAdd} className="order-1 md:order-2" />
      </section>
      <section id="rolemodels" aria-label="Role models" className="grid scroll-mt-24 gap-4 md:grid-cols-3">
        <FindBox
          kind="rolemodels"
          onAdd={onAdd}
          extra={<Link href="/hare-world/role-models" className="font-medium text-purple-800 underline underline-offset-2">Browse the Role Model Galleria</Link>}
        />
        <TopRoleModels people={roleModels.filter(visible)} describe={describe} onOpen={onOpen} className="md:col-span-2" />
      </section>
    </div>
  )
}
