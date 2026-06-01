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

    // Check for duplicate resources (same name + location)
    let isDuplicate = false
    if (name && location) {
      const { data: existingResources } = await supabase
        .from('resources')
        .select('id, name, location')
        .eq('name', name.trim())
        .limit(10)

      if (existingResources) {
        for (const resource of existingResources) {
          const resourceLocation = resource.location as Location | null
          if (
            resourceLocation?.city === location?.city &&
            resourceLocation?.province === location?.province &&
            resourceLocation?.address === location?.address
          ) {
            isDuplicate = true
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

    // Generate embedding for approved resources (for semantic search)
    if (resourceStatus === 'approved') {
      // Generate embedding in background (don't block response)
      onResourceCreated(resource).catch((error) => {
        console.error('Error generating resource embedding:', error)
      })
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