'use client'

import { useState } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'

/**
 * The shop's categories and quality filters (the products round). On a phone
 * they are a long list above every product (11 groups, a group's categories,
 * its qualities: about 1,700 pixels before the first product), so there they
 * start folded under one button that says where you are; from a tablet up
 * they are always shown. Choosing one is a link, so the page reloads folded,
 * with the products right there.
 */
export default function FilterPanel({ where, children }: { where: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="shop-filters"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-gray-900 lg:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" /> Categories and filters
        </span>
        <span className="flex min-w-0 items-center gap-1 text-gray-700">
          <span className="truncate">{where}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      <div id="shop-filters" className={`${open ? 'mt-4 block' : 'hidden'} lg:mt-0 lg:block`}>
        {children}
      </div>
    </>
  )
}
