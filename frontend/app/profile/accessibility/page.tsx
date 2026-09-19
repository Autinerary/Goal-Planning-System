'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Type, Contrast, Zap, BookOpen, Underline, RotateCcw, Palette, Maximize, Volume2 } from 'lucide-react'
import { usePreferences } from '../../context/usePreferences'
import { DEFAULT_ACCESSIBILITY, WIDGET_SIZES, ACCENTS, type FontScale } from '@/lib/preferences'

const FONT_SCALES: { id: FontScale; label: string; sample: string }[] = [
  { id: 'default', label: 'Default', sample: 'Aa' },
  { id: 'large', label: 'Large', sample: 'Aa' },
  { id: 'xlarge', label: 'Extra Large', sample: 'Aa' },
]

export default function AccessibilitySettingsPage() {
  const router = useRouter()
  const { prefs, update } = usePreferences()
  const a11y = prefs.accessibility

  const setA11y = (patch: Partial<typeof a11y>) => update({ accessibility: { ...a11y, ...patch } })

  const toggles: {
    key: keyof typeof a11y
    label: string
    desc: string
    icon: typeof Contrast
  }[] = [
    { key: 'highContrast', label: 'High contrast', desc: 'Boost contrast for easier reading.', icon: Contrast },
    { key: 'reduceMotion', label: 'Reduce motion', desc: 'Minimize animations and movement.', icon: Zap },
    { key: 'dyslexiaFont', label: 'Dyslexia-friendly font', desc: 'Use a more readable typeface with extra spacing.', icon: BookOpen },
    { key: 'underlineLinks', label: 'Underline links', desc: 'Always underline links for clarity.', icon: Underline },
    { key: 'soundEffects', label: 'Task completion sound', desc: 'Play a soft "pop" when you check off a task.', icon: Volume2 },
    { key: 'spokenDescriptions', label: 'Spoken descriptions', desc: 'Read control names and descriptions when clicked or focused. Off by default to avoid duplicating a screen reader.', icon: Volume2 },
    { key: 'voiceNavigation', label: 'Voice navigation', desc: 'Enable a microphone button. Listening starts only when pressed. Your browser may send audio to its speech service; Autinerary does not store recordings.', icon: Volume2 },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-300 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 p-6">
          <h1 className="text-2xl font-bold mb-1">Accessibility</h1>
          <p className="text-slate-600 mb-6 text-sm">
            Tune how the app looks and moves. Changes apply instantly and are saved on this device.
          </p>

          {/* Language moved to the main Settings page (Odosa): needing another
              language is not an accessibility need, and it was hard to find here. */}

          {/* Appearance — widget size & accent color (persist across devices) */}
          <div className="mb-6">
            <label className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
              <Maximize className="w-4 h-4 text-cyan-600" /> Widget size
            </label>
            <div className="grid grid-cols-3 gap-3">
              {WIDGET_SIZES.map((w) => (
                <button
                  key={w.id}
                  onClick={() => update({ layout: { ...prefs.layout, widgetSize: w.id } })}
                  className={`px-4 py-3 rounded-xl border-2 text-center transition-all ${
                    prefs.layout.widgetSize === w.id ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`font-bold ${w.id === 'small' ? 'text-sm' : w.id === 'medium' ? 'text-base' : 'text-lg'} ${prefs.layout.widgetSize === w.id ? 'text-cyan-700' : 'text-slate-700'}`}>Aa</div>
                  <div className="text-xs text-slate-500 mt-0.5">{w.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
              <Palette className="w-4 h-4 text-cyan-600" /> Accent color
            </label>
            <div className="flex flex-wrap gap-3">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => update({ layout: { ...prefs.layout, accent: a.id } })}
                  aria-label={a.label}
                  aria-pressed={prefs.layout.accent === a.id}
                  className={`w-11 h-11 rounded-full border-2 transition-all ${
                    prefs.layout.accent === a.id ? 'border-slate-800 scale-110' : 'border-white shadow'
                  }`}
                  style={{ backgroundColor: a.swatch }}
                  title={a.label}
                />
              ))}
            </div>
          </div>

          {/* Text size */}
          <div className="mb-6">
            <label className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
              <Type className="w-4 h-4 text-cyan-600" /> Text size
            </label>
            <div className="grid grid-cols-3 gap-3">
              {FONT_SCALES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setA11y({ fontScale: f.id })}
                  className={`px-4 py-4 rounded-xl border-2 text-center transition-all ${
                    a11y.fontScale === f.id
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`font-bold ${f.id === 'default' ? 'text-lg' : f.id === 'large' ? 'text-2xl' : 'text-3xl'} ${a11y.fontScale === f.id ? 'text-cyan-700' : 'text-slate-700'}`}>
                    {f.sample}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{f.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            {toggles.map(({ key, label, desc, icon: Icon }) => {
              const on = Boolean(a11y[key])
              return (
                <div key={key} className="flex items-center justify-between gap-4 p-4 rounded-xl border-2 border-slate-200">
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-slate-500 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{label}</div>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={label}
                    onClick={() => setA11y({ [key]: !on } as any)}
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${on ? 'bg-cyan-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Reset */}
          <button
            onClick={() => update({ accessibility: { ...DEFAULT_ACCESSIBILITY } })}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold"
          >
            <RotateCcw className="w-4 h-4" /> Reset to defaults
          </button>
        </div>
      </div>
    </div>
  )
}
