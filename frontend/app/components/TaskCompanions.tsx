'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

/**
 * A small fixed top-corner companion showing the hare 🐇 and tortoise 🐢 gently
 * "dancing" while you work through a task (Eliyana: "top corner view for the
 * dancing hare and tortoise when you are completing a task — also good for ADHD
 * to help focus since two things will be happening at once").
 *
 * Continuous, low-key motion by default; `energized` amps it up (e.g. on task
 * completion). Dismissible. Animations are CSS-driven, so the app-wide
 * `data-reduce-motion="on"` rule in globals.css stills them for users who asked
 * to reduce motion.
 */
export default function TaskCompanions({ energized = false }: { energized?: boolean }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="fixed top-3 right-3 z-40 pointer-events-none select-none">
      <style>{`
        @keyframes hareHop{0%,100%{transform:translateY(0)}30%{transform:translateY(-8px) rotate(-6deg)}60%{transform:translateY(0) rotate(3deg)}}
        @keyframes tortoiseSway{0%,100%{transform:translateX(0) rotate(-3deg)}50%{transform:translateX(3px) rotate(3deg)}}
        .companion-hare{animation:hareHop 1.1s ease-in-out infinite}
        .companion-hare-fast{animation:hareHop 0.5s ease-in-out infinite}
        .companion-tortoise{animation:tortoiseSway 2.4s ease-in-out infinite}
        .companion-tortoise-fast{animation:tortoiseSway 1s ease-in-out infinite}
      `}</style>
      <div className="pointer-events-auto flex items-end gap-1 bg-white/85 backdrop-blur border border-amber-200 rounded-2xl pl-3 pr-2 py-2 shadow-lg">
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
