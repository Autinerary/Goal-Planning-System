import { NextRequest, NextResponse } from 'next/server'

// Runs the LLM call at request time (never prerendered).
export const dynamic = 'force-dynamic'

/**
 * POST /api/assistant/chat — the "Ask the assistant" chatbot.
 *
 * Calls OpenAI's Chat Completions API the same way the backend does
 * (OPENAI_API_KEY, model from OPENAI_MODEL, default gpt-4o-mini) — no fake
 * responses. If the key isn't set the route says so honestly instead of
 * pretending. `context` is a short, client-supplied summary of the user's
 * goals/norms so replies are personalised.
 */

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `You are the assistant inside Autinerary, a life-planning app for people who navigate neurodivergence, disability, and other systemic barriers (the app calls these "norms").

Your job is to help the person get unstuck on a goal, milestone, or barrier. Be warm, concrete, and brief — a few short paragraphs or a tight list, not an essay. Offer practical next steps they can actually take, and options rather than a single prescription. Respect their autonomy and never be condescending. You are not a doctor, lawyer, or therapist: for medical, legal, or crisis situations, gently encourage them to reach out to a qualified professional or, in an emergency, local emergency services. Do not invent facts about their specific situation; if you're unsure, ask a short clarifying question.`

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  let body: { messages?: ChatMessage[]; context?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Keep only well-formed user/assistant turns, cap history + length.
  const history: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter(
      (m): m is ChatMessage =>
        !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0
    )
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))

  if (history.length === 0) {
    return NextResponse.json({ error: 'Say something first.' }, { status: 400 })
  }

  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      reply:
        "I'm almost ready — the assistant just needs an OpenAI key set up before I can chat. Once that's added I'll be able to help you here.",
    })
  }

  const context = typeof body.context === 'string' ? body.context.slice(0, 1500).trim() : ''
  const system = context ? `${SYSTEM_PROMPT}\n\nWhat we know about this person (use it to personalise, don't repeat it back verbatim):\n${context}` : SYSTEM_PROMPT

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, ...history],
        max_tokens: 700,
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[assistant] OpenAI error:', res.status, detail.slice(0, 300))
      return NextResponse.json(
        { reply: "Sorry — I couldn't reach my brain just now. Please try again in a moment." },
        { status: 200 }
      )
    }

    const data = await res.json()
    const reply = data?.choices?.[0]?.message?.content?.trim()
    return NextResponse.json({
      configured: true,
      reply: reply || "I'm not sure how to answer that — could you tell me a bit more?",
    })
  } catch (err) {
    console.error('[assistant] request failed:', err)
    return NextResponse.json(
      { reply: 'Something went wrong on my end. Please try again.' },
      { status: 200 }
    )
  }
}
