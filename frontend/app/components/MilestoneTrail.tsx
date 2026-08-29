'use client'

import { useMemo } from 'react'
import { Check, Lock } from 'lucide-react'

/**
 * The path as an illustrated level map.
 *
 * Modelled on a mobile puzzle-game world map: chunky numbered nodes scattered
 * across painted terrain, torn panel edges, props strewn around, and a HUD
 * showing where you stand.
 *
 * Everything visual here is GENERATED — layered gradients and inline SVG, no
 * image assets. That matters practically: the terrain has to adapt to however
 * many milestones a person actually has (which varies from 4 to 80+), and a
 * fixed illustration cannot. It also means zones re-theme themselves from the
 * user's own life dimensions rather than needing art per category.
 *
 * Why this shape rather than a list: 80 milestones as a list reads as a
 * backlog, which is the exact feeling this product exists to reduce. Scattered
 * across terrain, the same 80 become somewhere you are moving through, and the
 * next step is always one short hop away rather than item 47 of 80.
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

/** Each life dimension paints its own region. */
const ZONE: Record<
  string,
  { name: string; sky: [string, string]; ground: string; accent: string; node: string; nodeDark: string }
> = {
  education:     { name: 'Study Grove',  sky: ['#e9d8fd', '#f5eaff'], ground: '#c9b6e8', accent: '#7c3aed', node: '#4c1d95', nodeDark: '#2e1065' },
  workplace:     { name: 'Work Ridge',   sky: ['#fde8c8', '#fff4e2'], ground: '#eccfa0', accent: '#d97706', node: '#7c2d12', nodeDark: '#431407' },
  career:        { name: 'Work Ridge',   sky: ['#fde8c8', '#fff4e2'], ground: '#eccfa0', accent: '#d97706', node: '#7c2d12', nodeDark: '#431407' },
  relationships: { name: 'Kinship Vale', sky: ['#fbd5e4', '#ffeaf2'], ground: '#f0b8ce', accent: '#db2777', node: '#831843', nodeDark: '#500724' },
  health:        { name: 'Calm Springs', sky: ['#c8ecdd', '#e4f8f0'], ground: '#a5dcc6', accent: '#059669', node: '#064e3b', nodeDark: '#022c22' },
  default:       { name: 'Open Road',    sky: ['#d6e4f7', '#eef4fd'], ground: '#b8cde8', accent: '#2563eb', node: '#1e3a8a', nodeDark: '#172554' },
}
const zoneFor = (d?: string) => ZONE[(d || '').toLowerCase()] || ZONE.default

const PER_ZONE = 6

/**
 * Node placement.
 *
 * Deliberately NOT a neat zig-zag: the reference scatters nodes so the path
 * feels like terrain rather than a staircase. Offsets come from the index, so
 * the same milestone always sits in the same place — a random scatter would
 * rearrange the map on every render, which would be disorienting for exactly
 * the people this is built for.
 */
function nodePos(i: number, total: number): { x: number; y: number } {
  const t = total <= 1 ? 0.5 : i / (total - 1)
  const y = 8 + t * 84
  const wave = Math.sin(i * 1.35 + 0.6)
  const jitter = ((i * 37) % 11) - 5
  return { x: 50 + wave * 26 + jitter, y }
}

export default function MilestoneTrail({
  milestones,
  completedIds,
  currentIndex,
  onSelect,
  day = true,
}: MilestoneTrailProps) {
  const panels = useMemo(() => {
    const out: { zoneKey: string; items: { m: TrailMilestone; index: number }[] }[] = []
    milestones.forEach((m, index) => {
      const key = (m.dimension || 'default').toLowerCase()
      const last = out[out.length - 1]
      if (!last || last.zoneKey !== key || last.items.length >= PER_ZONE) {
        out.push({ zoneKey: key, items: [{ m, index }] })
      } else last.items.push({ m, index })
    })
    return out
  }, [milestones])

  const doneCount = milestones.filter((m) => completedIds.has(m.id)).length

  if (milestones.length === 0) return null

  return (
    <div className="w-full max-w-[420px] mx-auto">
      {/* HUD — the reference's top bar. Real numbers: how far along, and how
          many zones the path crosses. */}
      <div className="sticky top-2 z-30 mb-3 flex items-center justify-center gap-2">
        <div className="flex items-center gap-2 rounded-full bg-white/90 backdrop-blur border-2 border-amber-200 shadow-lg px-4 py-1.5">
          <span className="text-lg leading-none" aria-hidden="true">🏁</span>
          <span className="text-xs font-extrabold tabular-nums text-slate-800">
            {doneCount}<span className="text-slate-400">/{milestones.length}</span>
          </span>
          <span className="w-px h-4 bg-slate-200" aria-hidden="true" />
          <span className="text-xs font-bold text-slate-600">{panels.length} zones</span>
        </div>
      </div>

      <div className="space-y-3">
        {panels.map((panel, pi) => {
          const z = zoneFor(panel.zoneKey)
          const label = panel.items[0].m.dimensionLabel || z.name
          const uid = `${panel.zoneKey}-${pi}`

          return (
            <section
              key={uid}
              className="relative overflow-hidden rounded-[28px] shadow-lg"
              style={{ height: `${Math.max(280, panel.items.length * 78)}px` }}
              aria-label={`${label} — ${panel.items.length} milestones`}
            >
              {/* ── Painted background ─────────────────────────────────── */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={z.sky[0]} />
                    <stop offset="100%" stopColor={z.sky[1]} />
                  </linearGradient>
                  {/* Torn edges, like the ripped-paper borders in the reference */}
                  <clipPath id={`torn-${uid}`} clipPathUnits="objectBoundingBox">
                    <path d={tornEdge(pi)} />
                  </clipPath>
                </defs>

                <g clipPath={`url(#torn-${uid})`}>
                  <rect width="100" height="100" fill={`url(#sky-${uid})`} />
                  {/* Terrain: soft landmasses, deliberately irregular */}
                  <path d={landmass(pi, 0)} fill={z.ground} opacity="0.55" />
                  <path d={landmass(pi, 1)} fill={z.ground} opacity="0.35" />
                  {/* A ravine, for depth */}
                  <path d={ravine(pi)} fill="#3f3a52" opacity="0.18" />
                </g>
              </svg>

              {/* ── Scattered props ────────────────────────────────────── */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" aria-hidden="true">
                {props(pi, z.accent).map((p, k) => (
                  <g key={k} transform={`translate(${p.x} ${p.y}) scale(${p.s})`} opacity={p.o}>
                    <path d={p.d} fill={p.f} />
                  </g>
                ))}
              </svg>

              {/* Zone name */}
              <div className="absolute top-3 left-0 right-0 z-20 flex justify-center">
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow"
                  style={{ background: z.accent }}
                >
                  {label}
                </span>
              </div>

              {/* ── Nodes ──────────────────────────────────────────────── */}
              {panel.items.map(({ m, index }, i) => {
                const pos = nodePos(i, panel.items.length)
                const done = completedIds.has(m.id)
                const current = index === currentIndex
                const locked = !done && index > currentIndex

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelect(m)}
                    aria-current={current ? 'step' : undefined}
                    aria-label={`Step ${index + 1}: ${m.name}${done ? ' (done)' : current ? ' (you are here)' : locked ? ' (locked)' : ''}`}
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group focus:outline-none focus-visible:ring-4 focus-visible:ring-white rounded-full"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  >
                    {/* Chunky node with real depth — the reference's blobs read
                        as physical objects, not flat circles. */}
                    <span
                      className="relative grid place-items-center w-[58px] h-[58px] rounded-full transition-transform group-hover:scale-110 group-active:scale-95"
                      style={{
                        background: done
                          ? 'linear-gradient(160deg,#34d399,#059669)'
                          : locked
                          ? 'linear-gradient(160deg,#cbd5e1,#94a3b8)'
                          : `linear-gradient(160deg,${z.node},${z.nodeDark})`,
                        boxShadow: current
                          ? `0 6px 0 ${z.nodeDark}, 0 10px 18px rgba(0,0,0,.35), 0 0 0 5px rgba(255,255,255,.9)`
                          : `0 5px 0 rgba(0,0,0,.28), 0 8px 14px rgba(0,0,0,.25)`,
                      }}
                    >
                      {/* Highlight, so it reads as rounded rather than a disc */}
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
                        <span
                          className="text-lg font-black text-white tabular-nums"
                          style={{ textShadow: '0 2px 0 rgba(0,0,0,.45)' }}
                        >
                          {index + 1}
                        </span>
                      )}
                    </span>

                    {/* Current marker + label. Only the current node is named on
                        the map; the rest stay clean, and tapping opens them. */}
                    {current && (
                      <>
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce" aria-hidden="true">
                          📍
                        </span>
                        <span className="absolute top-[64px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-white/95 px-2 py-1 text-[11px] font-bold text-slate-800 shadow-md max-w-[160px] truncate">
                          {m.name}
                        </span>
                      </>
                    )}
                  </button>
                )
              })}
            </section>
          )
        })}
      </div>
    </div>
  )
}

/* ── Generated scenery ────────────────────────────────────────────────────
   All deterministic from the panel index, so a zone looks the same every
   render. Random scenery would reshuffle the world on each visit.          */

function tornEdge(seed: number): string {
  const n = 9
  // Ragged left and right margins, mirroring the ripped-paper look.
  const pts: string[] = ['M 0.03,0']
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const off = 0.02 + (((i * 31 + seed * 17) % 7) / 700)
    pts.push(`L ${off.toFixed(3)},${t.toFixed(3)}`)
  }
  pts.push('L 0.97,1')
  for (let i = n; i >= 0; i--) {
    const t = i / n
    const off = 0.98 - (((i * 23 + seed * 13) % 7) / 700)
    pts.push(`L ${off.toFixed(3)},${t.toFixed(3)}`)
  }
  pts.push('Z')
  return pts.join(' ')
}

function landmass(seed: number, layer: number): string {
  const b = seed * 7 + layer * 13
  const y = 20 + ((b % 5) * 8) + layer * 22
  return `M -5,${y} C 20,${y - 12 + (b % 6)} 35,${y + 10} 55,${y + 2}
          C 75,${y - 6} 90,${y + 12} 105,${y + 4} L 105,110 L -5,110 Z`
}

function ravine(seed: number): string {
  const x = 18 + ((seed * 29) % 40)
  return `M ${x},46 C ${x + 8},58 ${x - 6},70 ${x + 4},86 L ${x + 16},86
          C ${x + 8},70 ${x + 22},58 ${x + 14},46 Z`
}

function props(seed: number, accent: string) {
  // Crystals, stones and sprouts — enough to make terrain feel inhabited.
  const crystal = 'M0,-6 L3,0 L0,7 L-3,0 Z'
  const stone = 'M-5,2 C-5,-2 -2,-4 0,-4 C3,-4 5,-2 5,2 C5,4 2,5 0,5 C-2,5 -5,4 -5,2 Z'
  const sprout = 'M0,4 C0,0 -4,-2 -4,-5 C-1,-5 0,-2 0,0 C0,-2 1,-5 4,-5 C4,-2 0,0 0,4 Z'
  const shapes = [crystal, stone, sprout]
  return Array.from({ length: 7 }, (_, i) => {
    const h = (seed * 41 + i * 67) % 100
    return {
      x: 8 + ((seed * 19 + i * 23) % 84),
      y: 10 + ((seed * 31 + i * 47) % 80),
      s: 0.7 + ((h % 5) / 6),
      o: 0.25 + ((h % 4) / 12),
      d: shapes[i % shapes.length],
      f: i % 3 === 0 ? accent : '#ffffff',
    }
  })
}
