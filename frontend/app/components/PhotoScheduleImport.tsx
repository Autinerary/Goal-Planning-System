'use client'

import { useRef, useState } from 'react'
import { Camera, Check, Loader2, Pencil, X } from 'lucide-react'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface ExtractedEvent {
  id: string
  name: string
  date: string | null
  weekday: string | null
  time: string | null
  confidence: 'high' | 'low'
  /** Whether this row is checked to be added — starts true, user can uncheck. */
  included: boolean
}

/**
 * "Picture Analysis for Calendar" (Odosa): extract, then confirm via bullet
 * points with editing before anything touches the calendar.
 *
 * Nothing here writes to the calendar directly — onConfirm hands the
 * caller only the rows the user left checked, after they have had a chance
 * to fix a misread name/day/time. Low-confidence reads are flagged rather
 * than silently trusted, since a photo of handwriting is often ambiguous.
 */
export default function PhotoScheduleImport({
  onConfirm,
  onClose,
}: {
  onConfirm: (events: { name: string; day: string; time: string }[]) => void
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [events, setEvents] = useState<ExtractedEvent[] | null>(null)

  const handleFile = async (file: File) => {
    setError('')
    setBusy(true)
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/calendar/extract-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(j?.error || 'Could not read that photo.')
        return
      }
      const rows: ExtractedEvent[] = (j.events || []).map((e: any) => ({ ...e, included: true }))
      if (rows.length === 0) setError("Couldn't find any events in that photo.")
      setEvents(rows)
    } catch {
      setError('Something went wrong reading that photo.')
    } finally {
      setBusy(false)
    }
  }

  const update = (id: string, patch: Partial<ExtractedEvent>) => {
    setEvents((prev) => (prev || []).map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  const confirm = () => {
    const chosen = (events || [])
      .filter((e) => e.included && e.name.trim())
      .map((e) => ({
        name: e.name.trim(),
        day: e.weekday || 'Monday', // needs a weekday to slot into this calendar's template
        time: e.time || '09:00',
      }))
    onConfirm(chosen)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Add from a photo</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!events && (
          <>
            <p className="text-sm text-slate-600 mb-4">
              A screenshot of a schedule, a photo of a planner page, or a whiteboard — we'll pull out
              the events so you can check them before anything is added.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 hover:border-cyan-400 hover:text-cyan-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              {busy ? 'Reading photo…' : 'Choose or take a photo'}
            </button>
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {events && events.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Check the events to add, and fix anything that was misread — especially the ones marked
              "unsure".
            </p>
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className={`p-3 rounded-xl border ${e.confidence === 'low' ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={e.included}
                      onChange={(ev) => update(e.id, { included: ev.target.checked })}
                      className="mt-1.5"
                    />
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          value={e.name}
                          onChange={(ev) => update(e.id, { name: ev.target.value })}
                          className="flex-1 text-sm font-semibold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-cyan-500 outline-none bg-transparent"
                        />
                        {e.confidence === 'low' && (
                          <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                            <Pencil className="w-3 h-3" /> unsure
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={e.weekday || ''}
                          onChange={(ev) => update(e.id, { weekday: ev.target.value || null })}
                          className="text-xs border border-slate-200 rounded-md px-1.5 py-1"
                        >
                          <option value="">Day…</option>
                          {WEEKDAYS.map((w) => <option key={w} value={w}>{w}</option>)}
                        </select>
                        <input
                          type="time"
                          value={e.time || ''}
                          onChange={(ev) => update(e.id, { time: ev.target.value || null })}
                          className="text-xs border border-slate-200 rounded-md px-1.5 py-1"
                        />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-2">
              <button
                onClick={confirm}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600 text-white font-semibold hover:bg-cyan-700"
              >
                <Check className="w-4 h-4" /> Add {events.filter((e) => e.included).length} to calendar
              </button>
              <button
                onClick={() => { setEvents(null); setError('') }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                Try another photo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
