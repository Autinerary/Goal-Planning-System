// Words that say nothing about what a step is about (as ResourceHub's
// searchWords skips them, servicehub-mvp/lib/community/tidbits.ts).
const SKIP = new Set([
  'the', 'and', 'for', 'with', 'your', 'you', 'from', 'into', 'that', 'this', 'about', 'how', 'what', 'when', 'who',
  'set', 'get', 'got', 'make', 'find', 'build', 'start', 'try', 'take', 'use', 'plan', 'learn', 'help', 'step', 'steps',
  'up', 'out', 'new', 'one', 'own', 'more', 'some', 'can', 'are', 'was', 'have', 'has', 'will',
])

/**
 * What to search Tidbits for, for a milestone (the Race view's "help someone"
 * prompt): its last two words that say something, as step names end on what
 * they are about ("Set up a structured study schedule" → "study schedule").
 * ResourceHub finds Tidbits with both words, in any order.
 */
export function tidbitQuery(name: string): string {
  const words = String(name || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}'-]+/u)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => w.length >= 3 && !SKIP.has(w))
  return words.slice(-2).join(' ') || String(name || '').trim().slice(0, 60)
}
