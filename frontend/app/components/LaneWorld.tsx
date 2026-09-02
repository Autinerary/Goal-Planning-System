'use client'

import { Check, Lock } from 'lucide-react'

/**
 * The parallel-dimension view as ONE painted world.
 *
 * The previous attempt gamified the nodes but left them inside white cards
 * with borders, headers and progress bars — so it still read as a dashboard
 * with round buttons rather than a level map. A level map has no cards: the
 * world IS the background, edge to edge, and the tracks run through it.
 *
 * So this draws one continuous landscape — sky, rolling ground, scattered
 * props — and threads five lanes across it. Dimension names sit on the terrain
 * as painted banners, not as card chrome.
 */

export interface WorldStep {
  id: string
  name: string
}

export interface WorldLane {
  key: string
  label: string
  emoji: string
  accent: string
  node: string
  nodeDark: string
  band: string
  ground: string
  steps: WorldStep[]
}

interface LaneWorldProps {
  lanes: WorldLane[]
  completedIds: Set<string>
  onSelect: (laneKey: string, s: WorldStep) => void
  day?: boolean
}

const STEP = 128
const PAD_TOP = 96

export default function LaneWorld({ lanes, completedIds, onSelect, day = true }: LaneWorldProps) {
  if (lanes.length === 0) return null

  const maxSteps = Math.max(...lanes.map((l) => l.steps.length), 1)
  const height = PAD_TOP + (maxSteps - 1) * STEP + 150
  const colW = 100 / lanes.length

  return (
    <div
      className="relative overflow-hidden rounded-[28px] border-[3px] border-white/70"
      style={{ height, boxShadow: '0 6px 0 rgba(120,100,70,.25), 0 14px 28px rgba(60,50,40,.22)' }}
    >
      {/* ── The world ─────────────────────────────────────────────────── */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {/* Each lane owns a vertical strip of sky in its own colour, so the
              five regions read as neighbouring territories on one map. */}
          <linearGradient id="world-sky" x1="0" y1="0" x2="1" y2="0">
            {lanes.map((l, i) => [
              <stop key={`${i}a`} offset={`${i * colW}%`} stopColor={l.band} />,
              <stop key={`${i}b`} offset={`${(i + 1) * colW}%`} stopColor={l.band} />,
            ])}
          </linearGradient>
          <linearGradient id="world-deep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#7b8794" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        <rect width="100" height={height} fill="url(#world-sky)" />

        {/* Rolling hills, three ribbons deep, so the ground has depth rather
            than being a flat colour block. */}
        {[0.30, 0.55, 0.80].map((frac, band) => (
          <path
            key={band}
            d={`M -5 ${height * frac}
                C 18 ${height * (frac - 0.035)} 34 ${height * (frac + 0.03)} 52 ${height * frac}
                C 72 ${height * (frac - 0.028)} 88 ${height * (frac + 0.026)} 105 ${height * (frac - 0.006)}
                L 105 ${height} L -5 ${height} Z`}
            fill={lanes[Math.min(band, lanes.length - 1)].ground}
            opacity={0.20 + band * 0.07}
          />
        ))}

        {/* Water pools, mirroring the ponds in the reference map. */}
        {[0.18, 0.62].map((frac, k) => (
          <ellipse
            key={`w${k}`}
            cx={k === 0 ? 12 : 88}
            cy={height * frac}
            rx={11}
            ry={height * 0.028}
            fill="#bfe4f5"
            opacity={0.5}
          />
        ))}

        <rect width="100" height={height} fill="url(#world-deep)" />
      </svg>

      {/* ── Scenery. Deterministic scatter, never under a node. ────────── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {Array.from({ length: maxSteps * lanes.length * 2 + 14 }, (_, k) => {
          const laneIdx = k % lanes.length
          const l = lanes[laneIdx]
          const x = laneIdx * colW + 4 + ((k * 29) % Math.max(colW - 8, 4))
          const y = 54 + ((k * 173) % Math.max(height - 120, 60))
          // Keep the middle of each lane clear — that is where the track runs.
          if (Math.abs(x - (laneIdx * colW + colW / 2)) < 4.5) return null
          const kind = k % 4
          const s = 0.75 + ((k % 5) / 4)

          if (kind === 0) {
            // Boulder
            return (
              <g key={k} transform={`translate(${x} ${y})`} opacity={0.5}>
                <ellipse cx="0" cy="0" rx={2.4 * s} ry={9 * s} fill="#ffffff" opacity={0.5} />
                <ellipse cx="0" cy={-2 * s} rx={1.7 * s} ry={6 * s} fill={l.ground} />
              </g>
            )
          }
          if (kind === 1) {
            // Shrub
            return (
              <g key={k} transform={`translate(${x} ${y})`} opacity={0.42}>
                <ellipse cx="0" cy="0" rx={1.5 * s} ry={7 * s} fill={l.accent} opacity={0.6} />
                <ellipse cx={1.1 * s} cy={3 * s} rx={1.1 * s} ry={5 * s} fill={l.accent} opacity={0.4} />
              </g>
            )
          }
          if (kind === 2) {
            // Crystal / marker, echoing the spires in the reference
            return (
              <g key={k} transform={`translate(${x} ${y})`} opacity={0.36}>
                <path d={`M0,${-9 * s} L${1.5 * s},0 L0,${9 * s} L${-1.5 * s},0 Z`} fill="#ffffff" />
                <path d={`M0,${-5 * s} L${0.8 * s},0 L0,${5 * s} L${-0.8 * s},0 Z`} fill={l.accent} opacity={0.7} />
              </g>
            )
          }
          // Grass tuft
          return (
            <g key={k} transform={`translate(${x} ${y})`} opacity={0.3}>
              {[-1, 0, 1].map((o) => (
                <path
                  key={o}
                  d={`M${o * 1.1 * s},${5 * s} Q${o * 1.5 * s},0 ${o * 0.7 * s},${-6 * s}`}
                  stroke={l.accent}
                  strokeWidth={0.5}
                  fill="none"
                />
              ))}
            </g>
          )
        })}
      </svg>

      {/* ── The five tracks ───────────────────────────────────────────── */}
      {lanes.map((lane, li) => {
        const cx = li * colW + colW / 2
        const n = lane.steps.length
        if (n === 0) return null

        const pts = lane.steps.map((s, i) => ({
          s,
          i,
          x: cx + Math.sin(i * 1.3 + li) * Math.min(colW * 0.22, 5),
          y: PAD_TOP + i * STEP,
        }))

        const d = pts
          .map((p, i) => {
            if (i === 0) return `M ${p.x} ${p.y}`
            const prev = pts[i - 1]
            const midY = (prev.y + p.y) / 2
            return `C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`
          })
          .join(' ')

        const firstUnfinished = lane.steps.findIndex((s) => !completedIds.has(s.id))
        const activeIndex = firstUnfinished === -1 ? n - 1 : firstUnfinished

        return (
          <div key={lane.key} className="absolute inset-0 pointer-events-none">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox={`0 0 100 ${height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={d} fill="none" stroke="#ffffff" strokeWidth={10} strokeLinecap="round" opacity={0.9} />
              <path d={d} fill="none" stroke={lane.accent} strokeWidth={3} strokeLinecap="round" strokeDasharray="1 7" opacity={0.5} />
            </svg>

            {/* Territory banner, painted onto the land — not a card header. */}
            <div
              className="absolute z-20 -translate-x-1/2 pointer-events-none"
              style={{ left: `${cx}%`, top: 26 }}
            >
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white whitespace-nowrap"
                style={{ background: lane.node, boxShadow: `0 3px 0 ${lane.nodeDark}, 0 6px 12px rgba(0,0,0,.28)` }}
              >
                <span className="text-xs">{lane.emoji}</span>
                {lane.label}
              </span>
            </div>

            {pts.map(({ s, i, x, y }) => {
              const done = completedIds.has(s.id)
              const current = i === activeIndex && !done
              const locked = !done && i > activeIndex

              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={locked}
                  onClick={() => !locked && onSelect(lane.key, s)}
                  aria-current={current ? 'step' : undefined}
                  aria-label={`${lane.label} step ${i + 1}: ${s.name}${done ? ' (completed)' : current ? ' (you are here)' : locked ? ' (locked)' : ''}`}
                  title={locked ? 'Finish the step before this one first' : s.name}
                  className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 group rounded-full pointer-events-auto focus:outline-none focus-visible:ring-4 focus-visible:ring-white ${
                    locked ? 'cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  style={{ left: `${x}%`, top: y }}
                >
                  <span
                    className={`relative grid place-items-center w-[52px] h-[52px] rounded-full transition-transform ${
                      locked ? '' : 'group-hover:scale-110 group-active:scale-95'
                    }`}
                    style={{
                      background: done
                        ? 'linear-gradient(160deg,#34d399,#059669)'
                        : locked
                        ? 'linear-gradient(160deg,#cbd5e1,#94a3b8)'
                        : `linear-gradient(160deg,${lane.node},${lane.nodeDark})`,
                      boxShadow: current
                        ? `0 6px 0 ${lane.nodeDark}, 0 10px 18px rgba(0,0,0,.35), 0 0 0 5px rgba(255,255,255,.92)`
                        : '0 5px 0 rgba(0,0,0,.28), 0 8px 14px rgba(0,0,0,.25)',
                    }}
                  >
                    <span
                      className="absolute inset-x-2 top-1.5 h-3.5 rounded-full"
                      style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.45),transparent)' }}
                      aria-hidden="true"
                    />
                    {done ? (
                      <Check className="w-6 h-6 text-white drop-shadow" aria-hidden="true" />
                    ) : locked ? (
                      <Lock className="w-5 h-5 text-white/90" aria-hidden="true" />
                    ) : (
                      <span className="text-base font-black text-white tabular-nums" style={{ textShadow: '0 2px 0 rgba(0,0,0,.45)' }}>
                        {i + 1}
                      </span>
                    )}
                  </span>

                  {current && (
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce" aria-hidden="true">📍</span>
                  )}

                  {/* Name on a small wooden plaque, the way a level map labels
                      a stage — not a paragraph of body text. */}
                  <span
                    className={`absolute top-[56px] left-1/2 -translate-x-1/2 w-[104px] rounded-md px-1.5 py-1 text-center text-[9px] font-bold leading-tight line-clamp-2 shadow-md ${
                      done
                        ? 'bg-emerald-50/95 text-emerald-800 line-through decoration-emerald-600/50'
                        : locked
                        ? 'bg-white/70 text-slate-500'
                        : 'bg-white/95 text-slate-800'
                    }`}
                  >
                    {s.name}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
