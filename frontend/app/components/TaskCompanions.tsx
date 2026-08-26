'use client'

import { useEffect, useRef, useState } from 'react'
import { X, GripVertical } from 'lucide-react'

/**
 * A small companion showing the hare 🐇 and tortoise 🐢 gently "dancing" while
 * you work through a task (Eliyana: "top corner view for the dancing hare and
 * tortoise when you are completing a task — also good for ADHD to help focus
 * since two things will be happening at once").
 *
 * DRAGGABLE (Eliyana, follow-up): "This could get distracting having 2 things
 * at once, so be able to drag Spirit Animals/mascot to the corner as you do the
 * task." It used to be hard-pinned to the top-right, so if it covered something
 * your only option was to dismiss it entirely. Now you can drag it anywhere and
 * it snaps to whichever corner you release it nearest, remembering that choice.
 *
 * Also movable by keyboard — focus the grip and use the arrow keys — since a
 * drag-only control would be unusable for exactly the people this app serves.
 *
 * Continuous, low-key motion by default; `energized` amps it up (e.g. on task
 * completion). Animations are CSS-driven, so the app-wide
 * `data-reduce-motion="on"` rule in globals.css stills them for users who asked
 * to reduce motion.
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

export default function TaskCompanions({ energized = false }: { energized?: boolean }) {
  const [dismissed, setDismissed] = useState(false)
  const [corner, setCorner] = useState<Corner>('top-right')
  // Free position while a drag is in flight; null when parked in a corner.
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const grabOffset = useRef({ x: 0, y: 0 })

  // Restore the corner it was last parked in. Read after mount so the server
  // render and the first client render agree.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && isCorner(saved)) setCorner(saved)
    } catch {
      // Private mode or blocked site data — the default corner is fine.
    }
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
    el.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    setDrag({
      x: e.clientX - grabOffset.current.x,
      y: e.clientY - grabOffset.current.y,
    })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag) return
    const el = ref.current
    el?.releasePointerCapture(e.pointerId)
    const rect = el?.getBoundingClientRect()
    // Snap to whichever corner the widget's centre ended up closest to.
    const cx = (rect?.left ?? 0) + (rect?.width ?? 0) / 2
    const cy = (rect?.top ?? 0) + (rect?.height ?? 0) / 2
    const vertical = cy < window.innerHeight / 2 ? 'top' : 'bottom'
    const horizontal = cx < window.innerWidth / 2 ? 'left' : 'right'
    park(`${vertical}-${horizontal}` as Corner)
  }

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

  if (dismissed) return null

  return (
    <div
      ref={ref}
      className={`fixed z-40 select-none ${drag ? '' : CORNER_CLASS[corner]}`}
      style={drag ? { left: drag.x, top: drag.y } : undefined}
    >
      <style>{`
        @keyframes hareHop{0%,100%{transform:translateY(0)}30%{transform:translateY(-8px) rotate(-6deg)}60%{transform:translateY(0) rotate(3deg)}}
        @keyframes tortoiseSway{0%,100%{transform:translateX(0) rotate(-3deg)}50%{transform:translateX(3px) rotate(3deg)}}
        .companion-hare{animation:hareHop 1.1s ease-in-out infinite}
        .companion-hare-fast{animation:hareHop 0.5s ease-in-out infinite}
        .companion-tortoise{animation:tortoiseSway 2.4s ease-in-out infinite}
        .companion-tortoise-fast{animation:tortoiseSway 1s ease-in-out infinite}
      `}</style>
      <div
        className={`flex items-end gap-1 bg-white/85 backdrop-blur border border-amber-200 rounded-2xl pl-1 pr-2 py-2 shadow-lg ${
          drag ? 'cursor-grabbing shadow-2xl ring-2 ring-amber-300' : ''
        }`}
      >
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          aria-label="Move companions — drag, or use the arrow keys"
          title="Drag me to any corner"
          className="self-center text-slate-400 hover:text-slate-600 cursor-grab touch-none px-0.5"
        >
          <GripVertical className="w-4 h-4" aria-hidden="true" />
        </button>
        <div className={energized ? 'companion-hare-fast text-3xl' : 'companion-hare text-3xl'}>🐇</div>
        <div className={energized ? 'companion-tortoise-fast text-2xl' : 'companion-tortoise text-2xl'}>🐢</div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Hide companions"
          title="Hide companions"
          className="ml-1 self-start text-slate-400 hover:text-slate-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="pointer-events-none text-[9px] text-center text-slate-500 mt-1 font-medium">
        {energized ? 'Race complete! 🎉' : 'Racing with you'}
      </p>
    </div>
  )
}
