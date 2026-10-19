/**
 * The sky behind the app, adjustable (Odosa, October 2026: "Cloudy sky in
 * background should be 'fully adjustable' … a realistic darkening &
 * brightening of the sky … At darkest, can have option to show stars … option
 * to remove clouds entirely … At brightest, should be a daytime image with
 * the blue-pink clouds … allow to 'saturate', so that clouds can just be
 * white or grey").
 *
 * The default draws nothing new: the page keeps its usual background
 * (globals.css). Night and dusk need dark mode, so text stays light on a dark
 * sky; without it (another device, where dark mode is off) they show as a
 * cloudy day. Plain data and pure functions (lib/sky.test.mjs).
 */

export type SkyLight = 'night' | 'dusk' | 'cloudy' | 'day' | 'bright'

export const SKY_LIGHTS: { id: SkyLight; label: string }[] = [
  { id: 'night', label: 'Night' },
  { id: 'dusk', label: 'Dusk' },
  { id: 'cloudy', label: 'Cloudy' },
  { id: 'day', label: 'Day' },
  { id: 'bright', label: 'Bright' },
]

export interface SkyPrefs {
  light: SkyLight
  /** Clouds shown, or a clear sky. */
  clouds: boolean
  /** How much colour the clouds keep: 100 is the blue-pink sky, 0 is white and grey. */
  cloudColour: number
  /** Stars on a night sky. */
  stars: boolean
  /** Dark mode was turned on by choosing night or dusk, so going back to day turns it off again. */
  darkBySky?: boolean
}

export const DEFAULT_SKY: SkyPrefs = { light: 'day', clouds: true, cloudColour: 100, stars: true }

export function normalizeSky(value: Partial<SkyPrefs> | null | undefined): SkyPrefs {
  const light = SKY_LIGHTS.some((l) => l.id === value?.light) ? (value!.light as SkyLight) : 'day'
  const colour = Number(value?.cloudColour)
  return {
    light,
    clouds: value?.clouds !== false,
    cloudColour: Number.isFinite(colour) ? Math.max(0, Math.min(100, Math.round(colour))) : 100,
    stars: value?.stars !== false,
    ...(value?.darkBySky ? { darkBySky: true } : {}),
  }
}

/** The usual sky: nothing extra is drawn. */
export const isDefaultSky = (s: SkyPrefs) => s.light === 'day' && s.clouds && s.cloudColour === 100

export const needsDark = (light: SkyLight) => light === 'night' || light === 'dusk'

export interface SkyLayers {
  /** The light actually drawn (night and dusk need dark mode). */
  light: SkyLight
  /** Keep the sky's true colours under dark mode's inversion (night and dusk). */
  keepColours: boolean
  cloudOpacity: number
  cloudFilter: string
  tint: string
  starsOpacity: number
  veil: string
}

const DAY_VEIL = 'linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.72))'

/** What to draw, from the sky chosen and whether dark mode is on. */
export function skyLayers(sky: SkyPrefs, darkMode: boolean): SkyLayers {
  const light: SkyLight = needsDark(sky.light) && !darkMode ? 'cloudy' : sky.light
  const sat = sky.cloudColour / 100
  const cloudOpacity = sky.clouds ? 1 : 0
  switch (light) {
    case 'night':
      return {
        light, keepColours: true, cloudOpacity: cloudOpacity * 0.55,
        cloudFilter: `brightness(0.32) saturate(${(0.5 * sat).toFixed(2)})`,
        tint: 'linear-gradient(180deg, rgba(6, 10, 32, 0.86), rgba(18, 22, 56, 0.8))',
        starsOpacity: sky.stars ? 1 : 0,
        veil: 'linear-gradient(180deg, rgba(8, 10, 28, 0.3), rgba(8, 10, 28, 0.45))',
      }
    case 'dusk':
      return {
        light, keepColours: true, cloudOpacity: cloudOpacity * 0.8,
        cloudFilter: `brightness(0.6) saturate(${(0.9 * sat).toFixed(2)})`,
        tint: 'linear-gradient(180deg, rgba(36, 30, 88, 0.6), rgba(120, 60, 92, 0.42))',
        starsOpacity: sky.stars ? 0.3 : 0,
        veil: 'linear-gradient(180deg, rgba(14, 16, 42, 0.4), rgba(14, 16, 42, 0.52))',
      }
    case 'cloudy':
      return {
        light, keepColours: false, cloudOpacity,
        cloudFilter: `brightness(0.94) saturate(${(0.45 * sat).toFixed(2)})`,
        tint: 'linear-gradient(180deg, rgba(120, 130, 145, 0.22), rgba(150, 158, 170, 0.12))',
        starsOpacity: 0, veil: DAY_VEIL,
      }
    case 'bright':
      return {
        light, keepColours: false, cloudOpacity,
        cloudFilter: `brightness(1.06) saturate(${(1.25 * sat).toFixed(2)})`,
        tint: 'none', starsOpacity: 0, veil: DAY_VEIL,
      }
    default:
      return {
        light: 'day', keepColours: false, cloudOpacity,
        cloudFilter: `saturate(${sat.toFixed(2)})`,
        tint: 'none', starsOpacity: 0, veil: DAY_VEIL,
      }
  }
}
