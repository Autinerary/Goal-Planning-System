'use client'

import { useEffect, useState } from 'react'
import PronounsField from './PronounsField'

/**
 * Pronouns and a username, optional, in setup (Riipen Labs, Group 34, slide
 * 25). Folded away so the first step stays two questions, and shown only once
 * the profile has these fields (STEP 64). Saved straight away with their own
 * button, so a taken username is said here, not when the path is made.
 */

const USERNAME_RULE = /^[a-z0-9_.]{3,20}$/

export default function ProfileBasics() {
  const [ready, setReady] = useState(false)
  const [username, setUsername] = useState('')
  const [pronouns, setPronouns] = useState('')
  const [state, setState] = useState<null | 'saving' | { ok: boolean; text: string }>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/profile', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.extended) return
        setUsername(json.profile?.username || '')
        setPronouns(json.profile?.pronouns || '')
        setReady(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!ready) return null

  const clean = username.trim().replace(/^@/, '').toLowerCase()
  const problem = clean && !USERNAME_RULE.test(clean) ? 'A username is 3 to 20 letters, numbers, dots or underscores, with no spaces.' : null

  const save = async () => {
    if (problem) { setState({ ok: false, text: problem }); return }
    setState('saving')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean, pronouns }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'That could not be saved. Please try again.')
      setState({ ok: true, text: 'Saved. You can change these on Your profile.' })
    } catch (e: any) {
      setState({ ok: false, text: e.message })
    }
  }

  return (
    <details className="mt-6 rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-medium text-slate-900">Add your pronouns and a username (optional)</summary>
      <div className="mt-4 space-y-4">
        <PronounsField idPrefix="setup-pronouns" value={pronouns} onChange={(v) => { setPronouns(v); setState(null) }} />
        <div>
          <label htmlFor="setup-username" className="block text-sm font-semibold text-slate-800">Username</label>
          <p id="setup-username-help" className="mb-2 text-xs text-slate-600">People can find you by it. 3 to 20 letters, numbers, dots or underscores.</p>
          <div className="flex items-center rounded-lg border border-slate-300 focus-within:border-purple-500">
            <span className="pl-3 text-slate-600" aria-hidden="true">@</span>
            <input
              id="setup-username"
              value={username}
              maxLength={21}
              autoCapitalize="none"
              autoComplete="username"
              spellCheck={false}
              aria-invalid={Boolean(problem)}
              aria-describedby="setup-username-help setup-username-problem"
              onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/\s/g, '')); setState(null) }}
              className="w-full rounded-lg px-1 py-2 focus:outline-none"
            />
          </div>
          <p id="setup-username-problem" className="mt-1 text-xs text-red-700">{problem || ''}</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={state === 'saving'}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
        >
          {state === 'saving' ? 'Saving…' : 'Save these'}
        </button>
        <p role="status" className={`text-sm ${state && state !== 'saving' && state.ok ? 'text-emerald-800' : 'text-red-700'}`}>
          {state && state !== 'saving' ? state.text : ''}
        </p>
      </div>
    </details>
  )
}
