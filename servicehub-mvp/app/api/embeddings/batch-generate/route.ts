import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    const results = {
      users: { processed: 0, generated: 0, errors: 0 },
      resources: { processed: 0, generated: 0, errors: 0 },
    }

    // Generate embeddings for users without embeddings
    if (type === 'all' || type === 'users') {
      // Find users without embeddings
      const { data: usersWithoutEmbeddings, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .not(
          'id',
          'in',
          supabase
            .from('user_embeddings')
            .select('user_id')
            .then(({ data }) => `(${(data || []).map((r) => `'${r.user_id}'`).join(',') || 'null'})`)
        )
        .limit(limit)

      if (usersError) {
        console.error('Error fetching users without embeddings:', usersError)
      } else {
        const users = usersWithoutEmbeddings || []
        results.users.processed = users.length

        for (const user of users) {
          try {
            const success = await onUserBarriersLoadedFromDB(user.id)
            if (success) {
              results.users.generated++
            } else {
              results.users.errors++
            }
          } catch (error) {
            console.error(`Error generating embedding for user ${user.id}:`, error)
            results.users.errors++
          }
        }
      }

      // Alternative: Find users with barriers but no embeddings
      // This is more efficient - only check users who have barriers
      const { data: usersWithBarriers } = await supabase
        .from('user_barriers')
        .select('user_id')
        .limit(limit)

      if (usersWithBarriers) {
        const userIds = [...new Set(usersWithBarriers.map((b) => b.user_id))]

        // Check which ones don't have embeddings
        const { data: existingEmbeddings } = await supabase
          .from('user_embeddings')
          .select('user_id')
          .in('user_id', userIds)

        const existingUserIds = new Set((existingEmbeddings || []).map((e) => e.user_id))
        const usersNeedingEmbeddings = userIds.filter((id) => !existingUserIds.has(id))

        results.users.processed = usersNeedingEmbeddings.length

        for (const userId of usersNeedingEmbeddings.slice(0, limit)) {
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

    // Generate embeddings for resources without embeddings
    if (type === 'all' || type === 'resources') {
      // Find approved resources without embeddings
      const { data: resourcesWithoutEmbeddings, error: resourcesError } = await supabase
        .from('resources')
        .select('*')
        .eq('status', 'approved')
        .not(
          'id',
          'in',
          supabase
            .from('resource_embeddings')
            .select('resource_id')
            .then(({ data }) =>
              `(${(data || []).map((r) => `'${r.resource_id}'`).join(',') || 'null'})`
            )
        )
        .limit(limit)

      if (resourcesError) {
        console.error('Error fetching resources without embeddings:', resourcesError)
      } else {
        const resources = resourcesWithoutEmbeddings || []
        results.resources.processed = resources.length

        for (const resource of resources) {
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

      // More efficient: Check existing embeddings first
      const { data: allResources } = await supabase
        .from('resources')
        .select('*')
        .eq('status', 'approved')
        .limit(limit * 2)

      const { data: existingResourceEmbeddings } = await supabase
        .from('resource_embeddings')
        .select('resource_id')

      const existingResourceIds = new Set(
        (existingResourceEmbeddings || []).map((e) => e.resource_id)
      )
      const resourcesNeedingEmbeddings = (allResources || []).filter(
        (r) => !existingResourceIds.has(r.id)
      )

      results.resources.processed = resourcesNeedingEmbeddings.length

      for (const resource of resourcesNeedingEmbeddings.slice(0, limit)) {
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

    // Count users with barriers but no embeddings
    const { data: usersWithBarriers } = await supabase
      .from('user_barriers')
      .select('user_id', { count: 'exact', head: false })

    const uniqueUserIds = new Set((usersWithBarriers || []).map((b) => b.user_id))

    const { count: usersWithEmbeddings } = await supabase
      .from('user_embeddings')
      .select('user_id', { count: 'exact', head: true })
      .in('user_id', Array.from(uniqueUserIds))

    const usersNeedingEmbeddings = uniqueUserIds.size - (usersWithEmbeddings || 0)

    // Count approved resources without embeddings
    const { count: totalApprovedResources } = await supabase
      .from('resources')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')

    const { count: resourcesWithEmbeddings } = await supabase
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