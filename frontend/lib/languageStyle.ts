/**
 * How Autinerary writes about autism, ADHD and other differences, chosen by
 * each person (Riipen Labs, Group 15: "'Autistic person' and 'person with
 * autism' are both used within the community: offer the choice rather than
 * picking one house style").
 *
 * The choice goes to the AI wherever it writes about the person: the plan
 * (setup sends it; backend core/llm.py, LANGUAGE_RULES) and the assistant
 * (app/api/assistant/chat reads it). The app's own pages say "neurodivergent"
 * and avoid both forms where they can (docs/voice.md). Plain data, no imports.
 */

export type LanguageStyle = 'identity' | 'person' | ''

export const LANGUAGE_STYLES: { id: LanguageStyle; label: string; example: string }[] = [
  { id: 'identity', label: 'Identity-first', example: '“autistic person”, “ADHDer”' },
  { id: 'person', label: 'Person-first', example: '“person with autism”, “person with ADHD”' },
  { id: '', label: 'No preference', example: 'either' },
]

export function isLanguageStyle(value: unknown): value is LanguageStyle {
  return value === 'identity' || value === 'person' || value === ''
}
