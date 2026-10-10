'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { goHubHref } from '@/lib/serviceHub'

/**
 * The menus across the top of the Path (Riipen Labs, Group 34, slide 22:
 * "Stuck? > People > Fun > Mentors > Friends > Tools >", and slide 17:
 * "being able to expand the tabs on the main page"). Each opens a short list
 * of places, so everything is two taps from the Path. Only parts of the app
 * that work are listed; the rest are named under "Not working yet" on /help.
 *
 * Disclosure buttons rather than an ARIA menu: Tab moves through the links,
 * Escape closes and returns to the button, and only one list is open at a
 * time. The row wraps instead of scrolling sideways, so a list is never
 * clipped on a phone.
 */

export interface PathMenuItem {
  label: string
  href: string
  /** A ResourceHub path, opened through the session hand-off. */
  hub?: boolean
}

export const PATH_MENUS: { id: string; label: string; info: string; items: PathMenuItem[] }[] = [
  {
    id: 'stuck',
    label: 'Stuck?',
    info: 'Ways to get help: ask people, ask the assistant, or talk to someone now',
    items: [
      { label: 'Ask a question in Tidbits', href: '/community/new?from=path', hub: true },
      { label: 'Ask the assistant', href: '/assistant' },
      { label: 'What things are called', href: '/help' },
      { label: 'Talk to someone now', href: '/help#talk-now' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    info: 'Your people in Hare World, messages, groups, and family',
    items: [
      { label: 'Hare World', href: '/hare-world' },
      { label: 'Messages', href: '/hare-world/messages' },
      { label: 'Friend requests', href: '/hare-world#requests' },
      { label: 'Role Model Galleria', href: '/hare-world/role-models' },
      { label: 'Groups', href: '/hare-world?view=collab' },
      { label: 'Family', href: '/family' },
    ],
  },
  {
    id: 'fun',
    label: 'Fun',
    info: 'Your reel, your journal, About me, your Dream Self and your stats',
    items: [
      { label: 'Reels', href: '/reels' },
      { label: 'Journal', href: '/reflection' },
      { label: 'About me', href: '/about-me' },
      { label: 'Your Dream Self', href: '/ideal-self' },
      { label: 'Life Stats', href: '/stats' },
    ],
  },
  {
    id: 'mentors',
    label: 'Mentors',
    info: 'The people who guide you, calls, and tasks from mentors',
    items: [
      { label: 'Your mentors', href: '/hare-world#mentors' },
      { label: 'Find a mentor', href: '/hare-world?add=mentors' },
      { label: 'Calls', href: '/hare-world#calls' },
      { label: 'Mentor tasks', href: '/hare-world#tasks' },
      { label: 'What a mentor is', href: '/help#hare-world' },
    ],
  },
  {
    id: 'friends',
    label: 'Friends',
    info: 'The people who support you, their updates, notes, memes and goals together',
    items: [
      { label: 'Your friends', href: '/hare-world#friends' },
      { label: 'Find friends', href: '/hare-world?add=friends' },
      { label: 'Updates from your people', href: '/hare-world#updates' },
      { label: 'Notes of support', href: '/hare-world#notes' },
      { label: 'Memes', href: '/hare-world#memes' },
      { label: 'Goals together', href: '/hare-world#together' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    info: 'Tools for your steps, and places to find services',
    items: [
      { label: 'Pit Stop', href: '/pit-stop' },
      { label: 'Tools for your steps', href: '/tools' },
      { label: 'ResourceHub', href: '/', hub: true },
      { label: 'Starter resources', href: '/start' },
      { label: 'Path Market', href: '/path-market' },
    ],
  },
]

export default function PathMenus() {
  const [open, setOpen] = useState<string | null>(null)
  // A list that would run off the right edge (a button near it, on a phone)
  // opens leftwards instead, so the page never scrolls sideways.
  const [alignRight, setAlignRight] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const id = open
      setOpen(null)
      buttons.current[id]?.focus()
    }
    // Leaving the row with Tab closes it too.
    const onFocus = (e: FocusEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocus)
    }
  }, [open])

  return (
    <nav aria-label="More places" className="mb-6">
      <div ref={rootRef} className="flex flex-wrap items-center gap-2">
        {PATH_MENUS.map((menu) => {
          const isOpen = open === menu.id
          return (
            <div key={menu.id} className="relative">
              <button
                ref={(el) => { buttons.current[menu.id] = el }}
                type="button"
                aria-expanded={isOpen}
                aria-controls={`path-menu-${menu.id}`}
                data-info={`Opens a short list: ${menu.info}.`}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setAlignRight(rect.left + 240 > window.innerWidth - 16)
                  setOpen(isOpen ? null : menu.id)
                }}
                className={`inline-flex min-h-[40px] items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  isOpen ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400 hover:bg-indigo-50'
                }`}
              >
                {menu.label}
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              <ul
                id={`path-menu-${menu.id}`}
                hidden={!isOpen}
                className={`absolute ${isOpen && alignRight ? 'right-0' : 'left-0'} top-full z-40 mt-1 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl`}
              >
                {menu.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.hub ? goHubHref(item.href) : item.href}
                      onClick={() => setOpen(null)}
                      className="block rounded-lg px-3 py-2.5 text-sm text-slate-800 hover:bg-indigo-50 hover:text-indigo-900"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
