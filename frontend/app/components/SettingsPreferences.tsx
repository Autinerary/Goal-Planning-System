'use client'

/**
 * The preference block on the main Settings page (Odosa's settings feedback).
 *
 * Language lives here rather than under Accessibility: needing a different
 * language is not a disability, and burying it there made it hard to find for
 * the people most likely to need it.
 */

import { useState } from 'react'
import { Languages, Layers, Palette, Maximize, Sparkles, MoveHorizontal, Check } from 'lucide-react'
import { usePreferences } from '../context/usePreferences'
import { useTranslation } from '../context/LanguageContext'
import { LANGUAGES, type LanguageCode } from '@/lib/i18n'
import { VIEW_PREFERENCES, WIDGET_SIZES, ACCENTS, type ViewPreference } from '@/lib/preferences'
import { useDisclosure, type DisclosureLevel } from '@/lib/disclosure'

/** Odosa's wording for the four artistic levels, in her order. */
const VIEW_LEVEL_COPY: Record<ViewPreference, string> = {
  plain: 'Plain',
  pretty: 'Pretty, but not distracting',
  exciting: 'Exciting, but not too distracting',
  fun: 'Fun',
}

export default function SettingsPreferences() {
  const { prefs, update } = usePreferences()
  const { lang, setLang } = useTranslation()
  const { level, setOverride } = useDisclosure()
  const [showAllLanguages, setShowAllLanguages] = useState(false)

  const translated = LANGUAGES.filter((l) => l.translated)
  const untranslated = LANGUAGES.filter((l) => !l.translated)
  const visible = showAllLanguages ? LANGUAGES : translated

  // "Simplified" vs "Full" is the coarse control Odosa asked for; the
  // three-level machinery underneath stays, with 'standard' reading as Full.
  const isSimplified = level === 'simple'
  const setView = (v: 'simple' | 'full') => setOverride(v as DisclosureLevel)

  return (
    <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 p-6 mb-6">
      <h2 className="text-xl font-bold mb-1">Display &amp; Language</h2>
      <p className="text-slate-600 mb-6 text-sm">
        How the app looks, how much it shows you at once, and what language it speaks.
      </p>

      {/* ── Language ───────────────────────────────────────────── */}
      <section className="mb-8" data-info="Changes the language the app is written in.">
        <label className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
          <Languages className="w-4 h-4 text-cyan-600" /> Language
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {visible.map((l) => (
            <button
              key={l.code}
              disabled={!l.translated}
              onClick={() => setLang(l.code as LanguageCode)}
              aria-pressed={lang === l.code}
              data-info={
                l.translated
                  ? `Switches the app to ${l.english}.`
                  : `${l.english} is on the list but not translated yet, so the app will stay in English.`
              }
              className={`px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                lang === l.code ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{l.flag}</span>
                <span className={`text-sm font-medium ${lang === l.code ? 'text-cyan-700' : 'text-slate-700'}`}>
                  {l.label}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {l.english}
                {!l.translated && ' · not translated yet'}
              </div>
            </button>
          ))}
        </div>

        {!showAllLanguages && untranslated.length > 0 && (
          <button
            onClick={() => setShowAllLanguages(true)}
            className="mt-3 text-sm font-medium text-cyan-700 hover:underline"
          >
            Show {untranslated.length} more languages
          </button>
        )}

        <p className="text-xs text-slate-400 mt-2">
          Core navigation is available in {translated.length} languages. Some pages still use English.
          Languages marked "not translated yet" are not available to select.
        </p>
      </section>

      {/* ── Views ──────────────────────────────────────────────── */}
      <section className="mb-8">
        <label className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
          <Layers className="w-4 h-4 text-cyan-600" /> Views
        </label>
        <p className="text-xs text-slate-500 mb-2">How many features you see at a time.</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            { id: 'simple' as const, label: 'Simplified View', hint: 'Just the essentials.' },
            { id: 'full' as const, label: 'Full View', hint: 'Everything the app can do.' },
          ]).map((v) => {
            const active = v.id === 'simple' ? isSimplified : !isSimplified
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                aria-pressed={active}
                data-info={`${v.label}: ${v.hint}`}
                className={`px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  active ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {active && <Check className="w-3.5 h-3.5 text-cyan-700" />}
                  <span className={`text-sm font-semibold ${active ? 'text-cyan-700' : 'text-slate-700'}`}>
                    {v.label}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{v.hint}</div>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-slate-400 mt-2">New accounts start in Simplified View.</p>
      </section>

      {/* ── Colours / artistic design ──────────────────────────── */}
      <section className="mb-8">
        <label className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
          <Sparkles className="w-4 h-4 text-cyan-600" /> Colours &amp; artistic design
        </label>
        <p className="text-xs text-slate-500 mb-2">How lively the app looks and moves.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VIEW_PREFERENCES.map((v, i) => (
            <button
              key={v.id}
              onClick={() => update({ viewPreference: v.id })}
              aria-pressed={prefs.viewPreference === v.id}
              data-info={`Level ${i + 1}: ${VIEW_LEVEL_COPY[v.id]}.`}
              className={`px-4 py-3 rounded-xl border-2 text-left transition-all ${
                prefs.viewPreference === v.id ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{v.emoji}</span>
                <span
                  className={`text-sm font-semibold ${
                    prefs.viewPreference === v.id ? 'text-cyan-700' : 'text-slate-700'
                  }`}
                >
                  Lvl {i + 1}: {VIEW_LEVEL_COPY[v.id]}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Placement & size ───────────────────────────────────── */}
      <section className="mb-8">
        <label className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
          <MoveHorizontal className="w-4 h-4 text-cyan-600" /> Where things sit
        </label>
        <p className="text-xs text-slate-500 mb-2">Move the Races pinwheel to whichever side suits you.</p>
        <div className="grid grid-cols-2 gap-3">
          {(['left', 'right'] as const).map((side) => (
            <button
              key={side}
              onClick={() => update({ layout: { ...prefs.layout, pinwheelSide: side } })}
              aria-pressed={prefs.layout.pinwheelSide === side}
              data-info={`Puts the Races pinwheel on the ${side} of the screen.`}
              className={`px-4 py-3 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                prefs.layout.pinwheelSide === side
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              Pinwheel on the {side}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <label className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
          <Maximize className="w-4 h-4 text-cyan-600" /> Widget size
        </label>
        <div className="grid grid-cols-3 gap-3">
          {WIDGET_SIZES.map((w) => (
            <button
              key={w.id}
              onClick={() => update({ layout: { ...prefs.layout, widgetSize: w.id } })}
              aria-pressed={prefs.layout.widgetSize === w.id}
              data-info={`Makes the main buttons and cards ${w.label.toLowerCase()}.`}
              className={`px-4 py-3 rounded-xl border-2 text-center transition-all ${
                prefs.layout.widgetSize === w.id ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div
                className={`font-bold ${
                  w.id === 'small' ? 'text-sm' : w.id === 'medium' ? 'text-base' : 'text-lg'
                } ${prefs.layout.widgetSize === w.id ? 'text-cyan-700' : 'text-slate-700'}`}
              >
                Aa
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{w.label}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <label className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
          <Palette className="w-4 h-4 text-cyan-600" /> Accent colour
        </label>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => update({ layout: { ...prefs.layout, accent: a.id } })}
              aria-label={a.label}
              aria-pressed={prefs.layout.accent === a.id}
              data-info={`Uses ${a.label.toLowerCase()} as the app's highlight colour.`}
              className={`w-11 h-11 rounded-full border-2 transition-all ${
                prefs.layout.accent === a.id ? 'border-slate-800 scale-110' : 'border-white shadow'
              }`}
              style={{ backgroundColor: a.swatch }}
              title={a.label}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
