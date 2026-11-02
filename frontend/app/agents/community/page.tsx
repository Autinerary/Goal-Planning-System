'use client'

/**
 * Community agents: agents other people built and shared (lib/sharedAgents.ts, backend api/routes/shared_agents.py),
 * the best for you first: how much of each one's community you're part of (from what you told us at setup), then its
 * rating from people like you. Shared with you by your people, and one opened from a private link (?key=).
 *
 * "Try it on my plan" runs it on the person's own plan, on their device or our cloud model as they choose: their plan
 * seen the way the agent's owner sees things. It sees only their information, and only what it says it looks at; its
 * owner sees nothing of it. "Add to my agents" keeps a copy of it to use and change (app/agents).
 */
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import StarRating from '@/app/components/StarRating'
import ReportButton from '@/app/components/ReportButton'
import { AgentRuntime, lensWords, loadAgents, newAgentId, personData, saveAgents, seesWords, withAgent } from '@/lib/agents'
import { tagLabel } from '@/lib/sharedModels'
import { SharedAgent, agentByLink, fromShared, listSharedAgents, rateSharedAgent, reportSharedAgent, sharedAgentsStatus } from '@/lib/sharedAgents'
import { useAgentPath } from '../../context/AgentPathContext'
import { AgentPlanReview } from '../AgentTalk'
import { freshToken } from '../SharePanel'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function Card({ agent, signedIn, linkKey, onChanged }: {
  agent: SharedAgent
  signedIn: boolean
  linkKey: string | null
  onChanged: (id: string, change: Partial<SharedAgent>) => void
}) {
  const { payload, pathPlanning } = useAgentPath()
  const [trying, setTrying] = useState(false)
  const [runsOn, setRunsOn] = useState<AgentRuntime>('device')
  const [added, setAdded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The same object while nothing changes: the plan review checks where it runs whenever its agent changes.
  const tryAgent = useMemo(() => ({ ...fromShared(agent), id: `try-${agent.id}`, runsOn }), [agent, runsOn])

  const rate = async (rating: number) => {
    const token = await freshToken()
    if (!token) return
    setError(null)
    try {
      const out = await rateSharedAgent(API_URL, token, agent.id, rating, linkKey)
      onChanged(agent.id, { rating: out.rating, ratingForYou: out.ratingForYou, myRating: out.myRating })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    } catch (e: any) {
      setError(e?.message || String(e))
    }
  }

  const add = () => {
    const mine = loadAgents()
    if (mine.some((a) => a.from?.kind === 'community' && a.from.id === agent.id)) return setAdded(true)
    saveAgents(withAgent(mine, { ...fromShared(agent), id: newAgentId() }))
    setAdded(true)
  }

  return (
    <li id={`agent-${agent.id}`} className="rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{agent.name}</h3>
        {signedIn && !agent.mine && (
          <ReportButton what="agent" onReport={async (reason) => { await reportSharedAgent(API_URL, (await freshToken()) || '', agent.id, reason, linkKey) }} />
        )}
      </div>
      {agent.match.shared.length > 0 && (
        <p className="text-sm font-medium text-emerald-800">Matches you: {agent.match.shared.map(tagLabel).join(', ')}</p>
      )}
      {agent.purpose && <p className="text-sm text-slate-700">{agent.purpose}</p>}
      <p className="text-xs text-slate-500">
        {agent.lens.length > 0 && `Looks through: ${lensWords(agent.lens)}. `}It looks at {seesWords(agent.sees, 'yours')}.
        {agent.mine && ' Shared by you.'}
      </p>
      <details className="text-sm text-slate-700">
        <summary className="cursor-pointer text-slate-600">How it works, in its owner’s words</summary>
        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3">{agent.instructions || 'No instructions: it works from its name and what it’s for.'}</p>
      </details>
      {(agent.builtOn || agent.builtOnCount > 0) && (
        <p className="text-xs text-slate-600">
          {agent.builtOn && (agent.builtOn.name
            ? <>Built on <a href={`#agent-${agent.builtOn.id}`} className="underline">{agent.builtOn.name}</a>. </>
            : <>Built on an agent that isn&apos;t shared with you. </>)}
          {agent.builtOnCount > 0 && <>{agent.builtOnCount} agent{agent.builtOnCount === 1 ? '' : 's'} here {agent.builtOnCount === 1 ? 'was' : 'were'} built on this one.</>}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-600" aria-label={agent.rating.count ? `Rated ${agent.rating.average} out of 5 by ${agent.rating.count}` : 'No ratings yet'}>
          {agent.rating.count ? (
            <>
              <StarRating value={agent.rating.average || 0} onChange={() => {}} interactive={false} size="sm" />
              <span>({agent.rating.count} rating{agent.rating.count === 1 ? '' : 's'})</span>
            </>
          ) : <span>No ratings yet</span>}
        </div>
        {typeof agent.ratingForYou === 'number' && agent.rating.count > 0 && (
          <span className="text-sm text-slate-700">People like you: {agent.ratingForYou} out of 5</span>
        )}
        {signedIn && !agent.mine && (
          <div className="text-sm text-slate-700 flex items-center gap-2">
            <StarRating value={agent.myRating || 0} onChange={rate} size="md" label="Your rating" />
            {saved && <span role="status" className="text-xs text-emerald-700">Saved</span>}
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {signedIn ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" aria-expanded={trying} onClick={() => setTrying(!trying)} className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">
            Try it on my plan
          </button>
          <button type="button" onClick={add} disabled={added} className="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-60">
            {added ? 'Added to your agents' : 'Add to my agents'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-700">
          <a href={`/login?returnTo=${encodeURIComponent(typeof window === 'undefined' ? '/agents/community' : window.location.pathname + window.location.search)}`} className="font-medium underline">Sign in</a>{' '}
          to try it on your plan or keep it. <a href="/signup" className="underline">New here?</a>
        </p>
      )}
      {added && <p className="text-sm text-slate-600">It’s in <Link href="/agents" className="underline">My agents</Link>, to use and change as you like.</p>}
      {trying && (
        <div className="space-y-3">
          <fieldset className="space-y-1 text-sm text-slate-700">
            <legend className="font-medium text-slate-800">Where it runs</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name={`runs-${agent.id}`} className="mt-1" checked={runsOn === 'device'} onChange={() => setRunsOn('device')} />
              <span>On my device, with my own small open model: nothing leaves this device.</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name={`runs-${agent.id}`} className="mt-1" checked={runsOn === 'cloud'} onChange={() => setRunsOn('cloud')} />
              <span>On our cloud model: what it looks at goes to the AI company that runs that model.</span>
            </label>
          </fieldset>
          <AgentPlanReview
            key={runsOn}
            agent={tryAgent}
            data={personData(payload, pathPlanning)}
            cantSee={`${agent.name} doesn’t look at plans. Add it to your agents to talk with it, or to change what it can see.`}
          />
          <p className="text-xs text-slate-500">It sees only your own information, and only what it says it looks at. Whoever shared it sees nothing of it.</p>
        </div>
      )}
    </li>
  )
}

function CommunityAgents() {
  const params = useSearchParams()
  const linkKey = params.get('key')
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [agents, setAgents] = useState<SharedAgent[]>([])
  const [sharedWithMe, setSharedWithMe] = useState<SharedAgent[]>([])
  const [linked, setLinked] = useState<SharedAgent | null>(null)
  const [forYou, setForYou] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const status = await sharedAgentsStatus(API_URL)
        setEnabled(status.enabled)
        if (!status.enabled) return
        const token = await freshToken()
        setSignedIn(!!token)
        const listed = await listSharedAgents(API_URL, token)
        setAgents(listed.agents)
        setSharedWithMe(listed.sharedWithMe)
        setForYou(listed.forYou)
        if (linkKey) setLinked((await agentByLink(API_URL, token, linkKey)).agent)
      } catch (e: any) {
        setEnabled((current) => current ?? false)
        setError(e?.message || String(e))
      }
    })()
  }, [linkKey])

  const changed = (id: string, change: Partial<SharedAgent>) => {
    const apply = (list: SharedAgent[]) => list.map((a) => (a.id === id ? { ...a, ...change } : a))
    setAgents(apply)
    setSharedWithMe(apply)
    setLinked((current) => (current && current.id === id ? { ...current, ...change } : current))
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <Link href="/agents" className="text-sm text-slate-500 hover:text-slate-800">← My agents</Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Community agents</h1>
        <p className="text-slate-600">
          Agents other people built and shared. Try one on your plan to see it the way they see things, or add it to your
          own. An agent shared with everyone doesn&apos;t say who shared it, and nobody who shares one sees who uses it.
        </p>
      </header>

      {enabled === null && <p className="text-sm text-slate-500">Loading…</p>}
      {enabled === false && !error && (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
          Sharing agents is switched off for now.
        </p>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</p>}

      {enabled && (
        <>
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            Each one passed our checks before it was shared: its words name no one, it doesn&apos;t try to set our rules
            aside, and OpenAI&apos;s moderation service found nothing harmful in it. Our rules always come before its
            instructions. Report anything that looks wrong. <Link href="/agents" className="underline">Share yours</Link>
          </p>

          {linked && (
            <section aria-labelledby="link-heading" className="space-y-3">
              <h2 id="link-heading" className="text-lg font-semibold text-slate-900">Shared with you by link</h2>
              <ul className="space-y-4"><Card agent={linked} signedIn={signedIn} linkKey={linkKey} onChanged={changed} /></ul>
            </section>
          )}

          {sharedWithMe.length > 0 && (
            <section aria-labelledby="shared-heading" className="space-y-3">
              <h2 id="shared-heading" className="text-lg font-semibold text-slate-900">Shared with you</h2>
              <p className="text-sm text-slate-600">By your people in Hare World.</p>
              <ul className="space-y-4">
                {sharedWithMe.map((a) => <Card key={a.id} agent={a} signedIn={signedIn} linkKey={null} onChanged={changed} />)}
              </ul>
            </section>
          )}

          <section aria-labelledby="everyone-heading" className="space-y-3">
            <h2 id="everyone-heading" className="text-lg font-semibold text-slate-900">{forYou ? 'Recommended for you' : 'Shared with everyone'}</h2>
            {forYou && (
              <p className="text-sm text-slate-600">
                First the ones whose community you&apos;re most part of, from what you told us at setup, then the ones people
                like you rated highest.
              </p>
            )}
            {agents.length === 0 && <p className="text-sm text-slate-600">Nobody has shared an agent with everyone yet.</p>}
            <ul className="space-y-4">
              {agents.map((a) => <Card key={a.id} agent={a} signedIn={signedIn} linkKey={null} onChanged={changed} />)}
            </ul>
          </section>

          <p className="text-xs text-slate-500">Agents write with AI, from their owner&apos;s instructions. They can be wrong, and they are not medical or clinical advice.</p>
        </>
      )}
    </main>
  )
}

export default function CommunityAgentsPage() {
  // useSearchParams needs a Suspense boundary in a static page.
  return (
    <Suspense fallback={<main className="max-w-3xl mx-auto px-4 py-8"><p className="text-sm text-slate-500">Loading…</p></main>}>
      <CommunityAgents />
    </Suspense>
  )
}
