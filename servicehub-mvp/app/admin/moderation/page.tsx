import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ModerationDashboard from '@/components/admin/ModerationDashboard'

export default async function ModerationPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ModerationDashboard userId={user.id} />
    </div>
  )
}