'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Volume2, VolumeX, X, ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * First-run introduction overlay (Eliyana: "a microphone button would be a good
 * addition for the first steps/introduction to the app").
 *
 * A short scripted walkthrough that ALSO:
 *  - narrates each step aloud via the Web Speech API (SpeechSynthesis / TTS),
 *    toggleable, and
 *  - offers a microphone button for hands-free voice commands
 *    ("next", "back", "skip", "start") via SpeechRecognition.
 *
 * Both speech features degrade gracefully: where the browser lacks support
 * (e.g. Firefox / older Safari for recognition) the control is disabled with a
 * tooltip and the on-screen buttons still drive the whole flow. Shows once,
 * gated by a localStorage flag. Mount on the first post-onboarding screen.
 */

const SEEN_KEY = 'autinerary_intro_seen'

interface Step {
  emoji: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    emoji: '👋',
    title: 'Welcome to your journey',
    body: "Here's a quick tour. You can tap Next, or press the microphone and say 'next' to go hands-free.",
  },
  {
    emoji: '🗺️',
    title: 'Your Path',
    body: 'All your goals live on one map as races. This is your home base — start simple, and more appears as you go.',
  },
  {
    emoji: '🪧',
    title: 'Milestones',
    body: 'Each milestone pairs the tools you use with the barriers you unlock. Rate what helps as you go.',
  },
  {
    emoji: '🛒',
    title: 'The Pit Stop',
    body: 'Your cart of tools and supports. Add what helps, skip the rest.',
  },
  {
    emoji: '🔥',
    title: 'Streaks',
    body: 'Finish a task each day to build a streak. Earn freezes that protect you if you miss a day.',
  },
]

/** Minimal shape of the browser SpeechRecognition we use (typed loosely). */
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: any) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

export default function FirstRunIntro() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [ttsOn, setTtsOn] = useState(true)
  const [listening, setListening] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const sttSupported =
    typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  // First-run gate (after mount, SSR-safe).
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setVisible(true)
    } catch {
      /* ignore */
    }
  }, [])

  const stopSpeaking = useCallback(() => {
    try {
      if (ttsSupported) window.speechSynthesis.cancel()
    } catch {
      /* ignore */
    }
  }, [ttsSupported])

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    setListening(false)
  }, [])

  const finish = useCallback(() => {
    stopSpeaking()
    stopListening()
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }, [stopSpeaking, stopListening])

  const go = useCallback(
    (dir: 1 | -1) => {
      setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + dir)))
    },
    []
  )

  // Narrate the current step when it changes (if TTS is on).
  useEffect(() => {
    if (!visible || !ttsOn || !ttsSupported) return
    const { title, body } = STEPS[step]
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(`${title}. ${body}`)
      u.rate = 1
      u.pitch = 1
      window.speechSynthesis.speak(u)
    } catch {
      /* ignore */
    }
    return () => stopSpeaking()
  }, [visible, step, ttsOn, ttsSupported, stopSpeaking])

  // Stop everything if unmounted.
  useEffect(() => () => {
    stopSpeaking()
    stopListening()
  }, [stopSpeaking, stopListening])

  const handleVoiceCommand = useCallback(
    (transcript: string) => {
      const t = transcript.toLowerCase()
      if (/\b(next|continue|forward|go on|okay|ok)\b/.test(t)) go(1)
      else if (/\b(back|previous|go back)\b/.test(t)) go(-1)
      else if (/\b(skip|close|exit|stop|done|finish|start|got it|let's go|explore)\b/.test(t)) finish()
    },
    [go, finish]
  )

  const toggleListening = useCallback(() => {
    if (!sttSupported) return
    if (listening) {
      stopListening()
      return
    }
    try {
      const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const rec: SpeechRecognitionLike = new Ctor()
      rec.lang = 'en-US'
      rec.continuous = false
      rec.interimResults = false
      rec.onresult = (e: any) => {
        const transcript = e?.results?.[0]?.[0]?.transcript || ''
        handleVoiceCommand(transcript)
      }
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      recognitionRef.current = rec
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [sttSupported, listening, stopListening, handleVoiceCommand])

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
        {/* Skip */}
        <button
          onClick={finish}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          aria-label="Skip intro"
          title="Skip"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="text-6xl mb-3">{current.emoji}</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{current.title}</h2>
          <p className="text-slate-600">{current.body}</p>
        </div>

        {/* Voice controls */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={toggleListening}
            disabled={!sttSupported}
            title={
              sttSupported
                ? listening
                  ? 'Listening… say "next", "back", or "skip"'
                  : 'Tap and speak a command'
                : 'Voice commands aren’t supported in this browser'
            }
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              listening
                ? 'bg-red-50 border-red-300 text-red-600 animate-pulse'
                : 'bg-cyan-50 border-cyan-300 text-cyan-700 hover:bg-cyan-100'
            }`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {listening ? 'Listening…' : 'Voice'}
          </button>

          <button
            onClick={() => {
              if (ttsOn) stopSpeaking()
              setTtsOn((v) => !v)
            }}
            disabled={!ttsSupported}
            title={ttsSupported ? (ttsOn ? 'Mute narration' : 'Read aloud') : 'Narration isn’t supported in this browser'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {ttsOn && ttsSupported ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {ttsOn ? 'Narrating' : 'Muted'}
          </button>
        </div>

        {/* Progress dots */}
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-cyan-500' : 'w-1.5 bg-slate-300'}`}
            />
          ))}
        </div>

        {/* Nav */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={() => go(-1)}
            disabled={step === 0}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <button onClick={finish} className="text-xs text-slate-400 hover:text-slate-600 underline">
            Skip tour
          </button>
          <button
            onClick={() => (isLast ? finish() : go(1))}
            className="inline-flex items-center gap-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold hover:shadow-lg transition-all"
          >
            {isLast ? 'Start exploring' : 'Next'}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
