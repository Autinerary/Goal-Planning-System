import type { AccessibilitySettings } from './preferences'

/**
 * The accessibility settings ResourceHub should use, sent in its hand-off
 * link (/go/servicehub). ResourceHub is another site, so it couldn't see
 * them: Large text, high contrast and dark mode stopped at its door (Riipen
 * Labs, Group 32: "Large Font fails to scale text in sections like
 * ResourceHub"). It keeps them in a cookie (servicehub-mvp/lib/a11y.ts).
 *
 * Short tokens, only for what differs from the default; 'none' when nothing
 * does, so turning a setting off reaches ResourceHub too.
 */
export function a11yParam(a: Partial<AccessibilitySettings> | undefined): string {
  const t: string[] = []
  if (a?.fontScale === 'large' || a?.fontScale === 'xlarge') t.push(`text-${a.fontScale}`)
  if (a?.highContrast) t.push('contrast')
  if (a?.darkMode) t.push('dark')
  if (a?.dyslexiaFont) t.push('dyslexia')
  if (a?.underlineLinks) t.push('underline')
  if (a?.reduceMotion) t.push('calm')
  // Soft colours reach ResourceHub too (Riipen Labs, Group 8, who reviewed
  // ResourceHub: "softer to account for people who may experience increased
  // sensibility to screens"; Group 16's option).
  if (a?.softColors) t.push('soft')
  return t.length ? t.join('.') : 'none'
}
