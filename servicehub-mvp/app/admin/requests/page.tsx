import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RequestsQueue from '@/components/admin/RequestsQueue'
import { isAdminUser } from '@/lib/auth/admin'

export const metadata = { title: 'Requests | ResourceHub admin' }

/** Claims, listing changes, promotions, Spot Guide applications and free-access requests (STEP 81). */
export default async function RequestsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/requests')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(await isAdminUser(supabase, profile?.role))) redirect('/')
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <RequestsQueue />
    </div>
  )
}
