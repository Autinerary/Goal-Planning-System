/**
 * The areas of life goals are sorted into: in setup's goal step, and on the
 * Dream Self page (Riipen Labs, Group 34, slide 26). The ids are stored with
 * goals, so they never change; "barrier" is shown as Norms.
 */
export const GOAL_AREAS = [
  { id: 'education', label: 'Education', emoji: '🎓', placeholder: 'e.g., Graduate university, Learn a trade' },
  { id: 'career', label: 'Career', emoji: '💼', placeholder: 'e.g., Get a tech job, Start a business' },
  { id: 'relationships', label: 'Relationships', emoji: '❤️', placeholder: 'e.g., Build a support network, Improve communication' },
  { id: 'health', label: 'Healthcare & Wellness', emoji: '🏥', placeholder: 'e.g., Find an ADHD coach, Start therapy' },
  // Odosa: never show the word "barrier". The id stays for data matching.
  { id: 'barrier', label: 'Norms', emoji: '🌟', placeholder: 'e.g., Normalizing/Positivity, Self-advocacy skills' },
  { id: 'other', label: 'Other', emoji: '✨', placeholder: 'e.g., Travel, Learn to cook, Move to a new city' },
] as const

export type GoalAreaId = (typeof GOAL_AREAS)[number]['id']

export const isGoalArea = (id: unknown): id is GoalAreaId => GOAL_AREAS.some((a) => a.id === id)
