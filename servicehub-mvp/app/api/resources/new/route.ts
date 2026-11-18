import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createResource } from '@/lib/supabase/queries'
import { validationAgent } from '@/lib/agents/validation-agent'
import { getUserHistory } from '@/lib/agents/validation-agent/trust-scorer'
import { onResourceCreated } from '@/lib/embeddings/auto-generate'
import type { Location, ContactInfo } from '@/types/database'
import type { ValidationAgentInput } from '@/lib/agents/validation-agent/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { enqueueModeration } from '@/lib/moderation/queue'
import { imageKind } from '@/lib/visuals/aiCheck'

const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' } as const

/**
 * A listing's website as a full http(s) address: "example.ca" or
 * "www.example.ca/visit" gets https:// in front, so the link opens the site
 * instead of a missing page inside ResourceHub, and anything with another
 * scheme ("javascript:", "data:", "mailto:") is refused (bug audit,
 * 17 November 2026, items 4 and 29). Returns null for an empty value and
 * 'invalid' for one that can't be a web address.
 */
function normaliseWebsite(raw: unknown): string | null | 'invalid' {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null
  if (value.length > 2000 || /[\s<>"]/.test(value)) return 'invalid'
  // A scheme is letters before a colon ("https:", "javascript:"); "example.ca:8080" is a host and port.
  const withScheme = /^[a-z][a-z0-9+-]*:/i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return 'invalid'
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'invalid'
  if (!url.hostname || !url.hostname.includes('.') || url.username || url.password) return 'invalid'
  return url.toString()
}

// Recommending a service lets the person rate it (Goal 5; STEP 79), so the
// recommendation is written here, by the service, not by the browser.
async function recordRecommendation(userId: string, resourceId: string, reason: string | null): Promise<boolean> {
  const { error } = await createAdminClient()
    .from('resource_recommendations')
    .upsert({ user_id: userId, resource_id: resourceId, reason: reason ? reason.trim().slice(0, 500) || null : null }, { onConflict: 'user_id,resource_id', ignoreDuplicates: true })
  if (error && !/resource_recommendations/.test(error.message || '')) console.error('recommendation not recorded:', error.message)
  return !error
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()

        // Extract form data
        const name = formData.get('name') as string
        const category = formData.get('category') as string
        const description = formData.get('description') as string
        const recommendation_reason = formData.get('recommendation_reason') as string | null
        const locationStr = formData.get('location') as string | null
        const contactInfoStr = formData.get('contact_info') as string | null
        const priceStr = formData.get('price') as string | null
        const image = formData.get('image') as File | null

    // Validate required fields
    const errors: { [key: string]: string } = {}

    if (!name || !name.trim()) {
      errors.name = 'Name is required'
    }

    if (!category) {
      errors.category = 'Category is required'
    }

    if (!description || !description.trim()) {
      errors.description = 'Description is required'
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 })
    }

    // Validate using Validation Agent
    const userHistory = await getUserHistory(user.id)
    const validationInput: ValidationAgentInput = {
      itemType: 'resource',
      item: {
        name,
        category,
        description,
        location: locationStr,
        contact_info: contactInfoStr,
        recommendation_reason,
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
          error: 'Resource submission rejected by validation agent',
          errors: validationResult.reasons.reduce((acc, reason, idx) => {
            acc[`validation_${idx}`] = reason
            return acc
          }, {} as { [key: string]: string }),
          trustScore: validationResult.trustScore,
        },
        { status: 403 }
      )
    }

    // Parse location and contact info
    let location: Location | undefined = undefined
    if (locationStr) {
      try {
        location = JSON.parse(locationStr) as Location
      } catch (error) {
        console.error('Error parsing location:', error)
      }
    }

    let contactInfo: ContactInfo | undefined = undefined
    if (contactInfoStr) {
      try {
        contactInfo = JSON.parse(contactInfoStr) as ContactInfo
      } catch (error) {
        console.error('Error parsing contact info:', error)
      }
    }
    if (contactInfo && typeof contactInfo === 'object') {
      const website = normaliseWebsite((contactInfo as { website?: unknown }).website)
      if (website === 'invalid') {
        return NextResponse.json(
          { error: 'Please check the website', errors: { website: 'Please enter a web address, like example.ca or https://example.ca.' } },
          { status: 400 }
        )
      }
      contactInfo = { ...contactInfo, website: website ?? undefined }
    }

    // Check for duplicate resources (same name + location).
    //
    // This used to compare raw strings with === on name, city, province AND
    // address, so it only ever caught a character-for-character repeat. In
    // practice nobody types a place the same way twice: "St. Mary's Clinic"
    // vs "St Marys Clinic", "123 Main St" vs "123 Main Street", a stray
    // double space, or different capitalisation all sailed straight past and
    // produced a second listing for the same place. That matters more now
    // that the directory holds thousands of imported venues -- a duplicate
    // splits a place's ratings in half, so neither copy shows what people
    // actually said about it.
    //
    // Comparison is done on a normalised form: lowercased, punctuation and
    // common street-type abbreviations folded, whitespace collapsed. The
    // matching rule itself is unchanged -- name AND city AND province AND
    // address must all agree -- so this only catches what the old check was
    // already trying to catch and missed on formatting. It does not start
    // rejecting genuinely different places, which would be the worse failure:
    // a second branch of a chain on another street stays allowed.
    const normalise = (v: unknown) =>
      String(v ?? '')
        .toLowerCase()
        .replace(/[.,'’"()]/g, '')
        .replace(/\b(street|st)\b/g, 'st')
        .replace(/\b(avenue|ave)\b/g, 'ave')
        .replace(/\b(road|rd)\b/g, 'rd')
        .replace(/\b(drive|dr)\b/g, 'dr')
        .replace(/\b(boulevard|blvd)\b/g, 'blvd')
        .replace(/\b(suite|ste|unit)\b/g, 'unit')
        .replace(/\s+/g, ' ')
        .trim()

    let isDuplicate = false
    let duplicateId: string | null = null
    if (name && location) {
      // ilike with no wildcards is an exact match that ignores case, which
      // widens the candidate set enough for the normalised comparison below
      // to do the real work.
      const { data: existingResources } = await supabase
        .from('resources')
        .select('id, name, location')
        .ilike('name', name.trim())
        .limit(25)

      const candidateName = normalise(name)
      if (existingResources) {
        for (const resource of existingResources) {
          const resourceLocation = resource.location as Location | null
          if (
            normalise(resource.name) === candidateName &&
            normalise(resourceLocation?.city) === normalise(location?.city) &&
            normalise(resourceLocation?.province) === normalise(location?.province) &&
            normalise(resourceLocation?.address) === normalise(location?.address)
          ) {
            isDuplicate = true
            duplicateId = resource.id
            break
          }
        }
      }
    }

    if (isDuplicate) {
      const recommended = duplicateId ? await recordRecommendation(user.id, duplicateId, recommendation_reason) : false
      return NextResponse.json(
        {
          error: 'A resource with this name and location already exists',
          errors: { name: 'A resource with this name and location already exists' },
          // So the form can link straight to the listing that already covers
          // this place. Being told "this exists" without being shown where is
          // a dead end -- people re-submit with a tweaked name to get past it,
          // which produces exactly the duplicate this check exists to stop.
          existingResourceId: duplicateId,
          recommended,
        },
        { status: 409 }
      )
    }

    // Upload image if provided
    let imageUrl: string | undefined = undefined
    if (image instanceof File && image.size > 0) {
      // The file's own bytes decide its type, never the browser's label (an
      // SVG can carry script).
      const bytes = new Uint8Array(await image.arrayBuffer())
      const kind = imageKind(bytes)
      if (!kind) {
        return NextResponse.json(
          { error: 'Please choose a JPG, PNG, GIF or WebP picture.', errors: { image: 'Please choose a JPG, PNG, GIF or WebP picture.' } },
          { status: 400 }
        )
      }
      try {
        const fileName = `${user.id}/${Date.now()}.${kind}`
        const filePath = `resources/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('resource-images')
          .upload(filePath, bytes, {
            contentType: IMAGE_TYPES[kind],
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          console.error('Error uploading image:', uploadError)
          return NextResponse.json(
            { error: 'Failed to upload image', errors: { image: 'Failed to upload image' } },
            { status: 500 }
          )
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from('resource-images').getPublicUrl(filePath)

        imageUrl = publicUrl
      } catch (error) {
        console.error('Error processing image:', error)
        return NextResponse.json(
          { error: 'Failed to process image', errors: { image: 'Failed to process image' } },
          { status: 500 }
        )
      }
    }

    // Determine resource status based on validation result
    // Approved by agent: can be approved immediately (for high trust users;
    // never when a safety check failed, lib/agents/validation-agent)
    // Flagged: pending manual review
    const autoApprove = validationResult.decision === 'approve' && validationResult.trustScore > 70

    // Parse price
    let price: number | null = null
    if (priceStr && priceStr.trim()) {
      const parsedPrice = parseFloat(priceStr.trim())
      if (!isNaN(parsedPrice) && parsedPrice >= 0) {
        price = parsedPrice
      }
    }

    // Create resource, always as pending: people may only add pending
    // listings (STEP 105), and could set any status before it (item 4).
    // Note: recommendation_reason is not stored separately - it can be included in description if needed
    let resource = await createResource({
      name: name.trim(),
      category,
      description: description.trim(),
      location: location || undefined,
      contact_info: contactInfo || undefined,
      price: price || undefined,
      image_url: imageUrl || undefined,
      submitted_by: user.id,
    })

    if (!resource) {
      return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 })
    }

    // The validation agent approved it: the server approves it, as the service.
    let resourceStatus: 'approved' | 'pending' = 'pending'
    if (autoApprove) {
      const { data: approved, error: approveError } = await createAdminClient()
        .from('resources')
        .update({ status: 'approved' })
        .eq('id', resource.id)
        .eq('submitted_by', user.id)
        .select('*')
      if (approveError) console.error('auto-approval not saved:', approveError.message)
      if (approved && approved.length > 0) {
        resource = approved[0] as typeof resource
        resourceStatus = 'approved'
      }
    }

    await recordRecommendation(user.id, resource.id, recommendation_reason)
    // They offer a free first visit (Goal 2).
    if (formData.get('free_first_visit') === 'true') {
      const { error: tagError } = await supabase.from('resources').update({ tags: ['free_first_visit'] }).eq('id', resource.id)
      if (tagError) console.error('free_first_visit not tagged:', tagError.message)
    }

    // Add to moderation queue if pending or flagged. Written as the service
    // (people can't write the queue, so this never arrived; item 25).
    if (resourceStatus === 'pending' || validationResult.decision === 'flag_for_review') {
      await enqueueModeration({
        item_type: 'resource',
        item_id: resource.id,
        submitted_by: user.id,
        agent_decision: validationResult.decision,
        agent_confidence: validationResult.confidence,
        agent_reasons: validationResult.reasons,
      })
    }

    // TODO: Send email notification to admins using Supabase Edge Functions
    // This would require setting up an Edge Function separately
    // Example:
    // await fetch(`${process.env.SUPABASE_URL}/functions/v1/notify-admins`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     resource_id: resource.id,
    //     resource_name: resource.name,
    //     submitted_by: user.id,
    //   }),
    // })

    // Generate embedding for auto-approved resources (for semantic search).
    // Awaited — on Vercel serverless a fire-and-forget promise can be killed
    // when the response returns, leaving the resource missing from semantic
    // search. Approval still succeeds if embedding generation throws; the batch
    // backfill can recover it later.
    if (resourceStatus === 'approved') {
      try {
        await onResourceCreated(resource)
      } catch (error) {
        console.error('Error generating resource embedding:', error)
      }
    }

    return NextResponse.json({
      success: true,
      resource,
      validation: {
        decision: validationResult.decision,
        confidence: validationResult.confidence,
        trustScore: validationResult.trustScore,
        status: resourceStatus,
      },
    })
  } catch (error) {
    console.error('Error creating resource:', error)
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 })
  }
}