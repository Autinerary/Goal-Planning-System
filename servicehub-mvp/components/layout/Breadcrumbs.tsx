import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { Fragment } from 'react'

interface BreadcrumbItem {
  label: string
  href: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

/**
 * Breadcrumb trail.
 *
 * Everything sits in ONE flex row (Odosa: "make sure these tabs are in the
 * same line as the arrows"). Previously each <li> was its own flex container
 * holding the label AND the following chevron, so the icons and the text were
 * aligned in separate contexts — and the gaps stacked, because the list had
 * space-x-2 while the chevrons also carried mx-2. The separators are now
 * siblings of the labels, sharing a single `items-center` baseline, with one
 * `gap` controlling spacing.
 *
 * `leading-none` on the text stops the label's line-height box from sitting
 * taller than the 16px icons, which is what pushed the words above the arrows.
 *
 * Two later fixes, both from the "Home breadcrumb is misaligned" report:
 *
 *  - The house icon was rendered unconditionally, so a trail whose first
 *    crumb is already labelled "Home" showed the icon and the word next to
 *    each other with no separator between them. The icon now stands in for
 *    that crumb rather than doubling it.
 *
 *  - globals.css gives every <a> a 44px minimum touch target. That is the
 *    right default, but the anchors here were plain inline boxes, so a short
 *    label like "Home" sat left-aligned in a 44px-wide box and left a gap
 *    before the chevron that read as misalignment. Making them inline-flex
 *    and centred keeps the target and lines the text up with the arrows.
 */
export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5"
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center gap-2 text-sm text-gray-600 overflow-x-auto whitespace-nowrap no-scrollbar">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          // The first crumb carries the house icon instead of being preceded
          // by a loose one. When that crumb is already called "Home" the icon
          // replaces the word rather than sitting beside it.
          const isFirst = index === 0
          const isHome = isFirst && item.label.toLowerCase() === 'home'

          return (
            <Fragment key={item.href}>
              <li className="flex items-center shrink-0 leading-none">
                {isLast ? (
                  <span
                    className="inline-flex items-center justify-center gap-1.5 text-gray-900 font-medium"
                    aria-current="page"
                  >
                    {isFirst && <Home className="w-4 h-4 shrink-0" aria-hidden="true" />}
                    {!isHome && item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    aria-label={isHome ? 'Home' : undefined}
                    className="inline-flex items-center justify-center gap-1.5 hover:text-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                  >
                    {isFirst && <Home className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />}
                    {!isHome && item.label}
                  </Link>
                )}
              </li>

              {!isLast && (
                <li className="flex items-center shrink-0" aria-hidden="true">
                  <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
