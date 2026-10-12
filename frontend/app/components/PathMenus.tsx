'use client'

import Link from 'next/link'
import { goHubHref } from '@/lib/serviceHub'

/**
 * Every place on the Path, grouped as Riipen Labs Group 34's mockup grouped
 * them (slide 22: "Stuck? > People > Fun > Mentors > Friends > Tools >"), so
 * everything is two taps from the Path. They were six dropdown menus across
 * the top; Groups 31 and 32 found that row and Quick Links were two ways to
 * the same places ("competing pathways", "too many dropdowns"), so they are
 * now one list under Quick Links ("All places"), one level deep. Only parts
 * of the app that work are listed; the rest are under "Not working yet" on
 * /help.
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
      // Riipen Labs, Group 31: let people "continuously send feedback about
      // what they liked/found overwhelming" (the glossary's form, STEP 69).
      { label: 'Tell us what’s hard', href: '/help#tell-us' },
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
      // Setup's "AI Recommendations" step, in the app (Riipen Labs, Group 26).
      { label: 'AI suggestions for your steps', href: '/recommend-choices' },
      { label: 'ResourceHub', href: '/', hub: true },
      { label: 'Starter resources', href: '/start' },
      { label: 'Path Market', href: '/path-market' },
    ],
  },
]

// Each group's name is larger than the places under it, which are indented
// beneath it (Riipen Labs, Group 27: "text size variation in the table of
// contents to indicate sub-heading/pages within a larger topic").
export default function AllPlaces({ id }: { id: string }) {
  return (
    <div id={id} className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {PATH_MENUS.map((group) => (
        <section key={group.id} aria-labelledby={`${id}-${group.id}`}>
          <h3 id={`${id}-${group.id}`} className="text-base font-bold text-slate-900">{group.label}</h3>
          <p className="text-xs text-slate-700">{group.info}</p>
          <ul className="mt-1 border-l-2 border-slate-200 pl-3">
            {group.items.map((item) => (
              <li key={item.label}>
                {item.hub ? (
                  <a href={goHubHref(item.href)} className="flex min-h-[2.75rem] items-center text-sm font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">{item.label}</a>
                ) : (
                  <Link href={item.href} className="flex min-h-[2.75rem] items-center text-sm font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">{item.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
