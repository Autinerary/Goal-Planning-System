import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * Ideal Self portrait API.
 *
 *   GET  /api/me/ideal-self   -> the caller's saved portrait (or null)
 *   POST /api/me/ideal-self   -> generate a fresh portrait, persist, return it
 *
 * Generation uses the OpenAI Images API (server-side fetch — no SDK dep). The
 * resulting PNG is uploaded to the shared `resource-images` Storage bucket and
 * its public URL is upserted into public.ideal_self_portraits so we only pay
 * for a new image when the user explicitly (re)generates.
 */

const STORAGE_BUCKET = 'resource-images'
// Image models, newest first. dall-e-3 was the default here and has since
// been retired by OpenAI — the request failed with "The model 'dall-e-3' does
// not exist", which is invisible until you actually read the API's reply.
//
// Verified against the models endpoint on this account: dall-e-2 and dall-e-3
// are both gone; these are what remain. The list is a fallback chain, not a
// single value, so the next retirement degrades to the next model instead of
// breaking the feature outright.
const IMAGE_MODELS = [
  process.env.OPENAI_IMAGE_MODEL,
  'gpt-image-2',
  'gpt-image-1.5',
  'gpt-image-1',
  'gpt-image-1-mini',
].filter(Boolean) as string[]

// ── GET: return the saved portrait ────────────────────────────────────
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('ideal_self_portraits')
    .select('image_url, prompt, style, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('GET /api/me/ideal-self error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    portrait: data
      ? { imageUrl: data.image_url, prompt: data.prompt, style: data.style, updatedAt: data.updated_at }
      : null,
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
  })
}

// ── Prompt builder (server-side so we control safety + framing) ───────
function buildPrompt(input: {
  dreams?: string[]
  goals?: string[]
  barriers?: string[]
  style?: string
}): string {
  const dreams = (input.dreams || []).filter(Boolean).slice(0, 3)
  const goals = (input.goals || []).filter(Boolean).slice(0, 4)
  const themes = [...dreams, ...goals].slice(0, 5).join('; ')
  const styleLabel = (input.style || 'painterly').toLowerCase()
  const styleClause =
    styleLabel === 'anime'
      ? 'soft anime / cel-shaded illustration style'
      : styleLabel === 'watercolor'
        ? 'gentle watercolor illustration style'
        : styleLabel === 'photoreal'
          ? 'semi-realistic cinematic portrait style'
          : 'warm painterly digital-art style'

  return [
    'A warm, uplifting portrait representing a person\u2019s ideal future self \u2014',
    'confident, calm, hopeful and fulfilled, standing in soft natural light.',
    themes ? `Weave in, symbolically and tastefully, these aspirations: ${themes}.` : '',
    'Dignified and inspiring mood, gentle hopeful color palette,',
    `${styleClause}.`,
    'A single figure, respectful and inclusive. No text, no logos, no watermarks.',
  ]
    .filter(Boolean)
    .join(' ')
}

// ── POST: generate + persist ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Image generation is not configured. Set OPENAI_API_KEY.', code: 'no_api_key' },
      { status: 503 }
    )
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const style: string = typeof body?.style === 'string' ? body.style : 'painterly'
  const prompt = buildPrompt({
    dreams: Array.isArray(body?.dreams) ? body.dreams : [],
    goals: Array.isArray(body?.goals) ? body.goals : [],
    barriers: Array.isArray(body?.barriers) ? body.barriers : [],
    style,
  })

  // 1. Ask OpenAI for a PNG as base64.
  //
  // Walks the model chain: if a model has been retired, that is a 4xx saying
  // it "does not exist", and we move to the next rather than surfacing a dead
  // end. Any other failure stops immediately — retrying a safety rejection or
  // a billing problem against four models just burns time.
  let b64: string
  let usedModel = IMAGE_MODELS[0]
  try {
    let oaRes: Response | null = null
    for (const model of IMAGE_MODELS) {
      usedModel = model
      oaRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: '1024x1024',
          // Deliberately no response_format and no quality. The API rejected
          // response_format outright ("Unknown parameter: 'response_format'"),
          // and the accepted values for quality differ per model. Sending
          // neither works across every image model; we handle whichever shape
          // comes back below.
        }),
      })

      if (oaRes.ok) break

      // Only a retired/unknown model is worth retrying.
      const peek = await oaRes.clone().text()
      if (!/does not exist|not found|unknown model/i.test(peek)) break
      console.warn(`Image model ${model} unavailable, trying next.`)
    }

    if (!oaRes) {
      return NextResponse.json({ error: 'No image model configured.', code: 'no_model' }, { status: 500 })
    }

    if (!oaRes.ok) {
      const detail = await oaRes.text()
      console.error('OpenAI image error:', oaRes.status, detail.slice(0, 500))

      // Surface what OpenAI actually said. "Image generation failed." told
      // the user nothing and told us nothing — the real cause (unverified
      // organisation, no image permission on the key, exhausted quota, a
      // rejected prompt) only reached the server log. These messages carry
      // no secrets; the key is never echoed back.
      let reason = ''
      try {
        const parsed = JSON.parse(detail)
        reason = String(parsed?.error?.message || '').slice(0, 300)
      } catch {
        reason = detail.slice(0, 200)
      }

      const hint =
        oaRes.status === 401 ? 'The OpenAI key was rejected — check it is valid and not revoked.'
        : oaRes.status === 403 ? 'The key lacks image permission, or the organisation needs verifying for this model.'
        : oaRes.status === 429 ? 'OpenAI rate limit or quota reached — check billing on the account.'
        // Don't guess at 400. It was steering people toward "soften the
        // prompt" when the real cause was an unsupported parameter.
        : oaRes.status === 400 ? 'OpenAI rejected the request — the message above says why.'
        : ''

      return NextResponse.json(
        {
          error: reason ? `Image generation failed: ${reason}` : 'Image generation failed.',
          hint,
          code: 'openai_error',
          model: usedModel,
          triedModels: IMAGE_MODELS,
          status: oaRes.status,
        },
        { status: 502 }
      )
    }

    const json = await oaRes.json()
    const first = json?.data?.[0]

    // Models differ: some return base64 inline, others a short-lived URL.
    // Handle both rather than assuming, which is what broke this.
    if (first?.b64_json) {
      b64 = first.b64_json
    } else if (first?.url) {
      const imgRes = await fetch(first.url)
      if (!imgRes.ok) {
        return NextResponse.json(
          { error: 'Image generated but could not be downloaded.', code: 'fetch_failed' },
          { status: 502 }
        )
      }
      b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
    } else {
      console.error('OpenAI image: unrecognised response shape', JSON.stringify(json).slice(0, 300))
      return NextResponse.json({ error: 'No image returned.', code: 'empty' }, { status: 502 })
    }
  } catch (e: any) {
    console.error('OpenAI image request threw:', e?.message ?? e)
    return NextResponse.json({ error: 'Image generation failed.', code: 'network' }, { status: 502 })
  }

  const bytes = Buffer.from(b64, 'base64')
  const dataUrl = `data:image/png;base64,${b64}`

  // 2. Upload to Storage (upsert to a stable path so we keep one per user).
  const imagePath = `ideal-self/${user.id}/portrait.png`
  let publicUrl: string | null = null
  try {
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(imagePath, bytes, { contentType: 'image/png', upsert: true, cacheControl: '3600' })
    if (upErr) {
      console.error('Storage upload failed:', upErr.message)
    } else {
      publicUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(imagePath).data.publicUrl
      // Cache-bust so the browser fetches the freshly overwritten file.
      if (publicUrl) publicUrl = `${publicUrl}?v=${Date.now()}`
    }
  } catch (e: any) {
    console.error('Storage upload threw:', e?.message ?? e)
  }

  // 3. Persist. Prefer the Storage URL; fall back to the data URL so the user
  //    still gets a portrait even if the bucket is misconfigured.
  const finalUrl = publicUrl || dataUrl
  const { error: upsertErr } = await supabase
    .from('ideal_self_portraits')
    .upsert(
      {
        user_id: user.id,
        image_url: finalUrl,
        image_path: publicUrl ? imagePath : null,
        prompt,
        style,
      },
      { onConflict: 'user_id' }
    )
  if (upsertErr) {
    console.error('ideal_self upsert failed:', upsertErr.message)
    // Still return the image so the client can show it this session.
    return NextResponse.json({
      portrait: { imageUrl: finalUrl, prompt, style, updatedAt: new Date().toISOString() },
      saved: false,
    })
  }

  return NextResponse.json({
    portrait: { imageUrl: finalUrl, prompt, style, updatedAt: new Date().toISOString() },
    saved: Boolean(publicUrl),
  })
}

export const dynamic = 'force-dynamic'
