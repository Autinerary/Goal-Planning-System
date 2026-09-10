'use client'

/**
 * Paid-tier gates.
 *
 * There is no billing system yet, so this is the single place that decides
 * what is locked. Kept as one module rather than scattered `false` literals so
 * that wiring real entitlements later is one edit, not a hunt.
 *
 * Everything defaults to locked. A gate that silently defaults to unlocked is
 * how a paid feature ships for free.
 */

export type Entitlement = 'multiPath'

/** Multiple simultaneous life paths — for mentors, educators, parents. */
export function canManageMultiplePaths(): boolean {
  return false
}

export function hasEntitlement(name: Entitlement): boolean {
  switch (name) {
    case 'multiPath':
      return canManageMultiplePaths()
    default:
      return false
  }
}
