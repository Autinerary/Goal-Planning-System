import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminUsersPage from '@/components/admin/AdminUsersPage'

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: { role?: string; sort?: string; page?: string }
}) {
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
      <AdminUsersPage
        userId={user.id}
        initialRole={searchParams.role}
        initialSort={searchParams.sort}
        initialPage={searchParams.page ? Number(searchParams.page) : 1}
      />
    </div>
  )
}