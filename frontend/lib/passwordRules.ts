// The rules a new password has to meet. Sign-up checked them on its own;
// changing a password in Your profile and setting a new one after "Forgot
// password?" use the same list, so the three can't drift apart.

export const PASSWORD_RULES: { test: (password: string) => boolean; label: string }[] = [
  { test: (p) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'One uppercase letter' },
  { test: (p) => /[0-9]/.test(p), label: 'One number' },
]

/** Why a new password can't be used yet, or null when it can. */
export function newPasswordError(password: string, confirm: string): string | null {
  if (PASSWORD_RULES.some((rule) => !rule.test(password))) return 'Your new password needs at least 8 characters, an uppercase letter and a number.'
  if (password !== confirm) return 'The two passwords are different.'
  return null
}
