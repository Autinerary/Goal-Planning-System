/**
 * Where feedback goes (the team's planning note, October 2026, Goal 8:
 * "Feedback email button, linking to heydevs@autinerary.ca"). The email
 * opens in the person's own email app, with the page they were on. No
 * imports, so ResourceHub keeps a copy of the same few lines.
 */
export const FEEDBACK_EMAIL = 'heydevs@autinerary.ca'

export function feedbackMailto(page = ''): string {
  const subject = 'Feedback about Autinerary'
  const body = `Hello,\n\n(What happened, what you expected, or an idea.)\n\n\nThe page I was on: ${page}\n`
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
