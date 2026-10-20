import Link from 'next/link'
import { ChefHat, Lightbulb } from 'lucide-react'
import type { TidbitCommentary } from '@/lib/search/tidbitCommentaries'

/**
 * Tidbits as commentaries, beside the listings (the team's notes, October
 * 2026: "Integrate Tidbits AS commentaries (as solutions)"): each with its
 * source, Tidbits, and the key sentence its writer highlighted, if any.
 */
export default function TidbitCommentaries({ tidbits, query }: { tidbits: TidbitCommentary[]; query: string }) {
  if (tidbits.length === 0) return null
  const more = `/community${query ? `?q=${encodeURIComponent(query)}` : ''}`
  return (
    <section aria-labelledby="tidbit-commentaries" className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="tidbit-commentaries" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          <ChefHat className="h-4 w-4 text-amber-700" aria-hidden="true" /> Commentaries from Tidbits
        </h2>
        <Link href={more} className="text-sm font-medium text-blue-800 underline underline-offset-2">
          Check out their full page of commentaries here!
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tidbits.map((t) => (
          <li key={t.id}>
            <Link
              href={`/community/post/${t.id}`}
              className="block h-full rounded-lg border border-amber-200 bg-white p-4 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <p className="text-xs text-gray-700">
                Source: Tidbits
                {t.group ? ` · ${t.group}` : ''}
                {t.byAutinerary ? ' · by Autinerary' : ''}
              </p>
              <p className="mt-1 font-semibold text-gray-900">{t.title}</p>
              {t.keySentence ? (
                <p className="mt-2 flex gap-1.5 rounded-md border-l-4 border-amber-400 bg-amber-50 px-2 py-1.5 text-sm italic text-amber-950">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 not-italic text-amber-700" aria-hidden="true" />
                  <span>
                    <span className="sr-only">Key sentence: </span>“{t.keySentence}”
                  </span>
                </p>
              ) : (
                t.excerpt && <p className="mt-2 line-clamp-3 text-sm text-gray-700">{t.excerpt}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
