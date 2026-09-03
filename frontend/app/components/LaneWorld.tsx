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

const STEP = 168
const PAD_TOP = 96

export default function LaneWorld({ lanes, completedIds, onSelect, day = true }: LaneWorldProps) {
  if (lanes.length === 0) return null

  const maxSteps = Math.max(...lanes.map((l) => l.steps.length), 1)
  const height = PAD_TOP + (maxSteps - 1) * STEP + 150
  const colW = 100 / lanes.length

  // Five territories need room to stay legible. Below this the plaques and
  // banners collide, which is what pushed the world off the side of the page.
  // Each lane must hold a 150px plaque plus breathing room on both sides,
  // or names bleed across into the next territory.
  const minWidth = lanes.length * 200

  return (
    <div className="w-full overflow-x-auto overflow-y-hidden rounded-[28px]">
    <div
      className="relative overflow-hidden rounded-[28px] border-[3px] border-white/70"
      style={{ height, minWidth, boxShadow: '0 6px 0 rgba(120,100,70,.25), 0 14px 28px rgba(60,50,40,.22)' }}
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

        <rect width="100" height={height} fill="url(#world-deep)" />
      </svg>

      {/* ── Scenery. Plain HTML, because anything drawn in the squashed
             viewBox above comes out smeared sideways. Deterministic scatter,
             never over a track. ─────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {Array.from({ length: maxSteps * lanes.length + 18 }, (_, k) => {
          const laneIdx = k % lanes.length
          const l = lanes[laneIdx]
          const within = 4 + ((k * 29) % Math.max(colW - 8, 4))
          const x = laneIdx * colW + within
          const y = 60 + ((k * 173) % Math.max(height - 130, 60))
          // Keep the middle of each lane clear — the track runs there.
          if (Math.abs(within - colW / 2) < 5) return null
          const kind = k % 3
          const size = 7 + (k % 4) * 4

          if (kind === 0) {
            return (
              <span
                key={k}
                className="absolute rounded-full"
                style={{
                  left: `${x}%`, top: y, width: size, height: size * 0.8,
                  background: l.ground, opacity: 0.55,
                  boxShadow: '0 1px 0 rgba(255,255,255,.7)',
                }}
              />
            )
          }
          if (kind === 1) {
            return (
              <span
                key={k}
                className="absolute rounded-full"
                style={{
                  left: `${x}%`, top: y, width: size * 0.8, height: size * 0.8,
                  background: l.accent, opacity: 0.28,
                }}
              />
            )
          }
          return (
            <span
              key={k}
              className="absolute"
              style={{
                left: `${x}%`, top: y, width: 0, height: 0, opacity: 0.3,
                borderLeft: `${size * 0.4}px solid transparent`,
                borderRight: `${size * 0.4}px solid transparent`,
                borderBottom: `${size}px solid ${l.accent}`,
              }}
            />
          )
        })}
      </div>

      {/* ── The five tracks ───────────────────────────────────────────── */}
      {lanes.map((lane, li) => {
        const cx = li * colW + colW / 2
        const n = lane.steps.length
        if (n === 0) return null

        const pts = lane.steps.map((s, i) => ({
          s,
          i,
          x: cx + Math.sin(i * 1.3 + li) * Math.min(colW * 0.10, 2.2),
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
              {/* vectorEffect is essential here: the viewBox squashes X to 100
                  units while Y runs to the full pixel height, so without it
                  every stroke and dash is stretched into a wide horizontal
                  blob instead of a round dotted trail. non-scaling-stroke
                  renders the stroke in screen space, undistorted. */}
              <path
                d={d}
                fill="none"
                stroke="#ffffff"
                strokeWidth={14}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.92}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={d}
                fill="none"
                stroke={lane.accent}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray="0.1 9"
                opacity={0.55}
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Territory banner, painted onto the land — not a card header. */}
            <div
              className="absolute z-20 -translate-x-1/2 pointer-events-none"
              style={{ left: `${cx}%`, top: 26 }}
            >
              <span
                className="inline-flex items-center gap-1 max-w-[190px] rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white truncate"
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
                    className={`absolute top-[56px] left-1/2 -translate-x-1/2 w-[150px] rounded-md px-2 py-1 text-center text-[10px] font-bold leading-snug line-clamp-3 shadow-md ${
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
    </div>
  )
}
