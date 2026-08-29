'use client'

import { ReactNode } from 'react'

/**
 * Game-UI primitives.
 *
 * The trail map already reads as a game; the page around it still read as a
 * web app — flat white cards, hairline borders, text buttons. Mixing the two
 * looked like a game embedded in a dashboard rather than one screen.
 *
 * What actually separates the two languages, and what these encode:
 *   * depth — a hard bottom edge and a shadow, so things sit ON the surface
 *   * weight — thick borders and heavy type instead of hairlines
 *   * press — controls that visibly move when you push them
 *   * warmth — parchment and painted grounds instead of white
 *
 * All CSS. No image assets, so this stretches to any content length and
 * re-themes without new art.
 */

/* ── Panel ──────────────────────────────────────────────────────────────── */

export function GamePanel({
  children,
  tone = 'parchment',
  className = '',
}: {
  children: ReactNode
  tone?: 'parchment' | 'sky' | 'rose' | 'mint'
  className?: string
}) {
  const tones = {
    parchment: { bg: 'linear-gradient(165deg,#fffaf0,#fdf0d8)', border: '#e0c9a0', edge: '#c9a978' },
    sky:       { bg: 'linear-gradient(165deg,#eef6ff,#dbeafe)', border: '#a8cdf0', edge: '#7fb0e0' },
    rose:      { bg: 'linear-gradient(165deg,#fff1f6,#ffe0ec)', border: '#f4b8d0', edge: '#e792b5' },
    mint:      { bg: 'linear-gradient(165deg,#effaf4,#d7f2e6)', border: '#a5dcc6', edge: '#7cc4a8' },
  }[tone]

  return (
    <div
      className={`relative rounded-[22px] border-[3px] ${className}`}
      style={{
        background: tones.bg,
        borderColor: tones.border,
        // The hard bottom edge is what makes it read as a raised object
        // rather than a card with a drop shadow.
        boxShadow: `0 5px 0 ${tones.edge}, 0 10px 20px rgba(80,60,40,.18)`,
      }}
    >
      {children}
    </div>
  )
}

/** Carved banner that straddles the top edge of a panel, like a game header. */
export function GameBanner({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'violet' | 'emerald' }) {
  const tones = {
    amber:   { bg: 'linear-gradient(180deg,#fbbf24,#d97706)', edge: '#a45309' },
    violet:  { bg: 'linear-gradient(180deg,#a78bfa,#7c3aed)', edge: '#5b21b6' },
    emerald: { bg: 'linear-gradient(180deg,#34d399,#059669)', edge: '#047857' },
  }[tone]

  return (
    <div className="flex justify-center -mt-5 mb-2">
      <span
        className="rounded-full px-4 py-1.5 text-[13px] font-black uppercase tracking-wider text-white border-2 border-white/60"
        style={{ background: tones.bg, boxShadow: `0 3px 0 ${tones.edge}, 0 6px 12px rgba(0,0,0,.25)` }}
      >
        {children}
      </span>
    </div>
  )
}

/* ── Button ─────────────────────────────────────────────────────────────── */

export function GameButton({
  children,
  onClick,
  href,
  tone = 'amber',
  size = 'md',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  href?: string
  tone?: 'amber' | 'violet' | 'emerald' | 'slate'
  size?: 'sm' | 'md'
  className?: string
}) {
  const tones = {
    amber:   { bg: 'linear-gradient(180deg,#fcd34d,#f59e0b)', edge: '#b45309', text: '#4a2500' },
    violet:  { bg: 'linear-gradient(180deg,#c4b5fd,#8b5cf6)', edge: '#6d28d9', text: '#ffffff' },
    emerald: { bg: 'linear-gradient(180deg,#6ee7b7,#10b981)', edge: '#047857', text: '#04301f' },
    slate:   { bg: 'linear-gradient(180deg,#e2e8f0,#cbd5e1)', edge: '#94a3b8', text: '#334155' },
  }[tone]

  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'

  // translate-y on press, with the shadow shrinking to match, is what sells a
  // physical button — the whole thing travels down rather than just dimming.
  const cls = `inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold border-2 border-white/70
    ${pad} ${className}
    transition-[transform,box-shadow] duration-75
    active:translate-y-[3px] active:shadow-[0_1px_0_var(--edge)]
    focus:outline-none focus-visible:ring-4 focus-visible:ring-white`

  const style = {
    background: tones.bg,
    color: tones.text,
    ['--edge' as any]: tones.edge,
    boxShadow: `0 4px 0 ${tones.edge}, 0 7px 14px rgba(0,0,0,.22)`,
  } as React.CSSProperties

  if (href) {
    return (
      <a href={href} className={cls} style={style}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  )
}

/* ── Segmented control ──────────────────────────────────────────────────── */

export function GameTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string; icon?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div
      className="inline-flex rounded-full p-1 gap-1 border-[3px] border-white/70"
      style={{
        background: 'linear-gradient(180deg,#e7dcc6,#d6c7a8)',
        boxShadow: 'inset 0 2px 6px rgba(90,70,40,.35), 0 3px 0 #b9a582',
      }}
    >
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className="rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            style={
              active
                ? {
                    background: 'linear-gradient(180deg,#fcd34d,#f59e0b)',
                    color: '#4a2500',
                    boxShadow: '0 3px 0 #b45309',
                  }
                : { color: '#6b5a3e' }
            }
          >
            {o.icon && <span className="mr-1" aria-hidden="true">{o.icon}</span>}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Stat meter ─────────────────────────────────────────────────────────── */

export function GameMeter({
  label,
  value,
  max,
  tone,
}: {
  label: string
  value: number
  max: number
  tone: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-900/70">{label}</span>
        <span className="text-[11px] font-black tabular-nums text-amber-900">{value}</span>
      </div>
      <div
        className="h-3 rounded-full overflow-hidden border-2 border-white/70"
        style={{ background: '#d9c9a8', boxShadow: 'inset 0 2px 4px rgba(90,70,40,.4)' }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            background: tone,
            boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.18), inset 0 2px 0 rgba(255,255,255,.5)',
          }}
        />
      </div>
    </div>
  )
}
