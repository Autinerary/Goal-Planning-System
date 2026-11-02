'use client'

/**
 * Sharing one of the person's agents (lib/sharedAgents.ts, backend api/routes/shared_agents.py): with everyone, people
 * they pick, or by private link. What's shared is exactly what this panel shows: the agent's own words, never who they
 * are. Nothing is shared until every check passes; a check that doesn't apply to this share isn't shown.
 */
import { useEffect, useState } from 'react'
import { Agent, lensWords, seesWords } from '@/lib/agents'
import { Checks, ShareError, Visibility, agentLinkFor, changeSharedAgent, checkSharedAgent, listAgentPeople, shareAgent, shareRequest, takeDownSharedAgent } from '@/lib/sharedAgents'
import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function freshToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

const CHECK_NAMES: Record<string, string> = {
  words: 'It names no one',
  rules: 'It doesn’t try to set our rules aside',
  harm: 'Nothing harmful in it (OpenAI’s moderation service)',
  crowd: 'Its norms don’t point to you',
  audience: 'The people you picked are your people',
  lineage: 'What it was built on is still shared, and this one is yours',
}

export function AgentCheckList({ checks }: { checks: Checks }) {
  return (
    <ul className="space-y-1 text-sm" aria-label="Checks">
      {Object.entries(checks).filter(([, c]) => c && c.applies !== false).map(([key, c]) => (
        <li key={key} className={c!.passed ? 'text-emerald-800' : c!.waiting ? 'text-slate-500' : 'text-red-800'}>
          {c!.passed ? '✓' : c!.waiting ? '…' : '✗'} {CHECK_NAMES[key] || key}
          {!c!.passed && c!.why ? <span className={`block pl-5 ${c!.waiting ? 'text-slate-500' : 'text-red-700'}`}>{String(c!.why)}</span> : null}
        </li>
      ))}
    </ul>
  )
}

type Props = { agent: Agent; onShared: (agent: Agent) => void; onTakenDown: (agent: Agent) => void }

export default function SharePanel({ agent, onShared, onTakenDown }: Props) {
  const [visibility, setVisibility] = useState<Visibility>('everyone')
  const [people, setPeople] = useState<{ id: string; name: string }[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [checks, setChecks] = useState<Checks | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ visibility: Visibility; link: string | null } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (visibility !== 'people' || people) return
    freshToken().then((token) => token ? listAgentPeople(API_URL, token) : { people: [] }).then((r) => setPeople(r.people)).catch(() => setPeople([]))
  }, [visibility, people])

  const request = () => shareRequest(agent, visibility, picked)
  const ready = visibility !== 'people' || picked.length > 0
  const allPassed = !!checks && Object.values(checks).every((c) => !c || c.passed)

  const run = async (what: 'check' | 'share') => {
    const token = await freshToken()
    if (!token) return setError('Sign in to share an agent.')
    setBusy(what === 'check' ? 'Checking…' : 'Sharing…')
    setError(null)
    try {
      if (what === 'check') {
        setChecks((await checkSharedAgent(API_URL, token, request())).checks)
      } else {
        const out = agent.sharedId
          ? await changeSharedAgent(API_URL, token, agent.sharedId, request())
          : await shareAgent(API_URL, token, request())
        setChecks(out.checks)
        setDone({ visibility: out.visibility, link: out.linkKey ? agentLinkFor(window.location.origin, out.linkKey) : null })
        onShared({ ...agent, sharedId: out.id })
      }
    } catch (e: any) {
      if (e instanceof ShareError && e.checks) setChecks(e.checks)
      setError(e?.message || String(e))
    } finally {
      setBusy(null)
    }
  }

  const takeDown = async () => {
    const token = await freshToken()
    if (!token || !agent.sharedId || !window.confirm(`Take ${agent.name} down? People who added it to their own agents keep their copy.`)) return
    try {
      await takeDownSharedAgent(API_URL, token, agent.sharedId)
      onTakenDown({ ...agent, sharedId: null })
      setDone(null)
      setChecks(null)
    } catch (e: any) {
      setError(e?.message || String(e))
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <section aria-label={`Share ${agent.name}`} className="rounded-xl border border-slate-200 p-4 space-y-4 text-sm text-slate-700">
      <div className="space-y-1">
        <p className="font-medium text-slate-900">What others will see</p>
        <p className="text-slate-600">Exactly this, and never who you are. Whoever uses it runs it on their own plan: it sees only their information, never yours.</p>
        <div className="rounded-lg bg-slate-50 p-3 space-y-1">
          <p className="font-medium text-slate-900">{agent.name}</p>
          {agent.purpose && <p>{agent.purpose}</p>}
          {agent.instructions && <p className="whitespace-pre-wrap text-slate-800">{agent.instructions}</p>}
          <p className="text-xs text-slate-500">
            {agent.lens.length ? `Looks through: ${lensWords(agent.lens)}. ` : ''}
            It looks at: {seesWords(agent.sees, 'theirs')}.
          </p>
        </div>
        <p className="text-xs text-slate-500">To change any of it, change the agent first (Change), then share it again.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-medium text-slate-900">Who can see it</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name={`share-${agent.id}`} className="mt-1" checked={visibility === 'everyone'} onChange={() => { setVisibility('everyone'); setChecks(null) }} />
          <span><span className="font-medium">Everyone.</span> Listed in Community agents, without your name. Only if at least 5 people here share all of its norms, so they can&apos;t point to you.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name={`share-${agent.id}`} className="mt-1" checked={visibility === 'people'} onChange={() => { setVisibility('people'); setChecks(null) }} />
          <span><span className="font-medium">People I pick.</span> Only your people in Hare World that you choose. They&apos;ll know it&apos;s yours, so this is less anonymous.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name={`share-${agent.id}`} className="mt-1" checked={visibility === 'link'} onChange={() => { setVisibility('link'); setChecks(null) }} />
          <span><span className="font-medium">Anyone with the link.</span> Not listed. Whoever you give the link to can use it, and so can anyone they pass it on to.</span>
        </label>
      </fieldset>
      {visibility === 'people' && (
        people === null ? <p className="text-slate-500">Finding your people…</p>
        : people.length === 0 ? <p className="text-slate-600">You haven&apos;t connected with anyone in Hare World yet.</p>
        : (
          <fieldset className="space-y-1" aria-label="Your people">
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input type="checkbox" checked={picked.includes(p.id)}
                  onChange={(e) => { setPicked(e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id)); setChecks(null) }} />
                {p.name}
              </label>
            ))}
          </fieldset>
        )
      )}

      <p className="text-xs text-slate-500">
        Before it&apos;s shared, our server checks that it names no one and doesn&apos;t try to set our rules aside; then
        OpenAI&apos;s moderation service checks it for harmful content (only once nothing personal is left in it). Anyone can
        report a shared agent.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!ready || !!busy} onClick={() => run('check')} className="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-50">Check</button>
        <button type="button" disabled={!ready || !allPassed || !!busy} onClick={() => run('share')} className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">
          {agent.sharedId ? 'Update the shared copy' : 'Share it'}
        </button>
        {agent.sharedId && <button type="button" onClick={takeDown} className="text-red-700 underline">Take it down</button>}
      </div>
      {!ready && <p className="text-slate-600">Pick at least one person first.</p>}
      {busy && <p role="status" className="text-slate-600">{busy}</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {checks && <AgentCheckList checks={checks} />}
      {done && (
        <div role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-900 space-y-2">
          {done.visibility === 'everyone' && <p>Shared. It&apos;s in Community agents now. Thank you.</p>}
          {done.visibility === 'people' && <p>Shared with the people you picked. It&apos;s in their Community agents, under Shared with you.</p>}
          {done.link && (
            <>
              <p>Shared. Give this link to whoever you want to use it:</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-xs break-all rounded bg-white px-2 py-1">{done.link}</code>
                <button type="button" onClick={() => copy(done.link!)} className="underline">{copied ? 'Copied' : 'Copy'}</button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
