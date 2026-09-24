import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createResource } from '@/lib/supabase/queries'
import { validationAgent } from '@/lib/agents/validation-agent'
import { getUserHistory } from '@/lib/agents/validation-agent/trust-scorer'
import { onResourceCreated } from '@/lib/embeddings/auto-generate'
import type { Location, ContactInfo } from '@/types/database'
import type { ValidationAgentInput } from '@/lib/agents/validation-agent/types'

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
      return NextResponse.json(
        {
          error: 'A resource with this name and location already exists',
          errors: { name: 'A resource with this name and location already exists' },
          // So the form can link straight to the listing that already covers
          // this place. Being told "this exists" without being shown where is
          // a dead end -- people re-submit with a tweaked name to get past it,
          // which produces exactly the duplicate this check exists to stop.
          existingResourceId: duplicateId,
        },
        { status: 409 }
      )
    }

    // Upload image if provided
    let imageUrl: string | undefined = undefined
    if (image) {
      try {
        const fileExt = image.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`
        const filePath = `resources/${fileName}`

        const { data, error: uploadError } = await supabase.storage
          .from('resource-images')
          .upload(filePath, image, {
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
    // Approved by agent: can be approved immediately (for high trust users)
    // Flagged: pending manual review
    const resourceStatus =
      validationResult.decision === 'approve' && validationResult.trustScore > 70
        ? 'approved'
        : 'pending'

    // Parse price
    let price: number | null = null
    if (priceStr && priceStr.trim()) {
      const parsedPrice = parseFloat(priceStr.trim())
      if (!isNaN(parsedPrice) && parsedPrice >= 0) {
        price = parsedPrice
      }
    }

    // Create resource
    // Note: recommendation_reason is not stored separately - it can be included in description if needed
    const resource = await createResource({
      name: name.trim(),
      category,
      description: description.trim(),
      location: location || undefined,
      contact_info: contactInfo || undefined,
      price: price || undefined,
      image_url: imageUrl || undefined,
      submitted_by: user.id,
      status: resourceStatus,
    })

    if (!resource) {
      return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 })
    }

    // Add to moderation queue if pending or flagged
    if (resourceStatus === 'pending' || validationResult.decision === 'flag_for_review') {
      await supabase.from('moderation_queue').insert({
        item_type: 'resource',
        item_id: resource.id,
        submitted_by: user.id,
        status: 'pending',
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