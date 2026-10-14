/**
 * Content notes on Tidbits posts (Riipen Labs, Group 15: "Visible safety
 * signals in community spaces: clear moderation policy, content warnings,
 * and an easy report path, especially for first-time posters").
 *
 * A post about something hard can carry one note. Readers see the note, and
 * the post opens only when they choose; the feed shows the note instead of
 * the post's first lines. Stored in community_posts.content_note (STEP 75),
 * whose check lists the same ids. Until STEP 75 is applied, posts are saved
 * without a note and nothing else changes (app/api/community/posts).
 */

export const CONTENT_NOTES = [
  { id: 'self_harm', label: 'Self-harm or suicide' },
  { id: 'abuse', label: 'Abuse or violence' },
  { id: 'crisis', label: 'A mental health crisis' },
  { id: 'medical', label: 'Medical details' },
  { id: 'food', label: 'Eating or food' },
  { id: 'loss', label: 'Death or loss' },
  { id: 'other', label: 'Something else that may be hard to read' },
] as const

export type ContentNoteId = (typeof CONTENT_NOTES)[number]['id']

export function isContentNote(value: unknown): value is ContentNoteId {
  return typeof value === 'string' && CONTENT_NOTES.some((n) => n.id === value)
}

export function contentNoteLabel(id: string | null | undefined): string | null {
  return CONTENT_NOTES.find((n) => n.id === id)?.label ?? null
}

/** A query error that means the content_note column is not there yet (before STEP 75). */
export function missingContentNote(error: { message?: string; code?: string } | null | undefined): boolean {
  return Boolean(error && (error.code === '42703' || error.code === 'PGRST204' || /content_note/.test(error.message || '')))
}
