// Lightweight motivation-style analysis for journal entries.
//
// We infer which motivation style a person is leaning on from the language in
// their reflections. This is a heuristic (keyword-weighted) so it works even
// when the AI backend is offline — the goal is a directional "what drove you
// most this month" report, not a clinical assessment.
//
// Styles mirror the onboarding motivation options so the vocabulary is
// consistent across the app.

export type MotivationStyle =
  | 'achievement'
  | 'social'
  | 'reward'
  | 'purpose'
  | 'growth'
  | 'autonomy'

export const MOTIVATION_META: Record<
  MotivationStyle,
  { label: string; emoji: string; blurb: string }
> = {
  achievement: {
    label: 'Achievement',
    emoji: '🏆',
    blurb: 'Driven by finishing goals, hitting milestones, and measurable wins.',
  },
  social: {
    label: 'Social Connection',
    emoji: '👥',
    blurb: 'Energized by people, belonging, encouragement, and shared progress.',
  },
  reward: {
    label: 'Reward-Based',
    emoji: '🎁',
    blurb: 'Motivated by treats, points, and celebrating each step.',
  },
  purpose: {
    label: 'Purpose-Driven',
    emoji: '🌟',
    blurb: 'Fueled by meaning, values, and the bigger "why" behind the work.',
  },
  growth: {
    label: 'Growth & Mastery',
    emoji: '📈',
    blurb: 'Motivated by learning, improving, and getting better over time.',
  },
  autonomy: {
    label: 'Autonomy',
    emoji: '🧭',
    blurb: 'Thrives on independence, choice, and doing things your own way.',
  },
}

const KEYWORDS: Record<MotivationStyle, string[]> = {
  achievement: ['finish', 'complete', 'done', 'goal', 'win', 'accomplish', 'milestone', 'achieve', 'target', 'progress', 'streak'],
  social: ['friend', 'family', 'team', 'together', 'support', 'people', 'community', 'talk', 'share', 'help', 'connect', 'group'],
  reward: ['reward', 'treat', 'fun', 'enjoy', 'celebrate', 'points', 'prize', 'gift', 'break', 'relax', 'happy'],
  purpose: ['meaning', 'purpose', 'why', 'value', 'matter', 'believe', 'mission', 'impact', 'important', 'passion'],
  growth: ['learn', 'improve', 'better', 'grow', 'practice', 'skill', 'master', 'understand', 'progress', 'challenge'],
  autonomy: ['own', 'myself', 'independent', 'choose', 'control', 'decide', 'freedom', 'alone', 'self'],
}

export interface MotivationScore {
  style: MotivationStyle
  score: number
  hits: number
}

/** Score a block of text against each motivation style. */
export function scoreMotivation(text: string): MotivationScore[] {
  const lower = (text || '').toLowerCase()
  const scores = (Object.keys(KEYWORDS) as MotivationStyle[]).map((style) => {
    let hits = 0
    for (const kw of KEYWORDS[style]) {
      // count word occurrences
      const matches = lower.match(new RegExp(`\\b${kw}`, 'g'))
      if (matches) hits += matches.length
    }
    return { style, score: hits, hits }
  })
  return scores.sort((a, b) => b.score - a.score)
}

export interface MotivationReport {
  top: MotivationStyle | null
  ranked: MotivationScore[]
  totalHits: number
  entryCount: number
}

/**
 * Build a monthly-style report from a list of entry texts. Returns the winning
 * style plus the full ranking. `top` is null when there's not enough signal.
 */
export function buildMotivationReport(entryTexts: string[]): MotivationReport {
  const combined = entryTexts.join('\n')
  const ranked = scoreMotivation(combined)
  const totalHits = ranked.reduce((s, r) => s + r.score, 0)
  return {
    top: totalHits > 0 ? ranked[0].style : null,
    ranked,
    totalHits,
    entryCount: entryTexts.length,
  }
}
