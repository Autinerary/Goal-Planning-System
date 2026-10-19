/**
 * What someone said, as a command (Odosa, October 2026: "give anyone who
 * selects 'blind' or something similar [a way] to 'voice command' & 'talk'
 * with the app to navigate it"). Plain words, English, forgiving about
 * "please", "the", "my" and the order people say things in. Pure, so it is
 * tested on its own (lib/voiceCommands.test.mjs); the microphone is in
 * app/components/VoiceNavigation.tsx.
 */

export type VoiceCommand =
  | { kind: 'go'; to: string; label: string }
  | { kind: 'back' }
  | { kind: 'scroll'; dir: 'up' | 'down' | 'top' | 'bottom' }
  | { kind: 'read' }
  | { kind: 'stop' }
  | { kind: 'help' }
  | { kind: 'where' }
  | { kind: 'click'; name: string }
  | { kind: 'search'; query: string }
  | { kind: 'ask'; question: string }
  | { kind: 'unknown'; heard: string }

/** Places someone can ask for by name, and the words that mean them. */
export const DESTINATIONS: { to: string; label: string; words: string[] }[] = [
  { to: '/path', label: 'your Path', words: ['path', 'home', 'my plan', 'plan', 'dashboard'] },
  { to: 'next-step', label: 'your next step', words: ['next step', 'my next step', 'next milestone'] },
  { to: '/calendar', label: 'the Calendar', words: ['calendar', 'schedule', 'today'] },
  { to: '/races', label: 'Races', words: ['races', 'race', 'goals'] },
  { to: '/pit-stop', label: 'Pit Stop', words: ['pit stop', 'tools'] },
  { to: '/hare-world', label: 'Hare World', words: ['hare world', 'people', 'friends', 'messages'] },
  { to: '/reflection', label: 'your Journal', words: ['journal', 'reflection', 'diary'] },
  { to: '/assistant', label: 'the Assistant', words: ['assistant', 'chat'] },
  { to: '/help', label: 'Help', words: ['help page', 'help center'] },
  { to: '/profile', label: 'your profile', words: ['profile', 'my profile', 'account'] },
  { to: '/profile/settings', label: 'Settings', words: ['settings'] },
  { to: '/profile/accessibility', label: 'Accessibility settings', words: ['accessibility', 'accessibility settings'] },
  { to: 'hub:/', label: 'ResourceHub', words: ['resourcehub', 'resource hub', 'resources', 'services', 'find resources'] },
  { to: 'hub:/community', label: 'Tidbits', words: ['tidbits', 'tidbit', 'community'] },
  { to: 'hub:/shop', label: 'the shop', words: ['shop', 'store', 'products'] },
]

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,!?;:"“”]/g, ' ')
    .replace(/\b(please|can you|could you|would you|i want to|i'd like to|let's|now|thanks|thank you)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function parseVoiceCommand(said: string): VoiceCommand {
  const t = clean(said)
  if (!t) return { kind: 'unknown', heard: said }
  if (/^(stop|quiet|be quiet|stop reading|stop talking|pause|cancel)$/.test(t)) return { kind: 'stop' }
  if (/^(help|what can i say|commands|what are the commands|list commands)$/.test(t)) return { kind: 'help' }
  if (/^(where am i|what page is this|what is this page)$/.test(t)) return { kind: 'where' }
  if (/^(go back|back|previous page)$/.test(t)) return { kind: 'back' }
  if (/^(read( this| the)?( page)?|read it|read aloud|read to me)$/.test(t)) return { kind: 'read' }
  const scroll = t.match(/^(scroll|go|page) (up|down)$|^(scroll )?(to )?(the )?(top|bottom)$/)
  if (scroll) return { kind: 'scroll', dir: (scroll[2] || scroll[6]) as 'up' | 'down' | 'top' | 'bottom' }
  const search = t.match(/^(search|look|find|search resourcehub)( for)? (.+)$/)
  if (search && search[3] && !DESTINATIONS.some((d) => d.words.includes(search[3]))) return { kind: 'search', query: search[3].slice(0, 200) }
  const ask = t.match(/^(ask|ask the assistant|question)( about)? (.+)$/)
  if (ask) return { kind: 'ask', question: said.replace(/^\s*(please\s+)?(ask( the assistant)?|question)(\s+about)?\s+/i, '').trim().slice(0, 500) }
  const click = t.match(/^(click|press|tap|select|choose|push)( on)?( the)? (.+?)( button| link)?$/)
  if (click) return { kind: 'click', name: click[4] }
  const go = t.match(/^(go to|open|show( me)?|take me to|show)( the| my)? (.+)$/)
  const place = (go ? go[4] : t).replace(/^(the|my) /, '')
  const dest = DESTINATIONS.find((d) => d.words.includes(place))
  if (dest) return { kind: 'go', to: dest.to, label: dest.label }
  return { kind: 'unknown', heard: said }
}

/** What to say for "help". */
export const VOICE_HELP =
  'You can say: go to calendar, go to my next step, open ResourceHub, go back, scroll down, read this page, stop, where am I, click and a button\'s name, search for and what you need, or ask and a question for the assistant.'

/**
 * The control a spoken name means: an exact name first, then one that starts
 * with it, then one that contains it. Names are what a screen reader would
 * read: aria-label, the label, or the visible text.
 */
export function bestMatch<T extends { name: string }>(spoken: string, options: T[]): T | null {
  const s = clean(spoken)
  if (!s) return null
  const named = options.map((o) => ({ o, n: clean(o.name) })).filter((x) => x.n)
  return (
    named.find((x) => x.n === s)?.o ||
    named.find((x) => x.n.startsWith(s))?.o ||
    named.find((x) => x.n.includes(s))?.o ||
    null
  )
}
