import * as Crypto from 'expo-crypto'
import { supabase } from './supabase'

/**
 * One-click sign-up from the phone app: the same API as the web app
 * (app/api/me/signups on app.autinerary.ca), signed in with the app's
 * Supabase session as a Bearer token. The kit itself runs inside the
 * service's page, in screens/SignupScreen.tsx's web view.
 */
export const APP_URL = (process.env.EXPO_PUBLIC_APP_URL || 'https://app.autinerary.ca').replace(/\/$/, '')

export type SignupStatus = 'started' | 'signed_up' | 'check_email' | 'needs_you' | 'exists' | 'failed'

export interface SignupInfo {
  on: boolean
  ready?: boolean
  refusal?: string | null
  email?: string | null
  details?: { firstName: string; lastName: string } | null
  suggested?: string
  signups?: Record<string, { status: SignupStatus; at: string }>
}

async function authed(path: string, init: RequestInit = {}): Promise<Response | null> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  return fetch(`${APP_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) } }).catch(() => null)
}

export async function loadSignups(): Promise<SignupInfo | null> {
  const r = await authed('/api/me/signups')
  return r ? ((await r.json().catch(() => null)) as SignupInfo | null) : null
}

export async function saveDetails(details: { firstName: string; lastName: string }): Promise<string | null> {
  const r = await authed('/api/me/signups', { method: 'PUT', body: JSON.stringify({ details }) })
  if (!r) return 'Not signed in.'
  if (r.ok) return null
  const j = await r.json().catch(() => null)
  return j?.error || 'That didn’t save.'
}

export async function recordSignup(service: string, status: SignupStatus | 'timeout', detail?: string | null): Promise<void> {
  await authed('/api/me/signups', { method: 'POST', body: JSON.stringify({ service, runner: 'mobile', status, detail: detail || null }) })
}

/** 16 random characters (no look-alikes), then one of each kind services ask for: never kept. */
export function newPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  while (out.length < 16) {
    for (const b of Crypto.getRandomBytes(32)) if (b < 224 && out.length < 16) out += chars[b % 56]
  }
  return `${out.slice(0, 8)}-${out.slice(8)}!7aK`
}

/** "Sam Lee" → Sam / Lee. */
export function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  const words = String(full || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) return { firstName: words[0] || '', lastName: '' }
  return { firstName: words.slice(0, -1).join(' '), lastName: words[words.length - 1] }
}
