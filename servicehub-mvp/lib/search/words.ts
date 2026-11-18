/**
 * Text search terms, shared by venue search (lib/supabase/queries.ts) and the
 * shop (lib/search/products.ts).
 *
 * A search used to match only the exact phrase, so "autism support group"
 * found nothing even though venues mention all three words. Now each word has
 * to appear somewhere in the name, description or category, in any order.
 * Very common words are dropped, and so are characters that mean something
 * in PostgREST's filter syntax (a comma or bracket used to break the query).
 */

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'or', 'the', 'for', 'of', 'in', 'on', 'at', 'to', 'by', 'with', 'near', 'me', 'my', 'i', 'is',
])

/** Lower-cased, with only letters, digits, spaces, apostrophes, hyphens and underscores kept. */
export function cleanTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' _-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The words a search has to match (at most 8). */
export function searchWords(query?: string): string[] {
  const text = cleanTerm(query || '')
  const words = text.split(/[\s_]+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w))
  if (words.length > 0) return Array.from(new Set(words)).slice(0, 8)
  // Only short or common words ("me", "a"): search for what was typed.
  return text ? [text] : []
}

/**
 * A PostgREST `or` filter matching any of the terms in the name, description
 * or category. Terms must already be cleaned (cleanTerm / searchWords). In
 * ilike an underscore matches any one character, so a condition key like
 * "level_2" also matches "level 2".
 */
export function inNameDescriptionOrCategory(terms: string[]): string {
  return terms
    .flatMap((t) => [`name.ilike.%${t}%`, `description.ilike.%${t}%`, `category.ilike.%${t}%`])
    .join(',')
}

/**
 * A value for an `ilike` inside a PostgREST `or(...)` filter, matching `text`
 * anywhere, as typed. LIKE's own wildcards (% and _) and the backslash are
 * escaped so they match themselves, and the whole pattern is double-quoted
 * (escaping " and \ inside) so commas, dots, colons and brackets can't end
 * the filter or add conditions of their own (bug audit, 17 November 2026,
 * item 33). Use for raw user text: `.or(\`name.ilike.${v},category.ilike.${v}\`)`.
 */
export function orIlikeValue(text: string): string {
  const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  return `"${like.replace(/[\\"]/g, (c) => `\\${c}`)}"`
}
