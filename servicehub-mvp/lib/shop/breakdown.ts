import type { ProductReview } from '@/types/shop'
import type { DiagnosticBreakdown, AreaAverages } from '@/lib/supabase/queries'

/**
 * Turn raw product reviews into the same breakdown shape the service side
 * shows (Odosa: bring the rating breakdown and "based on those who matched
 * your Diagnostics profile" over from services).
 *
 * All of it is computed from snapshots written at review time — the reviewer's
 * own diagnostics, relationships and organisations. Nothing here reads another
 * user's profile, which RLS would block anyway.
 */

export interface ProductBreakdown {
  averageRating: number
  ratingCount: number
  /** How many reviews gave each star value, 1-5. */
  distribution: Record<number, number>
  /** Per-norm averages, e.g. sensory / mobility. */
  barrierScores: Record<string, { average: number; count: number }>
  /** Grouped by (norm, severity) — the nested "Autism Level 3" breakdown.
   *  Same shape the service side uses, so RatingsBreakdown renders it as-is. */
  diagnosticBreakdown: DiagnosticBreakdown[]
  /** Weighted by how close the reviewer is to the norm (lived > ally). */
  weightedRating: number
}

// Same tiers as lib/trust/relationship.ts. Duplicated deliberately rather than
// imported: this runs server-side on plain review rows and must not pull the
// client-side trust module into the shop bundle.
const RELATIONSHIP_WEIGHT: Record<string, number> = {
  lived: 1.0,
  direct_support: 0.6,
  indirect_support: 0.35,
  ally: 0.15,
}

function prettyNorm(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function buildProductBreakdown(reviews: ProductReview[]): ProductBreakdown {
  const empty: ProductBreakdown = {
    averageRating: 0,
    ratingCount: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    barrierScores: {},
    diagnosticBreakdown: [],
    weightedRating: 0,
  }
  if (!reviews || reviews.length === 0) return empty

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sum = 0
  let weightedSum = 0
  let weightTotal = 0
  const barrierAgg = new Map<string, { sum: number; count: number }>()
  // feature -> { count, areaSums, levels }. Nested rather than flat because
  // RatingsBreakdown shows area averages per severity level.
  const diagAgg = new Map<string, {
    count: number
    areas: Map<string, { sum: number; count: number }>
    levels: Map<number, { count: number; areas: Map<string, { sum: number; count: number }> }>
  }>()

  for (const r of reviews) {
    const rating = Number(r.rating) || 0
    sum += rating
    if (distribution[rating] !== undefined) distribution[rating] += 1

    // Weight by the reviewer's STRONGEST declared tie. An undeclared reviewer
    // weighs 1.0 — the safe default, matching the service side: nobody is
    // silently demoted for a question they were never asked.
    const rels = Object.values((r as any).rater_relationships || {}) as string[]
    const weight = rels.length
      ? Math.max(...rels.map((x) => RELATIONSHIP_WEIGHT[x] ?? 1.0))
      : 1.0
    weightedSum += rating * weight
    weightTotal += weight

    for (const [norm, score] of Object.entries((r as any).barrier_scores || {})) {
      const n = Number(score)
      if (!Number.isFinite(n)) continue
      const cur = barrierAgg.get(norm) || { sum: 0, count: 0 }
      cur.sum += n
      cur.count += 1
      barrierAgg.set(norm, cur)
    }

    // Group by (norm, severity) so the UI can say "Autism, Level 3". The
    // review's per-area scores are what get averaged; when a reviewer gave no
    // area scores we fall back to their overall rating so the group still
    // reflects them.
    const areaEntries = Object.entries((r as any).barrier_scores || {}) as [string, number][]
    const effectiveAreas: [string, number][] =
      areaEntries.length > 0 ? areaEntries : [['overall', rating]]

    for (const [norm, level] of Object.entries((r as any).rater_diagnostics || {})) {
      const lvl = Number(level)
      if (!Number.isFinite(lvl)) continue
      const feat = diagAgg.get(norm) || { count: 0, areas: new Map(), levels: new Map() }
      feat.count += 1
      for (const [area, score] of effectiveAreas) {
        const n = Number(score)
        if (!Number.isFinite(n)) continue
        const a = feat.areas.get(area) || { sum: 0, count: 0 }
        a.sum += n; a.count += 1
        feat.areas.set(area, a)
      }
      const lv = feat.levels.get(lvl) || { count: 0, areas: new Map() }
      lv.count += 1
      for (const [area, score] of effectiveAreas) {
        const n = Number(score)
        if (!Number.isFinite(n)) continue
        const a = lv.areas.get(area) || { sum: 0, count: 0 }
        a.sum += n; a.count += 1
        lv.areas.set(area, a)
      }
      feat.levels.set(lvl, lv)
      diagAgg.set(norm, feat)
    }
  }

  const barrierScores: Record<string, { average: number; count: number }> = {}
  for (const [k, v] of barrierAgg.entries()) {
    barrierScores[k] = { average: v.sum / v.count, count: v.count }
  }

  const toAreas = (m: Map<string, { sum: number; count: number }>): AreaAverages => {
    const out: AreaAverages = {}
    for (const [k, v] of m.entries()) out[k] = { average: v.sum / v.count, count: v.count }
    return out
  }

  const diagnosticBreakdown: DiagnosticBreakdown[] = Array.from(diagAgg.entries())
    .map(([feature, f]) => ({
      feature,
      count: f.count,
      areas: toAreas(f.areas),
      levels: Array.from(f.levels.entries())
        .map(([level, lv]) => ({ level, count: lv.count, areas: toAreas(lv.areas) }))
        .sort((a, b) => a.level - b.level),
    }))
    .sort((a, b) => b.count - a.count || a.feature.localeCompare(b.feature))

  return {
    averageRating: sum / reviews.length,
    ratingCount: reviews.length,
    distribution,
    barrierScores,
    diagnosticBreakdown,
    weightedRating: weightTotal > 0 ? weightedSum / weightTotal : 0,
  }
}

/**
 * "Based on those who matched your Diagnostics profile."
 *
 * Only counts reviewers who share at least one norm with the viewer, and only
 * returns something when there are at least two — a banner built on a single
 * stranger's review would imply a consensus that does not exist.
 */
export function matchForProfile(
  reviews: ProductReview[],
  viewerNorms: string[]
): { labels: string[]; count: number; avg: number } | null {
  if (!reviews?.length || !viewerNorms?.length) return null
  const mine = new Set(viewerNorms.map((n) => n.toLowerCase()))

  const matched = reviews.filter((r) =>
    Object.keys((r as any).rater_diagnostics || {}).some((n) => mine.has(n.toLowerCase()))
  )
  if (matched.length < 2) return null

  const shared = new Set<string>()
  for (const r of matched) {
    for (const n of Object.keys((r as any).rater_diagnostics || {})) {
      if (mine.has(n.toLowerCase())) shared.add(prettyNorm(n))
    }
  }

  return {
    labels: Array.from(shared).slice(0, 4),
    count: matched.length,
    avg: matched.reduce((s, r) => s + (Number(r.rating) || 0), 0) / matched.length,
  }
}
