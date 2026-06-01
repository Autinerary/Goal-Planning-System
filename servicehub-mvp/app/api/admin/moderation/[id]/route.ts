import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { decision, notes } = body

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
    }

    // Get moderation item
    const { data: item, error: itemError } = await supabase
      .from('moderation_queue')
      .select('*')
      .eq('id', params.id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Check if admin decision differs from agent decision
    const agentDecision = item.agent_decision
    const adminOverrides = decision === 'approved' && agentDecision === 'reject'

    // Update moderation queue
    const { error: updateError } = await supabase
      .from('moderation_queue')
      .update({
        status: decision,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
        admin_override: adminOverrides,
      })
      .eq('id', params.id)

    if (updateError) {
      throw updateError
    }

    // Update the actual item (rating or resource) status
    if (item.item_type === 'rating') {
      // Ratings don't have status - they're either created or not
      // Could add a hidden field or soft delete
    } else if (item.item_type === 'resource') {
      const resourceStatus = decision === 'approved' ? 'approved' : 'rejected'
      await supabase
        .from('resources')
        .update({ status: resourceStatus })
        .eq('id', item.item_id)
    }

    return NextResponse.json({ success: true, overrides: adminOverrides })
  } catch (error) {
    console.error('Error reviewing moderation item:', error)
    return NextResponse.json({ error: 'Failed to review item' }, { status: 500 })
  }
}