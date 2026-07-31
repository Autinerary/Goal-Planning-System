/**
 * Code-generated character avatar (Odosa/Eliyana: the hand-drawn SVG looked
 * "wonky"). Uses DiceBear's "avataaars" collection, rendered fully inline as an
 * SVG string — no network fetch, so it's CSP-safe. Deterministic: a fixed seed
 * means only the user's choices (hairstyle, hair colour, skin tone) change the
 * result, giving a video-game character-select feel.
 *
 * The stored `hairStyle` ids are the app's own stable values (buzz,
 * short_curly, …) so existing profiles keep working — we just map each to an
 * avataaars hairstyle for rendering.
 */
import { createAvatar } from '@dicebear/core'
import { avataaars } from '@dicebear/collection'

/** App hair id -> avataaars `top` value. Missing / none / skip => bald. */
const HAIR_TOP: Record<string, string> = {
  short_straight: 'shortFlat',
  short_curly: 'shortCurly',
  long_straight: 'straight01',
  long_curly: 'curly',
  braids: 'dreads01',
  buzz: 'theCaesar',
}

/** Selectable hair colours (avataaars expects 6-hex, no leading #). */
export const HAIR_COLORS: { id: string; label: string }[] = [
  { id: '2c1b18', label: 'Black' },
  { id: '724133', label: 'Brown' },
  { id: 'a55728', label: 'Auburn' },
  { id: 'b58143', label: 'Blonde' },
  { id: 'c93305', label: 'Red' },
  { id: 'e8e1e1', label: 'Grey' },
  { id: 'ecdcbf', label: 'Platinum' },
  { id: 'f59797', label: 'Pink' },
]

/** Selectable skin tones. */
export const SKIN_TONES: { id: string; label: string }[] = [
  { id: '614335', label: 'Deep' },
  { id: 'ae5d29', label: 'Tan' },
  { id: 'd08b5b', label: 'Medium' },
  { id: 'edb98a', label: 'Light' },
  { id: 'ffdbb4', label: 'Fair' },
]

export const DEFAULT_HAIR_COLOR = HAIR_COLORS[1].id // Brown
export const DEFAULT_SKIN_TONE = SKIN_TONES[2].id // Medium

export interface AvatarOptions {
  hairStyle?: string
  hairColor?: string
  skinColor?: string
  size?: number
}

/** Build an inline SVG string for the given avatar choices. */
export function buildAvatarSvg({
  hairStyle = '',
  hairColor = DEFAULT_HAIR_COLOR,
  skinColor = DEFAULT_SKIN_TONE,
  size = 96,
}: AvatarOptions): string {
  const top = HAIR_TOP[hairStyle]
  const bald = !top // none / skip / unknown -> no hair

  return createAvatar(avataaars, {
    seed: 'autinerary',
    size,
    backgroundColor: ['transparent'],
    // Only the user's choices vary; everything else stays clean + consistent.
    top: bald ? [] : [top as any],
    topProbability: bald ? 0 : 100,
    hairColor: [hairColor],
    skinColor: [skinColor],
    mouth: ['smile'],
    accessoriesProbability: 0,
    facialHairProbability: 0,
  }).toString()
}
