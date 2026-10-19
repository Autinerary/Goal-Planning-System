'use client'

import { HelpCircle } from 'lucide-react'
import { INFO_MODE_META, useInfoMode } from '@/lib/infoMode'

/**
 * The ? button with its title (Odosa: "a button with a ? mark icon + title in
 * the Navbar"): Action Mode to start, then Info, Info + Action, and back.
 */
export default function InfoModeButton({ className = '' }: { className?: string }) {
  const { mode, cycle, isOn } = useInfoMode()
  return (
    <button
      type="button"
      onClick={cycle}
      data-info-exempt="true"
      aria-pressed={isOn}
      title={`Help: ${INFO_MODE_META[mode].label}. ${INFO_MODE_META[mode].description}`}
      className={`flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1.5 text-sm font-medium ${isOn ? 'border-cyan-400 bg-cyan-50 text-cyan-900' : 'border-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900'} ${className}`}
    >
      <HelpCircle className="h-4 w-4" aria-hidden="true" />
      <span>{isOn ? INFO_MODE_META[mode].label : 'Help'}</span>
    </button>
  )
}
