'use client'

/**
 * The Pit Stop shopkeeper.
 *
 * Odosa's sketch: a merchant standing at the bottom of the shop, with the
 * scroll track drawn as a ladder beside them — "in future, merchant could
 * climb ladder to go up/down".
 *
 * The ladder rung the merchant stands on tracks real scroll position, so the
 * climb already means something rather than being decoration waiting on a
 * later feature.
 *
 * Marked .pref-gamify so it disappears in Plain view and calms down in Pretty,
 * like every other celebratory extra. A shop mascot is exactly the kind of
 * thing someone who chose a quieter interface does not want.
 */

import { useEffect, useState } from 'react'

interface Props {
  /** What the merchant says. Caller supplies it; never invented here. */
  line: string
}

export default function MerchantShopkeeper({ line }: Props) {
  const [climb, setClimb] = useState(0)
  const [waving, setWaving] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setClimb(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 0 at the bottom of the page, 1 at the top of the ladder.
  const rungOffset = Math.round(climb * 96)

  return (
    <div className="pref-gamify pointer-events-none fixed bottom-0 left-0 right-0 z-30 flex justify-center">
      <div className="relative w-full max-w-4xl px-4">
        {/* Ladder — the scroll track the merchant climbs. */}
        <div className="absolute right-6 bottom-0 h-32 w-8" aria-hidden="true">
          <div className="absolute left-1 top-0 h-full w-1.5 rounded bg-amber-800/70" />
          <div className="absolute right-1 top-0 h-full w-1.5 rounded bg-amber-800/70" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="absolute left-1 h-1 w-6 rounded bg-amber-700/70"
              style={{ bottom: `${i * 20}%` }}
            />
          ))}
        </div>

        {/* Counter */}
        <div className="relative mx-auto flex max-w-md items-end justify-center">
          <div
            className="pointer-events-auto mb-1 flex flex-col items-center transition-transform duration-300 ease-out"
            style={{ transform: `translateY(${-rungOffset}px)` }}
          >
            <div className="mb-1 max-w-[15rem] rounded-2xl border-2 border-amber-300 bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-900 shadow-sm">
              {line}
            </div>

            <button
              type="button"
              onClick={() => {
                setWaving(true)
                window.setTimeout(() => setWaving(false), 600)
              }}
              aria-label="The shopkeeper waves"
              className="focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-full"
            >
              <svg viewBox="0 0 48 56" className="h-16 w-14" role="img" aria-hidden="true">
                <ellipse cx="24" cy="53" rx="11" ry="2.5" fill="rgba(0,0,0,0.12)" />
                {/* body */}
                <path d="M14 50 L16 30 h16 l2 20 z" fill="#0f766e" />
                {/* arms */}
                <path d="M16 32 L8 40" stroke="#0f766e" strokeWidth="3.5" strokeLinecap="round" />
                <path
                  d="M32 32 L40 38"
                  stroke="#0f766e"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className={waving ? 'origin-[32px_32px] animate-[wave_0.6s_ease-in-out]' : ''}
                />
                {/* apron */}
                <path d="M18 34 h12 v10 h-12 z" fill="#fbbf24" opacity="0.9" />
                {/* head */}
                <circle cx="24" cy="22" r="8" fill="#f5d0a9" />
                <circle cx="21" cy="21" r="1.1" fill="#1f2937" />
                <circle cx="27" cy="21" r="1.1" fill="#1f2937" />
                <path d="M21 25 q3 2.5 6 0" stroke="#1f2937" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                {/* cap */}
                <path d="M15 17 q9 -9 18 0 z" fill="#b45309" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-28deg); }
        }
      `}</style>
    </div>
  )
}
