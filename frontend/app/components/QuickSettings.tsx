'use client'

import { Check } from 'lucide-react'
import { usePreferences } from '../context/usePreferences'
import type { AccessibilitySettings, FontScale } from '@/lib/preferences'

/**
 * "Pick your settings" (Riipen Labs, Group 34, slide 25): light or dark,
 * higher contrast, and text size, the three that change how every page
 * reads. They are the Settings → Accessibility switches, kept on this
 * device, and take effect at once. They were in setup; since Groups 25 to 30
 * they are behind the Path's Display button and on the "Complete your
 * profile" card (components/DisplaySettings.tsx), so setup is two questions.
 */

const SIZES: { id: FontScale; label: string; sample: string }[] = [
  { id: 'default', label: 'Usual', sample: 'text-base' },
  { id: 'large', label: 'Larger', sample: 'text-lg' },
  { id: 'xlarge', label: 'Largest', sample: 'text-xl' },
]

export default function QuickSettings({ embedded = false }: { embedded?: boolean }) {
  const { prefs, update } = usePreferences()
  const a11y = prefs.accessibility
  const set = (patch: Partial<AccessibilitySettings>) => update({ accessibility: { ...a11y, ...patch } })

  const choice = (on: boolean) =>
    `flex items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${
      on ? 'border-cyan-600 bg-cyan-50 text-cyan-900' : 'border-slate-200 text-slate-800 hover:border-slate-300'
    }`

  return (
    <section aria-labelledby="quick-settings-heading" className={embedded ? '' : 'mt-6 border-t border-slate-200 pt-6'}>
      <h3 id="quick-settings-heading" className={embedded ? 'text-sm font-semibold text-slate-800' : 'font-semibold text-slate-800'}>
        {embedded ? 'Light or dark, contrast and text size' : 'Pick your settings'}
      </h3>
      <p className="mb-4 mt-0.5 text-xs text-slate-600">For this device. Change them any time in Settings, then Accessibility.</p>

      <div role="group" aria-labelledby="qs-look-label" className="mb-4">
        <p id="qs-look-label" className="mb-2 text-sm font-medium text-slate-800">Light or dark</p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" aria-pressed={!a11y.darkMode} onClick={() => set({ darkMode: false })} className={choice(!a11y.darkMode)}>
            {!a11y.darkMode && <Check className="h-4 w-4" aria-hidden="true" />} Light
          </button>
          <button type="button" aria-pressed={Boolean(a11y.darkMode)} onClick={() => set({ darkMode: true })} className={choice(Boolean(a11y.darkMode))}>
            {a11y.darkMode && <Check className="h-4 w-4" aria-hidden="true" />} Dark (experimental)
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p id="qs-contrast-label" className="text-sm font-medium text-slate-800">Higher contrast</p>
          <p id="qs-contrast-help" className="text-xs text-slate-600">Darker text and clearer links.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={a11y.highContrast}
          aria-labelledby="qs-contrast-label"
          aria-describedby="qs-contrast-help"
          onClick={() => set({ highContrast: !a11y.highContrast })}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${a11y.highContrast ? 'bg-cyan-700' : 'bg-slate-400'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${a11y.highContrast ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <div role="group" aria-labelledby="qs-size-label">
        <p id="qs-size-label" className="mb-2 text-sm font-medium text-slate-800">Text size</p>
        <div className="grid grid-cols-3 gap-3">
          {SIZES.map((s) => (
            <button key={s.id} type="button" aria-pressed={a11y.fontScale === s.id} onClick={() => set({ fontScale: s.id })} className={choice(a11y.fontScale === s.id)}>
              <span className={s.sample}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
