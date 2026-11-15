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
    description: 'Log in on Halloween.',
    icon: '🎃',
    category: 'seasonal',
  },
]

export interface AchievementUnlock {
  achievement_id: string
  unlocked_at: string
}
