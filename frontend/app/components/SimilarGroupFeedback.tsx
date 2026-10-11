'use client'

import { useEffect, useState } from 'react'
import { backendAuthHeaders } from '@/lib/backendAuth'

/** Off unless NEXT_PUBLIC_SIMILAR_GROUP_FEEDBACK_ENABLED is 'true' (and the backend's flag). */
export const SIMILAR_GROUP_FEEDBACK_ENABLED = process.env.NEXT_PUBLIC_SIMILAR_GROUP_FEEDBACK_ENABLED === 'true'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const NOTE_LIMIT = 500

const ANSWERS = [
  { id: 'yes', label: 'Yes' },
  { id: 'somewhat', label: 'Somewhat' },
  { id: 'no', label: 'No' },
] as const

type Group = { size: number; conditions: string[] }

/**
 * Inside the "Why we suggested this" banner: an anonymous summary of the group
 * the plan was matched with (its size, and conditions at least 3 of them
 * share), then "Does this sound like people in a situation similar to yours?".
 * The backend works out the group from the stored plan and returns no ids
 * (api/routes/similar_group.py). The note is stored for the team and is never
 * sent to an AI. Renders nothing until there is a group to describe.
 */
export default function SimilarGroupFeedback() {
  const [group, setGroup] = useState<Group | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/pattern/group`, { headers: await backendAuthHeaders() })
        const json = res.ok ? await res.json() : null
        if (!cancelled && json && typeof json.size === 'number') {
          setGroup({ size: json.size, conditions: Array.isArray(json.conditions) ? json.conditions : [] })
        }
      } catch {
        /* nothing to show */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!group || group.size === 0) return null

  const send = async () => {
    if (!answer) return
    setState('sending')
    try {
      const res = await fetch(`${API_URL}/api/pattern/group/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await backendAuthHeaders()) },
        body: JSON.stringify({ answer, note: note.trim() || undefined }),
      })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return <p className="border-t border-purple-100 px-4 py-3 text-sm text-slate-700">Thank you. This helps us match people better.</p>
  }

  return (
    <div className="border-t border-purple-100 px-4 py-3 text-sm text-slate-700">
      <p>
        This group: {group.size} {group.size === 1 ? 'person' : 'people'}.
        {group.conditions.length > 0
          ? ` Shared by at least 3 of them: ${group.conditions.join(', ')}.`
          : group.size >= 3
            ? ' No condition is shared by 3 or more of them.'
            : ''}
      </p>
      <fieldset className="mt-3">
        <legend className="font-medium">Does this sound like people in a situation similar to yours?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ANSWERS.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={answer === a.id}
              onClick={() => setAnswer(a.id)}
              className={`rounded-full border px-3 py-1 ${answer === a.id ? 'border-purple-600 bg-purple-600 text-white' : 'border-purple-200 bg-white text-purple-700'}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 block">
        <span className="text-xs text-slate-600">Anything to add? (optional) Only the team reads this. It is never sent to an AI.</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_LIMIT))}
          maxLength={NOTE_LIMIT}
          rows={2}
          className="mt-1 w-full rounded-md border border-purple-200 p-2 text-sm"
        />
      </label>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={!answer || state === 'sending'}
          onClick={send}
          className="rounded-md bg-purple-600 px-3 py-1 text-white disabled:opacity-50"
        >
          {state === 'sending' ? 'Sending…' : 'Send'}
        </button>
        {state === 'error' && <span role="alert" className="text-xs text-red-700">That didn't send. Please try again.</span>}
      </div>
    </div>
  )
}
