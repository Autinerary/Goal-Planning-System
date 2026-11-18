/**
 * What this browser keeps for the person signed in, and clearing it before someone else uses it (bug audit,
 * 17 November 2026, item 8: "A shared browser hands the last person's data to the next account").
 *
 * Families, guardians, schools and libraries share browsers. Signing out used to remove only the session, so the
 * next person to sign up resumed the last one's setup (their goals, norms and city), the assistant was sent their
 * profile, and Settings offered their email for reminders. Now (app/context/AuthContext.tsx):
 * - signing out clears the person's own words and answers (PERSONAL_KEYS), in this tab or another;
 * - the browser remembers whose things it holds (OWNER_KEY). Before another account is used, everything of the
 *   last person's is cleared, including what was kept for their return (KEPT_FOR_RETURN_KEYS: a streak, ratings
 *   kept only here, saved copies of plans), which only pages behind sign-in show.
 *
 * What belongs to the device stays: accessibility (text size, dark mode, colours, voice), cookie choices, the
 * anonymous visitor id, tours already seen and the like. So do the answers a visitor gives before making an account
 * (Start here), when the last person signed out first.
 */

/** The id of the account whose things this browser holds. */
export const OWNER_KEY = 'autinerary_owner'
/** Set when that account signed out here: what was cleared then needn't be cleared again for the next one. */
const SIGNED_OUT_KEY = 'autinerary_owner_signed_out'

/** Sent when one person's things have been cleared from this browser. */
export const PERSONAL_CLEARED_EVENT = 'autinerary:personal-cleared'

/** One person's own words and answers, kept in localStorage: cleared at sign-out. */
export const PERSONAL_KEYS = [
  // Setup: the draft, a Path Market pick, the answers kept for a next plan, a plan being made, choices after setup.
  'autinerary_onboarding_draft',
  'autinerary_path_seed',
  'autinerary_onboarding_carryover',
  'autinerary_generation_job',
  'autinerary_onboarding_choices',
  'autinerary_setup_reminder',
  'autinerary_ask_later',
  // "Start here": who it is for and what they need.
  'autinerary_start_for',
  'autinerary_start_need',
  'autinerary_start_refine',
  // The plan's answers in this browser (goals, norms, role), and norms added on Races.
  'autinerary_profile',
  'raceExtraBarriers',
  // Suggestions waiting to be added, notifications, the order pages were visited in, and what My agents was asked.
  'pendingCalendarSuggestions',
  'pendingSavedResources',
  'autinerary_notifications',
  'autinerary_movement',
  'autinerary.agents.setup.v1',
] as const

/**
 * Also one person's, but kept at sign-out for when they come back, because nothing else has them (a streak, ratings
 * of tools ResourceHub doesn't list, saved copies of plans) or they are only a copy of the account's. Only pages
 * behind sign-in show them, and they are cleared before another account is used.
 */
export const KEPT_FOR_RETURN_KEYS = [
  'autinerary_path_snapshots',
  'milestoneToolRatings',
  'completedMilestoneIds',
  'heartedGoals',
  'todaysMotivation',
  'todaysMotivationDate',
  'autinerary_active_days',
  'autinerary_freeze_days',
  'autinerary_streak_meta',
  'autinerary_races_done_seen',
  'autinerary_last_place',
] as const

/** Keys that start with these are one person's too: the Calendar's tasks (per account), a day's motivation wheel. */
const PERSONAL_PREFIXES = ['calendarAddedTasks:', 'autinerary:wheel:'] as const

/** One person's own things, kept for the tab only: whether they have norms, and which (PageFooter's note). Where to
 *  go after signing in (returnTo) is not theirs, and stays for the sign-in under way. */
const PERSONAL_SESSION_KEYS = ['autinerary_has_norms', 'autinerary_note_norms'] as const

/** The preferences' own key (lib/preferences.ts): emptied, except the device's accessibility settings. */
const PREFERENCES_KEY = 'autinerary_preferences'

function storage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window[kind]
  } catch {
    return null
  }
}

function removeKeys(local: Storage, keys: readonly string[], prefixes: readonly string[] = []) {
  for (const key of keys) local.removeItem(key)
  if (!prefixes.length) return
  const matching: string[] = []
  for (let i = 0; i < local.length; i++) {
    const key = local.key(i)
    if (key && prefixes.some((p) => key.startsWith(p))) matching.push(key)
  }
  for (const key of matching) local.removeItem(key)
}

function announceCleared() {
  // Saves still on their way to this device are dropped (app/context/usePreferences.ts), so none of the last
  // person's lands here after the clear; then everything showing preferences reads them again (no detail: each
  // listener calls loadPreferences()), so nothing on screen still shows their choices.
  try {
    window.dispatchEvent(new CustomEvent(PERSONAL_CLEARED_EVENT))
    window.dispatchEvent(new CustomEvent('autinerary:prefs'))
  } catch {}
}

/**
 * Removes the person's own words and answers from this browser (PERSONAL_KEYS); with `everything`, what was kept for
 * their return too. Preferences keep only accessibility, which is set for the device (lib/preferences.ts); the
 * rest of them (reminders and their email, About me, notes about people) comes back from the account at sign-in.
 */
export function clearPersonalData({ everything = false }: { everything?: boolean } = {}): void {
  const local = storage('localStorage')
  if (local) {
    try {
      removeKeys(local, everything ? [...PERSONAL_KEYS, ...KEPT_FOR_RETURN_KEYS] : PERSONAL_KEYS, everything ? PERSONAL_PREFIXES : ['autinerary:wheel:'])
      const raw = local.getItem(PREFERENCES_KEY)
      if (raw) {
        let accessibility: unknown
        try { accessibility = JSON.parse(raw)?.accessibility } catch {}
        if (accessibility && typeof accessibility === 'object') local.setItem(PREFERENCES_KEY, JSON.stringify({ accessibility }))
        else local.removeItem(PREFERENCES_KEY)
      }
    } catch {
      /* storage blocked: nothing to clear */
    }
  }
  const session = storage('sessionStorage')
  if (session) {
    try { for (const key of PERSONAL_SESSION_KEYS) session.removeItem(key) } catch {}
  }
  announceCleared()
}

/** The account whose things this browser holds, if known. */
export function browserOwner(): string | null {
  const local = storage('localStorage')
  if (!local) return null
  try {
    const owner = local.getItem(OWNER_KEY)
    if (owner) return owner
    // Before the owner was kept: the copy of the last account signed in here (AuthContext's app_user), else the
    // account that last opened a page here (app/components/NavTrail.tsx). Signing out used to leave the second.
    const user = JSON.parse(local.getItem('app_user') || 'null')
    if (typeof user?.id === 'string' && user.id) return user.id
    const place = JSON.parse(local.getItem('autinerary_last_place') || 'null')
    return typeof place?.user === 'string' && place.user ? place.user : null
  } catch {
    return null
  }
}

function signedOutHere(): boolean {
  try { return storage('localStorage')?.getItem(SIGNED_OUT_KEY) === '1' } catch { return false }
}

/**
 * Called with the account's id as soon as it is known, before any page shows its things. If the browser holds
 * someone else's, they are cleared first. Returns true when it cleared.
 */
export function claimBrowserFor(userId: string): boolean {
  if (!userId) return false
  const local = storage('localStorage')
  const owner = browserOwner()
  const cleared = !!owner && owner !== userId
  if (cleared) {
    if (signedOutHere() && local) {
      // Their words and answers went at sign-out; what is here now since then is a visitor's own (Start here,
      // before making this account), so only what was kept for the last person's return goes.
      try { removeKeys(local, KEPT_FOR_RETURN_KEYS, PERSONAL_PREFIXES) } catch {}
      announceCleared()
    } else {
      clearPersonalData({ everything: true })
    }
  }
  try {
    local?.setItem(OWNER_KEY, userId)
    local?.removeItem(SIGNED_OUT_KEY)
  } catch {}
  return cleared
}

/** Signed out: the person's words and answers are cleared; what was kept for their return waits for them. */
export function releaseBrowser(): void {
  const owner = browserOwner()
  clearPersonalData()
  if (!owner) return
  try {
    storage('localStorage')?.setItem(OWNER_KEY, owner)
    storage('localStorage')?.setItem(SIGNED_OUT_KEY, '1')
  } catch {}
}

/**
 * A page opened with no session (it ran out, or was ended elsewhere): if the browser still holds someone's words
 * and answers, they go, as at sign-out. After a sign-out, nothing is cleared again, so a visitor's own answers stay.
 */
export function noSessionHere(): void {
  if (browserOwner() && !signedOutHere()) releaseBrowser()
}

/**
 * This browser's copy of the plan's answers (autinerary_profile), only when it is the signed-in person's: written
 * for them (its userId), or written before copies were tagged and this browser is theirs.
 */
export function ownLocalProfile(userId: string | null | undefined): Record<string, any> | null {
  if (!userId) return null
  try {
    const profile = JSON.parse(storage('localStorage')?.getItem('autinerary_profile') || 'null')
    if (!profile || typeof profile !== 'object') return null
    if (typeof profile.userId === 'string') return profile.userId === userId ? profile : null
    return browserOwner() === userId ? profile : null
  } catch {
    return null
  }
}
