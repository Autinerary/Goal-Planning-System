// Personal memory — messages to your future self
//
// Odosa's "Add memory": let users write messages to their future self — either
// "keep doing good" encouragement or "do better" nudges — so returning to the
// app surfaces their own past intentions. Client-side/localStorage, consistent
// with the other lib/* stores. (The "typical pattern & best day" half of the
// feature is derived from lib/streak's getWeekdayStats.)
'use client'

import { useEffect, useState } from 'react'

export type NoteTone = 'encourage' | 'improve'

export interface FutureNote {
  id: string
  text: string
  tone: NoteTone
  createdAt: string // ISO
}

const KEY = 'autinerary_future_notes'
export const MEMORY_EVENT = 'autinerary:memory'
const MAX_NOTES = 200

function readNotes(): FutureNote[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (n): n is FutureNote =>
        n && typeof n.id === 'string' && typeof n.text === 'string' && (n.tone === 'encourage' || n.tone === 'improve')
    )
  } catch {
    return []
  }
}

function writeNotes(notes: FutureNote[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes.slice(-MAX_NOTES)))
    window.dispatchEvent(new CustomEvent(MEMORY_EVENT))
  } catch {
    /* quota — ignore */
  }
}

export function getNotes(): FutureNote[] {
  // Newest first for display.
  return readNotes().slice().reverse()
}

export function addNote(text: string, tone: NoteTone): void {
  const trimmed = text.trim()
  if (!trimmed) return
  const note: FutureNote = {
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    text: trimmed,
    tone,
    createdAt: new Date().toISOString(),
  }
  writeNotes([...readNotes(), note])
}

export function deleteNote(id: string): void {
  writeNotes(readNotes().filter((n) => n.id !== id))
}

/** Live notes for components. */
export function useFutureNotes(): FutureNote[] {
  const [notes, setNotes] = useState<FutureNote[]>([])
  useEffect(() => {
    const sync = () => setNotes(getNotes())
    sync()
    window.addEventListener(MEMORY_EVENT, sync as EventListener)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(MEMORY_EVENT, sync as EventListener)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return notes
}
