import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const MAX_CONDITIONS = 80
const MAX_SUBTYPES = 20
const MAX_SHORT_TEXT = 200
const MAX_LONG_TEXT = 2000

function limitedString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function sanitizeProfile(input: any) {
  const conditions = Array.isArray(input?.conditions)
    ? input.conditions.slice(0, MAX_CONDITIONS).map((condition: any) => ({
        conditionId: limitedString(condition?.conditionId, MAX_SHORT_TEXT),
        conditionLabel: limitedString(condition?.conditionLabel, MAX_SHORT_TEXT),
        status: ['diagnosed', 'self_identified', 'exploring', 'prefer_not_to_say'].includes(condition?.status)
          ? condition.status
          : 'prefer_not_to_say',
        subtypeIds: Array.isArray(condition?.subtypeIds)
          ? condition.subtypeIds.slice(0, MAX_SUBTYPES).map((item: unknown) => limitedString(item, MAX_SHORT_TEXT)).filter(Boolean)
          : [],
        notes: limitedString(condition?.notes, MAX_LONG_TEXT),
      })).filter((condition: { conditionId: string; conditionLabel: string }) => condition.conditionId && condition.conditionLabel)
    : []

  const support = input?.supportContext && typeof input.supportContext === 'object'
    ? input.supportContext
    : {}

  return {
    version: 1,
    consentToStore: true,
    conditions,
    supportContext: {
      therapyHours: limitedString(support.therapyHours, MAX_SHORT_TEXT),
      therapyTypes: limitedString(support.therapyTypes, MAX_LONG_TEXT),
      medicationHistory: ['yes', 'no', 'prefer_not_to_say'].includes(support.medicationHistory)
        ? support.medicationHistory
        : '',
      sensoryNeeds: limitedString(support.sensoryNeeds, MAX_LONG_TEXT),
      strategiesWorked: limitedString(support.strategiesWorked, MAX_LONG_TEXT),
      strategiesNotWorked: limitedString(support.strategiesNotWorked, MAX_LONG_TEXT),
      schoolAccommodations: limitedString(support.schoolAccommodations, MAX_LONG_TEXT),
      workplaceAccommodations: limitedString(support.workplaceAccommodations, MAX_LONG_TEXT),
      biggestChallenge: limitedString(support.biggestChallenge, MAX_LONG_TEXT),
      biggestChallengeResponse: limitedString(support.biggestChallengeResponse, MAX_LONG_TEXT),
      recentChallenge: limitedString(support.recentChallenge, MAX_LONG_TEXT),
      recentChallengeResponse: limitedString(support.recentChallengeResponse, MAX_LONG_TEXT),
    },
  }
}

async function authenticatedUser() {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return { supabase, user: error ? null : user }
}

export async function GET() {
  const { supabase, user } = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_diagnostic_profiles')
    .select('profile, consented_at, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ diagnosticProfile: data ?? null })
}

export async function PUT(request: NextRequest) {
  const { supabase, user } = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let input: any
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (input?.consentToStore !== true) {
    return NextResponse.json({ error: 'Explicit consent is required' }, { status: 400 })
  }

  const profile = sanitizeProfile(input)
  const now = new Date().toISOString()

  // Ensure the FK target exists for accounts created before profile triggers
  // were installed. RLS limits this write to the authenticated user's own id.
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: user.id, email: user.email }, { onConflict: 'id' })

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  const { data, error } = await supabase
    .from('user_diagnostic_profiles')
    .upsert(
      {
        user_id: user.id,
        profile,
        consented_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )
    .select('profile, consented_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ diagnosticProfile: data })
}

export async function DELETE() {
  const { supabase, user } = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { error } = await supabase
    .from('user_diagnostic_profiles')
    .delete()
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
