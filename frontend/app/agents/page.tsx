'use client'

/**
 * My agents opens with the six agents built into every plan (lib/builtInAgents.ts): what each does, what it said on
 * this person's plan, and the instructions it gives the model, read from its code. The person's own agents follow
 * them, numbered from 7.
 *
 * Their own agents: agents a person builds to look at their plan their way (lib/agents.ts). Kept in this browser; each runs on
 * their device with their own model, or on our cloud model, as they choose; each sees only what they allow. They can
 * talk with one, have it look at their plan, or ask it about a step (app/components/AskMyAgents.tsx); and, once
 * sharing is on (unless SHARED_AGENTS=off; STEP 97), share one (SharePanel) or try others' (app/agents/community).
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Agent, STARTERS, agentFile, agentFromFile, agentFromStarter, lensWords, loadAgents, personData, saveAgents, withAgent } from '@/lib/agents'
import { insightMessage } from '@/lib/agentInsights'
import { BUILT_IN_AGENTS, BuiltInAgent, promptParts } from '@/lib/builtInAgents'
import { MySharedAgent, agentLinkFor, listMySharedAgents, sharedAgentsStatus, takeDownSharedAgent } from '@/lib/sharedAgents'
import { useAgentPath } from '../context/AgentPathContext'
import AgentForm from './AgentForm'
import { AgentPlanReview, AgentTalk } from './AgentTalk'
import SharePanel, { freshToken } from './SharePanel'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const VISIBILITY_WORDS = { everyone: 'shared with everyone', people: 'shared with people you picked', link: 'shared by link' }

type Open = { id: string; panel: 'talk' | 'plan' | 'share' } | null

const AgentNumber = ({ n, built }: { n: number; built: boolean }) => (
  <span aria-hidden="true" className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${built ? 'bg-slate-200 text-slate-800' : 'bg-indigo-600 text-white'}`}>{n}</span>
)

/** One of the six agents built into every plan: what it does, what it did on this plan, and what it tells the model. */
function BuiltInCard({ agent, said }: { agent: BuiltInAgent; said: string | null }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2" data-built-in={agent.id}>
      <div className="flex flex-wrap items-center gap-2">
        <AgentNumber n={agent.number} built />
        <h3 className="text-lg font-semibold text-slate-900">{agent.name}</h3>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">Built in</span>
      </div>
      <p className="text-sm text-slate-700">{agent.does}</p>
      <p className="text-xs text-slate-500">
        Looks at: {agent.looksAt}
        {agent.prompts.length > 0 && <> Writes with the model set for it in <Link href="/settings/models" className="underline">Models</Link>, or your own model when that&apos;s on.</>}
      </p>
      {said && <p className="text-sm text-slate-800"><span className="font-medium">On your plan:</span> {said}</p>}
      {agent.prompts.length > 0 ? (
        <details className="text-sm text-slate-700">
          <summary className="cursor-pointer text-slate-600">
            The instructions it gives the model ({agent.prompts.length})
          </summary>
          <div className="mt-2 space-y-3">
            {agent.prompts.map((p) => (
              <div key={p.label} className="rounded-lg bg-white p-3">
                <p className="font-medium text-slate-900">{p.label}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {promptParts(p.text).map((part, i) => (part.filled
                    ? <span key={i} className="rounded bg-amber-100 px-0.5 text-amber-900">{part.text}</span>
                    : <span key={i}>{part.text}</span>))}
                </p>
              </div>
            ))}
            <p className="text-xs text-slate-500">Read from its code. The highlighted parts are filled in for each plan.</p>
          </div>
        </details>
      ) : (
        <p className="text-xs text-slate-600">{agent.note}</p>
      )}
    </li>
  )
}

export default function AgentsPage() {
  const agentPath = useAgentPath()
  const { payload, pathPlanning } = agentPath
  // What each built-in agent said on this person's plan, from the plan itself (as its banners elsewhere show it).
  const slices = {
    path_planning: agentPath.pathPlanning, pattern_recognition: agentPath.patternRecognition,
    tool_recommendation: agentPath.toolRecommendation, reflection_analysis: agentPath.reflectionAnalysis,
    adaptation: agentPath.adaptation, calendar_optimization: agentPath.calendarOptimization,
  }
  const [agents, setAgents] = useState<Agent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState<Agent | null>(null)
  const [open, setOpen] = useState<Open>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shared, setShared] = useState<MySharedAgent[]>([])
  const [origin, setOrigin] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const data = personData(payload, pathPlanning)

  const refreshShared = async () => {
    const token = await freshToken()
    if (token) listMySharedAgents(API_URL, token).then((r) => setShared(r.agents)).catch(() => {})
  }

  useEffect(() => {
    setAgents(loadAgents())
    setLoaded(true)
    setOrigin(window.location.origin)
    sharedAgentsStatus(API_URL).then((s) => {
      setSharing(s.enabled)
      if (s.enabled) refreshShared()
    }).catch(() => {})
  }, [])

  // Shared, changed or taken down from its panel: kept with the agent here, and the list of shared ones again.
  const sharedChanged = (agent: Agent) => {
    keep(withAgent(agents, agent))
    refreshShared()
  }

  const takeDown = async (item: MySharedAgent) => {
    const token = await freshToken()
    if (!token || !window.confirm(`Take ${item.name} down? People who added it to their own agents keep their copy.`)) return
    try {
      await takeDownSharedAgent(API_URL, token, item.id)
      keep(agents.map((a) => (a.sharedId === item.id ? { ...a, sharedId: null } : a)))
      refreshShared()
      setNotice(`Took ${item.name} down.`)
    } catch (e: any) {
      setNotice(e?.message || String(e))
    }
  }

  const keep = (next: Agent[]) => {
    setAgents(next)
    saveAgents(next)
  }

  const save = (agent: Agent) => {
    keep(withAgent(agents, agent))
    setEditing(null)
    setNotice(`Saved ${agent.name}.`)
  }

  const remove = (agent: Agent) => {
    if (!window.confirm(`Remove ${agent.name} from this browser? If you haven't saved it as a file, it's gone.`)) return
    keep(agents.filter((a) => a.id !== agent.id))
    if (open?.id === agent.id) setOpen(null)
    setNotice(`Removed ${agent.name}.`)
  }

  const download = (agent: Agent) => {
    const url = URL.createObjectURL(new Blob([agentFile(agent)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'}.agent.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const openFile = async (file: File | null) => {
    if (!file) return
    const made = agentFromFile(await file.text())
    if ('error' in made) return setNotice(made.error)
    setEditing(made)
    setNotice(`Opened ${made.name}. Check it, then save it.`)
  }

  // A new agent: empty, seeing nothing, on the device. It gets its id when it's saved (cleanAgent).
  const blank = () => setEditing({ id: '', name: '', purpose: '', instructions: '', lens: [], sees: [], runsOn: 'device', createdAt: '', updatedAt: '', from: null, sharedId: null })

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">My agents</h1>
        <p className="text-slate-600">
          Build agents that look at your plan your way: what they look out for, how they talk to you, and what they can see.
          They’re kept in this browser. Each runs on your device with your own small open model, or on our cloud model, as
          you choose.
        </p>
      </header>

      {notice && <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{notice}</p>}

      {editing ? (
        <AgentForm key={editing.id || 'new'} agent={editing} onSave={save} onCancel={() => setEditing(null)} />
      ) : (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={blank} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Build an agent</button>
          <button type="button" onClick={() => fileInput.current?.click()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Open an agent file</button>
          <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label="Agent file"
            onChange={(e) => { openFile(e.target.files?.[0] || null); e.target.value = '' }} />
        </div>
      )}

      <section aria-labelledby="mine-heading" className="space-y-4">
        <div className="space-y-1">
          <h2 id="mine-heading" className="text-lg font-semibold text-slate-900">Your plan’s agents</h2>
          <p className="text-sm text-slate-600">
            Six agents are built into every plan
            {loaded && agents.length > 0
              ? `, and you’ve added ${agents.length === 1 ? 'one' : agents.length}: ${agents.length === 1 ? 'number 7' : `numbers 7 to ${6 + agents.length}`}.`
              : '. The ones you build, or add from Community agents, join them as number 7 and on.'}
          </p>
        </div>
        <ol className="space-y-4" aria-label="Your plan’s agents, built in first">
          {BUILT_IN_AGENTS.map((agent) => (
            <BuiltInCard key={agent.id} agent={agent} said={insightMessage(agent.id, slices[agent.id])} />
          ))}
          {loaded && agents.map((agent, i) => (
              <li key={agent.id} className="rounded-xl border border-indigo-200 p-4 space-y-3" data-mine={agent.id}>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AgentNumber n={7 + i} built={false} />
                    <h3 className="text-lg font-semibold text-slate-900">{agent.name}</h3>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                      {agent.from?.kind === 'community' ? 'Added from Community agents' : 'Yours'}
                    </span>
                  </div>
                  {agent.purpose && <p className="text-sm text-slate-700">{agent.purpose}</p>}
                  <p className="text-xs text-slate-500">
                    {agent.runsOn === 'cloud' ? 'Runs on our cloud model' : 'Runs on your device'}
                    {agent.lens.length > 0 && ` · looks through: ${lensWords(agent.lens)}`}
                    {agent.from?.kind === 'starter' && ` · started from Autinerary’s “${agent.from.name}”`}
                    {agent.from?.kind === 'file' && ' · opened from a file'}
                    {agent.from?.kind === 'community' && ` · added from Community agents (“${agent.from.name}”)`}
                    {agent.sharedId && ' · shared'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <button type="button" aria-expanded={open?.id === agent.id && open.panel === 'talk'}
                    onClick={() => setOpen(open?.id === agent.id && open.panel === 'talk' ? null : { id: agent.id, panel: 'talk' })}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium">Talk</button>
                  <button type="button" aria-expanded={open?.id === agent.id && open.panel === 'plan'}
                    onClick={() => setOpen(open?.id === agent.id && open.panel === 'plan' ? null : { id: agent.id, panel: 'plan' })}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium">Look at my plan</button>
                  {sharing && (
                    <button type="button" aria-expanded={open?.id === agent.id && open.panel === 'share'}
                      onClick={() => setOpen(open?.id === agent.id && open.panel === 'share' ? null : { id: agent.id, panel: 'share' })}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium">{agent.sharedId ? 'Shared' : 'Share'}</button>
                  )}
                  <button type="button" onClick={() => setEditing(agent)} className="rounded-lg px-3 py-1.5 text-slate-700 underline">Change</button>
                  <button type="button" onClick={() => download(agent)} className="rounded-lg px-3 py-1.5 text-slate-700 underline">Save as a file</button>
                  <button type="button" onClick={() => remove(agent)} className="rounded-lg px-3 py-1.5 text-red-700 underline">Remove</button>
                </div>
                {open?.id === agent.id && open.panel === 'talk' && <AgentTalk agent={agent} data={data} />}
                {open?.id === agent.id && open.panel === 'plan' && <AgentPlanReview agent={agent} data={data} />}
                {open?.id === agent.id && open.panel === 'share' && <SharePanel agent={agent} onShared={sharedChanged} onTakenDown={sharedChanged} />}
              </li>
            ))}
        </ol>
        {loaded && agents.length > 0 ? (
          <p className="text-sm text-slate-600">
            You can also ask your agents about one step, on that step’s page. <Link href="/milestones" className="underline">Your steps</Link>
          </p>
        ) : !editing && (
          <button type="button" onClick={blank} className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-900">
            Build the 7th
          </button>
        )}
      </section>

      {sharing && shared.length > 0 && (
        <section aria-labelledby="shared-heading" className="space-y-2 text-sm text-slate-700">
          <h2 id="shared-heading" className="text-lg font-semibold text-slate-900">Agents you’ve shared</h2>
          <ul className="space-y-2">
            {shared.map((item) => (
              <li key={item.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-slate-500">{item.status === 'approved' ? VISIBILITY_WORDS[item.visibility] : item.status === 'removed' ? 'taken down by a moderator' : item.status}</span>
                  <button type="button" onClick={() => takeDown(item)} className="text-xs text-red-700 underline">Take it down</button>
                </div>
                {item.visibility === 'people' && item.people.length > 0 && <p className="text-xs text-slate-600">With {item.people.map((p) => p.name).join(', ')}</p>}
                {item.linkKey && <p className="text-xs text-slate-600 break-all">Link: <code className="font-mono">{agentLinkFor(origin, item.linkKey)}</code></p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sharing && (
        <p className="rounded-lg bg-indigo-50 p-3 text-sm text-slate-800">
          <Link href="/agents/community" className="font-medium underline">Community agents</Link>: agents other people built
          and shared. Try one on your plan to see it the way they see things, or add it to yours.
        </p>
      )}

      {!editing && (
        <section aria-labelledby="starters-heading" className="space-y-3">
          <h2 id="starters-heading" className="text-lg font-semibold text-slate-900">Start from one of ours</h2>
          <p className="text-sm text-slate-600">Starters written by the Autinerary team. Change anything before you save it.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="font-medium text-slate-900">{s.name}</p>
                <p className="text-sm text-slate-700">{s.purpose}</p>
                <button type="button" onClick={() => setEditing(agentFromStarter(s))} className="text-sm text-cyan-700 underline">Start from this</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-slate-500">
        Agents write with AI, from your instructions. They can be wrong, and they are not medical or clinical advice.
      </p>
    </main>
  )
}
