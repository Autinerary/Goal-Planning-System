/**
 * Taste profiles (the products round's planning note, v1.5: "UNSUPERVISED
 * LEARNING groups of profiles for tastes & textures! Mix of Goal 3 & 4 + the
 * intersecting norms"). People say which qualities they like and avoid
 * (STEP 82's sensory_preferences); scripts/taste-profiles.mjs groups people
 * with similar answers and norms (k-means), and only groups of ten or more
 * are ever described. These are the qualities people are asked about.
 */
export const TASTE_QUALITIES = [
  'texture_crunchy',
  'texture_soft',
  'texture_smooth',
  'chewy',
  'mild_flavour',
  'consistent',
  'soft_fabric',
  'tagless',
  'seamless',
  'relaxed_fit',
  'gentle_compression',
  'fragrance_free',
  'unflavoured',
  'low_foam',
  'noise_reduction',
  'silent',
  'blocks_light',
  'dimmable',
  'weighted',
  'chew_safe',
  'discreet',
] as const

export const isTasteQuality = (q: unknown) => typeof q === 'string' && (TASTE_QUALITIES as readonly string[]).includes(q)

/** How well a product fits someone's likes and avoids: liked qualities it has, less avoided ones. */
export function tasteScore(qualities: string[] | undefined, likes: string[], avoids: string[]): number {
  const q = new Set(qualities || [])
  return likes.filter((l) => q.has(l)).length - 2 * avoids.filter((a) => q.has(a)).length
}
