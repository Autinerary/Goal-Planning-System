import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccessibilitySettingsClient from '@/components/settings/AccessibilitySettingsClient'

export default async function AccessibilitySettingsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AccessibilitySettingsClient userId={user.id} />
    </div>
  )
}