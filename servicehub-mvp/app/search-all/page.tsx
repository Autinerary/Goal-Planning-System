import Link from 'next/link'
import { Search, Handshake, ShoppingBag, Sparkles, CheckCircle2, Star, MapPin } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { universalSearch, type UniversalResult, type ResultKind } from '@/lib/search/universal'
import { formatPrice } from '@/types/shop'
import { FILTER_NORM_GROUPS } from '@/lib/norms/taxonomy'

export const dynamic = 'force-dynamic'

/**
 * Search across everything (Odosa: "add a Search tab which has ALL resource
 * types … and make sure all 3 of these are recognized as different types").
 *
 * Grouped by type rather than merged into one ranked list. A therapist, a
 * weighted blanket and a question about masking are not interchangeable, and
 * one list would imply they were — you would also have no way to tell, at a
 * glance, whether a result is somewhere to go, something to buy, or something
 * to read. Each section keeps its own link through to the type-specific tab.
 */

const SECTIONS: {
  kind: ResultKind
  label: string
  blurb: string
  icon: typeof Handshake
  accent: string
  browseHref: string
  browseLabel: string
}[] = [
  {
    kind: 'service', label: 'Services', blurb: 'Places and people you can go to',
    icon: Handshake, accent: 'text-blue-600', browseHref: '/search', browseLabel: 'Browse all services',
  },
  {
    kind: 'product', label: 'Shop Items', blurb: 'Things you can buy',
    icon: ShoppingBag, accent: 'text-purple-600', browseHref: '/shop', browseLabel: 'Browse the shop',
  },
  {
    kind: 'post', label: 'Tidbits', blurb: 'What people have written about this',
    icon: Sparkles, accent: 'text-emerald-600', browseHref: '/community', browseLabel: 'Browse Tidbits',
  },
]

/** Norms shared by services and posts. Drawn from the same taxonomy the rest
 *  of the app uses, trimmed to the ones broad enough to be worth a one-click
 *  chip — the full tree lives on the type-specific tabs. */
const COMMON_NORMS = FILTER_NORM_GROUPS.flatMap((g) => g.norms).slice(0, 8)

function buildHref(opts: {
  q: string
  kinds: ResultKind[]
  norms: string[]
  sort: string
}): string {
  const p = new URLSearchParams()
  if (opts.q) p.set('q', opts.q)
  if (opts.kinds.length) p.set('kinds', opts.kinds.join(','))
  if (opts.norms.length) p.set('norms', opts.norms.join(','))
  if (opts.sort && opts.sort !== 'relevance') p.set('sort', opts.sort)
  return `/search-all?${p.toString()}`
}

const chip = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
    active
      ? 'bg-blue-600 text-white border-blue-600'
      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
  }`

function ResultRow({ r }: { r: UniversalResult }) {
  return (
    <li>
      <Link
        href={r.href}
        className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900">{r.title}</h3>
          {r.kind === 'post' && r.isSolved && (
            <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Solved
            </span>
          )}
          {r.kind === 'product' && r.price != null && (
            <span className="shrink-0 text-sm font-bold text-purple-700">{formatPrice(r.price)}</span>
          )}
        </div>
        {r.description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{r.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {r.category && <span className="capitalize">{r.category.replace(/[-_]/g, ' ')}</span>}
          {r.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" aria-hidden="true" /> {r.location}
            </span>
          )}
          {/* Only claim a rating when one actually exists — an unrated thing
              showing "0.0" reads as a bad review rather than as no reviews. */}
          {r.rating != null && (r.ratingCount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" aria-hidden="true" />
              {r.rating.toFixed(1)} ({r.ratingCount})
            </span>
          )}
          {r.kind === 'post' && (
            <span>{r.answerCount} {r.answerCount === 1 ? 'answer' : 'answers'}</span>
          )}
        </div>
      </Link>
    </li>
  )
}

export default async function SearchAllPage({
  searchParams,
}: {
  searchParams: { q?: string; kinds?: string; norms?: string; sort?: string }
}) {
  const q = (searchParams.q || '').trim()
  const parseList = (v?: string) =>
    (v || '').split(',').map((x) => x.trim()).filter(Boolean)

  const kinds = parseList(searchParams.kinds) as ResultKind[]
  const norms = parseList(searchParams.norms)
  const sort = (searchParams.sort as 'relevance' | 'rating' | 'newest') || 'relevance'

  const results = q
    ? await universalSearch(q, { kinds, norms, sort })
    : { services: [], products: [], posts: [], total: 0 }
  const byKind: Record<ResultKind, UniversalResult[]> = {
    service: results.services,
    product: results.products,
    post: results.posts,
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Search', href: '/search-all' }]} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Search className="w-6 h-6 text-blue-600" aria-hidden="true" /> Search everything
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Services, shop items and Tidbits posts — all in one place.
        </p>

        <form action="/search-all" method="GET" className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search services, shop items and posts…"
              aria-label="Search everything"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* Carry the current filters through a new query so searching again
              does not silently reset them. */}
          {kinds.length > 0 && <input type="hidden" name="kinds" value={kinds.join(',')} />}
          {norms.length > 0 && <input type="hidden" name="norms" value={norms.join(',')} />}
          {sort !== 'relevance' && <input type="hidden" name="sort" value={sort} />}
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Search
          </button>
        </form>

        {q && (
          <div className="mt-4 space-y-3">
            {/* Type filter. Links rather than client state, so every filtered
                view has its own URL and can be shared or bookmarked. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Show</span>
              <Link
                href={buildHref({ q, kinds: [], norms, sort })}
                className={chip(kinds.length === 0)}
              >
                Everything
              </Link>
              {SECTIONS.map((sec) => {
                const only = kinds.length === 1 && kinds[0] === sec.kind
                const Icon = sec.icon
                return (
                  <Link
                    key={sec.kind}
                    href={buildHref({ q, kinds: only ? [] : [sec.kind], norms, sort })}
                    className={`${chip(only)} inline-flex items-center gap-1.5`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    {sec.label}
                  </Link>
                )
              })}
            </div>

            {/* Norms. Services and posts carry norm tags; shop items do not, so
                they are excluded while this is active rather than being returned
                with the filter silently ignored. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Norms</span>
              {COMMON_NORMS.map((n) => {
                const on = norms.includes(n.id)
                return (
                  <Link
                    key={n.id}
                    href={buildHref({
                      q,
                      kinds,
                      norms: on ? norms.filter((x) => x !== n.id) : [...norms, n.id],
                      sort,
                    })}
                    className={chip(on)}
                  >
                    {n.label}
                  </Link>
                )
              })}
              {norms.length > 0 && (
                <Link href={buildHref({ q, kinds, norms: [], sort })} className="text-xs text-blue-600 hover:underline ml-1">
                  Clear norms
                </Link>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Sort</span>
              {(['relevance', 'rating', 'newest'] as const).map((sv) => (
                <Link key={sv} href={buildHref({ q, kinds, norms, sort: sv })} className={`${chip(sort === sv)} capitalize`}>
                  {sv}
                </Link>
              ))}
            </div>

            {norms.length > 0 && (
              <p className="text-xs text-gray-500">
                Shop items are hidden while a norm filter is on — products aren&apos;t tagged by norm.
              </p>
            )}
          </div>
        )}

        {!q ? (
          <div className="mt-10 text-center text-gray-500">
            <Search className="w-8 h-8 mx-auto text-gray-300 mb-3" aria-hidden="true" />
            <p className="text-sm">Type something above to search all three at once.</p>
          </div>
        ) : results.total === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
            <p className="font-semibold text-gray-900">No matches for &ldquo;{q}&rdquo;</p>
            <p className="text-sm text-gray-600 mt-1">
              {kinds.length > 0 || norms.length > 0
                ? 'Nothing matched with these filters on. Widening them is usually the fix.'
                : 'Nothing in services, the shop, or Tidbits matched. Try a shorter or more general word.'}
            </p>
            {(kinds.length > 0 || norms.length > 0) && (
              <Link
                href={buildHref({ q, kinds: [], norms: [], sort })}
                className="inline-block mt-3 px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear all filters
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            <p className="text-sm text-gray-600">
              {results.total} {results.total === 1 ? 'result' : 'results'} across{' '}
              {SECTIONS.filter((s) => byKind[s.kind].length > 0).length} of 3 types
            </p>

            {SECTIONS.map((section) => {
              const rows = byKind[section.kind]
              if (rows.length === 0) return null
              const Icon = section.icon
              return (
                <section key={section.kind}>
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${section.accent}`} aria-hidden="true" />
                      {section.label}
                      <span className="text-sm font-normal text-gray-500">({rows.length})</span>
                    </h2>
                    <Link href={section.browseHref} className="text-xs font-medium text-blue-600 hover:underline">
                      {section.browseLabel} →
                    </Link>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{section.blurb}</p>
                  <ul className="space-y-3">
                    {rows.map((r) => (
                      <ResultRow key={`${r.kind}-${r.id}`} r={r} />
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
