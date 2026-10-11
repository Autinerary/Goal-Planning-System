// The line at the top of the Path. Riipen Labs, Group 34 found the quotes
// "repetitive or uninteresting": there were three for each stage of the
// journey, picked at random on every visit. Now there are ten for each stage,
// one a day: the same all day, a new one tomorrow. Written to docs/voice.md:
// warm, plain, no pressure and no contest.

export type QuoteStage = 'start' | 'early' | 'mid' | 'near'

export const QUOTES: Record<QuoteStage, string[]> = {
  start: [
    'Every big journey begins with one small step. You’ve got this.',
    'The start is often the hardest part, and you’re already here.',
    'You don’t need the whole map today. Just the next step.',
    'Starting small is still starting.',
    'There’s no right speed. There’s only your speed.',
    'One step today is enough. Tomorrow can wait until tomorrow.',
    'You chose a goal. That took courage.',
    'It’s okay not to know how yet. That’s what the steps are for.',
    'Today is a good day to try one small thing.',
    'Being curious counts. Trying counts. Showing up counts.',
  ],
  early: [
    'Progress, not perfection. Keep going at your own pace.',
    'Small steps, often, add up to big change.',
    'You’re building momentum, one milestone at a time.',
    'Rest days are part of the plan, not a break from it.',
    'If a step feels too big, it’s fine to make it smaller.',
    'You’ve already done things you weren’t sure you could.',
    'Slow progress is still progress.',
    'Notice what helped this week, and do a little more of it.',
    'A hard day doesn’t undo the good ones.',
    'You’re learning what works for you. That’s real progress.',
  ],
  mid: [
    'You’re over the hump. Look how far you’ve come.',
    'Halfway is a milestone worth celebrating.',
    'Keep showing up in the way that works for you.',
    'You’ve built habits that weren’t there when you started.',
    'Your pace got you here. Trust it.',
    'Look back for a moment: you’ve done a lot.',
    'It’s okay to change the plan. It’s yours.',
    'The middle is where the journey becomes yours.',
    'You don’t have to feel motivated to take a small step.',
    'Every milestone you finish makes the next one clearer.',
  ],
  near: [
    'The finish line is in sight. One step at a time.',
    'You’re so close. Your future self is cheering you on.',
    'Almost there. Be proud of how you got here.',
    'You’ve done the hardest parts already.',
    'Nearly there, and still at your own pace.',
    'Remember how this felt at the start? Look at you now.',
    'A few more steps. You know how to do this now.',
    'You kept going. That’s worth celebrating.',
    'Finish your way. Steady is fine.',
    'What you’ve learned along the way stays with you.',
  ],
}

/** Which stage of the journey an overall progress percentage is in. */
export function quoteStage(progress: number): QuoteStage {
  if (progress <= 0) return 'start'
  if (progress < 40) return 'early'
  if (progress < 80) return 'mid'
  return 'near'
}

/** Today's line for this stage: the same all day, a different one tomorrow. */
export function quoteOfTheDay(progress: number, now: Date = new Date()): string {
  const list = QUOTES[quoteStage(progress)]
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000)
  return list[day % list.length]
}
