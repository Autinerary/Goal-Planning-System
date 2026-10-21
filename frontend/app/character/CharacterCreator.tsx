'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  ArrowLeft, Brush, Droplet, Droplets, Eye, Glasses, Loader2, Palette, PaintBucket, PenTool, PersonStanding,
  RotateCcw, RotateCw, ScanFace, Scissors, Shirt, Smile, Sparkles, Undo2, UserRound, ZoomIn, ZoomOut, type LucideIcon,
} from 'lucide-react'
import { usePreferences } from '../context/usePreferences'
import { useAuth } from '../context/AuthContext'
import { hairChoiceId } from '@/lib/avatar'
import {
  BEARDS, BODY_SLIDERS, BROWS, DEFAULT_CHARACTER, ENVIRONMENTS, EYES, FACE_PAINTS, FACE_SLIDERS, FEATURES, GLASSES, HAIRS,
  HAIR_COLORS, LIP_COLORS, OUTFITS, PAINT_COLORS, POSES, SKIN_TONES, TATTOOS, TATTOO_COLORS,
  describe, sanitize, type Character3D,
} from '@/lib/avatar3d/character'
import type { CharacterScene, Framing } from '@/lib/avatar3d/scene'
import { OptionGrid, PanelSection, Segmented, Slider, Swatches, icon, thumb, type GridItem } from './panels'

type CategoryId =
  | 'body' | 'skin' | 'face' | 'eyes' | 'hair' | 'hairColor' | 'brows' | 'beard' | 'lips' | 'features'
  | 'facePaint' | 'facePaintColor' | 'tattoo' | 'tattooColor' | 'glasses' | 'outfit'

// The left-hand list, like the game's: each part of the character in turn.
const CATEGORIES: { id: CategoryId; label: string; Icon: LucideIcon; framing: Framing }[] = [
  { id: 'body', label: 'Body', Icon: PersonStanding, framing: 'body' },
  { id: 'skin', label: 'Skin tone', Icon: Palette, framing: 'upper' },
  { id: 'face', label: 'Face shape', Icon: ScanFace, framing: 'face' },
  { id: 'eyes', label: 'Eye colour', Icon: Eye, framing: 'face' },
  { id: 'hair', label: 'Hairstyle', Icon: Scissors, framing: 'upper' },
  { id: 'hairColor', label: 'Hair colour', Icon: Droplet, framing: 'upper' },
  { id: 'brows', label: 'Eyebrows', Icon: ScanFace, framing: 'face' },
  { id: 'beard', label: 'Facial hair', Icon: UserRound, framing: 'face' },
  { id: 'lips', label: 'Lip colour', Icon: Smile, framing: 'face' },
  { id: 'features', label: 'Facial features', Icon: Sparkles, framing: 'face' },
  { id: 'facePaint', label: 'Face paint', Icon: Brush, framing: 'face' },
  { id: 'facePaintColor', label: 'Face paint colour', Icon: PaintBucket, framing: 'face' },
  { id: 'tattoo', label: 'Tattoos', Icon: PenTool, framing: 'upper' },
  { id: 'tattooColor', label: 'Tattoo colour', Icon: Droplets, framing: 'upper' },
  { id: 'glasses', label: 'Glasses', Icon: Glasses, framing: 'face' },
  { id: 'outfit', label: 'Outfit', Icon: Shirt, framing: 'body' },
]

const AREAS: { id: string; label: string }[] = [
  { id: 'face', label: 'Face' },
  { id: 'eyes', label: 'Eyes and brows' },
  { id: 'nose', label: 'Nose' },
  { id: 'mouth', label: 'Mouth' },
  { id: 'ears', label: 'Ears' },
]

const VIEWS: { id: Framing; label: string }[] = [
  { id: 'body', label: 'Whole body' },
  { id: 'upper', label: 'Upper body' },
  { id: 'face', label: 'Face' },
]

// The 2D character's choices, as a first look for the 3D one (lib/avatar.ts ids).
const HAIR_FROM_2D: Record<string, string> = {
  shortFlat: 'short-neat', shortRound: 'close-crop', shortWaved: 'short-tousled', shortCurly: 'wavy-quiff',
  theCaesar: 'close-crop', theCaesarAndSidePart: 'side-swept', shavedSides: 'slicked-back', sides: 'close-crop',
  frizzle: 'afro', fro: 'afro', froBand: 'curls-headband', bob: 'bob', bun: 'top-bun', curly: 'long-curls',
  curvy: 'long-curls', bigHair: 'long-curls', straight01: 'long-straight', straight02: 'long-layers',
  straightAndStrand: 'long-layers', longButNotTooLong: 'inverted-bob', miaWallace: 'bob-bangs', shaggy: 'wavy-quiff',
  shaggyMullet: 'wavy-quiff', frida: 'braided-bun', none: 'none',
}
const GLASSES_FROM_2D: Record<string, string> = { round: 'round', kurt: 'round', prescription01: 'rectangle', prescription02: 'thin-wire', wayfarers: 'bold-square' }

function seedFrom2D(two: { hairStyle?: string; hairColor?: string; skinColor?: string; accessory?: string } | undefined): Character3D {
  if (!two) return DEFAULT_CHARACTER
  const hairColor = /^[0-9a-f]{6}$/i.test(two.hairColor || '') ? `#${two.hairColor!.toLowerCase()}` : DEFAULT_CHARACTER.hairColor
  return sanitize({
    ...DEFAULT_CHARACTER,
    skin: /^[0-9a-f]{6}$/i.test(two.skinColor || '') ? `#${two.skinColor}` : DEFAULT_CHARACTER.skin,
    hairColor,
    browColor: hairColor,
    hair: HAIR_FROM_2D[hairChoiceId(two.hairStyle)] || DEFAULT_CHARACTER.hair,
    glasses: GLASSES_FROM_2D[two.accessory || ''] || 'none',
  })
}

const same = (a: Character3D | null, b: Character3D | null) => JSON.stringify(a) === JSON.stringify(b)

type Status = 'starting' | 'loading' | 'ready' | 'nowebgl' | 'error' | 'lost'

export default function CharacterCreator() {
  const { prefs, update, synced } = usePreferences()
  const { supabaseUser } = useAuth()
  const [c, setC] = useState<Character3D>(DEFAULT_CHARACTER)
  const [saved, setSaved] = useState<Character3D | null>(null)
  const [category, setCategory] = useState<CategoryId>('hair')
  const [view, setView] = useState<Framing>('upper')
  const [status, setStatus] = useState<Status>('starting')
  const [progress, setProgress] = useState(0)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [spoken, setSpoken] = useState('')
  const [wide, setWide] = useState(true)
  const touched = useRef(false)
  const latest = useRef(c)
  latest.current = c
  const sceneRef = useRef<CharacterScene | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const reduceMotionPref = Boolean(prefs.accessibility?.reduceMotion)

  // The saved character (or a first look from the 2D one), until the person changes something.
  useEffect(() => {
    if (touched.current) return
    const stored = prefs.character3d
    const start = stored ? sanitize(stored) : seedFrom2D(prefs.character)
    setC(start)
    setSaved(stored ? start : null)
  }, [prefs, synced])

  const change = useCallback((patch: Partial<Character3D>) => {
    touched.current = true
    setNotice('')
    setC((prev) => {
      const next = { ...prev, ...patch }
      // Eyebrows that matched the hair keep matching it.
      if (patch.hairColor && !patch.browColor && prev.browColor === prev.hairColor) next.browColor = patch.hairColor
      return next
    })
  }, [])

  // ------------------------------------------------------------ the 3D view
  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return true
    return reduceMotionPref || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [reduceMotionPref])

  // On wide screens the panels sit over the view: the character stands in the
  // middle of the space between them.
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [freeCenter, setFreeCenter] = useState(0.5)
  const sizeScene = useCallback(() => {
    const el = stageRef.current
    const scene = sceneRef.current
    if (!el) return
    let center = 0.5
    if (window.matchMedia('(min-width: 1024px)').matches) {
      const r = el.getBoundingClientRect()
      const left = leftRef.current?.getBoundingClientRect()
      const right = rightRef.current?.getBoundingClientRect()
      const a = left ? left.right - r.left : 0
      const b = right ? right.left - r.left : r.width
      if (b > a) center = (a + b) / 2 / r.width
    }
    setFreeCenter(center)
    scene?.resize(el.clientWidth, el.clientHeight, center - 0.5)
  }, [])

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    let gl2 = false
    try { gl2 = Boolean(document.createElement('canvas').getContext('webgl2')) } catch {}
    if (!gl2) { setStatus('nowebgl'); return }
    setStatus('loading')
    const lowPower = window.matchMedia('(max-width: 640px)').matches || (navigator.hardwareConcurrency || 8) <= 4
    import('@/lib/avatar3d/scene')
      .then(async ({ CharacterScene }) => {
        const scene = await CharacterScene.create(canvas, {
          reducedMotion,
          lowPower,
          onProgress: (p) => { if (p < 0) setStatus('lost'); else setProgress(p) },
        })
        if (cancelled) { scene.dispose(); return }
        sceneRef.current = scene
        if (process.env.NODE_ENV !== 'production') (window as unknown as { __creatorScene?: CharacterScene }).__creatorScene = scene
        sizeScene()
        scene.setFraming(view)
        await scene.apply(latest.current)
        if (!cancelled) setStatus('ready')
      })
      .catch((e) => { console.error(e); if (!cancelled) setStatus('error') })
    return () => {
      cancelled = true
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
    // The scene is made once; later changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { sceneRef.current?.apply(c) }, [c, status])
  useEffect(() => { sceneRef.current?.setReducedMotion(reducedMotion) }, [reducedMotion])
  useEffect(() => { sceneRef.current?.setFraming(view) }, [view, status])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => sizeScene())
    ro.observe(el)
    const mq = window.matchMedia('(min-width: 1024px)')
    const onMq = () => { setWide(mq.matches); sizeScene() }
    onMq()
    mq.addEventListener('change', onMq)
    return () => { ro.disconnect(); mq.removeEventListener('change', onMq) }
  }, [sizeScene])

  // Drag to turn, wheel or pinch to zoom.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const pts = new Map<number, { x: number; y: number }>()
    let pinch = 0
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y) }
    }
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      if (pts.size === 1) {
        sceneRef.current?.turnBy((e.clientX - p.x) * 0.012)
      } else if (pts.size === 2) {
        p.x = e.clientX; p.y = e.clientY
        const [a, b] = [...pts.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch && d) sceneRef.current?.zoomBy(pinch / d)
        pinch = d
        return
      }
      p.x = e.clientX; p.y = e.clientY
    }
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinch = 0 }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      sceneRef.current?.zoomBy(e.deltaY > 0 ? 1.08 : 1 / 1.08)
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [])

  // ------------------------------------------------------------ saving
  const dirty = !same(c, saved)
  useEffect(() => {
    if (!dirty || !touched.current) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const save = async () => {
    setSaving(true)
    const ok = await update({ character3d: c })
    setSaving(false)
    setSaved(c)
    touched.current = false
    setNotice(ok ? 'Saved to your account.' : supabaseUser ? 'Saved on this device. Saving to your account didn’t work; try again when you’re connected.' : 'Saved on this device. Sign in to keep it on your account.')
  }
  const undoAll = () => {
    touched.current = false
    setC(saved || seedFrom2D(prefs.character))
    setNotice(saved ? 'Back to your saved character.' : 'Back to where you started.')
  }

  // What changed, said once things settle (screen readers).
  const description = describe(c)
  useEffect(() => {
    if (!touched.current) return
    const t = setTimeout(() => setSpoken(description), 1200)
    return () => clearTimeout(t)
  }, [description])

  // ------------------------------------------------------------ the list of parts
  const chooseCategory = (id: CategoryId) => {
    setCategory(id)
    const f = CATEGORIES.find((x) => x.id === id)!.framing
    setView(f)
  }
  const onTabKey = (e: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    let next = -1
    if (e.key in keys) next = (index + keys[e.key] + CATEGORIES.length) % CATEGORIES.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = CATEGORIES.length - 1
    if (next < 0) return
    e.preventDefault()
    chooseCategory(CATEGORIES[next].id)
    tabRefs.current[CATEGORIES[next].id]?.focus()
  }

  const current = CATEGORIES.find((x) => x.id === category)!
  // A plain face (fill and line drawing), then the design in its colour.
  const FACE_FILL = 'rgba(226,232,240,0.85)'
  const FACE_LINES = 'rgba(30,41,59,0.75)'
  const onFace = (mask: string, color: string): GridItem['icon'] => [
    { src: icon('face-fill'), color: FACE_FILL },
    { src: icon('face'), color: FACE_LINES },
    { src: icon(mask), color },
  ]

  const panel = (() => {
    switch (category) {
      case 'body':
        return (
          <>
            <p className="mb-2 text-sm text-slate-300">Each slider starts in the middle. Double-click one to put it back.</p>
            {BODY_SLIDERS.map((s) => (
              <Slider key={s.id} id={s.id} label={s.label} downLabel={s.downLabel} upLabel={s.upLabel} value={c.body[s.id] || 0} onChange={(v) => change({ body: { ...c.body, [s.id]: v } })} />
            ))}
            <Slider id="height" label="Height" downLabel="Shorter" upLabel="Taller" value={c.height} onChange={(v) => change({ height: v })} />
          </>
        )
      case 'skin':
        return <Swatches label="Skin tone" swatches={SKIN_TONES} chosen={c.skin} onChoose={(skin) => change({ skin })} />
      case 'face':
        return (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-300">Small changes go a long way.</p>
              <button type="button" onClick={() => change({ face: {} })} className="rounded-lg border border-white/25 px-3 py-1.5 text-sm text-slate-50 hover:bg-white/10">Reset face</button>
            </div>
            {AREAS.map((a) => (
              <PanelSection key={a.id} title={a.label}>
                {FACE_SLIDERS.filter((s) => s.area === a.id).map((s) => (
                  <Slider key={s.id} id={s.id} label={s.label} downLabel={s.downLabel} upLabel={s.upLabel} oneWay={!s.twoWay} value={c.face[s.id] || 0} onChange={(v) => change({ face: { ...c.face, [s.id]: v } })} />
                ))}
              </PanelSection>
            ))}
          </>
        )
      case 'eyes':
        return <OptionGrid label="Eye colour" items={EYES.map((e) => ({ id: e.id, label: e.label, thumb: thumb('eyes', e.id) }))} chosen={c.eyes} onChoose={(eyes) => change({ eyes })} />
      case 'hair':
        return <OptionGrid label="Hairstyle" items={[{ id: 'none', label: 'No hair', thumb: thumb('hair', 'none') }, ...HAIRS.map((h) => ({ id: h.id, label: h.label, thumb: thumb('hair', h.id) }))]} chosen={c.hair} onChoose={(hair) => change({ hair })} />
      case 'hairColor':
        return <Swatches label="Hair colour" swatches={HAIR_COLORS} chosen={c.hairColor} onChoose={(hairColor) => change({ hairColor })} />
      case 'brows':
        return (
          <>
            <OptionGrid label="Eyebrows" items={[{ id: 'none', label: 'None', thumb: thumb('brows', 'none') }, ...BROWS.map((b) => ({ id: b.id, label: b.label, thumb: thumb('brows', b.id) }))]} chosen={c.brows} onChoose={(brows) => change({ brows })} />
            <PanelSection
              title="Eyebrow and facial hair colour"
              action={c.browColor !== c.hairColor ? <button type="button" onClick={() => change({ browColor: c.hairColor })} className="rounded-lg border border-white/25 px-3 py-1.5 text-sm text-slate-50 hover:bg-white/10">Match my hair</button> : <span className="text-xs text-slate-300">Matches your hair</span>}
            >
              <Swatches label="Eyebrow and facial hair colour" swatches={HAIR_COLORS} chosen={c.browColor} onChoose={(browColor) => change({ browColor })} />
            </PanelSection>
          </>
        )
      case 'beard':
        return (
          <>
            <OptionGrid label="Facial hair" items={[{ id: 'none', label: 'None', thumb: thumb('beard', 'none') }, ...BEARDS.map((b) => ({ id: b.id, label: b.label, thumb: thumb('beard', b.id) }))]} chosen={c.beard} onChoose={(beard) => change({ beard })} />
            <p className="mt-3 text-sm text-slate-300">It’s the same colour as your eyebrows (under Eyebrows).</p>
          </>
        )
      case 'lips':
        return <Swatches label="Lip colour" swatches={LIP_COLORS} chosen={c.lips} onChoose={(lips) => change({ lips })} />
      case 'features':
        return (
          <>
            <p className="mb-2 text-sm text-slate-300">Choose as many as you like.</p>
            <OptionGrid
              label="Facial features"
              multiple
              items={FEATURES.map((f) => ({ id: f.id, label: f.label, icon: onFace(`feature/${f.id}`, '#b45309') }))}
              chosen={c.features}
              onChoose={(id) => change({ features: c.features.includes(id) ? c.features.filter((x) => x !== id) : FEATURES.map((f) => f.id as string).filter((x) => x === id || c.features.includes(x)) })}
            />
          </>
        )
      case 'facePaint':
        return <OptionGrid label="Face paint" items={[{ id: 'none', label: 'None', icon: [{ src: icon('face-fill'), color: FACE_FILL }, { src: icon('face'), color: FACE_LINES }] }, ...FACE_PAINTS.map((p) => ({ id: p.id, label: p.label, icon: onFace(`paint/${p.id}`, c.facePaintColor) }))]} chosen={c.facePaint} onChoose={(facePaint) => change({ facePaint })} />
      case 'facePaintColor':
        return (
          <>
            {c.facePaint === 'none' && <p className="mb-3 text-sm text-amber-100">Choose a face paint first, under Face paint.</p>}
            <Swatches label="Face paint colour" swatches={PAINT_COLORS} chosen={c.facePaintColor} onChoose={(facePaintColor) => change({ facePaintColor })} />
          </>
        )
      case 'tattoo':
        return (
          <>
            <p className="mb-2 text-sm text-slate-300">On the left arm, below a short sleeve. Long sleeves cover them; Attire: Basics shows them.</p>
            <OptionGrid label="Tattoos" items={[{ id: 'none', label: 'None', icon: [{ src: icon('arm'), color: FACE_FILL }] }, ...TATTOOS.map((t) => ({ id: t.id, label: t.label, icon: [{ src: icon('arm'), color: FACE_FILL }, { src: icon(`tattoo/${t.id}`), color: c.tattooColor }] }))]} chosen={c.tattoo} onChoose={(tattoo) => change({ tattoo })} />
          </>
        )
      case 'tattooColor':
        return (
          <>
            {c.tattoo === 'none' && <p className="mb-3 text-sm text-amber-100">Choose a tattoo first, under Tattoos.</p>}
            <Swatches label="Tattoo colour" swatches={TATTOO_COLORS} chosen={c.tattooColor} onChoose={(tattooColor) => change({ tattooColor })} />
          </>
        )
      case 'glasses':
        return <OptionGrid label="Glasses" items={[{ id: 'none', label: 'None', thumb: thumb('glasses', 'none') }, ...GLASSES.map((g) => ({ id: g.id, label: g.label, thumb: thumb('glasses', g.id) }))]} chosen={c.glasses} onChoose={(glasses) => change({ glasses })} />
      case 'outfit':
        return (
          <>
            {c.attire === 'basics' && <p className="mb-3 text-sm text-amber-100">Attire is on Basics. Choosing an outfit puts it on.</p>}
            <OptionGrid label="Outfit" columns={3} items={OUTFITS.map((o) => ({ id: o.id, label: o.label, thumb: thumb('outfit', o.id) }))} chosen={c.attire === 'basics' ? '' : c.outfit} onChoose={(outfit) => change({ outfit, attire: 'outfit' })} />
          </>
        )
    }
  })()

  // ------------------------------------------------------------ layout
  const panelBox = 'rounded-2xl bg-slate-950/85 ring-1 ring-amber-200/25 backdrop-blur-sm'
  const iconButton = 'flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-slate-900/70 text-slate-50 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300'
  const failed = status === 'nowebgl' || status === 'error' || status === 'lost'

  return (
    <div className="bg-slate-950 text-slate-50 lg:relative lg:mx-auto lg:h-[calc(100dvh-7.5rem)] lg:min-h-[640px] lg:max-w-[1700px] lg:overflow-hidden lg:rounded-2xl" data-character-creator>
      {/* Title and saving */}
      <header className="flex flex-wrap items-center justify-between gap-2 p-3 lg:absolute lg:left-0 lg:right-0 lg:top-0 lg:z-10 lg:bg-gradient-to-b lg:from-slate-950/90 lg:to-transparent">
        <div className="flex items-center gap-3">
          <Link href="/ideal-self" className={iconButton} aria-label="Back to Dream Self">
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold leading-tight text-amber-50">Character creator <span className="ml-1 rounded-full bg-amber-300/20 px-2 py-0.5 align-middle text-xs font-semibold text-amber-100">New, 3D</span></h1>
            <p className="text-xs text-slate-300">Make a character that looks like you, or how you’d like to look.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="text-sm text-slate-200" data-save-status>
            {notice || (dirty ? (saved ? 'Changes not saved yet' : 'Not saved yet') : 'Saved')}
          </p>
          <button type="button" onClick={undoAll} disabled={!dirty} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/25 px-3 text-sm font-semibold text-slate-50 hover:bg-white/10 disabled:opacity-50">
            <Undo2 aria-hidden="true" className="h-4 w-4" /> Undo changes
          </button>
          <button type="button" onClick={save} disabled={saving || (!dirty && Boolean(saved))} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-amber-300 px-4 text-sm font-bold text-slate-950 hover:bg-amber-200 disabled:opacity-60" data-save-character>
            {saving ? 'Saving…' : 'Save character'}
          </button>
        </div>
      </header>

      {/* The character */}
      <div
        ref={stageRef}
        role="img"
        aria-label={description}
        className="relative h-[56vh] min-h-[340px] w-full cursor-grab touch-pan-y select-none active:cursor-grabbing lg:absolute lg:inset-0 lg:h-auto"
        data-stage
      >
        <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
        {status === 'loading' || status === 'starting' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70">
            <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-amber-200 motion-reduce:animate-none" />
            <p className="text-sm text-slate-100">Getting your character ready…</p>
            <div role="progressbar" aria-label="Loading the character" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="h-2 w-56 overflow-hidden rounded-full bg-white/15">
              <div className="h-full bg-amber-300 transition-[width] motion-reduce:transition-none" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        ) : null}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 p-6 text-center" data-creator-fallback>
            <div className="max-w-md space-y-3">
              <p className="text-lg font-semibold">
                {status === 'nowebgl' ? 'This browser can’t show the 3D character.' : status === 'lost' ? 'The 3D view stopped.' : 'The 3D character didn’t load.'}
              </p>
              <p className="text-sm text-slate-300">
                {status === 'lost' ? 'Reload the page to try again. ' : 'It needs WebGL 2, which most up-to-date browsers have. '}
                Your 2D character still works.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {status !== 'nowebgl' && <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-amber-300 px-4 py-2 font-semibold text-slate-950">Reload</button>}
                <Link href="/ideal-self" className="rounded-lg border border-white/30 px-4 py-2 font-semibold text-slate-50">Design your 2D character</Link>
              </div>
            </div>
          </div>
        )}
        {status === 'ready' && (
          <p aria-hidden="true" className="pointer-events-none absolute bottom-3 hidden -translate-x-1/2 rounded-full bg-slate-950/60 px-3 py-1 text-xs text-slate-200 lg:block" style={{ left: `${freeCenter * 100}%` }}>
            Drag to turn · scroll to zoom
          </p>
        )}
      </div>

      {/* The parts, and the choices for the one picked */}
      <div ref={leftRef} className="flex flex-col gap-2 px-3 pb-3 lg:absolute lg:bottom-3 lg:left-3 lg:top-[4.5rem] lg:z-10 lg:flex-row lg:p-0">
        <div role="tablist" aria-label="Parts of your character" aria-orientation={wide ? 'vertical' : 'horizontal'} className={`${panelBox} flex gap-1 overflow-x-auto p-1.5 lg:w-14 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible xl:w-48`}>
          {CATEGORIES.map(({ id, label, Icon }, i) => {
            const on = id === category
            return (
              <button
                key={id}
                ref={(el) => { tabRefs.current[id] = el }}
                role="tab"
                id={`tab-${id}`}
                aria-selected={on}
                aria-controls="creator-panel"
                tabIndex={on ? 0 : -1}
                title={label}
                onClick={() => chooseCategory(id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border-l-4 px-2.5 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-300 lg:justify-center xl:justify-start ${
                  on ? 'border-amber-300 bg-amber-300/15 font-semibold text-amber-50' : 'border-transparent text-slate-100 hover:bg-white/10'
                }`}
              >
                <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${on ? 'text-amber-200' : 'text-slate-300'}`} />
                <span className="whitespace-nowrap lg:sr-only xl:not-sr-only">{label}</span>
              </button>
            )
          })}
        </div>
        <div id="creator-panel" role="tabpanel" aria-labelledby={`tab-${category}`} tabIndex={0} className={`${panelBox} p-4 lg:w-[20rem] lg:overflow-y-auto xl:w-[23rem]`} data-creator-panel={category}>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-amber-50">
            <current.Icon aria-hidden="true" className="h-5 w-5 text-amber-200" /> {current.label}
          </h2>
          {panel}
        </div>
      </div>

      {/* Pose, attire, expression, environment and the camera */}
      <div ref={rightRef} className={`${panelBox} mx-3 mb-3 flex flex-col gap-3 p-3 lg:absolute lg:bottom-3 lg:right-3 lg:top-[4.5rem] lg:z-10 lg:mx-0 lg:mb-0 lg:w-56 lg:overflow-y-auto`} data-view-controls>
        <Segmented stacked label="Pose" options={POSES.map((p) => ({ id: p.id as string, label: p.label }))} value={c.pose} onChange={(pose) => change({ pose })} />
        <Segmented stacked label="Attire" options={[{ id: 'outfit', label: 'Outfit' }, { id: 'basics', label: 'Basics' }]} value={c.attire} onChange={(attire) => change({ attire: attire as Character3D['attire'] })} />
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-amber-200">Environment</span>
          <select value={c.environment} onChange={(e) => change({ environment: e.target.value })} className="min-h-[40px] w-full rounded-lg border border-white/25 bg-slate-900 px-2 text-sm text-slate-50" data-environment>
            {ENVIRONMENTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </label>
        <label className="flex min-h-[40px] items-center gap-2 text-sm">
          <input type="checkbox" checked={c.smile} onChange={(e) => change({ smile: e.target.checked })} className="h-5 w-5 accent-amber-300" data-smile />
          Smile
        </label>
        <Segmented stacked label="View" options={VIEWS} value={view} onChange={setView} />
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={iconButton} aria-label="Turn left" onClick={() => sceneRef.current?.turnBy(-Math.PI / 6)}><RotateCcw aria-hidden="true" className="h-5 w-5" /></button>
          <button type="button" className={iconButton} aria-label="Turn right" onClick={() => sceneRef.current?.turnBy(Math.PI / 6)}><RotateCw aria-hidden="true" className="h-5 w-5" /></button>
          <button type="button" className={iconButton} aria-label="Zoom in" onClick={() => sceneRef.current?.zoomBy(1 / 1.25)}><ZoomIn aria-hidden="true" className="h-5 w-5" /></button>
          <button type="button" className={iconButton} aria-label="Zoom out" onClick={() => sceneRef.current?.zoomBy(1.25)}><ZoomOut aria-hidden="true" className="h-5 w-5" /></button>
        </div>
        <div className="lg:mt-auto">
          <Credits environmentCredit={ENVIRONMENTS.find((e) => e.id === c.environment)?.credit || ''} />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{spoken}</p>
    </div>
  )
}

interface Credit { kind: string; id: string; asset: string; author: string; license: string; source: string }

/**
 * Who made what. Most of the character is CC0 (no credit needed, given anyway);
 * some hairstyles are CC-BY, which needs it.
 */
function Credits({ environmentCredit }: { environmentCredit: string }) {
  const [list, setList] = useState<Credit[] | null>(null)
  const load = () => {
    if (list) return
    fetch('/avatar3d/credits.json').then((r) => r.json()).then(setList).catch(() => setList([]))
  }
  const byBy = (list || []).filter((x) => x.license === 'CC-BY')
  const authors = [...new Set((list || []).filter((x) => x.license === 'CC0').map((x) => x.author))].sort((a, b) => a.localeCompare(b))
  return (
    <details className="text-[11px] leading-snug text-slate-300" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) load() }}>
      <summary className="cursor-pointer select-none">
        Backdrop: {environmentCredit}, Poly Haven (CC0). Character: MakeHuman community assets. <span className="underline">Credits and licences</span>
      </summary>
      <div className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1 text-xs text-slate-200">
        {!list && <p>Loading…</p>}
        {byBy.length > 0 && (
          <div>
            <p className="font-semibold text-amber-100">Under CC BY 4.0 (credit required)</p>
            <ul className="list-disc pl-4">
              {byBy.map((x) => <li key={`${x.kind}-${x.id}`}>{x.asset.replace(/_/g, ' ')} by {x.author}{x.source ? <> (<a className="underline" href={x.source} target="_blank" rel="noopener noreferrer">source<span className="sr-only">, opens in a new tab</span></a>)</> : null}</li>)}
            </ul>
          </div>
        )}
        {authors.length > 0 && <p><span className="font-semibold text-amber-100">CC0 (public domain):</span> body, faces, eyes, most hair, clothes and glasses, by {authors.join(', ')} and the MakeHuman team, via the MakeHuman community asset packs. Built with MPFB in Blender.</p>}
        <p><span className="font-semibold text-amber-100">Backdrops (CC0):</span> Poly Haven, by Sergej Majboroda and Greg Zaal.</p>
      </div>
    </details>
  )
}
