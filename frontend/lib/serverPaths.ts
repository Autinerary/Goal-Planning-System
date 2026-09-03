// Server-backed multi-path client (Odosa: cross-device multiple paths).
//
// Talks to the FastAPI multi-path endpoints so a user's saved paths follow
// them across devices, unlike the local-only snapshots in pathSnapshots.ts.

import { backendAuthHeaders } from '@/lib/backendAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// These endpoints require a session now — they used to expose any user's
// paths to anyone holding their UUID. Every call from here is made from a
// client component, so the browser session is available.

export interface ServerPathSummary {
  pathId: string
  label: string
  isActive: boolean
  generatedAt?: string
  updatedAt?: string
  ultimateDream?: string
  raceCount: number
  overallProgress: number
}

/** List all of a user's saved paths (metadata only). */
export async function listServerPaths(userId: string): Promise<ServerPathSummary[]> {
  if (!userId) return []
  try {
    const res = await fetch(`${API_URL}/api/onboarding/user/${userId}/paths`, { cache: 'no-store', headers: await backendAuthHeaders() })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.paths as ServerPathSummary[]) || []
  } catch {
    return []
  }
}

/** Fetch a single full path payload by id. */
export async function fetchServerPath(pathId: string): Promise<any | null> {
  if (!pathId) return null
  try {
    const res = await fetch(`${API_URL}/api/onboarding/path/${pathId}`, { cache: 'no-store', headers: await backendAuthHeaders() })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Switch which path is active for the user. */
export async function activateServerPath(userId: string, pathId: string): Promise<boolean> {
  if (!userId || !pathId) return false
  try {
    const res = await fetch(`${API_URL}/api/onboarding/user/${userId}/paths/${pathId}/activate`, {
      method: 'POST',
      headers: await backendAuthHeaders(),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Delete one of the user's paths. */
export async function deleteServerPath(userId: string, pathId: string): Promise<boolean> {
  if (!userId || !pathId) return false
  try {
    const res = await fetch(`${API_URL}/api/onboarding/user/${userId}/paths/${pathId}`, {
      method: 'DELETE',
      headers: await backendAuthHeaders(),
    })
    return res.ok
  } catch {
    return false
  }
}
