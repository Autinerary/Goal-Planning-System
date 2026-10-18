/**
 * #FundAutinerary (the team's planning note, October 2026, Goal 9, "Sylvia's
 * chart"): a petition asking Canada's governments, universities, colleges,
 * workplaces and cities to fund Autinerary, so it can stay free for the
 * people they serve. No imports.
 */
export const PETITION_HASHTAG = '#FundAutinerary'

export const PETITION_ASKS = [
  { id: 'government', label: 'The Government of Canada, or my province' },
  { id: 'university', label: 'My university' },
  { id: 'college', label: 'My college' },
  { id: 'workplace', label: 'My workplace' },
  { id: 'city', label: 'My city or town' },
] as const

export type PetitionAsk = (typeof PETITION_ASKS)[number]['id']

export const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'] as const

export const PETITION_TEXT =
  'Autinerary helps neurodivergent people and their families plan, find services and build a support team. I am asking my government, school or workplace to fund it, so it stays free for everyone who needs it.'

export function shareLinks(url: string): { label: string; href: string }[] {
  const text = `I signed the petition to keep Autinerary free for neurodivergent people and families. ${PETITION_HASHTAG}`
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(text)
  return [
    { label: 'Post on X', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { label: 'Share on Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: 'Share on LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { label: 'Email a friend', href: `mailto:?subject=${encodeURIComponent('Help keep Autinerary free')}&body=${encodeURIComponent(`${text}\n\n${url}`)}` },
  ]
}
