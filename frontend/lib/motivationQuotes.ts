/**
 * The Motivation Wheel's lines (the team's notes, October 2026: "Motivation
 * Wheel generating quotes"; "this could get repetitive, maybe just need the
 * Motivation Wheel at the start"): one spin when you start a task, landing on
 * one of your motivation styles (profiles.preferences.motivation.types, the
 * six in lib/motivationChoices.ts) and giving a line for it. Our own words,
 * so nothing is misquoted or misattributed.
 */

export const WHEEL_STYLES: { id: string; label: string; color: string }[] = [
  { id: 'intrinsic', label: 'For you', color: '#6366f1' },
  { id: 'achievement', label: 'Progress', color: '#f59e0b' },
  { id: 'social', label: 'Together', color: '#ec4899' },
  { id: 'reward', label: 'Treat', color: '#10b981' },
  { id: 'deadline', label: 'Timer', color: '#ef4444' },
  { id: 'curiosity', label: 'Discover', color: '#06b6d4' },
]

export const MOTIVATION_LINES: Record<string, string[]> = {
  intrinsic: [
    'You chose this because it matters to you. That reason is still here.',
    'Do it your way. Nobody else needs to see the messy part.',
    'Small, steady and yours: that is how it gets done.',
    'This is for the person you are becoming.',
    'Notice how it feels when it’s done. That feeling is the point.',
  ],
  achievement: [
    'One more tick on the way to your milestone.',
    'Finish this and you’re measurably closer than this morning.',
    'Progress counts, even when it’s small. Especially then.',
    'Look back at last week. You did hard things then too.',
    'Start with the first step only. The rest gets easier.',
  ],
  social: [
    'Someone in your corner would love to hear how this goes.',
    'Tell one person you’re doing this. Then do it.',
    'You’re not the only one working on this today.',
    'Share the win afterwards, the messy bits too.',
    'Ask for help with one piece if you need it. That still counts.',
  ],
  reward: [
    'Pick your treat now. You can have it when this is done.',
    'Ten focused minutes, then a real break.',
    'Done means a reward. Choose a good one.',
    'Work first, favourite song after.',
    'You’ve earned something nice. Finish this and claim it.',
  ],
  deadline: [
    'Set a timer for 15 minutes and beat it.',
    'Decide when you’ll stop, then start.',
    'Just this task, just this hour.',
    'Future you will be glad this is done before the rush.',
    'Race the clock: how much can you do before it rings?',
  ],
  curiosity: [
    'What will you find out by doing this?',
    'Try it a new way today, just to see.',
    'Notice one thing you didn’t know before you started.',
    'Treat it like an experiment. Every result tells you something.',
    'Ask “what if…?” once while you work.',
  ],
}

/** The wheel's slices: your styles, or all six when you haven't chosen any. */
export function wheelSlices(types: readonly string[] | undefined): typeof WHEEL_STYLES {
  const mine = WHEEL_STYLES.filter((s) => (types || []).includes(s.id))
  return mine.length >= 2 ? mine : WHEEL_STYLES
}

/** A line for a style, picked with `rand` (0 to 1). */
export function lineFor(style: string, rand: number): string {
  const lines = MOTIVATION_LINES[style] || MOTIVATION_LINES.achievement
  return lines[Math.min(lines.length - 1, Math.floor(rand * lines.length))]
}
