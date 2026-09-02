'use client'

import { Check, Lock } from 'lucide-react'

/**
 * A compact gamified trail for ONE life dimension.
 *
 * The Trail Map view got the level-map treatment while "Separate" stayed flat
 * cards, so the same path looked like a game in one view and a spreadsheet in
 * another. This is the trail's visual language — winding path, chunky nodes,
 * ticks, padlocks, a pin on where you are — sized to sit five-across as one
 * lane of a branching track.
 *
 * Locking matches MilestoneTrail: a step you have not reached is shown but not
 * openable, and a completed step never carries the "you are here" pin.
 */

export interface LaneStep {
  id: string
  name: string
}

interface LaneTrailProps {
  steps: LaneStep[]
  completedIds: Set<string>
  /** Zone palette, so a lane matches its dimension's colour on the big trail. */
  accent: string
  node: string
  nodeDark: string
  onSelect: (s: LaneStep) => void
  day?: boolean
}

const STEP = 74
const PAD_TOP = 26

export default function LaneTrail({
  steps,
  completedIds,
  accent,
  node,
  nodeDark,
  onSelect,
  day = true,
}: LaneTrailProps) {
  const n = steps.length
  if (n === 0) return null

  const height = PAD_TOP + (n - 1) * STEP + 56

  // Same rule as the big trail: you are at the first step you have NOT
  // finished, so a green node can never also be the current one.
  const firstUnfinished = steps.findIndex((s) => !completedIds.has(s.id))
  const activeIndex = firstUnfinished === -1 ? n - 1 : firstUnfinished

  const pos = steps.map((s, i) => ({
    s,
    i,
    // Gentle alternating weave — enough to read as a path, not so much that
    // five lanes side by side become noisy.
    x: 50 + Math.sin(i * 1.25) * 17,
    y: PAD_TOP + i * STEP,
  }))

  const d = pos
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      const prev = pos[i - 1]
      const midY = (prev.y + p.y) / 2
      return `C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`
    })
    .join(' ')

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={d} fill="none" stroke={day ? '#ffffff' : '#0f172a'} strokeWidth={9} strokeLinecap="round" opacity={0.95} />
        <path d={d} fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeDasharray="1 6" opacity={0.55} />
      </svg>

      {pos.map(({ s, i, x, y }) => {
        const done = completedIds.has(s.id)
        const current = i === activeIndex && !done
        const locked = !done && i > activeIndex

        return (
          <button
            key={s.id}
            type="button"
            disabled={locked}
            onClick={() => !locked && onSelect(s)}
            aria-current={current ? 'step' : undefined}
            aria-label={`Step ${i + 1}: ${s.name}${done ? ' (completed)' : current ? ' (you are here)' : locked ? ' (locked)' : ''}`}
            title={locked ? 'Finish the step before this one first' : s.name}
            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 group rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-white ${
              locked ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
            style={{ left: `${x}%`, top: y }}
          >
            <span
              className={`relative grid place-items-center w-9 h-9 rounded-full transition-transform ${
                locked ? '' : 'group-hover:scale-110 group-active:scale-95'
              }`}
              style={{
                background: done
                  ? 'linear-gradient(160deg,#34d399,#059669)'
                  : locked
                  ? 'linear-gradient(160deg,#cbd5e1,#94a3b8)'
                  : `linear-gradient(160deg,${node},${nodeDark})`,
                boxShadow: current
                  ? `0 4px 0 ${nodeDark}, 0 7px 12px rgba(0,0,0,.3), 0 0 0 4px rgba(255,255,255,.92)`
                  : '0 3px 0 rgba(0,0,0,.26), 0 5px 9px rgba(0,0,0,.22)',
              }}
            >
              <span
                className="absolute inset-x-1.5 top-1 h-2.5 rounded-full"
                style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.45),transparent)' }}
                aria-hidden="true"
              />
              {done ? (
                <Check className="w-4 h-4 text-white drop-shadow" aria-hidden="true" />
              ) : locked ? (
                <Lock className="w-3.5 h-3.5 text-white/90" aria-hidden="true" />
              ) : (
                <span className="text-[11px] font-black text-white tabular-nums" style={{ textShadow: '0 1px 0 rgba(0,0,0,.45)' }}>
                  {i + 1}
                </span>
              )}
            </span>

            {current && (
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-base animate-bounce" aria-hidden="true">📍</span>
            )}

            {/* Label under every node — a lane of unlabelled dots tells you
                nothing about what the path actually contains. */}
            <span
              className={`absolute top-[42px] left-1/2 -translate-x-1/2 w-[92px] text-center text-[9px] font-semibold leading-tight line-clamp-2 ${
                done ? 'text-emerald-700 line-through decoration-emerald-600/50' : locked ? 'text-slate-400' : day ? 'text-slate-700' : 'text-slate-200'
              }`}
            >
              {s.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
