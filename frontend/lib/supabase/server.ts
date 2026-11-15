import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client that reads/writes auth cookies.
 * Use inside Next.js Route Handlers / Server Components.
 */
export function createServerSupabase(accessToken?: string) {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Route Handlers may not allow setting cookies on every code path.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Ignore — see above.
          }
        },
      },
    }
  )
}
