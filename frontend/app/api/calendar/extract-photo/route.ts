import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/calendar/extract-photo — Odosa: "Extract info from pic /
 * Confirm via bullet points & allow you to edit".
 *
 * Sends the photo to a real vision-capable model and asks for structured
 * JSON back. Nothing is added to the calendar here — this only returns a
 * list of candidates for the user to review, edit, or discard client-side,
 * per the "confirm & readjust" requirement.
 *
 * Model chain, same reasoning as the ideal-self portrait route: a hardcoded
 * single model name is how that broke when OpenAI retired dall-e-3. Verified
 * against the live models endpoint on this account — gpt-4o-mini is real,
 * vision-capable, and inexpensive for a single-image extraction call.
 */
const VISION_MODELS = [
  process.env.OPENAI_VISION_MODEL,
  'gpt-4o-mini',
  'gpt-4o',
].filter(Boolean) as string[]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Photo import is not configured. Set OPENAI_API_KEY.', code: 'no_api_key' },
      { status: 503 }
    )
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const imageDataUrl = String(body?.imageDataUrl || '')
  if (!imageDataUrl.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Send a base64 image data URL.' }, { status: 400 })
  }
  // A phone photo can run 5-10MB; base64 inflates that further, and the
  // point of this feature is a quick screenshot of a schedule, not an
  // arbitrary upload pipeline.
  if (imageDataUrl.length > 8_000_000) {
    return NextResponse.json({ error: 'That image is too large. Try a tighter crop or a lower-res photo.' }, { status: 413 })
  }

  const today = new Date()
  const prompt = `Today is ${today.toDateString()}. Look at this image of a schedule, planner page, ` +
    `whiteboard, or note. Extract every distinct event or task you can actually read. ` +
    `For each one return: name (string), date (ISO yyyy-mm-dd if a specific date is visible, else null), ` +
    `weekday (one of Sunday..Saturday if a day is written or a date lets you compute it, else null), ` +
    `time (HH:MM 24-hour if visible, else null), and confidence ("high"|"low") — "low" for anything you ` +
    `had to guess at rather than read directly. Do not invent events that are not visibly written down. ` +
    `Respond with ONLY a JSON array, no prose, shaped like: ` +
    `[{"name":"Dentist","date":"2026-09-12","weekday":"Saturday","time":"14:00","confidence":"high"}]`

  let lastError: { status: number; text: string } | null = null

  for (const model of VISION_MODELS) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
        max_tokens: 1200,
      }),
    })

    if (res.ok) {
      const json = await res.json()
      const raw = String(json?.choices?.[0]?.message?.content || '[]')
      // Models sometimes wrap JSON in a ```json fence despite instructions.
      const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()

      let items: any[] = []
      try {
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed)) items = parsed
      } catch (e) {
        console.error('[calendar/extract-photo] could not parse model output:', cleaned.slice(0, 300))
        return NextResponse.json({ error: 'Could not read a schedule from that image.', code: 'unparseable' }, { status: 502 })
      }

      const events = items
        .filter((it) => it && typeof it.name === 'string' && it.name.trim())
        .slice(0, 20)
        .map((it, i) => {
          let weekday = typeof it.weekday === 'string' && WEEKDAYS.includes(it.weekday) ? it.weekday : null
          if (!weekday && typeof it.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.date)) {
            const d = new Date(it.date + 'T00:00:00')
            if (!isNaN(d.getTime())) weekday = WEEKDAYS[d.getDay()]
          }
          return {
            id: `photo_${Date.now()}_${i}`,
            name: String(it.name).slice(0, 120),
            date: typeof it.date === 'string' ? it.date : null,
            weekday,
            time: typeof it.time === 'string' && /^\d{2}:\d{2}$/.test(it.time) ? it.time : null,
            confidence: it.confidence === 'high' ? 'high' : 'low',
          }
        })

      return NextResponse.json({ events, model })
    }

    const text = await res.text()
    lastError = { status: res.status, text }
    if (!/does not exist|not found|unknown model/i.test(text)) break
  }

  console.error('[calendar/extract-photo] OpenAI error:', lastError?.status, lastError?.text?.slice(0, 300))
  let reason = ''
  try { reason = String(JSON.parse(lastError?.text || '{}')?.error?.message || '').slice(0, 200) } catch {}
  return NextResponse.json(
    { error: reason ? `Photo import failed: ${reason}` : 'Photo import failed.', code: 'vision_error' },
    { status: 502 }
  )
}
