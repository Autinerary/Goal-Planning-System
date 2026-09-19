'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff } from 'lucide-react'
import { usePreferences } from '../context/usePreferences'
import { goHubHref } from '@/lib/serviceHub'

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  abort: () => void
}

export default function VoiceNavigation() {
  const { prefs } = usePreferences()
  const router = useRouter()
  const recognition = useRef<Recognition | null>(null)
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('')
  const [destination, setDestination] = useState<{ label: string; href: string } | null>(null)

  useEffect(() => () => recognition.current?.abort(), [])
  useEffect(() => {
    if (!prefs.accessibility.voiceNavigation) {
      recognition.current?.abort()
      setListening(false)
      setDestination(null)
      setMessage('')
    }
  }, [prefs.accessibility.voiceNavigation])

  if (!prefs.accessibility.voiceNavigation) return null

  const toggle = () => {
    if (listening) { recognition.current?.abort(); setListening(false); return }
    const speechWindow = window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Constructor) { setMessage('Voice recognition is unavailable in this browser.'); return }
    const instance = new Constructor()
    recognition.current = instance
    instance.lang = 'en-US'
    instance.continuous = false
    instance.interimResults = false
    instance.onend = () => setListening(false)
    instance.onerror = () => { setListening(false); setMessage('Microphone unavailable or speech was not recognized.'); }
    instance.onresult = event => {
      const command = event.results[0]?.[0]?.transcript.toLowerCase().replace(/[.!?]/g, '').trim() || ''
      const routes: Record<string, { label: string; href: string }> = {
        path: { label: 'Path', href: '/path' },
        calendar: { label: 'Calendar', href: '/calendar' },
        settings: { label: 'Settings', href: '/profile/settings' },
        accessibility: { label: 'Accessibility', href: '/profile/accessibility' },
        resources: { label: 'ResourceHub', href: goHubHref('/') },
        tidbits: { label: 'Tidbits', href: goHubHref('/community') },
        people: { label: 'People', href: '/pit-stop?tab=haveworld&view=people' },
        assistant: { label: 'Assistant', href: '/assistant' },
      }
      const selected = routes[command.replace(/^(go to|open|show) (my |the )?/, '')]
      if (command === 'cancel' || command === 'stop') { setDestination(null); setMessage('Cancelled.'); return }
      if (command === 'confirm' && destination) { router.push(destination.href); setDestination(null); setMessage(''); return }
      if (selected) {
        setDestination(selected)
        setMessage(`Open ${selected.label}? Confirm or cancel.`)
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel()
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(`Open ${selected.label}? Press the microphone and say confirm or cancel.`))
        }
      } else setMessage('Command not recognized. Available destinations: Path, Calendar, Settings, Accessibility, Resources, Tidbits, People, Assistant.')
    }
    try { instance.start(); setListening(true); setMessage('Listening...'); } catch { setMessage('Unable to start the microphone.'); }
  }

  return (
    <div data-info-exempt="true" data-speech-exempt="true" className="relative">
      <button type="button" onClick={toggle} aria-label={listening ? 'Stop voice navigation' : 'Start voice navigation'} aria-pressed={listening} title="Voice navigation (English)" className="rounded-lg p-2">
        {listening ? <MicOff className="h-5 w-5 text-red-600" /> : <Mic className="h-5 w-5" />}
      </button>
      {message && <div className="fixed left-4 right-4 top-24 z-[90] rounded-lg border bg-white p-3 text-sm shadow-lg sm:left-auto sm:w-80">
        <p role="status">{message}</p>
        {destination && <button type="button" className="mr-4 mt-2 underline" onClick={() => { router.push(destination.href); setDestination(null); setMessage('') }}>Confirm</button>}
        <button type="button" className="mt-2 underline" onClick={() => { recognition.current?.abort(); setDestination(null); setMessage(''); window.speechSynthesis?.cancel() }}>Cancel</button>
      </div>}
    </div>
  )
}