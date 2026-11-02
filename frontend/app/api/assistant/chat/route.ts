import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aboutMeForAssistant } from '@/lib/aboutMe'

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
  let body: { messages?: ChatMessage[]; context?: string; llm_config?: unknown; agent?: unknown }
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
    // Forwarded so the backend can attribute usage to a verified account. Read
    // from the auth cookie here rather than trusting anything the browser sent.
    const supabase = createServerSupabase()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // About me, only when its owner turned on "Share with the assistant"
    // (app/about-me). Read here from their own row, never from the browser.
    // It goes first: the backend keeps the first 2,000 characters of context.
    // One of the person's own agents (app/agents): its name, purpose, instructions and lens, checked here. It sees only
    // what its owner allowed (the context the browser built), so About me isn't added for it.
    const agent = agentSpec(body.agent)
    let aboutMe = ''
    // "Words we use" (Settings; Riipen Labs, Group 15): identity-first or
    // person-first, read from their own row like About me.
    let languageStyle: string | null = null
    const { data: { user } } = await supabase.auth.getUser()
    if (user && !agent) {
      const { data: row } = await supabase.from('profiles').select('aboutMe:preferences->aboutMe, languageStyle:preferences->>languageStyle').eq('id', user.id).maybeSingle()
      aboutMe = aboutMeForAssistant((row as { aboutMe?: any } | null)?.aboutMe)
      const style = (row as { languageStyle?: string | null } | null)?.languageStyle
      languageStyle = style === 'identity' || style === 'person' ? style : null
    }
    const pathContext = typeof body.context === 'string' ? body.context : ''

    const res = await fetch(`${BACKEND}/api/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      body: JSON.stringify({
        messages,
        context: [aboutMe, pathContext].filter(Boolean).join('\n\n'),
        llm_config: body.llm_config ?? null,
        language_style: languageStyle,
        ...(agent ? { agent } : {}),
      }),
      // Render free tier sleeps when idle; the first request can take ~40s+ to
      // wake the service, so allow generous headroom before giving up.
      signal: AbortSignal.timeout(75000),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      // A rate-limit message is actionable, so pass it through instead of
      // replacing it with a generic "try again" that hides the real reason.
      if (res.status === 429) {
        let message = 'You have reached the usage limit for now. Please try again shortly.'
        try {
          const parsed = JSON.parse(detail)
          if (typeof parsed?.detail === 'string') message = parsed.detail
        } catch {
          /* keep the default */
        }
        return NextResponse.json({ reply: message, rateLimited: true, failed: true }, { status: 200 })
      }
      console.error('[assistant] backend error:', res.status, detail.slice(0, 300))
      return NextResponse.json(
        { reply: "Sorry — I couldn't reach the assistant just now. Please try again in a moment.", failed: true },
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
      { reply: 'Something went wrong reaching the assistant. Please try again.', failed: true },
      { status: 200 }
    )
  }
}

/** An agent from the browser, cut to the backend's limits, or null. */
function agentSpec(raw: unknown): { name: string; purpose: string; instructions: string; lens: string[] } | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const name = text(a.name, 60)
  if (name.length < 2) return null
  return {
    name,
    purpose: text(a.purpose, 200),
    instructions: text(a.instructions, 2000),
    lens: (Array.isArray(a.lens) ? a.lens : []).filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 40)).slice(0, 6),
  }
}
