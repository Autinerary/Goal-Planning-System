// Age helpers for the 18+ self-signup gate.

export const MIN_SIGNUP_AGE = 18

/** Whole-years age from a 'YYYY-MM-DD' date of birth, or null if unparseable. */
export function computeAge(dobISO: string | null | undefined, now: Date = new Date()): number | null {
  if (!dobISO) return null
  const dob = new Date(`${dobISO}T00:00:00`)
  if (isNaN(dob.getTime())) return null
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
