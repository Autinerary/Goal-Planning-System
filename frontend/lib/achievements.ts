export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  category: 'social' | 'seasonal'
  threshold?: number
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'friends_1',
    title: 'First Friend',
    description: 'Connect with your first friend on Autinerary.',
    icon: '🤝',
    category: 'social',
    threshold: 1,
  },
  {
    id: 'friends_5',
    title: 'Friendly Five',
    description: 'Build a circle of five connected friends.',
    icon: '🫶',
    category: 'social',
    threshold: 5,
  },
  {
    id: 'friends_10',
    title: 'Friendship Circle',
    description: 'Connect with ten friends.',
    icon: '🌟',
    category: 'social',
    threshold: 10,
  },
  {
    id: 'halloween_login',
    title: 'Spooky Season',
    description: 'Open Autinerary on Halloween (31 October).',
    icon: '🎃',
    category: 'seasonal',
  },
]

export interface AchievementUnlock {
  achievement_id: string
  unlocked_at: string
}

/** Where a time zone isn't known, or isn't a real one: most people using Autinerary are in Ontario. */
export const DEFAULT_TIME_ZONE = 'America/Toronto'

/** A real IANA time zone ("America/Vancouver"), or the default. */
export function knownTimeZone(timeZone: unknown): string {
  if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 64) return DEFAULT_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone })
    return timeZone
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

/**
 * Whether it is 31 October where the person is. Seasonal achievements go by the person's own calendar day: by the
 * server's (UTC), Halloween evening in Toronto would already be 1 November. The moment is the server's own clock, so a
 * time zone can move the day by at most one.
 */
export function isHalloween(timeZone: unknown, now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: knownTimeZone(timeZone), month: 'numeric', day: 'numeric' }).formatToParts(now)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  return month === 10 && day === 31
}
