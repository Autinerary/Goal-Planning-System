import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PriorUseQueue from '@/components/admin/PriorUseQueue'
import { isAdminUser } from '@/lib/auth/admin'

export const metadata = { title: 'Proof of use | ResourceHub admin' }

/** Claims to have used a service before joining, waiting for the proof to be checked (Goal 5, STEP 79). */
export default async function ProofOfUsePage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/proof-of-use')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!(await isAdminUser(supabase, profile?.role))) redirect('/')
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PriorUseQueue />
    </div>
  )
}
