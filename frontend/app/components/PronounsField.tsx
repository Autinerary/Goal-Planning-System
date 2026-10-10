'use client'

import { useState } from 'react'
import { PRONOUN_OPTIONS, PRONOUNS_MAX, joinPronouns, splitPronouns } from '@/lib/pronouns'

/**
 * Choose your pronouns: tick any that fit, or type your own (Riipen Labs,
 * Group 34, slides 21 and 25). Optional. Used on Your profile and in setup.
 */
export default function PronounsField({ idPrefix, value, onChange }: {
  idPrefix: string
  value: string
  onChange: (value: string) => void
}) {
  const { picked, own } = splitPronouns(value)
  // What's typed is kept as typed; the saved line is rebuilt from it.
  const [ownText, setOwnText] = useState(own)

  const toggle = (option: string) => {
    const next = picked.includes(option) ? picked.filter((p) => p !== option) : [...picked, option]
    onChange(joinPronouns(next, ownText))
  }

  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-semibold text-slate-800">Pronouns</legend>
      <p id={`${idPrefix}-help`} className="mb-2 text-xs text-slate-600">
        Optional. Tick any that fit, or type your own. Other members see them next to your name.
      </p>
      <div className="flex flex-wrap gap-2">
        {PRONOUN_OPTIONS.map((option) => {
          const on = picked.includes(option)
          return (
            <label
              key={option}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                on ? 'border-purple-600 bg-purple-50 font-semibold text-purple-900' : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
              }`}
            >
              <input type="checkbox" checked={on} onChange={() => toggle(option)} className="h-4 w-4 accent-purple-700" />
              {option}
            </label>
          )
        })}
      </div>
      <label htmlFor={`${idPrefix}-own`} className="mt-3 block text-sm font-medium text-slate-800">Add your own</label>
      <input
        id={`${idPrefix}-own`}
        value={ownText}
        maxLength={PRONOUNS_MAX}
        aria-describedby={`${idPrefix}-help`}
        onChange={(e) => { setOwnText(e.target.value); onChange(joinPronouns(picked, e.target.value)) }}
        placeholder="For example: any pronouns, or just my name"
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
      />
    </fieldset>
  )
}
