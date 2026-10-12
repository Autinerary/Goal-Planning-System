'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { usePreferences } from '../context/usePreferences'
import { VIEW_PREFERENCES } from '@/lib/preferences'
import QuickSettings from './QuickSettings'

/**
 * How the app looks: light or dark, contrast and text size (QuickSettings,
 * this device), and how lively it looks (saved with the account). It was
 * setup's last step, "Personalize"; Riipen Labs, Group 26 asked to "move
 * 'Personalize' out of onboarding and into a toggle on the home page", like
 * "the Dark/Light mode that's frequently found on websites". Shown by the
 * Path's Display button (components/DisplayToggle.tsx) and on the "Complete
 * your profile" card. Every choice takes effect at once.
 */
export default function DisplaySettings({ onChange }: { onChange?: () => void }) {
  const { prefs, update } = usePreferences()
  return (
    <div>
      <QuickSettings embedded />
      <div role="group" aria-labelledby="display-lively-label" className="mt-4">
        <p id="display-lively-label" className="mb-2 text-sm font-medium text-slate-800">How lively should it look?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VIEW_PREFERENCES.map((v) => {
            const on = prefs.viewPreference === v.id
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={on}
                onClick={() => { update({ viewPreference: v.id }); onChange?.() }}
                className={`rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors ${on ? 'border-cyan-600 bg-cyan-50 text-cyan-900' : 'border-slate-200 text-slate-800 hover:border-slate-300'}`}
              >
                <span className="flex items-center gap-1 font-semibold">{on && <Check className="h-4 w-4" aria-hidden="true" />}{v.label}</span>
                <span className="block text-xs text-slate-700">{v.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-700">
        More choices, like reduced motion and a reading font, are in{' '}
        <Link href="/profile/accessibility" className="font-medium text-indigo-800 underline underline-offset-2">Settings, Accessibility</Link>.
      </p>
    </div>
  )
}
