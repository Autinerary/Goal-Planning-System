import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/auth/admin'

const ROLES = ['user', 'moderator', 'admin', 'banned']

/**
 * Change someone's role (including banning). The caller is checked with
 * their own session; the change is made with the server key. With the
 * session it changed nothing: a person can update only their own profile
 * row, so "Ban" answered success and left the role as it was.
 */

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

    if (!(await isAdminUser(supabase, profile?.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { role } = await request.json()
    const userId = params.id
    if (!ROLES.includes(role)) {
      return NextResponse.json({ error: 'Unknown role' }, { status: 400 })
    }
    if (userId === user.id) {
      return NextResponse.json({ error: 'You can’t change your own role here.' }, { status: 400 })
    }

    // Update user role
    const { data: changed, error } = await createAdminClient()
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select('id, role')

    if (error) throw error
    if (!changed?.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, role: changed[0].role })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}