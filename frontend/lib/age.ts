// Age helpers for the 18+ self-signup gate.

export const MIN_SIGNUP_AGE = 18

/** Whole-years age from a 'YYYY-MM-DD' date of birth, or null if unparseable. */
export function computeAge(dobISO: string | null | undefined, now: Date = new Date()): number | null {
  if (!dobISO || !/^\d{4}-\d{2}-\d{2}$/.test(dobISO)) return null
  const dob = new Date(`${dobISO}T00:00:00`)
  if (isNaN(dob.getTime())) return null
  const [year, month, day] = dobISO.split('-').map(Number)
  if (dob.getFullYear() !== year || dob.getMonth() + 1 !== month || dob.getDate() !== day || dob > now) return null
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

/** True only when the DOB is valid AND the person is at least MIN_SIGNUP_AGE. */
export function isAdult(dobISO: string | null | undefined): boolean {
  const a = computeAge(dobISO)
  return a !== null && a >= MIN_SIGNUP_AGE
}

/**
 * The setup age band ('18-24' … '65+') for a date of birth, or null. The ids
 * read as ranges but are only names: '25-40' holds 25 to 39 and '40-65' holds
 * 40 to 64, so every age is in exactly one (lib/preferences.ts, AGE_RANGES). Setup's
 * Personalize step stopped asking for an age range (Riipen Labs, Group 36:
 * fewer questions); sign-up already has the date of birth, and Pattern
 * Recognition still matches on the band.
 */
export function ageBandFromDob(dobISO: string | null | undefined): '18-24' | '25-40' | '40-65' | '65+' | null {
  const age = computeAge(dobISO)
  if (age === null || age < MIN_SIGNUP_AGE) return null
  if (age <= 24) return '18-24'
  if (age < 40) return '25-40'
  if (age < 65) return '40-65'
  return '65+'
}
