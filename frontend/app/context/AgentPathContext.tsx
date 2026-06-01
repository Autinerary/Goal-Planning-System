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

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface AgentResponse {
  agentId: string
  agentName: string
  result: any
  confidence?: number
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

  const load = async () => {
    if (!supabaseUser) {
      setPayload(null)
      return
    }
    setLoading(true)
    setError(null)
    const pathId = supabaseUser.user_metadata?.path_id
    const userId = supabaseUser.id
    try {
      let res: Response | null = null
      if (pathId) {
        res = await fetch(`${API_URL}/api/onboarding/path/${pathId}`)
      }
      if ((!res || !res.ok) && userId) {
        res = await fetch(`${API_URL}/api/onboarding/user/${userId}/path`)
      }
      if (res && res.ok) {
        setPayload(await res.json())
      } else {
        setPayload(null)
        if (res) setError(`Path fetch returned ${res.status}`)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load agent path')
      setPayload(null)
    } finally {
      setLoading(false)
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
