'use client'

import { useEffect, useState } from 'react'
import { lineFor, wheelSlices } from '@/lib/motivationQuotes'

/**
 * The Motivation Wheel, at the start of a task (the team's notes, October
 * 2026: Odosa, "Motivation Wheel generating quotes"; Eliyana, "this could get
 * repetitive; maybe just need Motivation Wheel at start"). One spin, landing
 * on one of your motivation styles (or all six, when you haven't chosen),
 * with a line for it. The result stays for this task today, so it doesn't
 * keep spinning; it's kept on this device only.
 */
export default function MotivationWheel({ taskId, types }: { taskId: string; types?: string[] }) {
  const slices = wheelSlices(types)
  const key = `autinerary:wheel:${taskId}:${new Date().toISOString().slice(0, 10)}`
  const [result, setResult] = useState<{ style: string; line: string } | null>(null)
  const [angle, setAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      if (saved?.style && saved?.line) setResult(saved)
    } catch {
      /* nothing saved */
    }
  }, [key])

  const calm = () => typeof document !== 'undefined' && (document.documentElement.dataset.reduceMotion === 'on' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  const spin = () => {
    if (spinning) return
    const index = Math.floor(Math.random() * slices.length)
    const each = 360 / slices.length
    // Land with the chosen slice under the pointer at the top.
    const target = 360 * 5 + (360 - (index * each + each / 2))
    const chosen = { style: slices[index].id, line: lineFor(slices[index].id, Math.random()) }
    const done = () => {
      setSpinning(false)
      setResult(chosen)
      try {
        localStorage.setItem(key, JSON.stringify(chosen))
      } catch {
        /* still shown, just not kept */
      }
    }
    if (calm()) {
      setAngle(target % 360)
      done()
      return
    }
    setSpinning(true)
    setAngle(target)
    window.setTimeout(done, 2200)
  }

  const label = (id: string) => slices.find((s) => s.id === id)?.label || id
  const each = 360 / slices.length
  const r = 70
  const point = (deg: number) => [80 + r * Math.sin((deg * Math.PI) / 180), 80 - r * Math.cos((deg * Math.PI) / 180)]

  return (
    <section aria-labelledby="wheel-heading" className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-center">
      <h2 id="wheel-heading" className="text-sm font-bold uppercase tracking-wide text-amber-900">
        Motivation Wheel
      </h2>
      {result ? (
        <div className="mt-2" aria-live="polite">
          <p className="text-xs font-semibold text-amber-900">Your spin: {label(result.style)}</p>
          <p className="mt-1 text-base italic text-slate-900">“{result.line}”</p>
        </div>
      ) : (
        <>
          <div className="relative mx-auto mt-2 h-40 w-40">
            {/* the pointer */}
            <div aria-hidden="true" className="absolute left-1/2 top-0 z-10 -translate-x-1/2 text-xl leading-none text-slate-900">▼</div>
            <svg viewBox="0 0 160 160" className="h-40 w-40" aria-hidden="true" style={{ transform: `rotate(${angle}deg)`, transition: spinning ? 'transform 2.2s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none' }}>
              {slices.map((s, i) => {
                const [x1, y1] = point(i * each)
                const [x2, y2] = point((i + 1) * each)
                const [tx, ty] = [80 + 46 * Math.sin(((i + 0.5) * each * Math.PI) / 180), 80 - 46 * Math.cos(((i + 0.5) * each * Math.PI) / 180)]
                return (
                  <g key={s.id}>
                    <path d={`M80,80 L${x1},${y1} A${r},${r} 0 ${each > 180 ? 1 : 0} 1 ${x2},${y2} Z`} fill={s.color} stroke="#fff" strokeWidth="2" />
                    <text x={tx} y={ty} fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(i + 0.5) * each} ${tx} ${ty})`}>
                      {s.label}
                    </text>
                  </g>
                )
              })}
              <circle cx="80" cy="80" r="10" fill="#fff" stroke="#0f172a" strokeWidth="2" />
            </svg>
          </div>
          <button
            type="button"
            onClick={spin}
            disabled={spinning}
            className="mt-2 rounded-xl bg-amber-700 px-5 py-2 font-semibold text-white hover:bg-amber-800 disabled:opacity-70"
          >
            {spinning ? 'Spinning…' : 'Spin to start'}
          </button>
          <p className="mt-1 text-xs text-slate-700">One spin, as you start. It lands on one of the things that motivate you.</p>
        </>
      )}
    </section>
  )
}
