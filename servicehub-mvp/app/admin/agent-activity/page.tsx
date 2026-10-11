import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AgentActivityDashboard from '@/components/admin/AgentActivityDashboard'
import { isAdminUser } from '@/lib/auth/admin'

export default async function AgentActivityPage() {
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

  if (!(await isAdminUser(supabase, profile?.role))) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AgentActivityDashboard userId={user.id} />
    </div>
  )
}