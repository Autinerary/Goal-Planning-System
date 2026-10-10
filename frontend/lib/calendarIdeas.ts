// Ideas the Calendar offers for a free slot (Riipen Labs, Group 34: "allow
// the calendar to suggest relevant activities"). Fixed rules, no AI: the
// milestone you're on, a tool suggested for it, and the energy level picked
// for today. Each one goes onto the calendar through the same "Add to
// Calendar" step as a suggestion from a friend.

export type EnergyLevel = 'worst' | 'average' | 'best'

export interface CalendarIdea {
  text: string
  why: string
}

export function calendarIdeas({ milestoneName, toolName, energy }: {
  milestoneName?: string | null
  toolName?: string | null
  energy: EnergyLevel
}): CalendarIdea[] {
  const ideas: CalendarIdea[] = []
  const milestone = (milestoneName || '').trim()
  if (milestone && milestone !== 'Getting started') {
    ideas.push({
      text: energy === 'worst' ? `Spend 10 minutes on “${milestone}”` : `Work on “${milestone}” for 25 minutes`,
      why: 'The milestone you’re on',
    })
  }
  const tool = (toolName || '').trim()
  if (tool) ideas.push({ text: `Try ${tool} for 15 minutes`, why: 'Suggested for this milestone' })
  if (energy === 'worst') ideas.push({ text: 'Take a 10-minute break: a short walk, a stretch, or somewhere quiet', why: 'For a low-energy day' })
  else if (energy === 'best') ideas.push({ text: 'Do the hardest task of the day first, while you have the energy', why: 'For a high-energy day' })
  else ideas.push({ text: 'Take a 5-minute break between two tasks', why: 'For a balanced day' })
  ideas.push({ text: 'Write in your journal for 5 minutes: what helped this week?', why: 'To notice what works for you' })
  return ideas
}
