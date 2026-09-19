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
  }
}

export function animalForDay(prefs: GamificationPreferences, date: Date, pace: 'fast' | 'slow' | 'unknown') {
  const index = prefs.mode === 'weekly' ? (date.getDay() + 6) % 7 : prefs.mode === 'fastSlow' ? pace === 'slow' ? 1 : pace === 'fast' ? 0 : -1 : 0
  const animal = prefs.animals[index]
  return animal?.type ? animal : null
}

export function themeForDate(prefs: GamificationPreferences, date: Date) {
  return prefs.dailyThemes[date.getDate() - 1] || prefs.weeklyThemes[(date.getDay() + 6) % 7] || prefs.monthlyThemes[date.getMonth()] || prefs.yearlyTheme
}