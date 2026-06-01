import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NotificationsPageClient from '@/components/notifications/NotificationsPageClient'

export default async function NotificationsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NotificationsPageClient userId={user.id} />
    </div>
  )
}