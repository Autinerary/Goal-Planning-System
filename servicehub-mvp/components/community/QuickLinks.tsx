'use client'

import { List } from 'lucide-react'
import { extractHeadings } from '@/lib/community/markdown'

/**
 * Jump-to-section links for a Tidbit (Odosa: "add the quick links that link to
 * each section in the page. This itself should be a feature for Tidbits").
 *
 * Built from the post's own headings rather than authored separately, so the
 * two can never drift: renaming a section renames its link, and deleting one
 * removes it. A hand-maintained contents list on user-editable content is a
 * broken link waiting to happen.
 *
 * Why this matters beyond convenience: a long explainer is exactly the shape
 * of page that is hardest to use if reading is effortful or attention is
 * expensive. Being able to see the whole structure at a glance, and land
 * directly on the part you came for, is the difference between a usable
 * reference and a wall of text.
 *
 * Only renders at two or more headings. One heading is not a contents list,
 * and a short personal story should not be dressed up as a document.
 */

const MIN_HEADINGS = 2

export default function QuickLinks({ source }: { source: string }) {
  const headings = extractHeadings(source)
  if (headings.length < MIN_HEADINGS) return null

  // Indent h3s under h2s, but only relative to the shallowest level actually
  // present -- a post whose top level is h2 should not be indented by default.
  const minLevel = Math.min(...headings.map((h) => h.level))

  return (
    <nav
      aria-labelledby="tidbit-quick-links"
      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <h2
        id="tidbit-quick-links"
        className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900"
      >
        <List className="h-4 w-4 text-gray-500" aria-hidden="true" />
        Quick links
      </h2>
      <ul className="space-y-1">
        {headings.map((h) => (
          <li key={h.id} style={{ paddingLeft: `${(h.level - minLevel) * 12}px` }}>
            <a
              href={`#${h.id}`}
              className="text-sm text-blue-700 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
