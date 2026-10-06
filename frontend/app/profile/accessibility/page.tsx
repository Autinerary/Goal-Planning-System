'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Type, Contrast, Zap, BookOpen, Underline, RotateCcw, Palette, Maximize, Volume2 } from 'lucide-react'
import { usePreferences } from '../../context/usePreferences'
import { DEFAULT_ACCESSIBILITY, WIDGET_SIZES, ACCENTS, type FontScale } from '@/lib/preferences'
import { SPEECH_RATES, SPEECH_VOLUMES, loadVoices, speak, speechSupported, voicesFor } from '@/lib/speech'

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

  // The device's voices for the app's language (Riipen Labs, Group 11: "let
  // users choose a more natural-sounding AI voice, or adjust or mute audio").
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null)
  // Known only in the browser; set after mount so the first render matches the server's.
  const [canSpeak, setCanSpeak] = useState(false)
  useEffect(() => {
    setCanSpeak(speechSupported())
    let cancelled = false
    loadVoices().then((all) => { if (!cancelled) setVoices(voicesFor(prefs.language, all)) })
    return () => { cancelled = true }
  }, [prefs.language])

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
          className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
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
                  aria-pressed={prefs.layout.widgetSize === w.id}
                  className={`px-4 py-3 rounded-xl border-2 text-center transition-all ${
                    prefs.layout.widgetSize === w.id ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* A box, not "Aa": this is the size of buttons and cards; text size is below. */}
                  <div
                    aria-hidden="true"
                    className={`mx-auto rounded-md border-2 ${w.id === 'small' ? 'h-4 w-6' : w.id === 'medium' ? 'h-5 w-8' : 'h-6 w-10'} ${prefs.layout.widgetSize === w.id ? 'border-cyan-700 bg-cyan-100' : 'border-slate-500 bg-slate-100'}`}
                  />
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
                  aria-pressed={a11y.fontScale === f.id}
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
                <div key={key} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200">
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

          {/* Voice: how the app sounds when it speaks. Exempt from spoken
              descriptions, so "Try it" is not talked over. */}
          {canSpeak && (
            <section aria-labelledby="voice-heading" data-speech-exempt="true" className="mt-6 rounded-xl border border-slate-200 p-4">
              <h2 id="voice-heading" className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                <Volume2 className="w-4 h-4 text-cyan-600" aria-hidden="true" /> Voice
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                How the app sounds when it speaks: spoken descriptions, the read-aloud tour and voice navigation. The
                voices come from your device, and some sound more natural than others.
              </p>
              {voices === null ? (
                <p className="mt-3 text-sm text-slate-700">Finding your device&apos;s voices&hellip;</p>
              ) : (
                <label className="mt-3 block text-sm font-medium text-slate-800">
                  Voice
                  <select
                    value={voices.some((v) => v.name === a11y.voiceName) ? a11y.voiceName : ''}
                    onChange={(e) => setA11y({ voiceName: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                  >
                    <option value="">Your device&apos;s default</option>
                    {voices.map((v) => (
                      <option key={v.name} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="mt-3">
                <span id="speech-rate-label" className="block text-sm font-medium text-slate-800">Speed</span>
                <div role="group" aria-labelledby="speech-rate-label" className="mt-1 grid grid-cols-3 gap-2">
                  {SPEECH_RATES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={(a11y.speechRate || 1) === r.id}
                      onClick={() => setA11y({ speechRate: r.id })}
                      className={`rounded-lg border-2 px-3 py-2 text-sm font-medium ${(a11y.speechRate || 1) === r.id ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <span id="speech-volume-label" className="block text-sm font-medium text-slate-800">Volume</span>
                <div role="group" aria-labelledby="speech-volume-label" className="mt-1 grid grid-cols-2 gap-2">
                  {SPEECH_VOLUMES.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={(a11y.speechVolume ?? 1) === v.id}
                      onClick={() => setA11y({ speechVolume: v.id })}
                      className={`rounded-lg border-2 px-3 py-2 text-sm font-medium ${(a11y.speechVolume ?? 1) === v.id ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => speak('This is how Autinerary sounds when it reads to you.')}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Volume2 className="w-4 h-4" aria-hidden="true" /> Try it
              </button>
            </section>
          )}

          {/* Reset */}
          <button
            onClick={() => update({ accessibility: { ...DEFAULT_ACCESSIBILITY } })}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold"
          >
            <RotateCcw className="w-4 h-4" /> Reset to defaults
          </button>
        </div>
      </div>
    </div>
  )
}
