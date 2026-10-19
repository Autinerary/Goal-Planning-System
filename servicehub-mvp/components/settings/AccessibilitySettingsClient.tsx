'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Type, Eye, Moon, Palette, Zap, BookOpen, Underline, Maximize2, Volume2 } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { A11Y_COOKIE, applyA11y, cleanA11y, tokenFor } from '@/lib/a11y'

interface AccessibilitySettingsClientProps {
  userId: string
}

/**
 * ResourceHub's display settings: the same ones the app's Display hands over
 * (lib/a11y.ts), kept in one cookie and applied to every page before it is
 * drawn. This page used to keep its own (small to large text, high contrast,
 * reduced motion, "screen reader optimization") under keys nothing else read,
 * so a choice made here lasted only while the page was open (found going back
 * over Riipen Labs, Group 8, who asked for softer colours and type for people
 * sensitive to screens; Group 14: "control over how information and the
 * interface are displayed"). The names and words are the app's.
 */
const TEXT_SIZES = [
  { token: '', label: 'Usual' },
  { token: 'text-large', label: 'Larger' },
  { token: 'text-xlarge', label: 'Largest' },
]
// The colour theme and colour strength, the app's (the team's planning note,
// October 2026: "Earthy Green & Watery Blue", and "dull or brighten the
// colors"); Softer is what Soft colours was. Each sample is drawn in its own
// theme (data-theme, app/themes.css).
const THEMES = [
  { token: '', id: 'earthy', label: 'Earthy', hint: 'Green and watery blue' },
  { token: 'theme-ocean', id: 'ocean', label: 'Ocean', hint: 'Sea blues and aqua' },
  { token: 'theme-sand', id: 'sand', label: 'Sand', hint: 'Warm browns and dusty blue' },
  { token: 'theme-warm', id: 'warm', label: 'Warm', hint: 'Warm orange' },
  { token: 'theme-cool', id: 'cool', label: 'Cool', hint: 'Soft lilac' },
  { token: 'theme-bakery', id: 'bakery', label: 'Bakery', hint: 'Golden, light and dark brown' },
  { token: 'theme-classic', id: 'classic', label: 'Classic', hint: 'The original purple and blue' },
]
const STRENGTHS = [
  { token: 'softest', label: 'Softest' },
  { token: 'soft', label: 'Softer' },
  { token: '', label: 'Usual' },
  { token: 'bright', label: 'Brighter' },
  { token: 'brightest', label: 'Brightest' },
]
const SWITCHES = [
  { token: 'contrast', label: 'High contrast', desc: 'Boost contrast for easier reading.', icon: Eye },
  { token: 'dark', label: 'Dark mode (experimental)', desc: 'Light text on a dark background. Photos keep their colours.', icon: Moon },
  { token: 'calm', label: 'Reduce motion', desc: 'Minimize animations and movement.', icon: Zap },
  { token: 'dyslexia', label: 'Dyslexia-friendly font', desc: 'Use a more readable typeface with extra spacing.', icon: BookOpen },
  { token: 'underline', label: 'Underline links', desc: 'Always underline links for clarity.', icon: Underline },
  { token: 'sounds-on', label: 'Sounds in Tidbits', desc: 'A soft sound when you finish a Tidbit (a Bite) or give a Well-Done. Off unless you turn it on.', icon: Volume2 },
]

function savedTokens(): string[] {
  const m = document.cookie.match(new RegExp(`(?:^|; )${A11Y_COOKIE}=([^;]*)`))
  const value = m ? cleanA11y(decodeURIComponent(m[1])) : 'none'
  return value === 'none' ? [] : value.split('.')
}

export default function AccessibilitySettingsClient({ userId }: AccessibilitySettingsClientProps) {
  // null until this browser's settings are read, so nothing flips on load.
  const [tokens, setTokens] = useState<string[] | null>(null)
  useEffect(() => { setTokens(savedTokens()) }, [])

  const save = (next: string[]) => {
    const value = cleanA11y(next.join('.'))
    document.cookie = `${A11Y_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    applyA11y(value)
    setTokens(value === 'none' ? [] : value.split('.'))
  }
  const on = tokens || []
  const size = on.find((t) => t.startsWith('text-')) || ''
  const setSize = (token: string) => save([...on.filter((t) => !t.startsWith('text-')), ...(token ? [token] : [])])
  const toggle = (token: string) => save(on.includes(token) ? on.filter((t) => t !== token) : [...on, token])
  // One token per setting: picking a theme or strength replaces the last.
  const theme = tokenFor(on.join('.'), 'theme')
  const strength = tokenFor(on.join('.'), 'colorStrength')
  const setTheme = (token: string) => save([...on.filter((t) => !t.startsWith('theme-')), ...(token ? [token] : [])])
  const setStrength = (token: string) =>
    save([...on.filter((t) => !STRENGTHS.some((s) => s.token && s.token === t)), ...(token ? [token] : [])])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to home
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <Maximize2 className="w-8 h-8 text-blue-600" aria-hidden="true" />
              <h1 className="text-3xl font-bold text-gray-900">Accessibility Settings</h1>
            </div>
            <p className="text-gray-700">
              For every ResourceHub page on this device, from the moment it opens. Opening ResourceHub from
              Autinerary brings your Display settings from there, and they replace these.
            </p>
          </div>

          {/* Settings Cards */}
          <div className="space-y-6">
            <fieldset className="bg-white p-6 rounded-lg border border-gray-200" disabled={tokens === null}>
              <legend className="sr-only">Text size</legend>
              <div className="flex items-center gap-3 mb-4" aria-hidden="true">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Type className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">Text size</p>
                  <p className="text-sm text-gray-700">For all the text on the page.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {TEXT_SIZES.map((s) => (
                  <label key={s.label} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-gray-300 px-4">
                    <input
                      type="radio"
                      name="textSize"
                      value={s.token}
                      checked={size === s.token}
                      onChange={() => setSize(s.token)}
                      className="w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    />
                    <span className="text-base text-gray-900">{s.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="bg-white p-6 rounded-lg border border-gray-200" disabled={tokens === null}>
              <legend className="sr-only">Colours</legend>
              <div className="flex items-center gap-3 mb-4" aria-hidden="true">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Palette className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">Colours</p>
                  <p className="text-sm text-gray-700">The colours of buttons, links and tints, here and in Autinerary.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {THEMES.map((t) => (
                  <label key={t.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-gray-300 px-4 py-2">
                    <input
                      type="radio"
                      name="colourTheme"
                      value={t.id}
                      checked={theme === t.token}
                      onChange={() => setTheme(t.token)}
                      className="w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    />
                    <span data-theme={t.id} aria-hidden="true" className="flex gap-1">
                      <span className="h-5 w-5 rounded-full bg-indigo-700" />
                      <span className="h-5 w-5 rounded-full bg-blue-500" />
                      <span className="h-5 w-5 rounded-full bg-pink-300" />
                    </span>
                    <span>
                      <span className="block text-base text-gray-900">{t.label}</span>
                      <span className="block text-sm text-gray-700">{t.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="bg-white p-6 rounded-lg border border-gray-200" disabled={tokens === null}>
              <legend className="sr-only">Colour strength</legend>
              <div className="flex items-center gap-3 mb-4" aria-hidden="true">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Palette className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">Colour strength</p>
                  <p className="text-sm text-gray-700">Softer makes every colour duller, pictures included; brighter makes them more vivid. Text stays as easy to read.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {STRENGTHS.map((c) => (
                  <label key={c.label} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-gray-300 px-4">
                    <input
                      type="radio"
                      name="colourStrength"
                      value={c.token || 'usual'}
                      checked={strength === c.token}
                      onChange={() => setStrength(c.token)}
                      className="w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    />
                    <span className="text-base text-gray-900">{c.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {SWITCHES.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.token} className="bg-white p-6 rounded-lg border border-gray-200">
                  <label className="flex cursor-pointer items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg" aria-hidden="true">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="flex-1">
                      <span className="block text-lg font-semibold text-gray-900">{s.label}</span>
                      <span className="block text-sm text-gray-700">{s.desc}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={on.includes(s.token)}
                      disabled={tokens === null}
                      onChange={() => toggle(s.token)}
                      className="mt-1 h-6 w-6 shrink-0 rounded text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    />
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
