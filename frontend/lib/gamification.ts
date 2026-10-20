import type { SpiritAnimal, SpiritAnimalMode } from './spiritAnimal'

export const ANIMAL_TYPES = ['bunny', 'fox', 'owl', 'cat', 'dog', 'bear', 'deer', 'butterfly', 'turtle', 'penguin', 'dolphin', 'dragon']
export const ANIMAL_COLORS: Record<string, number> = { orange: 0, gold: 20, green: 70, teal: 120, blue: 170, purple: 230, pink: 290, red: 330 }
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export interface GamificationPreferences {
  animals: SpiritAnimal[]
  mode: SpiritAnimalMode
  yearlyTheme: string
  monthlyThemes: string[]
  weeklyThemes: string[]
  dailyThemes: string[]
  /**
   * Match each day's energy level to its weather (Odosa, October 2026): a
   * sunny day high energy, a grey one balanced, rain or snow low, with the
   * fast and slow day animals to match. Needs the Calendar's forecast; a
   * level chosen for the day always wins.
   */
  energyFromWeather?: boolean
}

const strings = (value: unknown, limit: number): string[] => Array.isArray(value) ? value.slice(0, limit).map(item => typeof item === 'string' ? item.slice(0, 100) : '') : []

export function normalizeGamification(value?: Partial<GamificationPreferences> | null): GamificationPreferences {
  return {
    animals: Array.isArray(value?.animals) ? value.animals.slice(0, 7).map(animal => ({ type: ANIMAL_TYPES.includes(animal?.type) ? animal.type : '', color: Object.hasOwn(ANIMAL_COLORS, animal?.color || '') ? animal.color : 'orange' })) : [],
    mode: value?.mode === 'weekly' || value?.mode === 'fastSlow' ? value.mode : 'general',
    yearlyTheme: typeof value?.yearlyTheme === 'string' ? value.yearlyTheme.slice(0, 100) : '',
    monthlyThemes: strings(value?.monthlyThemes, 12),
    weeklyThemes: strings(value?.weeklyThemes, 7),
    dailyThemes: strings(value?.dailyThemes, 31),
    energyFromWeather: value?.energyFromWeather === true,
  }
}

/** The three ways to have spirit animals; each decides how many there are. */
export const SPIRIT_MODES: { id: SpiritAnimalMode; label: string; note: string }[] = [
  { id: 'general', label: 'One spirit animal', note: 'The same guide every day.' },
  { id: 'fastSlow', label: 'Two: fast and slow days', note: 'One for busy days, one for lighter days.' },
  { id: 'weekly', label: 'Seven: one for each weekday', note: 'A different guide each day of the week.' },
]

export const slotCount = (mode: SpiritAnimalMode): number => (mode === 'weekly' ? 7 : mode === 'fastSlow' ? 2 : 1)

/** What each animal is for: "Choose your spirit animal", or which of 2 or 7 it is. */
export function slotLabel(mode: SpiritAnimalMode, index: number): string {
  if (mode === 'weekly') return `Choose your ${WEEKDAYS[index]} animal (${index + 1}/7)`
  if (mode === 'fastSlow') return index === 0 ? 'Choose your fast day animal (1/2)' : 'Choose your slow day animal (2/2)'
  return 'Choose your spirit animal'
}

export function animalForDay(prefs: GamificationPreferences, date: Date, pace: 'fast' | 'slow' | 'unknown') {
  const index = prefs.mode === 'weekly' ? (date.getDay() + 6) % 7 : prefs.mode === 'fastSlow' ? pace === 'slow' ? 1 : pace === 'fast' ? 0 : -1 : 0
  const animal = prefs.animals[index]
  return animal?.type ? animal : null
}

export function themeForDate(prefs: GamificationPreferences, date: Date) {
  return prefs.dailyThemes[date.getDate() - 1] || prefs.weeklyThemes[(date.getDay() + 6) % 7] || prefs.monthlyThemes[date.getMonth()] || prefs.yearlyTheme
}