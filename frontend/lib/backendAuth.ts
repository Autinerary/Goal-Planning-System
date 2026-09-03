import { createClient } from '@/lib/supabase/client'

/**
 * Authorization header for calls to the FastAPI backend.
 *
 * The path endpoints used to be open — anyone with a user UUID could read
 * that person's barrierTypes and email. They now require a session, so every
 * browser call has to carry the access token.
 */
export async function backendAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await createClient().auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}
