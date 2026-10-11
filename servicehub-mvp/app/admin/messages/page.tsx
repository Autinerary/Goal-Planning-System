import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MessageReportsDashboard from '@/components/admin/MessageReportsDashboard'

/** Reported messages from Hare World, for the team (STEPs 66 and 67). */
export default async function MessageReportsPage() {
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
      <MessageReportsDashboard />
    </div>
  )
}
