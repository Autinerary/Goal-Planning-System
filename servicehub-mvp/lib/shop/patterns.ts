import type { ProductReview } from '@/types/shop'
import type { DiscoveredPattern } from '@/lib/agents/pattern-agent/types'

/**
 * Pattern insights for a product (Odosa).
 *
 * The service-side pattern agent works over `resources` + `ratings`; products
 * live in `products` + `product_reviews` and have no equivalent, so rather
 * than pointing a component at data that does not exist, these are derived
 * directly from the review snapshots.
 *
 * Every insight below is a statement about reviews that were actually left.
 * Nothing is inferred from a model, and when the evidence is thin, no pattern
 * is produced at all — an empty section is honest, a confident-sounding claim
 * from three reviews is not.
 */

// Below this, a difference is noise. Two reviewers agreeing is a coincidence.
const MIN_GROUP = 3
// A gap smaller than this is not worth telling someone about.
const MIN_DELTA = 0.6

const RELATIONSHIP_LABEL: Record<string, string> = {
  lived: 'people with lived experience',
  direct_support: 'family and close supporters',
  indirect_support: 'professionals who work with them',
  ally: 'allies',
}

function pretty(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

/**
 * Confidence from sample size, not from certainty about the claim.
 * Caps at 90: a rating pattern is never a fact, and showing 100% would say
 * otherwise.
 */
function confidenceFor(n: number): number {
  return Math.min(90, Math.round(40 + n * 8))
}

export function buildProductPatterns(
  reviews: ProductReview[],
  productName: string
): DiscoveredPattern[] {
  const out: DiscoveredPattern[] = []
  if (!reviews || reviews.length < MIN_GROUP) return out

  const overall = mean(reviews.map((r) => Number(r.rating) || 0))
  const now = new Date().toISOString()

  // ── 1. Does a norm group rate this differently from everyone else? ────────
  const byNorm = new Map<string, number[]>()
  for (const r of reviews) {
    for (const norm of Object.keys((r as any).rater_diagnostics || {})) {
      const arr = byNorm.get(norm) || []
      arr.push(Number(r.rating) || 0)
      byNorm.set(norm, arr)
    }
  }
  for (const [norm, ratings] of byNorm.entries()) {
    if (ratings.length < MIN_GROUP) continue
    const avg = mean(ratings)
    const delta = avg - overall
    if (Math.abs(delta) < MIN_DELTA) continue
    const better = delta > 0
    out.push({
      type: 'barrier_combination',
      pattern: { barrier_combination: [norm] },
      frequency: ratings.length,
      confidence: confidenceFor(ratings.length),
      insight: better
        ? `${pretty(norm)} reviewers rate this higher than average — ${avg.toFixed(1)} vs ${overall.toFixed(1)} overall, across ${ratings.length} reviews.`
        : `${pretty(norm)} reviewers rate this lower than average — ${avg.toFixed(1)} vs ${overall.toFixed(1)} overall, across ${ratings.length} reviews. Worth reading their comments before buying.`,
      scope: 'global',
      discovered_at: now,
      metadata: { novelty_score: Math.min(95, Math.round(Math.abs(delta) * 40)) } as any,
    })
  }

  // ── 2. Where does it do well, and where does it fall down? ────────────────
  const byArea = new Map<string, number[]>()
  for (const r of reviews) {
    for (const [area, score] of Object.entries((r as any).barrier_scores || {})) {
      const n = Number(score)
      if (!Number.isFinite(n)) continue
      const arr = byArea.get(area) || []
      arr.push(n)
      byArea.set(area, arr)
    }
  }
  const areas = Array.from(byArea.entries())
    .filter(([, xs]) => xs.length >= MIN_GROUP)
    .map(([area, xs]) => ({ area, avg: mean(xs), count: xs.length }))
    .sort((a, b) => b.avg - a.avg)

  if (areas.length >= 2) {
    const best = areas[0]
    const worst = areas[areas.length - 1]
    if (best.avg - worst.avg >= MIN_DELTA) {
      out.push({
        type: 'non_obvious',
        pattern: {} as any,
        frequency: Math.min(best.count, worst.count),
        confidence: confidenceFor(Math.min(best.count, worst.count)),
        insight: `Reviewers rate this strongest on ${pretty(best.area).toLowerCase()} (${best.avg.toFixed(1)}) and weakest on ${pretty(worst.area).toLowerCase()} (${worst.avg.toFixed(1)}).`,
        scope: 'global',
        discovered_at: now,
        metadata: { actionability_score: 80 } as any,
      })
    }
  }

  // ── 3. Does proximity to the norm change the verdict? ─────────────────────
  // The interesting case is disagreement between people who live with a norm
  // and people who only observe it — that is exactly what the relationship
  // weighting exists to surface.
  const byRelationship = new Map<string, number[]>()
  for (const r of reviews) {
    const rels = Object.values((r as any).rater_relationships || {}) as string[]
    for (const rel of new Set(rels)) {
      const arr = byRelationship.get(rel) || []
      arr.push(Number(r.rating) || 0)
      byRelationship.set(rel, arr)
    }
  }
  const lived = byRelationship.get('lived') || []
  const others = ['direct_support', 'indirect_support', 'ally']
    .flatMap((k) => byRelationship.get(k) || [])
  if (lived.length >= MIN_GROUP && others.length >= MIN_GROUP) {
    const gap = mean(lived) - mean(others)
    if (Math.abs(gap) >= MIN_DELTA) {
      out.push({
        type: 'intersectionality',
        pattern: {} as any,
        frequency: lived.length + others.length,
        confidence: confidenceFor(Math.min(lived.length, others.length)),
        insight:
          gap > 0
            ? `People with lived experience rate this higher than those supporting them — ${mean(lived).toFixed(1)} vs ${mean(others).toFixed(1)}.`
            : `People with lived experience rate this lower than those supporting them — ${mean(lived).toFixed(1)} vs ${mean(others).toFixed(1)}. The people using it are less convinced than the people buying it.`,
        scope: 'global',
        discovered_at: now,
        metadata: { novelty_score: 85 } as any,
      })
    }
  }

  // Strongest evidence first, and cap it: three good insights beat eight.
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 3)
}
