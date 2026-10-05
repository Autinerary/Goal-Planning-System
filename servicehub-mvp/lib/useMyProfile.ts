'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MyProfile } from '@/lib/onboarding/profile'

/** GET /api/me/profile, as the profile page and the prompts read it. */
export interface MyProfileResponse extends Partial<MyProfile> {
  signedIn: boolean
  saved?: { total: number; byCategory: Record<string, number> }
}

/** The signed-in person's ResourceHub profile; null while loading. */
export function useMyProfile() {
  const [profile, setProfile] = useState<MyProfileResponse | null>(null)

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/me/profile', { cache: 'no-store', credentials: 'include' })
      const data = res.ok ? await res.json() : { signedIn: false }
      setProfile(data)
      return data as MyProfileResponse
    } catch {
      setProfile({ signedIn: false })
      return { signedIn: false } as MyProfileResponse
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { profile, setProfile, reload }
}

/** Saves a change and returns the updated profile, or an error message. */
export async function saveProfile(
  url: string,
  init: RequestInit
): Promise<{ profile?: MyProfileResponse; error?: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data?.error || 'Could not save that. Please try again.' }
    return { profile: data }
  } catch {
    return { error: 'Could not reach ResourceHub. Please try again.' }
  }
}
