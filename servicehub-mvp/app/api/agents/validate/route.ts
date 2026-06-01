import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validationAgent } from '@/lib/agents/validation-agent'
import { getUserHistory } from '@/lib/agents/validation-agent/trust-scorer'
import type { ValidationAgentInput } from '@/lib/agents/validation-agent/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { itemType, item } = body

    if (!itemType || !item) {
      return NextResponse.json(
        { error: 'Missing required fields: itemType and item' },
        { status: 400 }
      )
    }

    // Validate itemType
    if (!['rating', 'resource', 'user'].includes(itemType)) {
      return NextResponse.json(
        { error: 'Invalid itemType. Must be: rating, resource, or user' },
        { status: 400 }
      )
    }

    // Get user history for context
    const userHistory = await getUserHistory(user.id)

    // Prepare validation input
    const validationInput: ValidationAgentInput = {
      itemType,
      item,
      context: {
        userId: user.id,
        userHistory,
      },
    }

    // Validate using agent
    const result = await validationAgent.validate(validationInput)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in validation API:', error)
    return NextResponse.json(
      {
        error: 'Failed to validate content',
        decision: 'flag_for_review',
        confidence: 0,
        reasons: ['Validation error occurred'],
        trustScore: 50,
        recommendedAction: 'Hold for manual review',
      },
      { status: 500 }
    )
  }
}