import { NextRequest, NextResponse } from 'next/server'
import { HELP_SYSTEM } from '@/lib/helpKnowledge'
import { ipHash } from '@/lib/newsletter'

export const dynamic = 'force-dynamic'

const MODEL = process.env.OPENAI_HELP_MODEL || 'gpt-4o-mini'
const PER_HOUR = 30
const seen = new Map<string, number[]>()

/**
 * POST /api/help/chat { messages: [{role, content}] }: the help chat (the
 * products round's planning note, Goal 11), answering from lib/helpKnowledge.ts
 * only, through OpenAI. Nothing is saved; a scrambled network address limits
 * floods (30 questions an hour per server).
 */
export async function POST(req: NextRequest) {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ reply: 'The help chat isn’t set up yet. Please email heydevs@autinerary.ca.' })
  const who = ipHash(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')) || 'unknown'
  const now = Date.now()
  const recent = (seen.get(who) || []).filter((t) => now - t < 3_600_000)
  if (recent.length >= PER_HOUR) return NextResponse.json({ reply: 'That’s a lot of questions in an hour. Please try again later, or email heydevs@autinerary.ca.' }, { status: 429 })
  seen.set(who, [...recent, now])
  if (seen.size > 5000) seen.clear()

  const body = await req.json().catch(() => ({}))
  const messages = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-8)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1500) }))
  if (!messages.length || messages[messages.length - 1].role !== 'user') return NextResponse.json({ error: 'Ask a question first.' }, { status: 400 })

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, temperature: 0.2, max_tokens: 350, messages: [{ role: 'system', content: HELP_SYSTEM }, ...messages] }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}`)
    const json = await res.json()
    const reply = String(json?.choices?.[0]?.message?.content || '').trim()
    return NextResponse.json({ reply: reply || 'I’m not sure. Please email heydevs@autinerary.ca.' })
  } catch (e: any) {
    console.error('[help-chat]', e?.message)
    return NextResponse.json({ reply: 'The help chat can’t answer just now. Please try again, or email heydevs@autinerary.ca.' }, { status: 502 })
  }
}
