import { colourStrengthOf, themeOf, type AccessibilitySettings, type LayoutPositions } from './preferences'

/**
 * The accessibility settings ResourceHub should use, sent in its hand-off
 * link (/go/servicehub). ResourceHub is another site, so it couldn't see
 * them: Large text, high contrast and dark mode stopped at its door (Riipen
 * Labs, Group 32: "Large Font fails to scale text in sections like
 * ResourceHub"). It keeps them in a cookie (servicehub-mvp/lib/a11y.ts).
 *
 * Short tokens, only for what differs from the default; 'none' when nothing
 * does, so turning a setting off reaches ResourceHub too. The colour theme
 * comes from the layout settings, where it is kept.
 */
export function a11yParam(a: Partial<AccessibilitySettings> | undefined, layout?: Partial<LayoutPositions>): string {
  const t: string[] = []
  if (a?.fontScale === 'large' || a?.fontScale === 'xlarge') t.push(`text-${a.fontScale}`)
  if (a?.highContrast) t.push('contrast')
  if (a?.darkMode) t.push('dark')
  if (a?.dyslexiaFont) t.push('dyslexia')
  if (a?.underlineLinks) t.push('underline')
  if (a?.reduceMotion) t.push('calm')
  // Colour strength reaches ResourceHub too (Riipen Labs, Group 8, who
  // reviewed ResourceHub: "softer to account for people who may experience
  // increased sensibility to screens"); 'soft' is what Soft colours sent.
  const strength = colourStrengthOf(a)
  if (strength !== 'usual') t.push(strength)
  // And the colour theme, Earthy unless another was picked (the team's
  // planning note, October 2026).
  const theme = themeOf(layout)
  if (theme !== 'earthy') t.push(`theme-${theme}`)
  // Listening and the notes for today (Goals 10 and 11), and the speaking speed.
  if (a?.readAloud === false) t.push('listen-off')
  if (a?.dailyNotes === false) t.push('notes-off')
  if (a?.speechRate && a.speechRate < 1) t.push('speak-slow')
  if (a?.speechRate && a.speechRate > 1) t.push('speak-fast')
  return t.length ? t.join('.') : 'none'
}
