import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOrUpdateRating, getRatingByUserAndResource, updateOwnRating } from '@/lib/supabase/queries'
import { isWaitBucket } from '@/lib/waits'
import { validationAgent } from '@/lib/agents/validation-agent'
import { getUserHistory } from '@/lib/agents/validation-agent/trust-scorer'
import { sendNotificationToMany } from '@/lib/notifications/service'
import { formatErrorForUser, createAppError, logError } from '@/lib/errors/handler'
import { recordRatingChange, recordRatingOutcome } from '@/lib/agents/recommendation-agent/memory'
import {
  attributeReward,
  ratingToReward,
} from '@/lib/agents/shared/servicehub-learning'
import type { ValidationAgentInput, ValidationAgentOutput } from '@/lib/agents/validation-agent/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { RATING_RULE, ratingAccess } from '@/lib/ratings/access'
import { CANT_POST_MESSAGE, isPostingBlockedError, postingBlockedReason } from '@/lib/community/client'
import { dropModerationEntry, enqueueModeration, heldForReview } from '@/lib/moderation/queue'
import type { BarrierScores } from '@/types/database'

type SessionClient = ReturnType<typeof createClient>

/**
 * The norms to attribute a rating's learning signal to: the person's own
 * norms, from the database. It used to take the keys of the barrier_scores
 * the browser sent, so anyone could credit a resource for any norm (bug
 * audit, 17 November 2026, item 11).
 */
async function ownNorms(supabase: SessionClient, userId: string): Promise<string[]> {
  try {
    const { data } = await supabase.from('user_barriers').select('barrier_type').eq('user_id', userId)
    return Array.from(new Set((data || []).map((r: any) => String(r.barrier_type || '').trim().toLowerCase()).filter(Boolean)))
  } catch {
    return []
  }
}

/** The scores as stored: whole numbers 1-5 under short keys, at most 30. Anything else is dropped. */
function cleanScores(raw: unknown): BarrierScores | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 30)) {
    const n = Number(v)
    if (k && k.length <= 60 && Number.isFinite(n) && n >= 1 && n <= 5) out[k] = Math.round(n)
  }
  return Object.keys(out).length > 0 ? (out as BarrierScores) : undefined
}

function validScore(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5
}

/** What the person is told when their account may not rate right now. */
function blockedResponse(message: string) {
  return NextResponse.json({ error: message, code: 'blocked' }, { status: 403 })
}

/**
 * Put a rating the validation agent flagged in the moderation queue, before
 * it is saved, so it is never shown unreviewed (item 25). Null when the queue
 * could not be written: the caller then saves nothing.
 */
async function holdForReview(ratingId: string, userId: string, result: ValidationAgentOutput): Promise<string | null> {
  return enqueueModeration({
    item_type: 'rating',
    item_id: ratingId,
    submitted_by: userId,
    agent_decision: result.decision,
    agent_confidence: result.confidence,
    agent_reasons: result.reasons,
  })
}

const QUEUE_DOWN = "We couldn't save your rating just now. Please try again in a minute."
/** A flagged edit of a rating that is already up (PUT). */
const EDIT_NOT_SAVED = 'That change couldn’t be saved as it is. Your rating is still there as it was. You could reword the change and try again.'

/**
 * GET /api/resources/[id]/ratings — the CALLER's own rating, if they have one.
 *
 * Odosa: "you can add & rate a resource more than once". At the database level
 * you cannot — ratings has UNIQUE(resource_id, user_id) and it is enforced.
 * But the Add Rating modal never checked, so it always said "Add Your Rating",
 * always POSTed, and createOrUpdateRating quietly turned that into an update.
 * You appeared to rate twice and were told it was submitted both times.
 *
 * This lets the modal know, so it can prefill and say it is editing. Only the
 * rating's public fields (and their wait) come back, never the row.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ existingRating: null })

  const existing = await getRatingByUserAndResource(params.id, user.id)
  return NextResponse.json({ existingRating: existing || null })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const error = createAppError('You must be signed in to rate resources', 'unauthorized', {
        statusCode: 401,
      })
      await logError(error, { action: 'create_rating', path: `/resources/${params.id}/ratings` })
      return NextResponse.json({ error: error.userMessage }, { status: 401 })
    }

    // A banned or paused account can't rate (item 9).
    const blocked = await postingBlockedReason(user.id)
    if (blocked) return blockedResponse(blocked)

    // Rating comes from experience (Goal 5, lib/ratings/access.ts).
    const access = await ratingAccess(supabase, params.id)
    if (!access.can_rate) {
      return NextResponse.json({ error: RATING_RULE, reason: 'not_eligible', access }, { status: 403 })
    }

    // Check if resource exists (read as the service: a hidden one, which
    // its team members may still rate, is not readable to them).
    const { data: resource, error: resourceError } = await createAdminClient()
      .from('resources')
      .select('id, name, status')
      .eq('id', params.id)
      .single()

    if (resourceError || !resource) {
      const error = createAppError('Resource not found', 'not-found', {
        statusCode: 404,
      })
      await logError(error, { action: 'create_rating', path: `/resources/${params.id}/ratings` })
      return NextResponse.json({ error: error.userMessage }, { status: 404 })
    }

    // Check if resource is approved (or hidden by the rating sweep, which
    // new ratings can bring back; not before STEP 79).
    if (!(resource.status === 'approved' || (resource.status === 'hidden' && !access.legacy))) {
      const error = createAppError('This resource is not yet approved for ratings', 'validation', {
        statusCode: 400,
      })
      return NextResponse.json({ error: error.userMessage }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const overall_score = body?.overall_score
    const barrier_scores = cleanScores(body?.barrier_scores)
    const comment: string | undefined = typeof body?.comment === 'string' ? body.comment.trim() || undefined : undefined
    // How long they waited (STEP 83), saved after the rating, so a rating still saves before it.
    const wait_bucket = isWaitBucket(body?.wait_bucket) ? body.wait_bucket : null

    if (!validScore(overall_score)) {
      const error = createAppError('Overall score must be between 1 and 5', 'validation', {
        statusCode: 400,
      })
      return NextResponse.json({ error: error.userMessage }, { status: 400 })
    }

    // Validate comment length
    if (comment && comment.length > 500) {
      return NextResponse.json({ error: 'Comment must be 500 characters or less' }, { status: 400 })
    }

    const previousRating = await getRatingByUserAndResource(params.id, user.id)

    // Validate using Validation Agent
    const userHistory = await getUserHistory(user.id)
    const validationInput: ValidationAgentInput = {
      itemType: 'rating',
      item: {
        // An existing rating being changed isn't a duplicate of itself.
        id: previousRating?.id,
        overall_score,
        barrier_scores,
        comment,
        resource_id: params.id,
        user_id: user.id,
      },
      context: {
        userId: user.id,
        userHistory,
      },
    }

    const validationResult = await validationAgent.validate(validationInput)

    // Handle validation decision
    if (validationResult.decision === 'reject') {
      return NextResponse.json(
        {
          error: 'Rating rejected by validation agent',
          reasons: validationResult.reasons,
          trustScore: validationResult.trustScore,
        },
        { status: 403 }
      )
    }

    // Snapshot the rater's OWN diagnostics (barrier_type -> severity 1-5) so the
    // nested breakdown can group area ratings by diagnostic feature + level,
    // without cross-user profile reads (RLS-safe: the rater reads their own).
    // Since STEP 105 the database moves this snapshot where only the service
    // reads it (lib/ratings/raterContext.ts).
    const rater_diagnostics: Record<string, number> = {}
    // Whose experience is this? (Odosa) Captured per norm so ratings can be
    // weighted by proximity — lived experience over ally — without ever
    // needing to verify identity.
    const rater_relationships: Record<string, string> = {}
    try {
      const { data: myBarriers } = await supabase
        .from('user_barriers')
        .select('barrier_type, severity, relationship, relationship_declared')
        .eq('user_id', user.id)
      for (const b of myBarriers || []) {
        const type = String((b as any).barrier_type || '').trim().toLowerCase()
        const sev = Number((b as any).severity)
        if (type) {
          rater_diagnostics[type] = sev >= 1 && sev <= 5 ? Math.round(sev) : 3
          // Only declared relationships are recorded — an undeclared rater is
          // weighted as lived (safe) but never badged as such.
          if ((b as any).relationship_declared) {
            rater_relationships[type] = String((b as any).relationship || 'lived')
          }
        }
      }
    } catch {
      /* non-fatal — rating still saves without diagnostics */
    }

    // Snapshot how the rater is connected to their norms (lib/filters/
    // taxonomy.ts CONNECTION_TYPES), for the "Connection type to norm"
    // filter. It was read but never written, so that filter had nothing to
    // find. From the connection types on their norms, their diagnostic
    // profile in the app (professionally diagnosed, self-identified, exploring)
    // and who they are here for.
    const rater_connection_types: string[] = []
    try {
      const add = (t: string | null | undefined) => { if (t && !rater_connection_types.includes(t)) rater_connection_types.push(t) }
      const { data: mine } = await supabase.from('user_barriers').select('connection_type').eq('user_id', user.id)
      for (const b of mine || []) add((b as any).connection_type)
      const { data: diag } = await supabase.from('user_diagnostic_profiles').select('profile').eq('user_id', user.id).maybeSingle()
      const statuses: string[] = ((diag as any)?.profile?.conditions || []).map((c: any) => String(c?.status || ''))
      if (statuses.includes('diagnosed')) add('diagnosed')
      if (statuses.includes('self_identified')) add('self_diagnosed')
      if (statuses.includes('exploring')) add('undiagnosed_unsure')
      const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle()
      const audience = String((prof as any)?.preferences?.audience || '')
      add(({ parent: 'parent_guardian', family: 'caretaker', teach: 'educator', educator: 'educator', ally: 'ally' } as Record<string, string>)[audience])
    } catch {
      /* non-fatal — rating still saves without it */
    }

    // Snapshot which organisations the rater belongs to, so ratings can be
    // grouped per organisation later without cross-user membership reads
    // (RLS-safe: the rater reads their own memberships).
    let rater_org_ids: string[] = []
    try {
      const { data: myOrgs } = await supabase
        .from('organization_members')
        .select('org_id')
        .eq('user_id', user.id)
      rater_org_ids = (myOrgs || [])
        .map((o: any) => String(o.org_id || ''))
        .filter(Boolean)
    } catch {
      /* non-fatal — rating still saves without org grouping */
    }

    // A flagged rating goes in the moderation queue first, so it is hidden
    // from the moment it is saved until a moderator has looked (item 25).
    // The queue used to be written with the person's session, which always
    // failed, so flagged ratings went public unreviewed.
    const ratingId = previousRating?.id ?? randomUUID()
    let queueId: string | null = null
    let wasHeld = false
    if (validationResult.decision === 'flag_for_review') {
      wasHeld = !!previousRating && (await heldForReview('rating', [previousRating.id])).has(previousRating.id)
      queueId = await holdForReview(ratingId, user.id, validationResult)
      if (!queueId) return NextResponse.json({ error: QUEUE_DOWN }, { status: 503 })
    }

    let rating
    try {
      rating = await createOrUpdateRating({
        id: ratingId,
        resource_id: params.id,
        user_id: user.id,
        overall_score,
        barrier_scores,
        comment,
        rater_diagnostics,
        rater_relationships,
        rater_org_ids,
        rater_connection_types,
      })
    } catch (err) {
      if (isPostingBlockedError(err as { code?: string; message?: string })) return blockedResponse(CANT_POST_MESSAGE)
      throw err
    }

    if (!rating) {
      // Nothing changed, so nothing new to review (an earlier entry stays).
      if (queueId && !wasHeld) await dropModerationEntry(queueId)
      const blockedNow = await postingBlockedReason(user.id)
      if (blockedNow) return blockedResponse(blockedNow)
      return NextResponse.json({ error: 'Failed to create rating' }, { status: 500 })
    }
    if (wait_bucket) {
      const { error: waitError } = await supabase.from('ratings').update({ wait_bucket }).eq('id', rating.id)
      if (waitError) console.warn('[ratings] wait time not saved:', waitError.message)
    }

    // Waiting for a moderator: flagged now, or flagged before and not yet looked at.
    const held = queueId !== null || (await heldForReview('rating', [rating.id])).has(rating.id)

    // Universal-agent learning loop: record this rating as a reward
    // attribution against (resource_id, the rater's own norms). Both this
    // product and the goal-planning recommendation agent read from the same
    // `tool_outcomes` table, so a single rating here improves both products'
    // future suggestions. Once per person and resource: a new rating counts
    // its reward, a changed one only the change (item 11). A rating waiting
    // for review counts nothing. Best-effort: never blocks the response.
    if (validationResult.decision === 'approve' && !held) {
      const norms = Object.keys(rater_diagnostics)
      try {
        if (!previousRating) await recordRatingOutcome(params.id, norms, overall_score)
        else await recordRatingChange(params.id, norms, previousRating.overall_score, overall_score)
      } catch (err) {
        console.warn('[ratings] learning outcome skipped:', err)
      }

      // Fan the same reward out to the four non-recommendation ServiceHub
      // agents (pattern, validation, synthesis, orchestrator). One RPC
      // call hits every in-window decision touching (user, resource).
      try {
        const reward = previousRating
          ? Math.max(-1, Math.min(1, ratingToReward(overall_score) - ratingToReward(previousRating.overall_score)))
          : ratingToReward(overall_score)
        if (reward !== 0) {
          await attributeReward(user.id, params.id, reward)
        }
      } catch (err) {
        console.warn('[ratings] attributeReward (POST) skipped:', err)
      }
    }

    // Tell the people who saved this resource about a new rating, once it
    // shows. Who saved it is other people's rows, so it is read as the
    // service; the rater's session only ever found their own (item 33).
    if (!previousRating && !held) {
      try {
        const { data: savedResources, error: savedError } = await createAdminClient()
          .from('saved_resources')
          .select('user_id')
          .eq('resource_id', params.id)
          .neq('user_id', user.id) // Don't notify the rater
          .limit(500)
        if (savedError) console.warn('[ratings] saved-by list not read:', savedError.message)
        await sendNotificationToMany(
          (savedResources || []).map((s: { user_id: string }) => s.user_id),
          'resource_saved_new_rating',
          { resourceId: params.id, resourceName: resource.name || 'A resource you saved' }
        )
      } catch (err) {
        console.warn('[ratings] saved-resource notifications skipped:', err)
      }
    }

    return NextResponse.json({
      success: true,
      rating,
      validation: {
        // What the person should be told: a rating waiting for a moderator is pending review.
        decision: held ? 'flag_for_review' : validationResult.decision,
        confidence: validationResult.confidence,
        trustScore: validationResult.trustScore,
      },
    })
  } catch (error) {
    const formatted = formatErrorForUser(error)
    const supabaseForError = createClient()
    const { data: { user: errorUser } } = await supabaseForError.auth.getUser()
    await logError(error, {
      action: 'create_rating',
      userId: errorUser?.id,
      path: `/resources/${params.id}/ratings`,
    })
    return NextResponse.json(
      { error: formatted.message, type: formatted.type },
      { status: formatted.type === 'network' ? 503 : 500 }
    )
  }
}

/**
 * PUT /api/resources/[id]/ratings — change one's own rating.
 *
 * It used to skip the validation agent, take the norms for the learning
 * signal from the request, add the whole reward again on every save and
 * create a rating when there was none (bug audit, 17 November 2026, item 11).
 * Now it changes an existing rating only (404 otherwise), checks it like a
 * new one, and the learning signal moves only by the change in score.
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // A banned or paused account can't rate (item 9).
    const blocked = await postingBlockedReason(user.id)
    if (blocked) return blockedResponse(blocked)

    // Rating comes from experience (Goal 5, lib/ratings/access.ts); one's
    // own rating can always be edited. This replaces "only selected
    // raters" (profiles.is_rater, set by hand with
    // scripts/grant-rater-status.sql), which only editing checked.
    const access = await ratingAccess(supabase, params.id)
    if (!access.can_rate) {
      return NextResponse.json({ error: RATING_RULE, reason: 'not_eligible', access }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const overall_score = body?.overall_score
    const barrier_scores = cleanScores(body?.barrier_scores)
    const comment: string | undefined = typeof body?.comment === 'string' ? body.comment.trim() || undefined : undefined
    // How long they waited (STEP 83), saved after the rating, so a rating still saves before it.
    const wait_bucket = isWaitBucket(body?.wait_bucket) ? body.wait_bucket : null

    if (!validScore(overall_score)) {
      return NextResponse.json({ error: 'Invalid overall_score' }, { status: 400 })
    }

    // Validate comment length
    if (comment && comment.length > 500) {
      return NextResponse.json({ error: 'Comment must be 500 characters or less' }, { status: 400 })
    }

    // Only an existing rating is changed here; a new one goes through POST.
    const previous = await getRatingByUserAndResource(params.id, user.id)
    if (!previous) {
      return NextResponse.json({ error: "You haven't rated this yet. Add a rating first." }, { status: 404 })
    }

    // The same check a new rating gets.
    const userHistory = await getUserHistory(user.id)
    const validationResult = await validationAgent.validate({
      itemType: 'rating',
      item: {
        id: previous.id,
        overall_score,
        barrier_scores,
        comment,
        resource_id: params.id,
        user_id: user.id,
      },
      context: { userId: user.id, userHistory },
    })

    if (validationResult.decision === 'reject') {
      return NextResponse.json(
        {
          error: 'Rating rejected by validation agent',
          reasons: validationResult.reasons,
          trustScore: validationResult.trustScore,
        },
        { status: 403 }
      )
    }

    let queueId: string | null = null
    let wasHeld = false
    if (validationResult.decision === 'flag_for_review') {
      wasHeld = (await heldForReview('rating', [previous.id])).has(previous.id)
      if (!wasHeld) {
        // A rating people can already read isn't held because of an edit: a moderator's "reject" deletes the whole
        // rating, which would also take the version that was fine. So a flagged edit isn't saved; the rating stays
        // as it was, and the person can reword the change.
        return NextResponse.json(
          { error: EDIT_NOT_SAVED, reasons: validationResult.reasons, decision: 'flag_for_review', kept: true },
          { status: 422 }
        )
      }
      queueId = await holdForReview(previous.id, user.id, validationResult)
      if (!queueId) return NextResponse.json({ error: QUEUE_DOWN }, { status: 503 })
    }

    // As before, what isn't sent is left as it was.
    const rating = await updateOwnRating(previous.id, user.id, {
      overall_score,
      ...(barrier_scores ? { barrier_scores } : {}),
      ...(comment !== undefined ? { comment } : {}),
    })

    if (!rating) {
      if (queueId && !wasHeld) await dropModerationEntry(queueId)
      const blockedNow = await postingBlockedReason(user.id)
      if (blockedNow) return blockedResponse(blockedNow)
      return NextResponse.json({ error: 'Failed to update rating' }, { status: 500 })
    }
    if (wait_bucket) {
      const { error: waitError } = await supabase.from('ratings').update({ wait_bucket }).eq('id', rating.id)
      if (waitError) console.warn('[ratings] wait time not saved:', waitError.message)
    }

    const held = queueId !== null || (await heldForReview('rating', [rating.id])).has(rating.id)

    // The learning signal moves by the change in score only, against the
    // person's own norms from the database, and not while it awaits review.
    if (validationResult.decision === 'approve' && !held && previous.overall_score !== overall_score) {
      try {
        await recordRatingChange(params.id, await ownNorms(supabase, user.id), previous.overall_score, overall_score)
      } catch (err) {
        console.warn('[ratings] recordRatingChange skipped:', err)
      }
      // Same fan-out as POST: credit pattern, validation, synthesis,
      // orchestrator decisions that touched this (user, resource).
      try {
        const reward = Math.max(-1, Math.min(1, ratingToReward(overall_score) - ratingToReward(previous.overall_score)))
        if (reward !== 0) {
          await attributeReward(user.id, params.id, reward)
        }
      } catch (err) {
        console.warn('[ratings] attributeReward (PUT) skipped:', err)
      }
    }

    return NextResponse.json({
      success: true,
      rating,
      validation: {
        decision: held ? 'flag_for_review' : validationResult.decision,
        confidence: validationResult.confidence,
        trustScore: validationResult.trustScore,
      },
    })
  } catch (error) {
    if (isPostingBlockedError(error as { code?: string; message?: string })) return blockedResponse(CANT_POST_MESSAGE)
    console.error('Error updating rating:', error)
    return NextResponse.json({ error: 'Failed to update rating' }, { status: 500 })
  }
}
