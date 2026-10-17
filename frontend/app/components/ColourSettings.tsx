'use client'

import { Check } from 'lucide-react'
import { usePreferences } from '../context/usePreferences'
import {
  COLOUR_STRENGTHS,
  COLOUR_THEMES,
  colourStrengthOf,
  themeOf,
  type ColourStrength,
  type ColourTheme,
} from '@/lib/preferences'
import { trackDisplayChoice, type DisplayChoice } from '@/lib/displayChoices'

// What each choice is counted as (lib/displayChoices.ts). Softer keeps Soft
// colours' name, so the counts carry on.
const STRENGTH_CHOICE: Partial<Record<ColourStrength, DisplayChoice>> = {
  softest: 'display_softest',
  soft: 'display_soft',
  bright: 'display_bright',
  brightest: 'display_brightest',
}

/**
 * Colours: the theme, and how strong the colours are (the team's planning
 * note, October 2026: "Colors & Theme: Earthy (Earthy Green & Watery Blue)",
 * "add a general option in Settings to customize the colors, and dull or
 * brighten the colors"). The same control in Settings, Settings →
 * Accessibility and the Display panel. The theme is saved to the account,
 * like the accent colour; the strength stays on this device, like the other
 * display settings. Both reach ResourceHub (lib/a11yHandoff.ts).
 *
 * Each sample is drawn in its own theme (data-theme), with the colours the
 * theme gives buttons, links and tints.
 */
export default function ColourSettings({ compact = false, idPrefix = 'colours' }: { compact?: boolean; idPrefix?: string }) {
  const { prefs, update, updateLayout } = usePreferences()
  const theme = themeOf(prefs.layout)
  const strength = colourStrengthOf(prefs.accessibility)
  const index = COLOUR_STRENGTHS.findIndex((c) => c.id === strength)

  const setTheme = (id: ColourTheme) => {
    trackDisplayChoice(`display_theme_${id}` as DisplayChoice)
    updateLayout({ theme: id })
  }
  const setStrength = (id: ColourStrength) => {
    const choice = STRENGTH_CHOICE[id]
    if (choice) trackDisplayChoice(choice)
    update({ accessibility: { ...prefs.accessibility, colorStrength: id, softColors: id === 'soft' || id === 'softest' } })
  }

  return (
    <div>
      <div role="group" aria-labelledby={`${idPrefix}-theme-label`}>
        <p id={`${idPrefix}-theme-label`} className="mb-2 text-sm font-medium text-slate-800">Colours</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COLOUR_THEMES.map((t) => {
            const on = theme === t.id
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTheme(t.id)}
                className={`flex flex-col items-start gap-1.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
                  on ? 'border-cyan-600 bg-cyan-50 text-cyan-900' : 'border-slate-200 text-slate-800 hover:border-slate-300'
                }`}
              >
                <span data-theme={t.id} aria-hidden="true" className="flex gap-1">
                  <span className="h-5 w-5 rounded-full bg-indigo-700" />
                  <span className="h-5 w-5 rounded-full bg-blue-500" />
                  <span className="h-5 w-5 rounded-full bg-pink-300" />
                </span>
                <span className="flex items-center gap-1 text-sm font-medium">
                  {on && <Check className="h-4 w-4" aria-hidden="true" />}
                  {t.label}
                </span>
                {!compact && <span className="text-xs text-slate-600">{t.hint}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={`${idPrefix}-strength`} className="text-sm font-medium text-slate-800">
          Colour strength: <span>{COLOUR_STRENGTHS[index].label}</span>
        </label>
        {!compact && (
          <p id={`${idPrefix}-strength-help`} className="text-xs text-slate-600">
            Softer makes every colour duller, pictures and emoji included; brighter makes them more vivid. Text stays as easy to read.
          </p>
        )}
        <input
          id={`${idPrefix}-strength`}
          type="range"
          min={0}
          max={COLOUR_STRENGTHS.length - 1}
          step={1}
          value={index}
          aria-valuetext={COLOUR_STRENGTHS[index].label}
          aria-describedby={compact ? undefined : `${idPrefix}-strength-help`}
          onChange={(e) => setStrength(COLOUR_STRENGTHS[Number(e.target.value)].id)}
          className="mt-1 h-11 w-full cursor-pointer"
        />
        <div aria-hidden="true" className="flex justify-between text-xs text-slate-600">
          <span>Softer</span>
          <span>Brighter</span>
        </div>
      </div>
    </div>
  )
}
