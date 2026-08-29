'use client'

import { useMemo } from 'react'
import { Check, Lock } from 'lucide-react'

/**
 * The path as ONE continuous illustrated world.
 *
 * An earlier version chunked zones into separate panels with gaps between
 * them, which read as three floating cards rather than a journey — the whole
 * point of the reference is that you scroll through a single connected place,
 * with the terrain changing under you as you move between regions.
 *
 * So: one canvas, one path threading every node, and zones as bands that blend
 * into each other rather than boxes stacked with margins.
 *
 * All generated — layered gradients and inline SVG, no image assets. Terrain
 * has to stretch to however many milestones a person actually has (4 to 80+),
 * which a fixed illustration cannot, and a new life dimension re-themes itself
 * without new art.
 */

export interface TrailMilestone {
  id: string
  name: string
  status: 'active' | 'upcoming' | 'far'
  dimension?: string
  dimensionLabel?: string
}

interface MilestoneTrailProps {
  milestones: TrailMilestone[]
  completedIds: Set<string>
  currentIndex: number
  onSelect: (m: TrailMilestone) => void
  day?: boolean
}

const ZONE: Record<
  string,
  { name: string; band: string; ground: string; accent: string; node: string; nodeDark: string }
> = {
  education:     { name: 'Study Grove',  band: '#e6d9fb', ground: '#cbb6ee', accent: '#7c3aed', node: '#4c1d95', nodeDark: '#2e1065' },
  workplace:     { name: 'Work Ridge',   band: '#fbe6c4', ground: '#eecfa0', accent: '#d97706', node: '#7c2d12', nodeDark: '#431407' },
  career:        { name: 'Work Ridge',   band: '#fbe6c4', ground: '#eecfa0', accent: '#d97706', node: '#7c2d12', nodeDark: '#431407' },
  relationships: { name: 'Kinship Vale', band: '#fbd3e3', ground: '#f2b3cd', accent: '#db2777', node: '#831843', nodeDark: '#500724' },
  health:        { name: 'Calm Springs', band: '#c9eede', ground: '#a3ddc5', accent: '#059669', node: '#064e3b', nodeDark: '#022c22' },
  default:       { name: 'Open Road',    band: '#d5e5f8', ground: '#b4cdea', accent: '#2563eb', node: '#1e3a8a', nodeDark: '#172554' },
}
const zoneFor = (d?: string) => ZONE[(d || '').toLowerCase()] || ZONE.default

// Vertical space per milestone. Enough that a node plus its label never
// collides with the one above.
const STEP = 108
const PAD_TOP = 70
const PAD_BOTTOM = 90

export default function MilestoneTrail({
  milestones,
  completedIds,
  currentIndex,
  onSelect,
  day = true,
}: MilestoneTrailProps) {
  const n = milestones.length
  const height = PAD_TOP + Math.max(1, n) * STEP + PAD_BOTTOM

  // One coordinate space for the whole map. x is a percentage of the width so
  // it stays responsive; y is absolute pixels so spacing never compresses.
  const nodes = useMemo(
    () =>
      milestones.map((m, i) => {
        // Serpentine, with a deterministic nudge so it reads as terrain rather
        // than a staircase. Derived from the index, never Math.random() — a
        // random scatter would rearrange the world on every render.
        const wave = Math.sin(i * 1.15 + 0.5)
        const nudge = (((i * 37) % 9) - 4) * 0.8
        return {
          m,
          i,
          x: 50 + wave * 24 + nudge,
          y: PAD_TOP + i * STEP,
        }
      }),
    [milestones]
  )

  // Where each zone starts, so bands and labels line up with the real change
  // in life dimension rather than an arbitrary chunk size.
  const zoneRuns = useMemo(() => {
    const runs: { key: string; label: string; startY: number; endY: number }[] = []
    nodes.forEach(({ m, y }) => {
      const key = (m.dimension || 'default').toLowerCase()
      const last = runs[runs.length - 1]
      if (!last || last.key !== key) {
        runs.push({
          key,
          label: m.dimensionLabel || zoneFor(key).name,
          startY: y - STEP / 2,
          endY: y + STEP / 2,
        })
      } else {
        last.endY = y + STEP / 2
      }
    })
    return runs
  }, [nodes])

  const doneCount = milestones.filter((m) => completedIds.has(m.id)).length

  if (n === 0) return null

  // The trail: a single smooth path through every node, top to bottom.
  const trail = nodes
    .map((p, i) =>
      i === 0
        ? `M ${p.x} ${p.y}`
        : ` C ${nodes[i - 1].x} ${nodes[i - 1].y + STEP * 0.5}, ${p.x} ${p.y - STEP * 0.5}, ${p.x} ${p.y}`
    )
    .join('')

  return (
    <div className="w-full max-w-[440px] mx-auto">
      {/* HUD */}
      <div className="sticky top-2 z-30 mb-2 flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-white/92 backdrop-blur border-2 border-amber-200 px-4 py-1.5 shadow-lg">
          <span className="text-lg leading-none" aria-hidden="true">🏁</span>
          <span className="text-xs font-extrabold tabular-nums text-slate-800">
            {doneCount}<span className="text-slate-400">/{n}</span>
          </span>
          <span className="w-px h-4 bg-slate-200" aria-hidden="true" />
          <span className="text-xs font-bold text-slate-600">{zoneRuns.length} zones</span>
        </div>
      </div>

      {/* ONE canvas for the whole world */}
      <div
        className="relative overflow-hidden rounded-[28px] border-[3px] border-white/70"
        style={{ height, boxShadow: '0 6px 0 rgba(120,100,70,.25), 0 14px 28px rgba(60,50,40,.22)' }}
      >
        {/* Terrain. viewBox in the same pixel space as the nodes, so bands land
            exactly where their zone actually begins. */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="trail-sky" x1="0" y1="0" x2="0" y2="1">
              {/* Zone colours as stops on ONE gradient — regions bleed into each
                  other instead of butting up as separate blocks. */}
              {zoneRuns.map((r, i) => {
                const z = zoneFor(r.key)
                return [
                  <stop key={`${i}a`} offset={`${(r.startY / height) * 100}%`} stopColor={z.band} />,
                  <stop key={`${i}b`} offset={`${(r.endY / height) * 100}%`} stopColor={z.band} />,
                ]
              })}
            </linearGradient>
          </defs>

          <rect width="100" height={height} fill="url(#trail-sky)" />

          {/* Rolling ground, one continuous ribbon down the whole map */}
          {zoneRuns.map((r, i) => {
            const z = zoneFor(r.key)
            const h = r.endY - r.startY
            return (
              <path
                key={`g${i}`}
                d={`M -5 ${r.startY + h * 0.45}
                    C 25 ${r.startY + h * 0.3} 45 ${r.startY + h * 0.62} 70 ${r.startY + h * 0.48}
                    C 88 ${r.startY + h * 0.4} 98 ${r.startY + h * 0.55} 105 ${r.startY + h * 0.5}
                    L 105 ${r.endY + 2} L -5 ${r.endY + 2} Z`}
                fill={z.ground}
                opacity="0.45"
              />
            )
          })}
        </svg>

        {/* Props, in node space so they scatter across the whole map */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {Array.from({ length: Math.max(6, n * 2) }, (_, k) => {
            const y = 40 + ((k * 137) % (height - 80))
            const run = zoneRuns.find((r) => y >= r.startY && y <= r.endY) || zoneRuns[0]
            const z = zoneFor(run.key)
            const x = 6 + ((k * 53) % 88)
            const near = nodes.some((p) => Math.abs(p.y - y) < 44 && Math.abs(p.x - x) < 14)
            if (near) return null // never sit a prop under a node
            const s = 0.8 + ((k % 5) / 5)
            return (
              <g key={k} transform={`translate(${x} ${y}) scale(${s * 1.6} ${s * 12})`} opacity={0.28}>
                <path d="M0,-0.5 L0.25,0 L0,0.6 L-0.25,0 Z" fill={k % 3 === 0 ? z.accent : '#ffffff'} />
              </g>
            )
          })}
        </svg>

        {/* The trail itself, threading every node across every zone */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={trail} fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="9" strokeLinecap="round"
                vectorEffect="non-scaling-stroke" />
          <path d={trail} fill="none" stroke="rgba(90,75,55,.28)" strokeWidth="2" strokeLinecap="round"
                strokeDasharray="1 9" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* Zone labels — pinned to the side, so a node can never land on one */}
        {zoneRuns.map((r, i) => {
          const z = zoneFor(r.key)
          return (
            <span
              key={`l${i}`}
              className="absolute left-3 z-20 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white border-2 border-white/60 shadow"
              style={{ top: r.startY + 6, background: z.accent }}
            >
              {r.label}
            </span>
          )
        })}

        {/* Nodes */}
        {nodes.map(({ m, i, x, y }) => {
          const z = zoneFor(m.dimension)
          const done = completedIds.has(m.id)
          const current = i === currentIndex
          const locked = !done && i > currentIndex

          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m)}
              aria-current={current ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${m.name}${done ? ' (done)' : current ? ' (you are here)' : locked ? ' (locked)' : ''}`}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group focus:outline-none focus-visible:ring-4 focus-visible:ring-white rounded-full"
              style={{ left: `${x}%`, top: y }}
            >
              <span
                className="relative grid place-items-center w-[56px] h-[56px] rounded-full transition-transform group-hover:scale-110 group-active:scale-95"
                style={{
                  background: done
                    ? 'linear-gradient(160deg,#34d399,#059669)'
                    : locked
                    ? 'linear-gradient(160deg,#cbd5e1,#94a3b8)'
                    : `linear-gradient(160deg,${z.node},${z.nodeDark})`,
                  boxShadow: current
                    ? `0 6px 0 ${z.nodeDark}, 0 10px 18px rgba(0,0,0,.35), 0 0 0 5px rgba(255,255,255,.92)`
                    : '0 5px 0 rgba(0,0,0,.28), 0 8px 14px rgba(0,0,0,.25)',
                }}
              >
                <span
                  className="absolute inset-x-2 top-1.5 h-4 rounded-full"
                  style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.45),transparent)' }}
                  aria-hidden="true"
                />
                {done ? (
                  <Check className="w-6 h-6 text-white drop-shadow" aria-hidden="true" />
                ) : locked ? (
                  <Lock className="w-5 h-5 text-white/90" aria-hidden="true" />
                ) : (
                  <span className="text-lg font-black text-white tabular-nums" style={{ textShadow: '0 2px 0 rgba(0,0,0,.45)' }}>
                    {i + 1}
                  </span>
                )}
              </span>

              {current && (
                <>
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce" aria-hidden="true">📍</span>
                  <span className="absolute top-[62px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-white/95 px-2 py-1 text-[11px] font-bold text-slate-800 shadow-md max-w-[170px] truncate">
                    {m.name}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
