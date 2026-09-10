'use client'

/**
 * Which spirit animal belongs to today.
 *
 * Onboarding lets a user assign animals one of three ways: one for every day,
 * a fast/slow pair, or one per weekday. The Path header previously rendered
 * the first two entries side by side regardless, so a weekly user saw Monday
 * and Tuesday's guides on a Thursday.
 *
 * "Fast" and "slow" are read from the schedule the calendar agent actually
 * produced, never guessed from the weekday. When today is not in the schedule
 * we return the day type as unknown and the caller falls back to the first
 * animal without claiming it is today's.
 */

export type SpiritAnimalMode = 'general' | 'fastSlow' | 'weekly'

export interface SpiritAnimal {
  type: string
  color: string
}

export interface ScheduleDay {
  dayName?: string
  type?: string
  energyLevel?: string
}

export const SPIRIT_ANIMAL_EMOJI: Record<string, string> = {
  owl: '🦉', fox: '🦊', wolf: '🐺', bear: '🐻', eagle: '🦅', dolphin: '🐬',
  lion: '🦁', tiger: '🐯', hawk: '🦅', rabbit: '🐰', deer: '🦌', turtle: '🐢',
}

// Onboarding stores weekly animals Monday-first; JS getDay() is Sunday-first.
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function todayWeekdayName(now: Date = new Date()): string {
  return WEEKDAYS[(now.getDay() + 6) % 7]
}

export type DayPace = 'fast' | 'slow' | 'unknown'

/**
 * Classify today from the generated schedule.
 *
 * Only an explicit recovery/low-energy day counts as slow — everything else
 * the agent scheduled is a working day. Absent a schedule entry we say so
 * rather than defaulting, so the caller can avoid mislabelling the day.
 */
export function paceForToday(schedule: ScheduleDay[] | undefined, now: Date = new Date()): DayPace {
  if (!Array.isArray(schedule) || schedule.length === 0) return 'unknown'

  const today = todayWeekdayName(now).toLowerCase()
  const day = schedule.find((d) => String(d?.dayName || '').toLowerCase() === today)
  if (!day) return 'unknown'

  const type = String(day.type || '').toLowerCase()
  const energy = String(day.energyLevel || '').toLowerCase()

  if (type === 'recovery' || energy === 'low') return 'slow'
  if (type === 'high_energy' || type === 'focus' || energy === 'high') return 'fast'
  return 'fast'
}

export interface TodaysAnimal {
  animal: SpiritAnimal
  /** Short label for the tooltip, e.g. "Slow Day" or "Thursday". */
  label: string
  pace: DayPace
}

/**
 * The single animal to show today, or null when the user has not chosen any.
 *
 * Returning null matters: the previous default rendered an owl and a fox for
 * everyone, so a user who picked a wolf was shown someone else's animals as
 * though they were their own.
 */
export function selectTodaysAnimal(
  animals: SpiritAnimal[] | undefined,
  mode: SpiritAnimalMode | undefined,
  schedule: ScheduleDay[] | undefined,
  now: Date = new Date(),
): TodaysAnimal | null {
  const list = (animals || []).filter((a) => a && a.type)
  if (list.length === 0) return null

  const resolvedMode: SpiritAnimalMode = mode || (list.length >= 7 ? 'weekly' : list.length === 2 ? 'fastSlow' : 'general')

  if (resolvedMode === 'weekly') {
    const idx = (now.getDay() + 6) % 7
    const animal = list[idx] || list[0]
    return { animal, label: todayWeekdayName(now), pace: 'unknown' }
  }

  if (resolvedMode === 'fastSlow' && list.length >= 2) {
    const pace = paceForToday(schedule, now)
    if (pace === 'slow') return { animal: list[1], label: 'Slow Day', pace }
    if (pace === 'fast') return { animal: list[0], label: 'Fast Day', pace }
    return { animal: list[0], label: 'Your guide', pace: 'unknown' }
  }

  return { animal: list[0], label: 'Your guide', pace: 'unknown' }
}
