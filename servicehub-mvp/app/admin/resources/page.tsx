import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminResourcesPage from '@/components/admin/AdminResourcesPage'

export default async function ResourcesAdminPage({
  searchParams,
}: {
  searchParams: { status?: string; category?: string; page?: string }
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
      <AdminResourcesPage
        userId={user.id}
        initialStatus={searchParams.status}
        initialCategory={searchParams.category}
        initialPage={searchParams.page ? Number(searchParams.page) : 1}
      />
    </div>
  )
}