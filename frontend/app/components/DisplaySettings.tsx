'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { usePreferences } from '../context/usePreferences'
import { VIEW_PREFERENCES } from '@/lib/preferences'
import { useDisclosure, type DisclosureLevel } from '@/lib/disclosure'
import QuickSettings from './QuickSettings'
import { trackDisplayChoice } from '@/lib/displayChoices'

// How much each page shows (lib/disclosure.ts). Riipen Labs, Group 22:
// "Respect the 'complexity of screen' options" and "hiding extra features
// behind toggles". The same two views as Settings → Views, which is the
// control Odosa asked for ('standard' reads as Full), here one tap away.
export const SHOW_LEVELS: { id: DisclosureLevel; label: string; hint: string }[] = [
  { id: 'simple', label: 'Simplified View', hint: 'Just the essentials: your next step and a few links.' },
  { id: 'full', label: 'Full View', hint: 'Everything the app can do.' },
]

/**
 * How the app looks: light or dark, contrast and text size (QuickSettings,
 * this device), and how lively it looks (saved with the account). It was
 * setup's last step, "Personalize"; Riipen Labs, Group 26 asked to "move
 * 'Personalize' out of onboarding and into a toggle on the home page", like
 * "the Dark/Light mode that's frequently found on websites". Shown by the
 * Path's Display button (components/DisplayToggle.tsx) and on the "Complete
 * your profile" card. Every choice takes effect at once.
 */
export default function DisplaySettings({ onChange, visitor = false }: { onChange?: () => void; visitor?: boolean }) {
  const { prefs, update } = usePreferences()
  const { level, setOverride } = useDisclosure()
  return (
    <div>
      <QuickSettings embedded />
      {!visitor && (
        <div role="group" aria-labelledby="display-show-label" className="mt-4">
          <p id="display-show-label" className="mb-2 text-sm font-medium text-slate-800">How much to show</p>
          <div className="grid grid-cols-2 gap-2">
            {SHOW_LEVELS.map((v) => {
              const on = v.id === 'simple' ? level === 'simple' : level !== 'simple'
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { setOverride(v.id); trackDisplayChoice(v.id === 'simple' ? 'display_view_simple' : 'display_view_full'); onChange?.() }}
                  className={`rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors ${on ? 'border-cyan-600 bg-cyan-50 text-cyan-900' : 'border-slate-200 text-slate-800 hover:border-slate-300'}`}
                >
                  <span className="flex items-center gap-1 font-semibold">{on && <Check className="h-4 w-4" aria-hidden="true" />}{v.label}</span>
                  <span className="block text-xs text-slate-700">{v.hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
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
                onClick={() => { update({ viewPreference: v.id }); trackDisplayChoice(`display_look_${v.id}`); onChange?.() }}
                className={`rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors ${on ? 'border-cyan-600 bg-cyan-50 text-cyan-900' : 'border-slate-200 text-slate-800 hover:border-slate-300'}`}
              >
                <span className="flex items-center gap-1 font-semibold">{on && <Check className="h-4 w-4" aria-hidden="true" />}{v.label}</span>
                <span className="block text-xs text-slate-700">{v.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      {visitor ? (
        <p className="mt-3 text-xs text-slate-700">Kept on this device. With an account there are more choices, like a reading font.</p>
      ) : (
        <p className="mt-3 text-xs text-slate-700">
          More choices, like a reading font and spoken descriptions, are in{' '}
          <Link href="/profile/accessibility" className="font-medium text-indigo-800 underline underline-offset-2">Settings, Accessibility</Link>.
        </p>
      )}
    </div>
  )
}
