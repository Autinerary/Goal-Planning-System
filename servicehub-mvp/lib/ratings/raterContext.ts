import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Who wrote a rating or a product review, as far as the breakdowns need: the
 * reviewer's own norms and their levels, how they relate to each norm, the
 * organisations they belonged to and how they are connected to their norms.
 * Recorded when they rated (the "rater_*" snapshot).
 *
 * These are private. They used to sit on each rating and product review,
 * which anyone could read with the public key, and one route sent whole rows
 * to the browser beside the reviewer's name (bug audit, 17 November 2026,
 * item 2). STEP 105 moves them into rating_rater_context and
 * product_review_rater_context, which only the service can read, and blanks
 * them on the rows. So they are read here, on the server, with the admin
 * client, and only aggregates may leave the server: never these values, and
 * never anything that ties a person or a name to them.
 *
 * Before STEP 105 the context tables don't exist and this reads the same
 * columns from the rows, still as the service.
 */
export interface RaterContext {
  /** { norm: level 1-5 } */
  diagnostics: Record<string, number>
  /** { norm: 'lived' | 'direct_support' | 'indirect_support' | 'ally' }, declared ones only. */
  relationships: Record<string, string>
  orgIds: string[]
  connectionTypes: string[]
}

export type RaterSource = 'ratings' | 'product_reviews'

export { MIN_BREAKDOWN_GROUP } from './groups'

const SOURCES: Record<RaterSource, { context: string; key: string; rows: string; columns: string }> = {
  ratings: {
    context: 'rating_rater_context',
    key: 'rating_id',
    rows: 'ratings',
    columns: 'rater_diagnostics, rater_relationships, rater_org_ids, rater_connection_types',
  },
  product_reviews: {
    context: 'product_review_rater_context',
    key: 'review_id',
    rows: 'product_reviews',
    // Product reviews never had connection types (nor does their context table).
    columns: 'rater_diagnostics, rater_relationships, rater_org_ids',
  },
}

// Ids go in the URL; 200 is well under PostgREST's limit (lib/supabase/queries.ts).
const ID_BATCH = 200
const PAGE_ROWS = 1000

/** The context table isn't there yet (before STEP 105). */
function tableMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /rater_context|does not exist|could not find the table/i.test(error.message || '')
  )
}

// Asking every time would double the reads before STEP 105; asking once a
// minute lets the context tables take over within a minute of STEP 105.
const missingUntil: Record<RaterSource, number> = { ratings: 0, product_reviews: 0 }

function emptyContext(): RaterContext {
  return { diagnostics: {}, relationships: {}, orgIds: [], connectionTypes: [] }
}

function toContext(row: Record<string, unknown> | null | undefined): RaterContext {
  const out = emptyContext()
  if (!row) return out
  const diags = row.rater_diagnostics
  if (diags && typeof diags === 'object' && !Array.isArray(diags)) {
    for (const [k, v] of Object.entries(diags as Record<string, unknown>)) {
      const n = Number(v)
      if (k && Number.isFinite(n)) out.diagnostics[k] = n
    }
  }
  const rels = row.rater_relationships
  if (rels && typeof rels === 'object' && !Array.isArray(rels)) {
    for (const [k, v] of Object.entries(rels as Record<string, unknown>)) {
      if (k && typeof v === 'string' && v) out.relationships[k] = v
    }
  }
  if (Array.isArray(row.rater_org_ids)) {
    out.orgIds = (row.rater_org_ids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
  }
  // Stored as a JSON array; old rows hold the column's default '{}' (an object).
  if (Array.isArray(row.rater_connection_types)) {
    out.connectionTypes = (row.rater_connection_types as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
  }
  return out
}

function adminOrNull(): SupabaseClient | null {
  try {
    return createAdminClient()
  } catch (err) {
    console.warn('[raterContext] service client not configured; breakdowns are empty', err)
    return null
  }
}

type Rows = { data: Record<string, unknown>[] | null; error: { code?: string; message?: string } | null }

async function readByIds(read: (batch: string[]) => PromiseLike<Rows>, ids: string[]): Promise<Rows> {
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += ID_BATCH) batches.push(ids.slice(i, i + ID_BATCH))
  const results = await Promise.all(batches.map((b) => read(b)))
  const error = results.find((r) => r.error)?.error ?? null
  return { data: results.flatMap((r) => r.data || []), error }
}

async function readEverything(read: (from: number, to: number) => PromiseLike<Rows>): Promise<Rows> {
  const data: Record<string, unknown>[] = []
  // Bounded, like search's reads (lib/supabase/queries.ts MAX_MATCHES).
  for (let from = 0; from < 50_000; from += PAGE_ROWS) {
    const page = await read(from, from + PAGE_ROWS - 1)
    if (page.error) return { data, error: page.error }
    data.push(...(page.data || []))
    if (!page.data || page.data.length < PAGE_ROWS) break
  }
  return { data, error: null }
}

/**
 * The reviewer context of these ratings or product reviews (by their ids), or
 * of all of them ('all'), keyed by rating or review id. Server only. Missing
 * ids simply have no entry; a failure gives an empty map (the breakdowns are
 * then empty, nothing else breaks).
 */
export async function loadRaterContext(source: RaterSource, ids: string[] | 'all'): Promise<Map<string, RaterContext>> {
  const out = new Map<string, RaterContext>()
  const wanted = ids === 'all' ? 'all' : Array.from(new Set(ids.filter(Boolean)))
  if (wanted !== 'all' && wanted.length === 0) return out
  const admin = adminOrNull()
  if (!admin) return out
  const s = SOURCES[source]

  if (Date.now() >= missingUntil[source]) {
    const ctx =
      wanted === 'all'
        ? await readEverything((from, to) => admin.from(s.context).select(`${s.key}, ${s.columns}`).order(s.key).range(from, to) as unknown as PromiseLike<Rows>)
        : await readByIds((batch) => admin.from(s.context).select(`${s.key}, ${s.columns}`).in(s.key, batch) as unknown as PromiseLike<Rows>, wanted)
    if (!ctx.error) {
      for (const row of ctx.data || []) out.set(String(row[s.key]), toContext(row))
      return out
    }
    if (!tableMissing(ctx.error)) {
      console.error(`[raterContext] ${s.context} read failed:`, ctx.error.message)
      return out
    }
    missingUntil[source] = Date.now() + 60_000
  }

  // Before STEP 105: the same values, from the rows themselves.
  const rows =
    wanted === 'all'
      ? await readEverything((from, to) => admin.from(s.rows).select(`id, ${s.columns}`).order('id').range(from, to) as unknown as PromiseLike<Rows>)
      : await readByIds((batch) => admin.from(s.rows).select(`id, ${s.columns}`).in('id', batch) as unknown as PromiseLike<Rows>, wanted)
  if (rows.error) {
    console.error(`[raterContext] ${s.rows} read failed:`, rows.error.message)
    return out
  }
  for (const row of rows.data || []) out.set(String(row.id), toContext(row))
  return out
}

/**
 * The same context put on server-side copies of the rows, under the old
 * rater_* names, for code that reads them there (lib/shop/breakdown.ts,
 * lib/shop/patterns.ts). The properties are not enumerable, so they are left
 * out if the rows are ever serialised (JSON, or props for a client
 * component): they stay on the server.
 */
export function withHiddenRaterFields<T extends { id: string }>(rows: T[], context: Map<string, RaterContext>): T[] {
  return rows.map((row) => {
    const copy = { ...row } as T & Record<string, unknown>
    // Drop anything that came from the row itself (before STEP 105).
    delete copy.rater_diagnostics
    delete copy.rater_relationships
    delete copy.rater_org_ids
    delete copy.rater_connection_types
    const c = context.get(row.id) || emptyContext()
    const hidden = (name: string, value: unknown) => Object.defineProperty(copy, name, { value, enumerable: false, writable: false, configurable: false })
    hidden('rater_diagnostics', c.diagnostics)
    hidden('rater_relationships', c.relationships)
    hidden('rater_org_ids', c.orgIds)
    hidden('rater_connection_types', c.connectionTypes)
    return copy as T
  })
}
