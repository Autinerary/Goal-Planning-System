/**
 * The character's skin texture, painted on a canvas from the choices: the
 * tone, the skin's own detail, then lip colour, facial features, face paint
 * and a tattoo, each an alpha mask made by scripts/avatar3d/textures.py.
 *
 * detail.webp is MakeHuman's skin with its colour divided out, so multiplying
 * it by any tone keeps pores, lips and shading. Masks are cropped to where
 * they are on the 2048px texture (masks.json), and are only fetched once used.
 */
import type { Character3D } from './character'

interface MaskRect { x: number; y: number; w: number; h: number }
interface MaskIndex { size: number; masks: Record<string, MaskRect> }

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load ${src}`))
    img.src = src
  })

// What a feature does to the skin under it: freckles, marks and blush darken
// or warm it ('multiply'); a scar is lighter.
const FEATURE_LOOK: Record<string, { color: string; alpha: number; mode: GlobalCompositeOperation }> = {
  freckles: { color: '#a77a5c', alpha: 0.9, mode: 'multiply' },
  blush: { color: '#e9a0a0', alpha: 0.85, mode: 'multiply' },
  'beauty-mark': { color: '#4b3226', alpha: 0.95, mode: 'multiply' },
  mole: { color: '#5c3d2c', alpha: 0.9, mode: 'multiply' },
  scar: { color: '#f2d0c8', alpha: 0.55, mode: 'source-over' },
}

export class SkinPainter {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private scratch: HTMLCanvasElement
  private sctx: CanvasRenderingContext2D
  private detail: HTMLImageElement | null = null
  private index: MaskIndex | null = null
  private masks = new Map<string, Promise<HTMLImageElement>>()
  private k: number

  constructor(private base: string, readonly size = 2048) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.canvas.height = size
    this.ctx = this.canvas.getContext('2d')!
    this.scratch = document.createElement('canvas')
    this.sctx = this.scratch.getContext('2d')!
    this.k = size / 2048
  }

  async load() {
    const [detail, index] = await Promise.all([
      loadImage(`${this.base}skin/detail.webp`),
      fetch(`${this.base}skin/masks.json`).then((r) => r.json() as Promise<MaskIndex>),
    ])
    this.detail = detail
    this.index = index
    this.k = this.size / index.size
  }

  private mask(name: string) {
    if (!this.masks.has(name)) this.masks.set(name, loadImage(`${this.base}skin/${name}.webp`))
    return this.masks.get(name)!
  }

  /** The masks a character needs, so they can be fetched before painting. */
  static masksFor(c: Character3D): string[] {
    const out: string[] = []
    if (c.lips !== 'natural') out.push('lips')
    for (const f of c.features) out.push(`feature-${f}`)
    if (c.facePaint !== 'none') out.push(`paint-${c.facePaint}`)
    if (c.tattoo !== 'none') out.push(`tattoo-${c.tattoo}`)
    return out
  }

  /** Paint the skin for this character. Resolves once the canvas is up to date. */
  async paint(c: Character3D) {
    if (!this.detail || !this.index) await this.load()
    const names = SkinPainter.masksFor(c)
    const imgs = await Promise.all(names.map((n) => this.mask(n).catch(() => null)))
    const byName = new Map(names.map((n, i) => [n, imgs[i]]))
    const { ctx, size } = this

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = c.skin
    ctx.fillRect(0, 0, size, size)
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(this.detail!, 0, 0, size, size)

    if (c.lips !== 'natural') this.layer(byName.get('lips'), 'lips', c.lips, 0.68, 'source-over', true)
    for (const f of c.features) {
      const look = FEATURE_LOOK[f]
      if (look) this.layer(byName.get(`feature-${f}`), `feature-${f}`, look.color, look.alpha, look.mode, false)
    }
    if (c.tattoo !== 'none') this.layer(byName.get(`tattoo-${c.tattoo}`), `tattoo-${c.tattoo}`, c.tattooColor, 0.88, 'multiply', false)
    if (c.facePaint !== 'none') this.layer(byName.get(`paint-${c.facePaint}`), `paint-${c.facePaint}`, c.facePaintColor, 0.92, 'source-over', true)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  /**
   * One coloured layer through a mask. With `textured`, the colour keeps the
   * skin's detail (lipstick and paint still show pores and lip lines).
   */
  private layer(img: HTMLImageElement | null | undefined, name: string, color: string, alpha: number, mode: GlobalCompositeOperation, textured: boolean) {
    const r = this.index?.masks[name]
    if (!img || !r) return
    const k = this.k
    const x = Math.floor(r.x * k), y = Math.floor(r.y * k)
    const w = Math.max(1, Math.ceil(r.w * k)), h = Math.max(1, Math.ceil(r.h * k))
    const { scratch, sctx } = this
    scratch.width = w
    scratch.height = h
    sctx.globalCompositeOperation = 'source-over'
    sctx.globalAlpha = 1
    sctx.fillStyle = color
    sctx.fillRect(0, 0, w, h)
    if (textured) {
      sctx.globalCompositeOperation = 'multiply'
      sctx.drawImage(this.detail!, r.x, r.y, r.w, r.h, 0, 0, w, h)
      // detail is about 0.92 on average; lift it back so the colour reads true.
      sctx.globalCompositeOperation = 'color-dodge'
      sctx.fillStyle = 'rgb(20,20,20)'
      sctx.fillRect(0, 0, w, h)
    }
    sctx.globalCompositeOperation = 'destination-in'
    sctx.drawImage(img, 0, 0, w, h)
    this.ctx.globalCompositeOperation = mode
    this.ctx.globalAlpha = alpha
    this.ctx.drawImage(scratch, x, y, w, h)
    this.ctx.globalAlpha = 1
    this.ctx.globalCompositeOperation = 'source-over'
  }
}
