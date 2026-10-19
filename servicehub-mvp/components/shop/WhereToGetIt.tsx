import { ExternalLink, MessageSquare } from 'lucide-react'
import type { Product } from '@/types/shop'
import { isAppCategory, isWatchCategory } from '@/lib/shop/categories'

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * "Where you can get it" (Odosa): the real places a product is sold, a
 * Canadian store where there is one, the App Store or Google Play for apps,
 * and where to watch for films and series (STEP 82's buy_links, each checked
 * when it was added). ResourceHub doesn't sell them, unless a vendor sells
 * one through ResourceHub (soldHere; Goal 9). The example stores that stood
 * in before real links existed are gone.
 */
export default function WhereToGetIt({ product, soldHere = false }: { product: Product; soldHere?: boolean }) {
  const links = (product.buy_links || []).filter((l) => l?.url && /^https?:\/\//.test(l.url))
  const heading = isWatchCategory(product.category) ? 'Where to watch' : isAppCategory(product.category) ? 'Where to get the app' : 'Where you can get it'
  return (
    <section aria-labelledby="where-to-get-it" className="space-y-3">
      <div>
        <h2 id="where-to-get-it" className="text-sm font-semibold text-gray-900">
          {heading}
        </h2>
        <p className="mt-0.5 text-xs text-gray-700">
          {soldHere ? 'You can also buy it above, from the vendor who sells it here. Prices and stock are each seller’s.' : 'ResourceHub doesn’t sell this. Prices and stock are the seller’s.'}
        </p>
      </div>
      {links.length > 0 ? (
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-300 px-3 py-2.5 transition-colors hover:border-blue-500 hover:bg-blue-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">{l.label}</span>
                  <span className="block truncate text-xs text-gray-700">{host(l.url)}</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-800">
          {product.maker_url ? (
            <a href={product.maker_url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-800 underline underline-offset-2">
              The maker&apos;s page
            </a>
          ) : (
            'No store yet.'
          )}{' '}
          <a href={`/community/new?about=${encodeURIComponent(product.name)}`} className="inline-flex items-center gap-1 font-medium text-blue-800 underline underline-offset-2">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Ask in Tidbits where people found it
          </a>
        </p>
      )}
    </section>
  )
}
