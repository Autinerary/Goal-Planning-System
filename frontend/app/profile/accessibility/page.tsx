'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Type, Contrast, Zap, BookOpen, Underline, RotateCcw, Palette, Maximize, Volume2, Moon, Leaf } from 'lucide-react'
import { usePreferences } from '../../context/usePreferences'
import { DEFAULT_ACCESSIBILITY, WIDGET_SIZES, ACCENTS, visionSettings, type FontScale } from '@/lib/preferences'
import { SPEECH_RATES, SPEECH_VOLUMES, loadVoices, speak, speechSupported, voicesFor } from '@/lib/speech'
import ColourSettings from '../../components/ColourSettings'
import SkySettings from '../../components/SkySettings'

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
    { key: 'darkMode', label: 'Dark mode (experimental)', desc: 'Light text on a dark background. Photos and characters keep their colours; some emoji and colours may look different.', icon: Moon },
    { key: 'highContrast', label: 'High contrast', desc: 'Boost contrast for easier reading.', icon: Contrast },
    { key: 'reduceMotion', label: 'Reduce motion', desc: 'Minimize animations and movement.', icon: Zap },
    { key: 'dyslexiaFont', label: 'Dyslexia-friendly font', desc: 'Use a more readable typeface with extra spacing.', icon: BookOpen },
    { key: 'underlineLinks', label: 'Underline links', desc: 'Always underline links for clarity.', icon: Underline },
    { key: 'soundEffects', label: 'Task completion sound', desc: 'Play a soft "pop" when you check off a task.', icon: Volume2 },
    { key: 'spokenDescriptions', label: 'Spoken descriptions', desc: 'Read control names and descriptions when clicked or focused. Off by default to avoid duplicating a screen reader.', icon: Volume2 },
    { key: 'voiceNavigation', label: 'Voice commands', desc: 'A microphone at the top. Press it once and it keeps listening until you press it again: go to a page, go back, read this page, click a button by its name, search ResourceHub, or ask the assistant. Say "help" for the list. Your browser sends the audio to its speech service; Autinerary keeps no recordings.', icon: Volume2 },
    { key: 'readAloud', label: 'Listen to this page', desc: 'A button at the foot of every page, in Autinerary and ResourceHub, that reads the page (or the words you select) aloud, with the voice below.', icon: Volume2 },
    { key: 'dailyNotes', label: 'A note for today', desc: 'A short, kind note at the foot of each page.', icon: Leaf },
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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Accessibility</h1>
          <p className="text-slate-600 mb-6 text-sm">
            Tune how the app looks and moves. Changes apply instantly and are saved on this device.
          </p>

          {/* Language moved to the main Settings page (Odosa): needing another
              language is not an accessibility need, and it was hard to find here. */}

          {/* How you see the screen (Odosa, October 2026: "make the site
              audible … for anyone who selects 'blind' or something similar").
              Choosing low vision or blind turns the spoken help on at once,
              and says so; nothing is ever turned off by this. */}
          <fieldset className="mb-6 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 font-semibold text-slate-800">How do you see the screen?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {([['', 'No changes needed'], ['low', 'Low vision'], ['blind', 'Blind']] as const).map(([id, label]) => (
                <label key={id || 'none'} className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm ${(a11y.vision || '') === id ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200'}`}>
                  <input
                    type="radio"
                    name="vision"
                    checked={(a11y.vision || '') === id}
                    onChange={() => {
                      const patch = visionSettings(id, Boolean(a11y.screenReader))
                      setA11y(patch)
                      if (id && canSpeak) speak(a11y.screenReader ? 'Voice commands are on. Press the microphone at the top and say help.' : 'Spoken descriptions and voice commands are on. Press the microphone at the top and say help.')
                    }}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
            {(a11y.vision === 'low' || a11y.vision === 'blind') && (
              <>
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" checked={Boolean(a11y.screenReader)} onChange={(e) => setA11y(visionSettings(a11y.vision, e.target.checked))} className="h-4 w-4" />
                  I use a screen reader (VoiceOver, NVDA, JAWS or TalkBack)
                </label>
                <p role="status" className="mt-2 text-sm text-slate-700">
                  On now: voice commands (the microphone at the top: say &quot;help&quot;), Listen to this page
                  {a11y.screenReader ? '. Your screen reader reads the controls.' : ', and spoken descriptions of what you click or focus.'} You can change each one below.
                </p>
              </>
            )}
          </fieldset>

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

          {/* The colour theme and colour strength (the team's planning note,
              October 2026); the softer end is what the Soft colours switch was
              (Riipen Labs, Group 16: "neurodivergent friendly colour schemes"). */}
          <div className="mb-6">
            <p className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
              <Palette className="w-4 h-4 text-cyan-600" aria-hidden="true" /> Colours and colour strength
            </p>
            <ColourSettings idPrefix="a11y-colours" />
          </div>

          {/* The sky behind the app (Odosa, October 2026; lib/sky.ts). */}
          <div className="mb-6">
            <p className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
              <Moon className="w-4 h-4 text-cyan-600" aria-hidden="true" /> The sky
            </p>
            <SkySettings idPrefix="a11y-sky" />
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

          {/* Reset. Saving merges, so the settings the defaults leave out
              (dark mode, colour strength) are named, or they would stay on. */}
          <button
            onClick={() => update({ accessibility: { ...DEFAULT_ACCESSIBILITY, darkMode: false, softColors: false, colorStrength: 'usual' } })}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold"
          >
            <RotateCcw className="w-4 h-4" /> Reset to defaults
          </button>
        </div>
      </div>
    </div>
  )
}
