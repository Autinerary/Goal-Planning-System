import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveResource, unsaveResource } from '@/lib/supabase/queries'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notes } = await request.json().catch(() => ({}))
    const result = await saveResource(user.id, params.id, notes)

    if (!result) {
      return NextResponse.json({ error: 'Failed to save resource' }, { status: 500 })
    }

    return NextResponse.json({ success: true, saved: result })
  } catch (error) {
    console.error('Error saving resource:', error)
    return NextResponse.json({ error: 'Failed to save resource' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const success = await unsaveResource(user.id, params.id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to unsave resource' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unsaving resource:', error)
    return NextResponse.json({ error: 'Failed to unsave resource' }, { status: 500 })
  }
}