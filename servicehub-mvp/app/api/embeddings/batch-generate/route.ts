import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { onUserBarriersLoadedFromDB, onResourceCreated } from '@/lib/embeddings/auto-generate'
import type { Resource } from '@/types/database'

/**
 * POST /api/embeddings/batch-generate
 * Batch generate embeddings for users and resources that are missing them
 * Can be called manually or by cron job
 */
/**
 * Allow either an authenticated admin user OR a Vercel cron / scripted caller bearing
 * `Authorization: Bearer ${process.env.CRON_SECRET}`. Without this gate the endpoint is
 * a public cost/DoS vector — embedding generation loads an 80MB model and runs over
 * every user + resource.
 */
async function isAuthorized(request: NextRequest, supabase: ReturnType<typeof createClient>): Promise<boolean> {
  // Vercel cron hits set this header automatically when CRON_SECRET is configured.
  if (request.headers.get('x-vercel-cron') === '1') return true

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`) {
    return true
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    if (!(await isAuthorized(request, supabase))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { type = 'all', limit = 100 } = body // type: 'users' | 'resources' | 'all'

    // Admin client is required to scan candidates across all users \u2014 the
    // session client (anon role) cannot see other users' `user_barriers` rows
    // because of RLS, and `resource_embeddings` writes are blocked entirely
    // outside service-role.
    const admin = createAdminClient()

    const results = {
      users: { processed: 0, generated: 0, errors: 0 },
      resources: { processed: 0, generated: 0, errors: 0 },
    }

    // Generate embeddings for users with barriers but no embedding yet
    if (type === 'all' || type === 'users') {
      const { data: usersWithBarriers, error: barriersError } = await admin
        .from('user_barriers')
        .select('user_id')

      if (barriersError) {
        console.error('Error fetching users with barriers:', barriersError)
      } else {
        const uniqueUserIds = [...new Set((usersWithBarriers || []).map((b) => b.user_id))]

        const { data: existingEmbeddings } = await admin
          .from('user_embeddings')
          .select('user_id')
          .in('user_id', uniqueUserIds)

        const existingUserIds = new Set((existingEmbeddings || []).map((e) => e.user_id))
        const usersNeedingEmbeddings = uniqueUserIds
          .filter((id) => !existingUserIds.has(id))
          .slice(0, limit)

        results.users.processed = usersNeedingEmbeddings.length

        for (const userId of usersNeedingEmbeddings) {
          try {
            const success = await onUserBarriersLoadedFromDB(userId)
            if (success) {
              results.users.generated++
            } else {
              results.users.errors++
            }
          } catch (error) {
            console.error(`Error generating embedding for user ${userId}:`, error)
            results.users.errors++
          }
        }
      }
    }

    // Generate embeddings for approved resources without an embedding yet
    if (type === 'all' || type === 'resources') {
      const { data: allResources, error: resourcesError } = await admin
        .from('resources')
        .select('*')
        .eq('status', 'approved')

      if (resourcesError) {
        console.error('Error fetching approved resources:', resourcesError)
      } else {
        const { data: existingResourceEmbeddings } = await admin
          .from('resource_embeddings')
          .select('resource_id')

        const existingResourceIds = new Set(
          (existingResourceEmbeddings || []).map((e) => e.resource_id)
        )
        const resourcesNeedingEmbeddings = (allResources || [])
          .filter((r) => !existingResourceIds.has(r.id))
          .slice(0, limit)

        results.resources.processed = resourcesNeedingEmbeddings.length

        for (const resource of resourcesNeedingEmbeddings) {
          try {
            const success = await onResourceCreated(resource as Resource)
            if (success) {
              results.resources.generated++
            } else {
              results.resources.errors++
            }
          } catch (error) {
            console.error(`Error generating embedding for resource ${resource.id}:`, error)
            results.resources.errors++
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${results.users.processed} users and ${results.resources.processed} resources`,
    })
  } catch (error) {
    console.error('Error in batch generate embeddings:', error)
    return NextResponse.json({ error: 'Failed to batch generate embeddings' }, { status: 500 })
  }
}

/**
 * GET /api/embeddings/batch-generate
 * Get statistics on missing embeddings (admin / cron only — same auth as POST).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    if (!(await isAuthorized(request, supabase))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin client required to count across all users (anon role can't see
    // other users' user_barriers / user_embeddings rows).
    const admin = createAdminClient()

    // Count users with barriers but no embeddings
    const { data: usersWithBarriers } = await admin
      .from('user_barriers')
      .select('user_id', { count: 'exact', head: false })

    const uniqueUserIds = new Set((usersWithBarriers || []).map((b) => b.user_id))

    const { count: usersWithEmbeddings } = await admin
      .from('user_embeddings')
      .select('user_id', { count: 'exact', head: true })
      .in('user_id', Array.from(uniqueUserIds))

    const usersNeedingEmbeddings = uniqueUserIds.size - (usersWithEmbeddings || 0)

    // Count approved resources without embeddings
    const { count: totalApprovedResources } = await admin
      .from('resources')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')

    const { count: resourcesWithEmbeddings } = await admin
      .from('resource_embeddings')
      .select('resource_id', { count: 'exact', head: true })

    const resourcesNeedingEmbeddings =
      (totalApprovedResources || 0) - (resourcesWithEmbeddings || 0)

    return NextResponse.json({
      users: {
        withBarriers: uniqueUserIds.size,
        withEmbeddings: usersWithEmbeddings || 0,
        needingEmbeddings: usersNeedingEmbeddings,
      },
      resources: {
        totalApproved: totalApprovedResources || 0,
        withEmbeddings: resourcesWithEmbeddings || 0,
        needingEmbeddings: resourcesNeedingEmbeddings,
      },
    })
  } catch (error) {
    console.error('Error getting embedding stats:', error)
    return NextResponse.json({ error: 'Failed to get embedding stats' }, { status: 500 })
  }
}