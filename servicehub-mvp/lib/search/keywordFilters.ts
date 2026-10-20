/**
 * Filters matched on what a listing says about itself, until listings are
 * tagged for them (the team's notes, October 2026):
 *   * Activities under Resource Type: "Swimming, Horseback Riding, Animal
 *     Therapy".
 *   * Therapy types and the kinds under each (lib/filters/taxonomy.ts
 *     THERAPY_TYPES and THERAPY_SUBTYPES, from the Learning page).
 * Whole words and phrases only: a short acronym ("ABA", "OT") would match
 * inside other words, so listings are found by the names they spell out.
 */

export const ACTIVITIES = [
  { id: 'swimming', label: 'Swimming', words: ['swim', 'aquatic', 'swimming pool'] },
  { id: 'horseback', label: 'Horseback Riding', words: ['horseback', 'horse riding', 'equestrian', 'therapeutic riding', 'hippotherapy', 'equine'] },
  { id: 'animal_therapy', label: 'Animal Therapy', words: ['animal therapy', 'animal-assisted', 'animal assisted', 'therapy dog', 'therapy animal', 'pet therapy', 'equine therapy', 'equine-assisted', 'dog guide', 'service dog', 'assistance dog'] },
] as const

export const isActivity = (v: string) => ACTIVITIES.some((a) => a.id === v)

// The words for each therapy type and each kind under it.
const THERAPY_WORDS: Record<string, string[]> = {
  behavioural: ['applied behaviour analysis', 'applied behavior analysis', 'intensive behavioural intervention', 'intensive behavioral intervention', 'behaviour therap', 'behavior therap', 'behaviour analyst', 'behavior analyst'],
  aba: ['applied behaviour analysis', 'applied behavior analysis', 'aba therapy', 'aba services'],
  ibi: ['intensive behavioural intervention', 'intensive behavioral intervention'],
  developmental: ['speech-language', 'speech language', 'speech therap', 'occupational therap', 'play therap', 'sensory integration', 'sensory therap', 'developmental therap', 'child development'],
  speech_language: ['speech-language', 'speech language', 'speech therap', 'speech patholog'],
  occupational: ['occupational therap'],
  play: ['play therap'],
  sensory_therapy: ['sensory integration', 'sensory therap', 'sensory processing'],
  educational: ['educational therap', 'tutoring', 'learning support', 'learning disabilit', 'special education'],
  educational_therapy: ['educational therap'],
  nutritional: ['dietitian', 'dietician', 'nutrition'],
  dietitian: ['dietitian', 'dietician'],
  pharmacological: ['psychiatr', 'medication'],
  medication: ['psychiatr', 'medication'],
  psychological: ['psycholog', 'counselling', 'counseling', 'psychotherap', 'cognitive behav', 'mental health'],
  cbt: ['cognitive behav'],
  social_relational: ['social skills', 'relationship development', 'social group', 'peer group'],
  rdi: ['relationship development intervention'],
  therapy_other: ['animal therapy', 'animal-assisted', 'animal assisted', 'art therap', 'music therap', 'relaxation'],
  animal_assisted: ['animal therapy', 'animal-assisted', 'animal assisted', 'therapy dog', 'therapy animal', 'equine therap', 'equine-assisted'],
  art_therapy: ['art therap'],
  relaxation: ['relaxation', 'mindfulness'],
}

export const therapyWords = (id: string): string[] => THERAPY_WORDS[id] || []

/**
 * The text groups these choices add to a search: one for the activities, one
 * for the therapy kinds (any word within a group; every group must match, as
 * search's own words do). Unknown ids are ignored.
 */
export function keywordGroupsFor(activities: readonly string[] = [], therapy: readonly string[] = []): string[][] {
  const groups: string[][] = []
  const act = Array.from(new Set(ACTIVITIES.filter((a) => activities.includes(a.id)).flatMap((a) => a.words)))
  if (act.length) groups.push(act)
  const th = Array.from(new Set(therapy.flatMap(therapyWords)))
  if (th.length) groups.push(th)
  return groups
}
