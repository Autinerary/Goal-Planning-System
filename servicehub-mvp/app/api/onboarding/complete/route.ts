import { relationshipFromConnection } from '@/lib/trust/relationship'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateUserEmbeddingJob } from '@/lib/embeddings/background-jobs'
import { orchestrator } from '@/lib/agents/orchestrator'
import type { UserRequest } from '@/lib/agents/orchestrator/types'
import type { Json, Location } from '@/types/database'
import { geocodeLocation } from '@/lib/geocode'
import { findNorm, findRole } from '@/lib/onboarding/setup'
import { clientIp, rateLimited, TOO_MANY_MESSAGE } from '@/lib/rateLimit'
import {
  summarizeSupportContext,
  type FunctionalSupportContext,
} from '@/lib/agents/recommendation-agent/support-context'

interface OnboardingData {
  role: string | null
  location: {
    city: string
    province: string
    country: string
  }
  barriers: Array<{
    id: string
    label: string
    category: string
    categoryLabel: string
    severity?: number
    notes?: string
    connectionType?: string
  }>
  lifeStage: string
  goals: string[]
  culturalNotes: string
  additionalNotes: string
  supportContext?: FunctionalSupportContext
}

// Each call can make paid AI calls (lib/llm.ts) and a geocoding request
// (Nominatim allows one a second). Signed-out calls are limited per address,
// signed-in ones per person (bug audit, 17 November 2026, item 16).
const SIGNED_OUT_PER_10_MINUTES = 20
const SIGNED_OUT_PER_DAY = 100
const SIGNED_IN_PER_10_MINUTES = 20

// Roles only the team gives (STEP 68): never written from here.
const TEAM_ROLES = new Set(['admin', 'moderator', 'banned'])

// Goal Planning sends who the person is here for as a connection type
// (lib/trust/relationship.ts); ResourceHub's own role ids are taken as they
// are. Anything else leaves the role unchanged: this route used to store
// whatever string it was sent in profiles.role.
const ROLE_FROM_CONNECTION: Record<string, string> = {
  self: 'self_advocate',
  parent: 'parent',
  sibling: 'parent',
  partner: 'parent',
  caregiver: 'caregiver',
  friend: 'caregiver',
  educator: 'professional',
  employer: 'professional',
  therapist: 'professional',
  researcher: 'professional',
  medical: 'professional',
  coworker: 'professional',
}

const MAX_NORMS = 30
const MAX_PLACE = 100
const MAX_NOTES = 200

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')

function roleFor(raw: string): string | null {
  return findRole(raw)?.id ?? ROLE_FROM_CONNECTION[raw] ?? null
}

interface CleanNorm {
  id: string
  group: string
  severity: number | null
  notes: string | null
  connectionType: string
}

/**
 * Only norms from the shared list (lib/norms/taxonomy.ts), each once, filed
 * under the list's own group; severity 1 to 5 or nothing; short notes. The
 * category and id used to be stored as sent.
 */
function cleanNorms(raw: unknown): CleanNorm[] {
  const out: CleanNorm[] = []
  const seen = new Set<string>()
  for (const b of Array.isArray(raw) ? raw.slice(0, 100) : []) {
    const norm = findNorm(text((b as any)?.id, 80).toLowerCase())
    if (!norm || seen.has(norm.id)) continue
    seen.add(norm.id)
    const severity = Number((b as any)?.severity)
    out.push({
      id: norm.id,
      group: norm.group,
      severity: Number.isInteger(severity) && severity >= 1 && severity <= 5 ? severity : null,
      notes: text((b as any)?.notes, MAX_NOTES) || null,
      connectionType: text((b as any)?.connectionType, 40).toLowerCase(),
    })
    if (out.length >= MAX_NORMS) break
  }
  return out
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Check authentication - but allow unauthenticated users for Goal Planning integration
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    let body: OnboardingData
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // If no user, we'll still process the data but won't persist it
    // This allows Goal Planning to get recommendations without requiring ServiceHub login
    const isAuthenticated = !authError && user !== null

    // Validate required fields
    const rawRole = text(body?.role, 40).toLowerCase()
    if (!rawRole) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }

    const norms = cleanNorms(body?.barriers)
    if (norms.length === 0) {
      return NextResponse.json({ error: 'Choose at least one norm.' }, { status: 400 })
    }

    if (!body?.lifeStage || !body?.goals || !((body.goals as unknown[]).length > 0)) {
      return NextResponse.json(
        { error: 'Life stage and goals are required' },
        { status: 400 }
      )
    }

    const limited =
      isAuthenticated && user
        ? rateLimited('onboarding-complete-user', user.id, SIGNED_IN_PER_10_MINUTES, 10 * 60_000)
        : rateLimited('onboarding-complete-ip-10m', clientIp(request.headers), SIGNED_OUT_PER_10_MINUTES, 10 * 60_000) ||
          rateLimited('onboarding-complete-ip-day', clientIp(request.headers), SIGNED_OUT_PER_DAY, 24 * 60 * 60_000)
    if (limited) {
      return NextResponse.json({ error: TOO_MANY_MESSAGE, recommendations: [] }, { status: 429 })
    }

    // Location is optional. Goal Planning's onboarding tells people it is,
    // and a missing location just means "near you" sorting cannot apply.
    const city = text(body?.location?.city, MAX_PLACE)
    const province = text(body?.location?.province, MAX_PLACE)
    const country = text(body?.location?.country, MAX_PLACE)
    const hasLocation = Boolean(city)

    // Convert barriers to agent format
    const barriers = norms.map((n) => ({
      category: n.group,
      type: n.id,
      severity: n.severity ?? undefined,
      notes: n.notes ?? undefined,
    }))

    // Geocode the city/province/country to lat/lng so the 'nearest to you'
    // distance features work for goal-planning users (whose onboarding only
    // collects location as plain text). Falls back to null on failure.
    const coords = hasLocation ? await geocodeLocation({ city, province, country }) : null

    // Convert location to Location type (none when the person skipped it)
    const location: Location | undefined = hasLocation
      ? {
          city,
          province,
          country,
          address: '',
          lat: coords?.lat ?? 0,
          lng: coords?.lng ?? 0,
          postal_code: '',
        }
      : undefined

    // Only persist data if user is authenticated
    let userId = user?.id || 'anonymous'
    let barriersAdded = 0

    if (isAuthenticated && user) {
      // Update user profile (with geocoded coords so distance search works)
      // A skipped location must not blank one the person already saved, and
      // a role the team gave (admin, moderator, banned) is never changed here.
      const { data: current } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const role = roleFor(rawRole)
      const profileChanges: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (role && !TEAM_ROLES.has(String(current?.role || ''))) profileChanges.role = role
      // profiles.location is JSON; Location is its shape.
      if (location) profileChanges.location = location as unknown as Json

      const { data: updated, error: profileError } = await supabase
        .from('profiles')
        .update(profileChanges)
        .eq('id', user.id)
        .select('id')
      if (profileError || !updated || updated.length === 0) {
        console.error('[onboarding/complete] profile not saved:', profileError?.message || 'no profile row')
        return NextResponse.json(
          { error: 'Failed to update profile' },
          { status: 500 }
        )
      }

      // Each norm once: one already on the profile is updated, not added
      // again (a repeat call used to add every norm a second time).
      const { data: existingRows, error: existingError } = await supabase
        .from('user_barriers')
        .select('barrier_type')
        .eq('user_id', user.id)
      if (existingError) {
        console.error('[onboarding/complete] norms not read:', existingError.message)
        return NextResponse.json({ error: 'Failed to save your norms' }, { status: 500 })
      }
      // Stored as typed before the shared list (e.g. 'ADHD'), so matched without case.
      const existing = new Map<string, string[]>()
      for (const r of (existingRows || []) as { barrier_type: string | null }[]) {
        const stored = String(r.barrier_type || '')
        const key = stored.trim().toLowerCase()
        if (key) existing.set(key, [...(existing.get(key) || []), stored])
      }

      const results = await Promise.all(
        norms.map(async (norm) => {
          const stored = existing.get(norm.id)
          if (stored) {
            const changes: Record<string, unknown> = {}
            if (norm.severity !== null) changes.severity = norm.severity
            if (norm.notes) changes.notes = norm.notes
            if (Object.keys(changes).length === 0) return true
            const { error } = await supabase
              .from('user_barriers')
              .update(changes)
              .eq('user_id', user.id)
              .in('barrier_type', stored)
            if (error) console.error('[onboarding/complete] norm not updated:', error.message)
            return !error
          }
          // Whose experience this is (Odosa). Goal Planning onboarding already
          // asks (connectionTypes: self / parent / educator / ally …) but used
          // to discard the per-norm answer — it drives rating weight now.
          // `role` is the connectionType Goal Planning derives (self / parent /
          // educator / ally …); a per-barrier override wins when present.
          const connection = norm.connectionType || rawRole
          const { error } = await supabase.from('user_barriers').insert({
            user_id: user.id,
            barrier_category: norm.group,
            barrier_type: norm.id,
            ...(norm.severity !== null ? { severity: norm.severity } : {}),
            ...(norm.notes ? { notes: norm.notes } : {}),
            relationship: relationshipFromConnection(connection),
            // Picking a connection type in onboarding IS a declaration.
            relationship_declared: !!connection,
          })
          if (error) console.error('[onboarding/complete] norm not added:', error.message)
          return !error
        })
      )

      barriersAdded = results.filter(Boolean).length

      // Generate user embedding in background (non-blocking)
      setImmediate(() => {
        generateUserEmbeddingJob(user.id).catch((error) => {
          console.error('Error generating user embedding:', error)
        })
      })
    } else {
      // Log data for unauthenticated users (for analytics/debugging)
      console.log('Onboarding data received from unauthenticated user:', {
        role: roleFor(rawRole),
        hasLocation,
        barriersCount: norms.length,
        goalsCount: Array.isArray(body.goals) ? body.goals.length : 0,
      })
    }

    // Generate AI recommendations using orchestrator
    let recommendations: any[] = []
    let recommendationExplanation = ''
    let recommendationConfidence = 0

    try {
      const supportSummary = summarizeSupportContext(
        body.supportContext && typeof body.supportContext === 'object' ? body.supportContext : undefined
      )
      const userRequest: UserRequest = {
        userId: userId,
        requestType: 'recommendations',
        context: {
          location,
          isNewUser: true,
          needsDeepInsights: true,
          context: supportSummary,
        },
        barriers,
      }

      const orchestrationResult = await orchestrator.handleRequest(userRequest)
      const recommendationOutput = orchestrationResult.agentOutputs.RecommendationAgent

      if (recommendationOutput && recommendationOutput.resources) {
        recommendations = recommendationOutput.resources.slice(0, 12) // Top 12 recommendations
        recommendationExplanation = orchestrationResult.explanation || recommendationOutput.explanations?.[0] || ''
        recommendationConfidence = recommendationOutput.confidence || orchestrationResult.metadata?.synthesis?.confidence || 0
      }
    } catch (error) {
      console.error('Error generating recommendations:', error)
      // Continue without recommendations - don't fail the onboarding
    }

    return NextResponse.json({
      message: isAuthenticated
        ? 'Onboarding completed successfully'
        : 'Onboarding data received. Sign in to ResourceHub to save your profile and get personalized recommendations.',
      userId: userId,
      barriersAdded,
      recommendations: recommendations.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        price: typeof r.price === 'number' ? r.price : null,
        location: r.location,
        averageRating: r.averageRating || 0,
        ratingCount: r.ratingCount || 0,
        score: r.score || 0,
        explanation: r.explanation || '',
      })),
      recommendationExplanation,
      recommendationConfidence,
      requiresAuth: !isAuthenticated,
    })
  } catch (error) {
    console.error('Error completing onboarding:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
