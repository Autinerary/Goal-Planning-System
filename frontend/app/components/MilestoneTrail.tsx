'use client'

import { useMemo } from 'react'
import { Check, Lock, Star } from 'lucide-react'

/**
 * The path as a level map.
 *
 * The reference is a mobile puzzle-game world map: numbered nodes winding up
 * the screen, grouped into visually distinct regions, with what you have
 * cleared, what you are on, and what is still locked all readable at a glance.
 *
 * Why that shape earns its place here rather than just looking nicer: a flat
 * list of 80 milestones reads as a backlog, and a backlog is the exact thing
 * this product exists to make less punishing. A winding trail makes progress
 * spatial — you can see how far you have come without counting — and chunking
 * it into zones means the next thing is always a short hop, not item 47 of 80.
 *
 * Real data throughout: nodes are the user's own milestones, zones are their
 * life dimensions, and the current node is the one the agents marked active.
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

/** Zone palettes, keyed by life dimension. Each region reads as its own place. */
const ZONE: Record<string, { name: string; from: string; to: string; node: string; ring: string }> = {
  education:     { name: 'Study Grove',   from: 'from-sky-100',     to: 'to-indigo-100',   node: 'bg-sky-500',     ring: 'ring-sky-300' },
  workplace:     { name: 'Work Ridge',    from: 'from-amber-100',   to: 'to-orange-100',   node: 'bg-amber-500',   ring: 'ring-amber-300' },
  career:        { name: 'Work Ridge',    from: 'from-amber-100',   to: 'to-orange-100',   node: 'bg-amber-500',   ring: 'ring-amber-300' },
  relationships: { name: 'Kinship Vale',  from: 'from-rose-100',    to: 'to-pink-100',     node: 'bg-rose-500',    ring: 'ring-rose-300' },
  health:        { name: 'Calm Springs',  from: 'from-emerald-100', to: 'to-teal-100',     node: 'bg-emerald-500', ring: 'ring-emerald-300' },
  default:       { name: 'Open Road',     from: 'from-slate-100',   to: 'to-slate-50',     node: 'bg-slate-500',   ring: 'ring-slate-300' },
}

const zoneFor = (dim?: string) => ZONE[(dim || '').toLowerCase()] || ZONE.default

// Nodes per zone panel. Small enough that the next node is always a short hop.
const PER_ZONE = 6

export default function MilestoneTrail({
  milestones,
  completedIds,
  currentIndex,
  onSelect,
  day = true,
}: MilestoneTrailProps) {
  // Chunk into panels, breaking whenever the life dimension changes so a zone
  // is always one kind of work — never half study, half health.
  const panels = useMemo(() => {
    const out: { zoneKey: string; items: { m: TrailMilestone; index: number }[] }[] = []
    milestones.forEach((m, index) => {
      const key = (m.dimension || 'default').toLowerCase()
      const last = out[out.length - 1]
      if (!last || last.zoneKey !== key || last.items.length >= PER_ZONE) {
        out.push({ zoneKey: key, items: [{ m, index }] })
      } else {
        last.items.push({ m, index })
      }
    })
    return out
  }, [milestones])

  if (milestones.length === 0) return null

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {panels.map((panel, panelIdx) => {
        const z = zoneFor(panel.zoneKey)
        const label = panel.items[0].m.dimensionLabel || z.name

        return (
          <section
            key={`${panel.zoneKey}-${panelIdx}`}
            className={`relative rounded-3xl border overflow-hidden bg-gradient-to-b ${z.from} ${z.to} ${
              day ? 'border-white/70' : 'border-white/10'
            } shadow-sm`}
            aria-label={`${label} — ${panel.items.length} milestones`}
          >
            <div className="absolute top-3 left-4 z-10">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600/80">
                {label}
              </span>
            </div>

            <div className="relative pt-10 pb-6 px-6">
              {/* The trail itself, drawn behind the nodes. Serpentine so the eye
                  follows it rather than scanning a column. */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d={trailPath(panel.items.length)}
                  fill="none"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={trailPath(panel.items.length)}
                  fill="none"
                  stroke="rgba(100,116,139,0.25)"
                  strokeWidth="2"
                  strokeDasharray="1 10"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              <ol className="relative space-y-5">
                {panel.items.map(({ m, index }, i) => {
                  const done = completedIds.has(m.id)
                  const current = index === currentIndex
                  // Locked = beyond the current step and not yet done. Shown,
                  // never hidden: seeing what is coming is part of the point.
                  const locked = !done && index > currentIndex

                  // Alternate sides so the row zig-zags along the path.
                  const side = i % 2 === 0 ? 'justify-start' : 'justify-end'

                  return (
                    <li key={m.id} className={`flex ${side}`}>
                      <button
                        type="button"
                        onClick={() => onSelect(m)}
                        className="group flex items-center gap-2.5 max-w-[80%] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-500 rounded-2xl"
                        aria-current={current ? 'step' : undefined}
                      >
                        {/* Node */}
                        <span
                          className={`relative grid place-items-center w-12 h-12 rounded-full shrink-0 text-white font-bold shadow-md transition-transform group-hover:scale-105 ${
                            done
                              ? 'bg-emerald-500'
                              : current
                              ? `${z.node} ring-4 ${z.ring}`
                              : 'bg-slate-300'
                          }`}
                        >
                          {done ? (
                            <Check className="w-5 h-5" aria-hidden="true" />
                          ) : locked ? (
                            <Lock className="w-4 h-4 opacity-80" aria-hidden="true" />
                          ) : (
                            <span className="text-sm tabular-nums">{index + 1}</span>
                          )}

                          {current && (
                            <span className="absolute -top-1.5 -right-1.5 grid place-items-center w-6 h-6 rounded-full bg-amber-400 shadow">
                              <Star className="w-3.5 h-3.5 text-white fill-white" aria-hidden="true" />
                            </span>
                          )}
                        </span>

                        {/* Label */}
                        <span
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur ${
                            current
                              ? 'bg-white text-slate-900'
                              : done
                              ? 'bg-white/80 text-slate-500 line-through decoration-slate-400'
                              : 'bg-white/75 text-slate-700'
                          }`}
                        >
                          {m.name}
                          {current && (
                            <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-600">
                              You are here
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          </section>
        )
      })}
    </div>
  )
}

/**
 * A serpentine path for n nodes, in the panel's own coordinate space.
 * Percentages so it stretches with the container instead of needing a measure.
 */
function trailPath(n: number): string {
  if (n <= 1) return 'M 20% 50% L 80% 50%'
  const step = 100 / (n + 0.5)
  let d = ''
  for (let i = 0; i < n; i++) {
    const y = 12 + step * i
    const x = i % 2 === 0 ? 22 : 78
    d += i === 0 ? `M ${x}% ${y}%` : ` Q 50% ${y - step / 2}% ${x}% ${y}%`
  }
  return d
}
