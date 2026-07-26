'use client'

import { useEffect } from 'react'
import { Flame } from 'lucide-react'

/**
 * Full-screen celebration when the user hits a streak milestone (3, 7, 14…).
 * Purely presentational — the caller decides when to show it (e.g. after a task
 * completion bumps the streak) and passes the milestone number. Auto-dismisses.
 *
 * Animations are CSS-driven, so the app-wide `data-reduce-motion="on"` rule in
 * globals.css disables them for users who asked to reduce motion.
 */
export default function StreakCelebration({
  milestone,
  onDone,
}: {
  milestone: number | null
  onDone: () => void
}) {
  useEffect(() => {
    if (milestone == null) return
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [milestone, onDone])

  if (milestone == null) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm"
      role="alertdialog"
      aria-label={`${milestone} day streak reached`}
      onClick={onDone}
    >
      <style>{`
        @keyframes streakPop{0%{transform:scale(0.4);opacity:0}45%{transform:scale(1.15);opacity:1}70%{transform:scale(0.95)}100%{transform:scale(1)}}
        @keyframes flameFloat{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-10px) rotate(4deg)}}
        @keyframes confettiFall{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(60vh) rotate(360deg);opacity:0}}
      `}</style>

      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {['🎉', '✨', '🔥', '⭐', '🎊', '💫', '🔥', '✨'].map((e, i) => (
          <span
            key={i}
            className="absolute text-2xl"
            style={{
              left: `${(i + 1) * 11}%`,
              top: '-5%',
              animation: `confettiFall ${2 + (i % 4) * 0.4}s ease-in ${(i % 5) * 0.15}s forwards`,
            }}
          >
            {e}
          </span>
        ))}
      </div>

      <div
        className="relative bg-white rounded-3xl px-10 py-8 shadow-2xl text-center max-w-xs mx-4"
        style={{ animation: 'streakPop 0.6s ease-out' }}
      >
        <div className="text-6xl mb-2" style={{ animation: 'flameFloat 1.2s ease-in-out infinite' }}>
          🔥
        </div>
        <div className="flex items-center justify-center gap-2 text-3xl font-extrabold text-orange-600">
          <Flame className="w-7 h-7 text-orange-500" />
          {milestone} days!
        </div>
        <p className="text-slate-600 mt-2 text-sm">
          {milestone >= 30
            ? "Incredible dedication. You're unstoppable."
            : milestone >= 7
              ? 'A whole week strong — keep the fire going!'
              : "You're building a habit. Nice work!"}
        </p>
        <button
          onClick={onDone}
          className="mt-4 px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm font-semibold hover:shadow-lg transition-all"
        >
          Keep going →
        </button>
      </div>
    </div>
  )
}
