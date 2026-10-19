/**
 * The app's accessibility settings, on ResourceHub (Riipen Labs, Group 32:
 * "Large Font fails to scale text in sections like ResourceHub"). The app's
 * hand-off link carries them as ?a11y= (frontend/lib/a11yHandoff.ts); the
 * middleware keeps them in this cookie, and a script in the root layout
 * applies them to <html> before the first paint, as the app does. Only the
 * tokens below are kept.
 */
export const A11Y_COOKIE = 'autinerary_a11y'

// token → the data-attribute on <html> the CSS reads, and its value
const ATTRS: [string, string, string][] = [
  ['text-large', 'fontScale', 'large'],
  ['text-xlarge', 'fontScale', 'xlarge'],
  ['contrast', 'highContrast', 'on'],
  ['dark', 'darkMode', 'on'],
  ['dyslexia', 'dyslexiaFont', 'on'],
  ['underline', 'underlineLinks', 'on'],
  ['calm', 'reduceMotion', 'on'],
  // Colour strength, softest to brightest (the team's planning note, October
  // 2026: "dull or brighten the colors"); 'soft' was Soft colours (Riipen
  // Labs, Groups 8 and 16).
  ['softest', 'colorStrength', 'softest'],
  ['soft', 'colorStrength', 'soft'],
  ['bright', 'colorStrength', 'bright'],
  ['brightest', 'colorStrength', 'brightest'],
  // The colour theme (app/themes.css); Earthy, the default, has no token.
  ['theme-ocean', 'theme', 'ocean'],
  ['theme-sand', 'theme', 'sand'],
  ['theme-classic', 'theme', 'classic'],
  ['theme-warm', 'theme', 'warm'],
  ['theme-cool', 'theme', 'cool'],
  ['theme-bakery', 'theme', 'bakery'],
  // Listening, the notes for today, and the speaking speed (the planning
  // note, Goals 10 and 11): the app's Settings, Accessibility.
  ['listen-off', 'listen', 'off'],
  ['notes-off', 'dailyNotes', 'off'],
  ['speak-slow', 'speechRate', 'slow'],
  ['speak-fast', 'speechRate', 'fast'],
  // Sounds for Bites and Well-Dones in Tidbits (the Tidbits round, Goal 3). Off
  // unless someone turns them on: a sudden sound can be a lot.
  ['sounds-on', 'sounds', 'on'],
]

/** The cookie value for an ?a11y= value: known tokens only, one per setting, 'none' if none. */
export function cleanA11y(raw: string): string {
  const keyOf = new Map(ATTRS.map(([token, key]) => [token, key]))
  const byKey = new Map<string, string>()
  // The last token for a setting wins (two text sizes, two themes).
  for (const p of raw.split('.')) if (keyOf.has(p)) byKey.set(keyOf.get(p)!, p)
  const parts = Array.from(byKey.values())
  return parts.length ? parts.join('.') : 'none'
}

/** The token set for one setting (its data-attribute), from a cookie value. */
export function tokenFor(value: string, key: string): string {
  const tokens = value.split('.')
  return ATTRS.find(([token, k]) => k === key && tokens.includes(token))?.[0] || ''
}

/** Sets <html>'s data-attributes for a cookie value, clearing the others. */
export function applyA11y(value: string) {
  const root = document.documentElement
  const tokens = value.split('.')
  for (const [, key] of ATTRS) delete root.dataset[key]
  for (const [token, key, on] of ATTRS) if (tokens.includes(token)) root.dataset[key] = on
}

/** Runs in <head>: the cookie's settings, before the first paint. */
export const A11Y_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )${A11Y_COOKIE}=([^;]*)/),v=m?decodeURIComponent(m[1]).split('.'):[],r=document.documentElement;${ATTRS.map(([token, key, on]) => `if(v.indexOf('${token}')>-1)r.dataset.${key}='${on}';`).join('')}}catch(e){}`
