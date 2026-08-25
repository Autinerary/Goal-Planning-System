// Age helpers for the 18+ self-signup gate — mirrors frontend/lib/age.ts so
// both apps enforce the same rule (Odosa: "18+ only for now!!!").

export const MIN_SIGNUP_AGE = 18

export function computeAge(dobISO: string | null | undefined, now: Date = new Date()): number | null {
  if (!dobISO) return null
  const dob = new Date(dobISO)
  if (Number.isNaN(dob.getTime())) return null
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

export function isAdult(dobISO: string | null | undefined): boolean {
  const age = computeAge(dobISO)
  return age !== null && age >= MIN_SIGNUP_AGE
}
