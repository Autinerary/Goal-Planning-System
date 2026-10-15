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
  // Soft colours (Riipen Labs, Groups 8 and 16): every colour less bright.
  ['soft', 'softColors', 'on'],
]

/** The cookie value for an ?a11y= value: known tokens only, 'none' if none. */
export function cleanA11y(raw: string): string {
  const known = ATTRS.map(([token]) => token)
  const parts = raw.split('.').filter((p) => known.includes(p))
  return parts.length ? Array.from(new Set(parts)).join('.') : 'none'
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
