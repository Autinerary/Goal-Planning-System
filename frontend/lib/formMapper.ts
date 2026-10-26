// Server only: the AI's reading of a local service's contact form, for fields
// its own words don't settle (lib/signupKit.ts runContactForm, needs_mapping).
// It sees the form's words only (each field's label, type and whether it is
// required), never the person's name, email or message, and answers with a
// role for each field, or "skip". Anything it can't place stays a question
// for the person: nothing is ever guessed into a form.

import type { FieldRole, FormField } from '@/lib/signupKit'

const ROLES: FieldRole[] = ['firstName', 'lastName', 'fullName', 'email', 'phone', 'message', 'subject', 'consent', 'skip']
const MODEL = process.env.OPENAI_FORM_MODEL || 'gpt-4o-mini'

const SYSTEM = `You read the fields of a local service's contact or booking form and say what each one asks for.
Roles: firstName, lastName, fullName, email, phone, message (a free-text box for the person's request), subject, consent (a box to agree to being contacted or to a privacy policy; never a newsletter or marketing box), skip.
Use "skip" for anything else, for example a date of birth, an address, an insurance or health card number, a referral source, a preferred date, or a question about the person's situation: those are the person's to answer, never filled in for them.
Answer only with JSON: {"mapping": {"<key>": "<role>", ...}}, one entry per field you were given.`

/** The fields' roles, or null when the AI isn't set up or didn't answer usefully. */
export async function mapFields(fields: FormField[]): Promise<Record<string, FieldRole> | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key || !fields.length) return null
  // The form's words only, trimmed.
  const asked = fields.slice(0, 40).map((f) => ({ key: String(f.key).slice(0, 8), type: String(f.type).slice(0, 20), label: String(f.label).slice(0, 160), required: !!f.required }))
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 400, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(asked) }] }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const j = await res.json()
    const parsed = JSON.parse(j?.choices?.[0]?.message?.content || '{}') as { mapping?: Record<string, unknown> }
    const out: Record<string, FieldRole> = {}
    for (const f of asked) {
      const role = parsed.mapping?.[f.key]
      out[f.key] = ROLES.includes(role as FieldRole) ? (role as FieldRole) : 'skip'
    }
    return out
  } catch {
    return null
  }
}
