'use client'

/**
 * The ? button. Cycles action → info → infoAction → action.
 *
 * Carries a title so the mode is readable at a glance, per Odosa's note that
 * the button needs an icon AND a title — an unlabelled ? is exactly the kind
 * of thing a less confident user will not risk pressing.
 */

import { HelpCircle } from 'lucide-react'
import { INFO_MODE_META, useInfoMode } from '@/lib/infoMode'

export default function InfoModeButton() {
  const { mode, cycle, isOn } = useInfoMode()

  return (
    <button
      onClick={cycle}
      data-info-exempt="true"
      aria-pressed={isOn}
      title={`Help: ${INFO_MODE_META[mode].label}. ${INFO_MODE_META[mode].description}`}
      className={`flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 text-sm font-medium transition-all ${
        isOn
          ? 'border-cyan-400 bg-cyan-50 text-cyan-800'
          : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <HelpCircle className="h-4 w-4" aria-hidden="true" />
      <span>
        {isOn ? INFO_MODE_META[mode].label : 'Help'}
      </span>
    </button>
  )
}
