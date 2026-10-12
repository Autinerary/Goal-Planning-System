'use client'

import { useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

/**
 * Search for "What things are called" (Riipen Labs, Group 27: "a search bar
 * ... allowing users to locate their exact resource"; Group 28: "a chatbot or
 * searchable help option can let users ask for what they need instead of
 * scrolling through pages"). Every word typed must appear in a term's name or
 * meaning; names that match come first. Results link to the term on the page.
 */

export interface HelpEntry {
  id: string
  term: string
  section: string
  text: string
}

export default function HelpSearch({ entries }: { entries: HelpEntry[] }) {
  const [query, setQuery] = useState('')
  const inputId = useId()
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const results = useMemo(() => {
    if (words.length === 0) return []
    const scored: { entry: HelpEntry; score: number }[] = []
    for (const entry of entries) {
      const name = entry.term.toLowerCase()
      const all = `${name} ${entry.text.toLowerCase()} ${entry.section.toLowerCase()}`
      if (!words.every((w) => all.includes(w))) continue
      scored.push({ entry, score: words.filter((w) => name.includes(w)).length * 10 - (entry.section === 'Section' ? 0 : 1) })
    }
    const seen = new Set<string>()
    return scored
      .sort((a, b) => b.score - a.score)
      .filter(({ entry }) => (seen.has(entry.id) ? false : (seen.add(entry.id), true)))
      .slice(0, 8)
      .map(({ entry }) => entry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, entries])

  const snippet = (text: string) => (text.length > 140 ? `${text.slice(0, 137).trimEnd()}…` : text)

  return (
    <div role="search" className="mt-6">
      <label htmlFor={inputId} className="mb-1 block text-sm font-semibold text-slate-900">Search this page</label>
      <div className="flex items-center gap-2 rounded-lg border-2 border-slate-300 bg-white px-3 focus-within:border-indigo-600">
        <Search className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="For example: norms, streak, Pit Stop"
          autoComplete="off"
          className="w-full bg-transparent py-2.5 text-base text-slate-900 placeholder-slate-500 focus:outline-none"
          aria-describedby={`${inputId}-count`}
        />
      </div>
      <p id={`${inputId}-count`} className="sr-only" aria-live="polite">
        {words.length ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : ''}
      </p>
      {words.length > 0 && (
        results.length > 0 ? (
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {results.map((r) => (
              <li key={r.id}>
                <a href={`#${r.id}`} className="block px-3 py-2 hover:bg-slate-50">
                  <span className="font-semibold text-indigo-900 underline underline-offset-2">{r.term}</span>
                  {r.section !== 'Section' && <span className="ml-2 text-xs text-slate-600">in {r.section}</span>}
                  {r.text && <span className="mt-0.5 block text-sm text-slate-700">{snippet(r.text)}</span>}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-700">
            Nothing on this page matches. Try another word, or{' '}
            <Link href="/assistant" className="font-medium text-indigo-800 underline underline-offset-2">ask the assistant</Link>.
          </p>
        )
      )}
    </div>
  )
}
