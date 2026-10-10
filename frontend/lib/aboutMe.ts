/**
 * About me (Riipen Labs, Group 34, slide 26): a page where a person writes
 * about themselves in their own words, under a few prompts. Only they can
 * read it. If they turn on "Share with the assistant", the assistant gets it
 * with each question (app/api/assistant/chat), so it doesn't have to ask
 * again. Kept with their preferences (profiles.preferences.aboutMe), which
 * only they can read once STEP 64 is applied; the page waits for that.
 */

export const ABOUT_ME_SECTIONS = [
  { id: 'strengths', label: 'What I’m good at', hint: 'Things you do well, or that people come to you for.' },
  { id: 'helps', label: 'What helps me', hint: 'For example: written instructions, quiet places, a heads-up before plans change.' },
  { id: 'hard', label: 'What’s hard for me', hint: 'For example: phone calls, crowds, starting tasks, mornings.' },
  { id: 'know', label: 'What I want people to know', hint: 'Anything you wish people understood about you.' },
  { id: 'other', label: 'Anything else', hint: 'Interests, what you’re working towards, what a good day looks like.' },
] as const

export type AboutMeSection = (typeof ABOUT_ME_SECTIONS)[number]['id']

export const ABOUT_ME_MAX = 600

export interface AboutMe {
  sections: Partial<Record<AboutMeSection, string>>
  /** Off unless the person turns it on. */
  shareWithAssistant: boolean
  updatedAt?: string
}

/** What the assistant is told, when sharing is on: at most `limit` characters. */
export function aboutMeForAssistant(aboutMe: AboutMe | null | undefined, limit = 900): string {
  if (!aboutMe?.shareWithAssistant || !aboutMe.sections) return ''
  const lines = ABOUT_ME_SECTIONS
    .map((s) => {
      const text = String(aboutMe.sections[s.id] || '').replace(/\s+/g, ' ').trim()
      return text ? `${s.label.replace('’', "'")}: ${text}` : null
    })
    .filter(Boolean) as string[]
  if (!lines.length) return ''
  const block = `About them, in their own words (from their About me page):\n${lines.join('\n')}`
  return block.length > limit ? `${block.slice(0, limit - 1)}…` : block
}
