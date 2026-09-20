/**
 * Code-generated character avatar (Odosa/Eliyana: the hand-drawn SVG looked
 * "wonky"). Uses DiceBear's "avataaars" collection, rendered fully inline as an
 * SVG string — no network fetch, so it's CSP-safe. Deterministic: a fixed seed
 * means only the user's choices change the result, giving a video-game
 * character-select feel.
 *
 * A tester asked for the full Avataaars range. The builder previously exposed
 * 6 of the collection's 34 hair options and forced accessories and facial hair
 * off, so most people could not make a character that looked like them. All of
 * it is now selectable, including the hijab and turban, which matter for a
 * product whose whole premise is that people arrive from different places.
 *
 * Stored ids stay stable. The app's original hair ids (buzz, short_curly, …)
 * are kept as aliases in HAIR_TOP, so a profile saved before this change
 * renders exactly as it did. New choices store the avataaars value directly.
 */
import { createAvatar } from '@dicebear/core'
import { avataaars } from '@dicebear/collection'

/**
 * Legacy app hair id -> avataaars `top` value.
 *
 * Only for profiles saved before the full list was exposed. Anything not in
 * here is passed through as an avataaars value. 'none' / 'skip' / unknown
 * means bald.
 */
const HAIR_TOP: Record<string, string> = {
  short_straight: 'shortFlat',
  short_curly: 'shortCurly',
  long_straight: 'straight01',
  long_curly: 'curly',
  braids: 'dreads01',
  buzz: 'theCaesar',
}

export interface AvatarChoice {
  id: string
  label: string
}

/**
 * Hair and headwear, grouped so 34 options are a browsable list rather than a
 * wall. Ids are avataaars values, stored as-is.
 */
export const HAIR_GROUPS: { name: string; options: AvatarChoice[] }[] = [
  {
    name: 'Short',
    options: [
      { id: 'shortFlat', label: 'Short & flat' },
      { id: 'shortRound', label: 'Short & round' },
      { id: 'shortWaved', label: 'Short & waved' },
      { id: 'shortCurly', label: 'Short & curly' },
      { id: 'theCaesar', label: 'Buzz cut' },
      { id: 'theCaesarAndSidePart', label: 'Buzz & side part' },
      { id: 'shavedSides', label: 'Shaved sides' },
      { id: 'sides', label: 'Sides' },
      { id: 'frizzle', label: 'Frizzle' },
    ],
  },
  {
    name: 'Medium & long',
    options: [
      { id: 'bob', label: 'Bob' },
      { id: 'bun', label: 'Bun' },
      { id: 'curly', label: 'Long & curly' },
      { id: 'curvy', label: 'Curvy' },
      { id: 'straight01', label: 'Long & straight' },
      { id: 'straight02', label: 'Long & straight II' },
      { id: 'straightAndStrand', label: 'Straight with strand' },
      { id: 'longButNotTooLong', label: 'Shoulder length' },
      { id: 'miaWallace', label: 'Blunt fringe' },
      { id: 'shaggy', label: 'Shaggy' },
      { id: 'shaggyMullet', label: 'Shaggy mullet' },
      { id: 'bigHair', label: 'Big hair' },
    ],
  },
  {
    name: 'Textured & locs',
    options: [
      { id: 'fro', label: 'Afro' },
      { id: 'froBand', label: 'Afro with band' },
      { id: 'dreads', label: 'Locs' },
      { id: 'dreads01', label: 'Locs, tied' },
      { id: 'dreads02', label: 'Locs, long' },
      { id: 'frida', label: 'Braided crown' },
    ],
  },
  {
    name: 'Headwear',
    options: [
      { id: 'hijab', label: 'Hijab' },
      { id: 'turban', label: 'Turban' },
      { id: 'hat', label: 'Hat' },
      { id: 'winterHat1', label: 'Winter hat' },
      { id: 'winterHat02', label: 'Winter hat II' },
      { id: 'winterHat03', label: 'Winter hat III' },
      { id: 'winterHat04', label: 'Winter hat IV' },
    ],
  },
  {
    name: 'None',
    options: [{ id: 'none', label: 'No hair / bald' }],
  },
]

/** Flat list, for lookups and validation. */
export const HAIR_OPTIONS: AvatarChoice[] = HAIR_GROUPS.flatMap((g) => g.options)

/** Glasses and other face accessories. */
export const ACCESSORIES: AvatarChoice[] = [
  { id: 'none', label: 'None' },
  { id: 'round', label: 'Round glasses' },
  { id: 'prescription01', label: 'Prescription' },
  { id: 'prescription02', label: 'Prescription II' },
  { id: 'wayfarers', label: 'Wayfarers' },
  { id: 'kurt', label: 'Kurt' },
  { id: 'sunglasses', label: 'Sunglasses' },
  { id: 'eyepatch', label: 'Eyepatch' },
]

export const FACIAL_HAIR: AvatarChoice[] = [
  { id: 'none', label: 'None' },
  { id: 'beardLight', label: 'Light beard' },
  { id: 'beardMedium', label: 'Medium beard' },
  { id: 'beardMajestic', label: 'Full beard' },
  { id: 'moustacheFancy', label: 'Moustache' },
  { id: 'moustacheMagnum', label: 'Thick moustache' },
]

export const CLOTHING: AvatarChoice[] = [
  { id: 'shirtCrewNeck', label: 'Crew neck' },
  { id: 'shirtVNeck', label: 'V-neck' },
  { id: 'shirtScoopNeck', label: 'Scoop neck' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'graphicShirt', label: 'Graphic tee' },
  { id: 'collarAndSweater', label: 'Collar & sweater' },
  { id: 'blazerAndShirt', label: 'Blazer & shirt' },
  { id: 'blazerAndSweater', label: 'Blazer & sweater' },
  { id: 'overall', label: 'Overalls' },
]

/** Selectable hair colours (avataaars expects 6-hex, no leading #). */
export const HAIR_COLORS: AvatarChoice[] = [
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
export const SKIN_TONES: AvatarChoice[] = [
  { id: '614335', label: 'Deep' },
  { id: 'ae5d29', label: 'Tan' },
  { id: 'd08b5b', label: 'Medium' },
  { id: 'edb98a', label: 'Light' },
  { id: 'ffdbb4', label: 'Fair' },
]

export const DEFAULT_HAIR_COLOR = HAIR_COLORS[1].id // Brown
export const DEFAULT_SKIN_TONE = SKIN_TONES[2].id // Medium
export const DEFAULT_CLOTHING = CLOTHING[0].id

export interface AvatarOptions {
  hairStyle?: string
  hairColor?: string
  skinColor?: string
  accessory?: string
  facialHair?: string
  clothing?: string
  size?: number
}

/** Build an inline SVG string for the given avatar choices. */
export function buildAvatarSvg({
  hairStyle = '',
  hairColor = DEFAULT_HAIR_COLOR,
  skinColor = DEFAULT_SKIN_TONE,
  accessory = 'none',
  facialHair = 'none',
  clothing = DEFAULT_CLOTHING,
  size = 96,
}: AvatarOptions): string {
  // A legacy id maps through the alias table; anything else is already an
  // avataaars value. 'none', 'skip' and unknown all mean bald.
  const mapped = HAIR_TOP[hairStyle] ?? hairStyle
  const top = mapped && mapped !== 'none' && mapped !== 'skip' ? mapped : ''
  const bald = !top

  const hasAccessory = accessory !== 'none' && accessory !== 'skip' && !!accessory
  const hasFacialHair = facialHair !== 'none' && facialHair !== 'skip' && !!facialHair

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
    clothing: [clothing as any],
    accessories: hasAccessory ? [accessory as any] : [],
    accessoriesProbability: hasAccessory ? 100 : 0,
    facialHair: hasFacialHair ? [facialHair as any] : [],
    facialHairProbability: hasFacialHair ? 100 : 0,
  }).toString()
}
