/**
 * Where feedback goes (the team's planning note, October 2026, Goal 8:
 * "Feedback email button, linking to heydevs@autinerary.ca"), and how it is
 * labelled (the products round, Goal 11: "a template/label that identifies
 * their issue/bug/idea/recommendation ... service-specific ... so emails we
 * get are more specific"). The subject starts with the kind and what it is
 * about, e.g. "[Bug] [Product] Loop Engage", so heydevs@ can sort them (a
 * Gmail filter per label). The email opens in the person's own email app.
 * No imports: the app keeps the same file (frontend/lib/feedback.ts).
 */
export const FEEDBACK_EMAIL = 'heydevs@autinerary.ca'

export type FeedbackKind = 'bug' | 'idea' | 'question' | 'recommendation' | 'listing' | 'general'
export type FeedbackAbout = 'service' | 'product' | 'article' | 'app' | 'resourcehub'

export const FEEDBACK_KINDS: { id: Exclude<FeedbackKind, 'listing' | 'general'>; label: string }[] = [
  { id: 'bug', label: 'Something isn’t working' },
  { id: 'idea', label: 'An idea' },
  { id: 'question', label: 'A question' },
  { id: 'recommendation', label: 'Recommend a service, product or article' },
]

const LABEL: Record<FeedbackKind, string> = { bug: 'Bug', idea: 'Idea', question: 'Question', recommendation: 'Recommendation', listing: 'Listing', general: 'Feedback' }
const ABOUT: Record<FeedbackAbout, string> = { service: 'Service', product: 'Product', article: 'Article', app: 'App', resourcehub: 'ResourceHub' }

const TEMPLATE: Record<FeedbackKind, string> = {
  bug: 'What happened:\n\n\nWhat you expected:\n\n\nYour device and browser (optional):\n',
  idea: 'Your idea:\n\n\nWho it would help:\n',
  question: 'Your question:\n',
  recommendation: 'What you recommend (its name and website):\n\n\nWhy it helps:\n',
  listing: 'What is wrong or missing in this listing:\n',
  general: '(What happened, what you expected, or an idea.)\n',
}

export function feedbackMailto(page = '', opts: { kind?: FeedbackKind; about?: FeedbackAbout; item?: string } = {}): string {
  const kind = opts.kind || 'general'
  const tags = `[${LABEL[kind]}]${opts.about ? ` [${ABOUT[opts.about]}]` : ''}`
  const subject = `${tags} ${opts.item ? opts.item.slice(0, 80) : 'Feedback about Autinerary'}`
  const body = `Hello,\n\n${TEMPLATE[kind]}\n\nThe page I was on: ${page}\n`
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
