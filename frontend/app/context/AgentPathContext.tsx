'use client'

/**
 * AgentPathContext
 * Single source of truth for the multi-agent path payload on the frontend.
 *
 * Loads `GET /api/onboarding/user/{user_id}/path` (or `/api/onboarding/path/{path_id}`
 * when `path_id` is on the auth user's metadata) and exposes a per-agent slice
 * so every page can render real agent output without re-fetching.
 *
 * All slices fall back to `undefined` when no path exists, so pages can keep
 * their existing mock data as a graceful default.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { backendAuthHeaders } from '@/lib/backendAuth'
import { withoutHiddenGoals } from '@/lib/hiddenGoals'
import { TAKING_LONGER, fetchWithTimeout, isTimeout } from '@/lib/backendTimeout'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface AgentResponse {
  agentId: string
  agentName: string
  result: any
  // null for Calendar Optimization since 13 October 2026: its 0.75 measured nothing.
  confidence?: number | null
}

export interface AgentPathPayload {
  id?: string
  userId?: string
  userProfile?: any
  generatedAt?: string
  updatedAt?: string
  path?: any
  races?: any[]
  recommendations?: any
  schedule?: any[]
  explanations?: string[]
  agentResponses?: AgentResponse[]
  milestones?: any[]
  tasks?: any[]
  lastAdaptation?: any
}

interface AgentPathContextValue {
  payload: AgentPathPayload | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  // Per-agent slices (result objects, not the wrapper)
  patternRecognition: any
  pathPlanning: any
  toolRecommendation: any
  calendarOptimization: any
  reflectionAnalysis: any
  adaptation: any
}

const Ctx = createContext<AgentPathContextValue | undefined>(undefined)

function pickAgent(payload: AgentPathPayload | null, id: string): any {
  if (!payload?.agentResponses) return undefined
  return payload.agentResponses.find((r) => r.agentId === id)?.result
}

export function AgentPathProvider({ children }: { children: ReactNode }) {
  const { supabaseUser } = useAuth()
  const [payload, setPayload] = useState<AgentPathPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The load whose answer counts: an answer to an earlier one (another account's, or a plan since replaced) is
  // dropped, and whose plan is on screen, so another account's is never left showing while this one's loads.
  const generation = useRef(0)
  const shownFor = useRef<string | null>(null)

  const load = async () => {
    const run = ++generation.current
    if (!supabaseUser) {
      shownFor.current = null
      setPayload(null)
      return
    }
    const pathId = supabaseUser.user_metadata?.path_id
    const userId = supabaseUser.id
    if (shownFor.current !== userId) {
      shownFor.current = userId
      setPayload(null)
    }
    setLoading(true)
    setError(null)
    const show = (next: AgentPathPayload | null) => {
      // Goals taken out in "Your Goals, Dreams & Obstacles" stay in the
      // plan but no page shows them (lib/hiddenGoals.ts).
      if (generation.current === run) setPayload(next ? withoutHiddenGoals(next) : null)
    }
    try {
      // These endpoints require a session — they used to return a user's full
      // profile to anyone holding their UUID. /api/me/path takes the token too.
      const authHeaders = await backendAuthHeaders()
      // 1. Prefer the Next.js /api/me/path route, which reads user_paths
      //    directly from Supabase and works on Vercel without FastAPI. An
      //    answer with no plan (payload: null) means there is none: the backend
      //    has nothing more, so it isn't asked as well (people with no plan
      //    waited for it to wake). Only a network error or a 5xx falls back.
      let fallBack = false
      try {
        const meRes = await fetch('/api/me/path', { cache: 'no-store', credentials: 'include', headers: authHeaders })
        if (meRes.ok) {
          const json = await meRes.json()
          show((json?.payload as AgentPathPayload) || null)
          return
        }
        fallBack = meRes.status >= 500
        if (!fallBack) {
          show(null)
          if (generation.current === run) setError(`Path fetch returned ${meRes.status}`)
          return
        }
      } catch {
        fallBack = true
      }

      // 2. Fallback: FastAPI, when the route couldn't be reached or failed.
      //    Bounded: the backend can take over a minute to wake
      //    (lib/backendTimeout.ts).
      let res: Response | null = null
      if (pathId) {
        res = await fetchWithTimeout(`${API_URL}/api/onboarding/path/${pathId}`, { headers: authHeaders })
      }
      if ((!res || !res.ok) && userId) {
        res = await fetchWithTimeout(`${API_URL}/api/onboarding/user/${userId}/path`, { headers: authHeaders })
      }
      if (res && res.ok) {
        show(await res.json())
      } else {
        show(null)
        if (res && generation.current === run) setError(`Path fetch returned ${res.status}`)
      }
    } catch (e: any) {
      if (generation.current === run) {
        setError(isTimeout(e) ? TAKING_LONGER : e?.message || 'Failed to load agent path')
        setPayload(null)
      }
    } finally {
      if (generation.current === run) setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Re-run when the user changes OR when a new path_id is written to
    // supabase metadata (i.e. immediately after a fresh onboarding).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUser?.id, supabaseUser?.user_metadata?.path_id])

  const value = useMemo<AgentPathContextValue>(
    () => ({
      payload,
      loading,
      error,
      refresh: load,
      patternRecognition: pickAgent(payload, 'pattern_recognition'),
      pathPlanning: pickAgent(payload, 'path_planning'),
      toolRecommendation: pickAgent(payload, 'tool_recommendation'),
      calendarOptimization: pickAgent(payload, 'calendar_optimization'),
      reflectionAnalysis: pickAgent(payload, 'reflection_analysis'),
      adaptation: pickAgent(payload, 'adaptation'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload, loading, error]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAgentPath() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAgentPath must be used inside <AgentPathProvider>')
  return v
}
