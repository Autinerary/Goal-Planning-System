'use client'

import { Check } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { sliderWords, type Swatch } from '@/lib/avatar3d/character'

const BASE = '/avatar3d/'

/**
 * The creator's option panels: a grid of pictures (hairstyles, outfits…),
 * colour swatches, and sliders. Every option is a button that says whether
 * it's chosen (aria-pressed), with its name on it; colours have names too.
 */

export interface GridItem {
  id: string
  label: string
  /** A picture: thumbs/<kind>/<id>.webp. */
  thumb?: string
  /** Or a flat icon: layers of alpha masks, each tinted with a colour (CSS mask), bottom first. */
  icon?: { src: string; color: string }[]
}

export function OptionGrid({ label, items, chosen, onChoose, multiple = false, columns = 4 }: {
  label: string
  items: GridItem[]
  chosen: string | string[]
  onChoose: (id: string) => void
  multiple?: boolean
  columns?: 3 | 4
}) {
  const isOn = (id: string) => (Array.isArray(chosen) ? chosen.includes(id) : chosen === id)
  return (
    <div role="group" aria-label={label} className={`grid gap-2 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4'}`}>
      {items.map((item) => {
        const on = isOn(item.id)
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChoose(item.id)}
            data-option={item.id}
            className={`group flex min-h-[44px] flex-col items-stretch rounded-xl border p-1.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
              on ? 'border-amber-300 bg-amber-300/15' : 'border-white/15 bg-white/5 hover:border-white/40 hover:bg-white/10'
            }`}
          >
            <span className="relative block aspect-square w-full overflow-hidden rounded-lg bg-gradient-to-b from-slate-600/60 to-slate-800/80">
              {item.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              )}
              {item.icon?.map((layer) => <MaskIcon key={layer.src} src={layer.src} color={layer.color} />)}
              {multiple && !on && <span aria-hidden="true" className="absolute right-1 top-1 h-5 w-5 rounded-full border-2 border-white/60 bg-slate-900/40" />}
              {on && <Check aria-hidden="true" className="absolute right-1 top-1 h-5 w-5 rounded-full bg-amber-300 p-0.5 text-slate-950" strokeWidth={3} />}
            </span>
            <span className={`mt-1 block px-0.5 text-xs leading-tight ${on ? 'font-semibold text-amber-100' : 'text-slate-100'}`}>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function MaskIcon({ src, color }: { src: string; color: string }) {
  const style: CSSProperties = {
    backgroundColor: color,
    WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
    WebkitMaskSize: 'contain', maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center', maskPosition: 'center',
  }
  return <span aria-hidden="true" className="absolute inset-0" style={style} />
}

export function Swatches({ label, swatches, chosen, onChoose, custom = true }: {
  label: string
  swatches: Swatch[]
  chosen: string
  onChoose: (id: string) => void
  /** Offer any colour as well (a colour picker). */
  custom?: boolean
}) {
  const known = swatches.some((s) => s.id === chosen)
  return (
    <div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {swatches.map((s) => {
          const on = s.id === chosen
          const isColour = s.id.startsWith('#')
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              aria-label={`${label}: ${s.label}`}
              title={s.label}
              onClick={() => onChoose(s.id)}
              data-swatch={s.id}
              className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                on ? 'scale-110 border-amber-300' : 'border-white/30 hover:border-white/70'
              }`}
              style={isColour ? { backgroundColor: s.id } : undefined}
            >
              {!isColour && <span aria-hidden="true" className="text-[10px] font-semibold leading-none text-slate-100">{s.label}</span>}
              {on && <Check aria-hidden="true" className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-amber-300 p-0.5 text-slate-950" strokeWidth={3} />}
            </button>
          )
        })}
      </div>
      {custom && (
        <label className="mt-3 flex items-center gap-3 text-sm text-slate-100">
          <input
            type="color"
            value={chosen.startsWith('#') ? chosen : '#888888'}
            onChange={(e) => onChoose(e.target.value.toLowerCase())}
            className="h-11 w-14 cursor-pointer rounded-lg border-2 border-white/30 bg-transparent"
          />
          <span>
            Any colour{!known && chosen.startsWith('#') ? <span className="text-slate-300"> (chosen: {chosen})</span> : null}
          </span>
        </label>
      )}
    </div>
  )
}

export function Slider({ id, label, value, onChange, downLabel, upLabel, oneWay = false }: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
  downLabel: string
  upLabel: string
  oneWay?: boolean
}) {
  const words = oneWay ? (value < 0.05 ? downLabel : sliderWords(value, downLabel, upLabel)) : sliderWords(value, downLabel, upLabel)
  return (
    <div className="py-1.5" data-slider={id}>
      <label htmlFor={`slider-${id}`} className="flex items-baseline justify-between gap-3 text-sm text-slate-50">
        <span className="font-medium">{label}</span>
        <span aria-hidden="true" className="text-xs text-slate-300">{words}</span>
      </label>
      <input
        id={`slider-${id}`}
        type="range"
        min={oneWay ? 0 : -100}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        aria-valuetext={words}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onDoubleClick={() => onChange(0)}
        className="mt-1 h-6 w-full cursor-pointer accent-amber-300"
      />
      <div aria-hidden="true" className="flex justify-between text-[11px] text-slate-400">
        <span>{downLabel}</span>
        <span>{upLabel}</span>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ label, options, value, onChange, stacked = false }: {
  label: string
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
  /** The label on its own line, above the buttons (narrow columns). */
  stacked?: boolean
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span aria-hidden="true" className={`mr-1 text-xs font-semibold uppercase tracking-wide text-amber-200 ${stacked ? 'w-full' : ''}`}>{label}</span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          data-choice={`${label.toLowerCase()}:${o.id}`}
          className={`min-h-[36px] rounded-lg border px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
            value === o.id ? 'border-amber-300 bg-amber-300 font-semibold text-slate-950' : 'border-white/25 bg-slate-900/60 text-slate-50 hover:bg-white/10'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PanelSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-amber-100">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export const thumb = (kind: string, id: string) => `${BASE}thumbs/${kind}/${id}.webp`
export const icon = (path: string) => `${BASE}icons/${path}.webp`
