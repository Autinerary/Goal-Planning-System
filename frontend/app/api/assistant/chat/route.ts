import { NextRequest, NextResponse } from 'next/server'

// Proxies at request time (never prerendered).
export const dynamic = 'force-dynamic'

/**
 * POST /api/assistant/chat — proxies the chat to the FastAPI backend's
 * /api/assistant/chat, so the assistant uses the same LLM (model/config) as the
 * agent orchestrator and can be enriched with the user's full path context.
 * No faked replies: if the backend URL isn't configured, we say so honestly.
 */

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const BACKEND = (process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || '').replace(/\/$/, '')

export async function POST(request: NextRequest) {
  let body: { messages?: ChatMessage[]; context?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const messages: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter(
      (m): m is ChatMessage =>
        !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0
    )
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))

  if (messages.length === 0) {
    return NextResponse.json({ error: 'Say something first.' }, { status: 400 })
  }

  if (!BACKEND) {
    return NextResponse.json({
      configured: false,
      reply: "I'm almost ready — the assistant backend isn't connected yet. Once it's set up I'll be able to help here.",
    })
  }

  try {
    const res = await fetch(`${BACKEND}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context: typeof body.context === 'string' ? body.context : '' }),
      // Render free tier sleeps when idle; the first request can take ~40s+ to
      // wake the service, so allow generous headroom before giving up.
      signal: AbortSignal.timeout(75000),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[assistant] backend error:', res.status, detail.slice(0, 300))
      return NextResponse.json(
        { reply: "Sorry — I couldn't reach the assistant just now. Please try again in a moment." },
        { status: 200 }
      )
    }

    const data = await res.json().catch(() => null)
    return NextResponse.json({
      configured: data?.configured ?? true,
      reply: data?.reply || "I'm not sure how to answer that — could you tell me a bit more?",
    })
  } catch (err) {
    console.error('[assistant] proxy failed:', err)
    return NextResponse.json(
      { reply: 'Something went wrong reaching the assistant. Please try again.' },
      { status: 200 }
    )
  }
}
