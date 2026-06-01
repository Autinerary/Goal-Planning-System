import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateSavedResourceStatus } from '@/lib/supabase/queries'

export async function PATCH(
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

    const resourceId = params.id
    const body = await request.json()
    const { status } = body

    if (!status || !['wishlist', 'current', 'past'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Verify the saved resource belongs to the user
    const { data: savedResource, error: fetchError } = await supabase
      .from('saved_resources')
      .select('user_id')
      .eq('resource_id', resourceId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !savedResource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    }

    // Update status
    const updated = await updateSavedResourceStatus(user.id, resourceId, status)

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    return NextResponse.json({ success: true, savedResource: updated })
  } catch (error) {
    console.error('Error updating saved resource status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
