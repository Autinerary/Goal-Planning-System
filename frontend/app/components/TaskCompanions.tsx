'use client'

import { useEffect, useRef, useState } from 'react'
import { X, GripVertical, PictureInPicture2 } from 'lucide-react'
import { ANIMAL_COLORS } from '@/lib/gamification'

/**
 * Your spirit animal, keeping you company while you work on a task.
 *
 * The team's notes, October 2026:
 *  - "Start this as toggled off": the Task View shows a switch, and this
 *    renders only when it's on (preferences.taskCompanion).
 *  - Eliyana: "this could get distracting having 2 [mascots] at once, so be
 *    able to drag Spirit Animals/mascot to your screen in the corner as you do
 *    the task": one companion, your own spirit animal (the hare when you
 *    haven't chosen one), dragged to any corner, where it stays next time.
 *    Arrow keys move it too, since a drag-only control would leave out
 *    exactly the people this app serves.
 *  - Odosa: "ideally, this should be something that you can drag even after
 *    the app is closed, to be cheering you on as you complete real-life
 *    tasks. Is an extension the best way to do this? And can we accomplish
 *    this without violating any privacy laws?": "Keep on top" opens it in the
 *    browser's own Picture-in-Picture window, which floats above every other
 *    app and window while Autinerary stays open in a tab (Chrome and Edge on
 *    a computer). It needs no install and no permission, and shows only what
 *    we draw in it: nothing on the screen is read or recorded. An extension
 *    couldn't float over other apps at all (only over web pages, with access
 *    to them); a phone needs a native app for that.
 *
 * Continuous, low-key motion by default; `energized` amps it up (on
 * completion). CSS animations, so Reduce motion stills them.
 */

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const STORAGE_KEY = 'autinerary:companions-corner'

const CORNER_CLASS: Record<Corner, string> = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-3 right-3',
  'bottom-left': 'bottom-3 left-3',
  'bottom-right': 'bottom-3 right-3',
}

const isCorner = (v: string): v is Corner => v in CORNER_CLASS

const CHEERS = ['You’ve got this.', 'One step at a time.', 'Still here with you.', 'Keep going, nice and steady.', 'Breathe. Then the next bit.', 'Look how far you’ve come.']

export interface CompanionAnimal {
  type: string
  color: string
}

export default function TaskCompanions({
  energized = false,
  animal = null,
  taskName = '',
  onTurnOff,
}: {
  energized?: boolean
  animal?: CompanionAnimal | null
  taskName?: string
  /** The X: turns the companion off (the Task View saves it). */
  onTurnOff?: () => void
}) {
  const [corner, setCorner] = useState<Corner>('top-right')
  // Free position while a drag is in flight; null when parked in a corner.
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const grabOffset = useRef({ x: 0, y: 0 })
  const [pip, setPip] = useState<Window | null>(null)
  const [canPip, setCanPip] = useState(false)

  // Restore the corner it was last parked in. Read after mount so the server
  // render and the first client render agree.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && isCorner(saved)) setCorner(saved)
    } catch {
      // Private mode or blocked site data — the default corner is fine.
    }
    setCanPip(typeof window !== 'undefined' && 'documentPictureInPicture' in window)
  }, [])

  const park = (next: Corner) => {
    setCorner(next)
    setDrag(null)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Position just won't persist to the next visit; not worth surfacing.
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    grabOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setDrag({ x: rect.left, y: rect.top })
    // Capture on the element receiving the events (the grip), so pointerup
    // always arrives and a drag can't turn into following the cursor.
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    setDrag({ x: e.clientX - grabOffset.current.x, y: e.clientY - grabOffset.current.y })
  }

  const snap = () => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return setDrag(null)
    const vertical = rect.top + rect.height / 2 < window.innerHeight / 2 ? 'top' : 'bottom'
    const horizontal = rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right'
    park(`${vertical}-${horizontal}` as Corner)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    snap()
  }

  // A lost pointerup (a context menu, a dropped touch, the tab losing focus)
  // snaps it to the nearest corner instead of leaving it following the cursor.
  useEffect(() => {
    if (!drag) return
    window.addEventListener('pointerup', snap)
    window.addEventListener('pointercancel', snap)
    window.addEventListener('blur', snap)
    return () => {
      window.removeEventListener('pointerup', snap)
      window.removeEventListener('pointercancel', snap)
      window.removeEventListener('blur', snap)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag])

  // Arrow keys hop between corners, so this is reachable without a pointer.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const [v, h] = corner.split('-') as ['top' | 'bottom', 'left' | 'right']
    let next: Corner | null = null
    if (e.key === 'ArrowUp') next = `top-${h}` as Corner
    else if (e.key === 'ArrowDown') next = `bottom-${h}` as Corner
    else if (e.key === 'ArrowLeft') next = `${v}-left` as Corner
    else if (e.key === 'ArrowRight') next = `${v}-right` as Corner
    if (next) {
      e.preventDefault()
      park(next)
    }
  }

  const image = animal?.type ? `/spirit-animals/${animal.type}.png` : null
  const tint = animal?.color ? `hue-rotate(${ANIMAL_COLORS[animal.color] ?? 0}deg)` : ''

  // "Keep on top": the companion in a small always-on-top window.
  const popOut = async () => {
    const dpip = (window as any).documentPictureInPicture
    if (!dpip) return
    try {
      const w: Window = await dpip.requestWindow({ width: 230, height: 250 })
      const doc = w.document
      doc.title = 'Your companion'
      doc.body.style.cssText = 'margin:0;font-family:system-ui,sans-serif;background:#fffbeb;color:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:6px;text-align:center'
      const fig = doc.createElement('div')
      fig.style.cssText = 'font-size:64px;line-height:1'
      if (image) {
        const img = doc.createElement('img')
        img.src = new URL(image, window.location.origin).toString()
        img.alt = ''
        img.width = 96
        img.height = 96
        img.style.filter = tint
        fig.appendChild(img)
      } else {
        fig.textContent = '🐇'
      }
      const task = doc.createElement('p')
      task.style.cssText = 'margin:0 8px;font-size:13px;font-weight:600'
      task.textContent = taskName ? taskName.slice(0, 80) : 'Your task'
      const cheer = doc.createElement('p')
      cheer.style.cssText = 'margin:0 8px;font-size:14px'
      const time = doc.createElement('p')
      time.style.cssText = 'margin:0;font-size:12px;color:#334155'
      const back = doc.createElement('button')
      back.textContent = 'Back to my task'
      back.style.cssText = 'margin-top:4px;padding:6px 12px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font-weight:600;cursor:pointer'
      back.onclick = () => window.focus()
      doc.body.append(fig, task, cheer, time, back)
      const started = Date.now()
      const tick = () => {
        const mins = Math.floor((Date.now() - started) / 60000)
        cheer.textContent = CHEERS[Math.floor((Date.now() - started) / 90000) % CHEERS.length]
        time.textContent = mins < 1 ? 'Just started' : `${mins} min so far`
      }
      tick()
      const timer = window.setInterval(tick, 15000)
      w.addEventListener('pagehide', () => {
        window.clearInterval(timer)
        setPip(null)
      })
      setPip(w)
    } catch {
      // The browser said no (not from a click, or not allowed): stay in the page.
    }
  }

  // Close the floating window when the task screen goes away.
  useEffect(() => () => pip?.close(), [pip])

  if (pip) {
    return (
      <div className="fixed bottom-24 right-6 z-40 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-lg">
        Your companion is in its own window.{' '}
        <button type="button" onClick={() => pip.close()} className="font-semibold text-indigo-800 underline">
          Bring it back
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className={`fixed z-40 select-none ${drag ? '' : CORNER_CLASS[corner]}`} style={drag ? { left: drag.x, top: drag.y } : undefined}>
      <style>{`
        @keyframes companionHop{0%,100%{transform:translateY(0)}30%{transform:translateY(-8px) rotate(-6deg)}60%{transform:translateY(0) rotate(3deg)}}
        .companion-hop{animation:companionHop 1.4s ease-in-out infinite}
        .companion-hop-fast{animation:companionHop 0.5s ease-in-out infinite}
      `}</style>
      <div className={`flex items-center gap-1 surface-chrome border border-amber-200 rounded-2xl pl-1 pr-2 py-2 shadow-lg ${drag ? 'cursor-grabbing shadow-2xl ring-2 ring-amber-300' : ''}`}>
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          aria-label="Move your companion. Drag, or use the arrow keys"
          title="Drag me to any corner"
          className="self-center text-slate-500 hover:text-slate-700 cursor-grab touch-none px-0.5"
        >
          <GripVertical className="w-4 h-4" aria-hidden="true" />
        </button>
        <div className={energized ? 'companion-hop-fast' : 'companion-hop'}>
          {image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={image} alt={`Your ${animal?.color || ''} ${animal?.type || ''}`.replace(/\s+/g, ' ').trim()} width={44} height={44} style={{ filter: tint }} />
          ) : (
            <span className="text-3xl" role="img" aria-label="A hare">🐇</span>
          )}
        </div>
        <div className="ml-1 flex flex-col gap-1">
          {onTurnOff && (
            <button type="button" onClick={onTurnOff} aria-label="Turn your companion off" title="Turn off" className="grid h-6 w-6 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800">
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          {canPip && (
            <button type="button" onClick={popOut} aria-label="Keep your companion on top of other windows" title="Keep on top" className="grid h-6 w-6 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-800">
              <PictureInPicture2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <p className="pointer-events-none text-[0.625rem] text-center text-slate-700 mt-1 font-medium">{energized ? 'You did it! 🎉' : 'Here with you'}</p>
    </div>
  )
}
