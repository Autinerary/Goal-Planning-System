/**
 * The app's own words, said plainly where they first appear.
 *
 * Riipen Labs, September 2026: Group 19 found "terms like 'milestone' and
 * 'path' are not clearly defined in the context of the app, leaving users
 * unsure how features connect"; Group 16 that the screen after setup "does
 * not explain what a path even does, and just has a button to create the
 * path"; Group 17 that setup used "undefined terms like 'norms'". The
 * glossary (/help) has the long versions; these are the one-line ones shown
 * by components/Define.tsx, tapped open beside the word. They agree with the
 * glossary. Plain data, no imports; tested by lib/terms.test.mjs.
 */

export type TermId = 'path' | 'milestone' | 'norms' | 'task'

export const TERMS: Record<TermId, { word: string; question: string; short: string; glossary: string }> = {
  path: {
    word: 'path',
    question: 'What is a path?',
    short: 'Your path is your plan for a goal: the goal broken into small steps called milestones, each with a few tasks and tools that can help. Your Path page always shows the next one.',
    glossary: '/help#path',
  },
  milestone: {
    word: 'milestone',
    question: 'What is a milestone?',
    short: 'A milestone is one small step of your plan, like “Choose a language to learn”. Opening it shows a few tasks and the tools that can help. Tick it off when it is done, and the next one comes up.',
    glossary: '/help#milestones',
  },
  norms: {
    word: 'norms',
    question: 'What are norms?',
    short: 'Norms are what you navigate day to day: a condition or difference such as autism or ADHD, a disability, or your situation, such as being a newcomer. Sharing them is optional, and they shape the tools and services suggested to you.',
    glossary: '/help#norms',
  },
  task: {
    word: 'task',
    question: 'What is a task?',
    short: 'A task is one small thing to do this week for a milestone. Tasks show on your Calendar, spread around your energy.',
    glossary: '/help#calendar',
  },
}
