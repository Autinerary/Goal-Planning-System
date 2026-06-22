'use client'

import { Sparkles } from 'lucide-react'
import Markdown from './Markdown'

interface SolvedBannerProps {
  keyInsight: string
  tldr: string
}

/**
 * THE flagship UI element. Sits at the top of any solved post and
 * highlights the "moment that helped" + a 1-3 sentence TL;DR.
 *
 * Visual spec: emerald gradient, prominent label, larger type for the
 * key insight (this is the "key moment" the user emphasised), then the
 * TL;DR below.
 */
export default function SolvedBanner({ keyInsight, tldr }: SolvedBannerProps) {
  return (
    <div
      role="note"
      aria-label="Solved summary"
      className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 shadow-sm overflow-hidden"
      data-testid="solved-banner"
    >
      <div className="px-5 py-3 bg-emerald-600 text-white flex items-center gap-2">
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        <span className="font-semibold text-sm tracking-wide uppercase">Solved</span>
        <span className="opacity-80 text-xs">— the moment that helped</span>
      </div>
      <div className="p-5 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">
            Key insight
          </p>
          <p className="text-lg sm:text-xl font-semibold text-gray-900 leading-snug">
            {keyInsight}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">
            TL;DR
          </p>
          <Markdown source={tldr} className="text-gray-700" />
        </div>
      </div>
    </div>
  )
}
