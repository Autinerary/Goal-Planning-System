// Stories people share about using Autinerary (Riipen Labs, Group 11:
// "lived-experience testimonials ... shared with consent"). The consent
// choices match docs/beta/testimonials.md. Stored in public.stories (STEP 52),
// read and written only through app/api/stories.

export const STORY_ROLES = [
  { id: 'self', label: 'Myself, about my own experience', shown: null },
  { id: 'parent', label: 'A parent', shown: 'parent' },
  { id: 'sibling', label: 'A sibling', shown: 'sibling' },
  { id: 'family', label: 'Another family member', shown: 'family member' },
  { id: 'professional', label: 'Someone who teaches, supports or works with people', shown: 'educator or support worker' },
  { id: 'ally', label: 'An ally', shown: 'ally' },
  { id: 'other', label: 'Other', shown: null },
] as const

export const PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Nova Scotia',
  'Northwest Territories', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon',
  'Outside Canada',
] as const

export const NAME_DISPLAYS = [
  { id: 'first_name', label: 'My first name' },
  { id: 'initials', label: 'My initials' },
  { id: 'none', label: 'No name' },
] as const

export type StoryStatus = 'submitted' | 'awaiting_approval' | 'approved' | 'published' | 'declined' | 'withdrawn'

/** What the person sees about where their story is. */
export const STATUS_LABEL: Record<StoryStatus, string> = {
  submitted: 'With the team. We will send you the final version to approve before anything is shared.',
  awaiting_approval: 'Ready for you to approve. Nothing is shared until you do.',
  approved: 'Approved by you. The team will share it soon.',
  published: 'Shared on the Autinerary website.',
  declined: 'Not shared this time. Thank you for writing it.',
  withdrawn: 'Withdrawn. It is not shown anywhere.',
}

export interface StoryInput {
  story: string
  role: string | null
  showRole: boolean
  province: string | null
  showProvince: boolean
  nameDisplay: string
  displayName: string
  shareSite: boolean
  shareSocial: boolean
  format: string
  adult: boolean
}

/** Checks a submitted story; returns the row to store, or a reason. */
export function cleanStory(raw: any): { row?: Record<string, unknown>; error?: string } {
  const story = typeof raw?.story === 'string' ? raw.story.trim().replace(/\r\n/g, '\n') : ''
  if (story.length < 20) return { error: 'Please write a little more: at least a sentence or two.' }
  if (story.length > 1500) return { error: 'Please keep it under 1,500 characters.' }
  if (raw?.adult !== true) return { error: 'Stories can only be shared by people 18 or older.' }
  const role = STORY_ROLES.some((r) => r.id === raw?.role) ? raw.role : null
  const province = PROVINCES.includes(raw?.province) ? raw.province : null
  const nameDisplay = NAME_DISPLAYS.some((n) => n.id === raw?.nameDisplay) ? raw.nameDisplay : 'none'
  const displayName = typeof raw?.displayName === 'string' ? raw.displayName.trim() : ''
  if (nameDisplay !== 'none' && !/^\p{L}[\p{L} .'-]{0,39}$/u.test(displayName)) {
    return { error: nameDisplay === 'initials' ? 'Add your initials, or choose "No name".' : 'Add your first name, or choose "No name".' }
  }
  const shareSite = raw?.shareSite !== false
  const shareSocial = raw?.shareSocial === true
  if (!shareSite && !shareSocial) return { error: 'Choose where it may be shared, or keep it to yourself for now.' }
  return {
    row: {
      story,
      role,
      show_role: Boolean(raw?.showRole) && role !== null,
      province,
      show_province: Boolean(raw?.showProvince) && province !== null,
      name_display: nameDisplay,
      display_name: nameDisplay === 'none' ? null : displayName,
      share_site: shareSite,
      share_social: shareSocial,
      format: ['text', 'audio', 'video'].includes(raw?.format) ? raw.format : 'text',
      adult: true,
    },
  }
}

/** A published story as the home page may show it: only what its teller agreed to. */
export function publicStory(row: any): { id: string; text: string; byline: string } {
  const name = row.name_display === 'none' || !row.display_name ? null : row.display_name
  const role = row.show_role ? STORY_ROLES.find((r) => r.id === row.role)?.shown || null : null
  const place = row.show_province ? row.province : null
  const parts = [name, role, place].filter(Boolean).join(', ') || 'someone using Autinerary'
  return { id: row.id, text: row.final_text || row.story, byline: parts[0].toUpperCase() + parts.slice(1) }
}
