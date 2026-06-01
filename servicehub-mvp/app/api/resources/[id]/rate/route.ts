import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResourceById } from '@/lib/supabase/queries'
import { getUserBarriers } from '@/lib/supabase/queries'
import { getRatingByUserAndResource } from '@/lib/supabase/queries'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch resource
    const resource = await getResourceById(params.id)
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    }

    // Fetch user barriers
    const barriers = await getUserBarriers(user.id)

    // Check for existing rating
    const existingRating = await getRatingByUserAndResource(params.id, user.id)

    return NextResponse.json({
      resource,
      barriers,
      existingRating,
    })
  } catch (error) {
    console.error('Error fetching rating data:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}