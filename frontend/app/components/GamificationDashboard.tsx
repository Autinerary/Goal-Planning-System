'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Level map recreated from Figma "Cloud Level - Health & Education" (node 130:2).
 *
 * The art is a fixed 1075×1434 canvas with hand-placed orbs, so it is laid out
 * at design pixels and uniformly scaled to the container width. That keeps the
 * trail SVG, orbs and labels in register at any screen size.
 */

const CANVAS_W = 1075
const CANVAS_H = 1434

type Sector = 'health' | 'education'

const SECTOR_STYLES: Record<Sector, { fill: string; orb: string }> = {
  health: { fill: 'bg-[#298c61]', orb: '/gamification/orb-green.svg' },
  education: { fill: 'bg-[#3852ad]', orb: '/gamification/orb-blue.svg' },
}

export interface MapLevel {
  level: number
  sector: Sector
  /** Top-left of the 150px orb, in design pixels. */
  x: number
  y: number
}

export const DEFAULT_LEVELS: MapLevel[] = [
  { level: 270, sector: 'health', x: 551, y: 115 },
  { level: 269, sector: 'health', x: 691, y: 297 },
  { level: 268, sector: 'health', x: 447, y: 417 },
  { level: 267, sector: 'health', x: 317, y: 617 },
  { level: 266, sector: 'health', x: 585, y: 707 },
  { level: 265, sector: 'education', x: 731, y: 915 },
  { level: 264, sector: 'education', x: 665, y: 1137 },
  { level: 263, sector: 'education', x: 475, y: 1325 },
]

const SPARKLES = [
  { x: 120, y: 250 },
  { x: 900, y: 150 },
  { x: 900, y: 620 },
  { x: 150, y: 1050 },
  { x: 900, y: 1300 },
]

interface GamificationDashboardProps {
  levels?: MapLevel[]
  onLevelSelect?: (level: MapLevel) => void
  className?: string
}

export default function GamificationDashboard({
  levels = DEFAULT_LEVELS,
  onLevelSelect,
  className = '',
}: GamificationDashboardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / CANVAS_W)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-[1075px] mx-auto overflow-hidden ${className}`}
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}
      >
        <img
          src="/gamification/background-art.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        />

        {/* Dotted trail linking the orbs (SVG includes a 4.5px stroke bleed on each side) */}
        <img
          src="/gamification/level-trail.svg"
          alt=""
          width={423}
          height={1219}
          className="absolute left-[387.5px] top-[185.5px] max-w-none pointer-events-none"
        />

        <img
          src="/gamification/sector-divider.svg"
          alt=""
          width={995}
          height={4}
          className="absolute left-[40px] top-[846px] max-w-none pointer-events-none"
        />

        <SectorBanner label="❤️  Health & Lifestyle" sector="health" left={277.5} top={30} width={520} />
        <SectorBanner label="🎓  Education" sector="education" left={337.5} top={865} width={400} />

        {levels.map((lvl) => (
          <LevelNode key={lvl.level} level={lvl} onSelect={onLevelSelect} />
        ))}

        {SPARKLES.map((s, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute text-[30px] leading-none text-black pointer-events-none select-none"
            style={{ left: s.x, top: s.y }}
          >
            ✨
          </span>
        ))}
      </div>
    </div>
  )
}

function SectorBanner({
  label,
  sector,
  left,
  top,
  width,
}: {
  label: string
  sector: Sector
  left: number
  top: number
  width: number
}) {
  return (
    <h2
      className={`absolute flex h-[84px] items-center justify-center rounded-[42px] border-4 border-white text-[30px] font-bold text-white whitespace-pre shadow-[0px_4px_8px_0px_rgba(0,0,0,0.35)] ${SECTOR_STYLES[sector].fill}`}
      style={{ left, top, width }}
    >
      {label}
    </h2>
  )
}

function LevelNode({
  level,
  onSelect,
}: {
  level: MapLevel
  onSelect?: (level: MapLevel) => void
}) {
  const { fill, orb } = SECTOR_STYLES[level.sector]

  return (
    <button
      type="button"
      onClick={() => onSelect?.(level)}
      aria-label={`Level ${level.level}, locked`}
      className="group absolute size-[150px] rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
      style={{ left: level.x, top: level.y }}
    >
      <span className="absolute inset-0 transition-transform duration-150 group-hover:scale-105 group-active:scale-95">
        {/* Orb SVG is 194px: 150px circle plus 22px of drop-shadow filter room per side */}
        <img
          src={orb}
          alt=""
          width={194}
          height={194}
          className="absolute -left-[22px] -top-[22px] max-w-none pointer-events-none"
        />

        {/* Glossy highlight */}
        <span className="absolute left-[17.11px] top-[20px] flex h-[47.43px] w-[62.197px] items-center justify-center">
          <img
            src="/gamification/orb-highlight.svg"
            alt=""
            width={55}
            height={32}
            className="max-w-none rotate-[18deg] pointer-events-none"
          />
        </span>

        {/* Padlock */}
        <span className="absolute left-[20px] -top-[13px] h-[130px] w-[110px] overflow-hidden">
          <img
            src="/gamification/lock-shackle.svg"
            alt=""
            width={56}
            height={28}
            className="absolute left-[27px] top-[6px] max-w-none pointer-events-none"
          />
          <span
            className={`absolute left-[5px] top-[46px] h-[84px] w-[100px] rounded-[18px] border-[3px] border-white shadow-[0px_3px_5px_0px_rgba(0,0,0,0.3)] ${fill}`}
          />
          <img
            src="/gamification/lock-keyhole.svg"
            alt=""
            width={12}
            height={12}
            className="absolute left-[49px] top-[58px] max-w-none pointer-events-none"
          />
          <span className="absolute left-[5px] top-[88px] flex h-[30px] w-[100px] items-center justify-center text-[24px] font-bold text-white">
            {level.level}
          </span>
        </span>
      </span>
    </button>
  )
}
