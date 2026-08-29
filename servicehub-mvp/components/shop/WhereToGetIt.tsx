'use client'

import { ExternalLink } from 'lucide-react'
import type { Product } from '@/types/shop'

/**
 * "Where you can get it" (Odosa) — replaces Add to Cart.
 *
 * ResourceHub points people at things; it does not sell them. A cart implied
 * an order pipeline that does not exist, so the button showed a "checkout is
 * coming" toast — a dead end dressed as a purchase.
 *
 * The retailers below are PLACEHOLDERS, explicitly requested as such
 * ("for now, just fake ones like QuickMart, Superstore, Rainforest, Cheapco").
 * They are labelled as examples in the UI so nobody mistakes them for real
 * stock, and each link is a search for this product's name — so when real
 * retailers replace them, only this list changes.
 */

interface Retailer {
  name: string
  /** Given a product name, where to send the person. */
  search: (q: string) => string
  note: string
}

const RETAILERS: Retailer[] = [
  { name: 'QuickMart',  search: (q) => `https://www.google.com/search?q=${q}+quickmart`,  note: 'Usually fastest delivery' },
  { name: 'Superstore', search: (q) => `https://www.google.com/search?q=${q}+superstore`, note: 'Often in stock locally' },
  { name: 'Rainforest', search: (q) => `https://www.google.com/search?q=${q}+rainforest`, note: 'Widest selection' },
  { name: 'Cheapco',    search: (q) => `https://www.google.com/search?q=${q}+cheapco`,    note: 'Usually lowest price' },
]

export default function WhereToGetIt({ product }: { product: Product }) {
  const q = encodeURIComponent(product.name)

  return (
    <section aria-labelledby="where-to-get-it" className="space-y-3">
      <div>
        <h2 id="where-to-get-it" className="text-sm font-semibold text-gray-900">
          Where you can get it
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Example sellers while real retailer links are being added — each one searches for this item.
        </p>
      </div>

      <ul className="space-y-2">
        {RETAILERS.map((r) => (
          <li key={r.name}>
            <a
              href={r.search(q)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-300 px-3 py-2.5 hover:border-purple-400 hover:bg-purple-50/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">{r.name}</span>
                <span className="block text-xs text-gray-500 truncate">{r.note}</span>
              </span>
              <ExternalLink className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
