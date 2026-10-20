'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Crown, Lock, Users2 } from 'lucide-react'
import BackButton from '../../../components/BackButton'

interface Member {
  id: string
  name: string
  icon: string
  leader: boolean
  you: boolean
  joined_at: string
}

interface Group {
  id: string
  name: string
  type: string
  rules: string | null
  isPublic: boolean
  code: string | null
  isLeader: boolean
  joined: boolean
  count: number
}

/**
 * A Collab Group's page (Hare World): who is in it, the leader's rules, the
 * code for a private group, and for the leader, editing the rules, handing
 * the group to another member and removing someone. Members see each other's
 * names; joining a group shares yours with its members.
 */
export default function GroupPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState('')
  const [rules, setRules] = useState('')
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState('')

  const load = () =>
    fetch(`/api/collab-groups/${id}`, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (!r.ok) throw new Error(d?.error || 'Group not found.')
        setGroup(d.group)
        setMembers(d.members || [])
        setRules(d.group.rules || '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Group not found.'))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const patch = async (body: Record<string, unknown>, done: string) => {
    setStatus('')
    const r = await fetch(`/api/collab-groups/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json().catch(() => null)
    if (!r.ok) return setStatus(d?.error || 'That didn’t save.')
    setStatus(done)
    setEditing(false)
    load()
  }

  const remove = async (m: Member) => {
    if (!confirm(`Remove ${m.name} from ${group?.name}?`)) return
    const r = await fetch(`/api/collab-groups/${id}`, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: m.id }) })
    const d = await r.json().catch(() => null)
    setStatus(r.ok ? `${m.name} was removed.` : d?.error || 'That didn’t work.')
    load()
  }

  const join = async () => {
    const r = await fetch('/api/collab-groups/membership', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: id }) })
    const d = await r.json().catch(() => null)
    setStatus(r.ok ? 'You joined the group.' : d?.error || 'Could not join.')
    load()
  }

  const leave = async (closeGroup = false) => {
    if (!closeGroup && !confirm(`Leave ${group?.name}?`)) return
    const r = await fetch('/api/collab-groups/membership', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: id, closeGroup }) })
    const d = await r.json().catch(() => null)
    if (!r.ok) {
      if (d?.code === 'last_member' && confirm('You’re the only one in this group. Leaving closes it for good. Close the group?')) return leave(true)
      return setStatus(d?.error || 'Could not leave.')
    }
    router.replace('/hare-world?view=collab')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <BackButton fallback="/hare-world?view=collab" />
        {error ? (
          <p className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-slate-900">{error}</p>
        ) : !group ? (
          <p className="mt-6 text-slate-700">Loading…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <header className="rounded-2xl border border-indigo-200 bg-white p-6">
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                {group.name} {group.isLeader && <Crown className="h-5 w-5 text-amber-600" aria-label="You lead it" />}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-800">
                <span className="inline-flex items-center gap-1">
                  <Users2 className="h-4 w-4" aria-hidden="true" /> {group.count} {group.count === 1 ? 'member' : 'members'}
                </span>
                <span>{group.isPublic ? 'Public: anyone can find and join it' : 'Private: joined with its code'}</span>
              </p>
              {group.code && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm text-slate-900">
                  <Lock className="h-4 w-4" aria-hidden="true" /> Code: {group.code}
                </p>
              )}
              {!group.joined && group.isPublic && (
                <button type="button" onClick={join} className="mt-4 block rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800">
                  Join this group
                </button>
              )}
            </header>

            <section aria-labelledby="rules-heading" className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 id="rules-heading" className="text-lg font-bold text-slate-900">
                Rules
              </h2>
              {editing ? (
                <div className="mt-2">
                  <label htmlFor="group-rules" className="sr-only">
                    The group’s rules
                  </label>
                  <textarea id="group-rules" value={rules} onChange={(e) => setRules(e.target.value.slice(0, 2000))} rows={5} className="w-full rounded-lg border border-slate-300 p-2 text-slate-900" />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => patch({ rules }, 'Rules saved.')} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white">
                      Save rules
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-900">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 whitespace-pre-line text-slate-900">{group.rules || 'No rules yet.'}</p>
                  {group.isLeader && (
                    <button type="button" onClick={() => setEditing(true)} className="mt-2 text-sm font-semibold text-indigo-800 underline">
                      Edit the rules
                    </button>
                  )}
                </>
              )}
            </section>

            {group.joined && (
              <section aria-labelledby="members-heading" className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 id="members-heading" className="text-lg font-bold text-slate-900">
                  Members
                </h2>
                <p className="text-xs text-slate-700">Members see each other’s names here.</p>
                <ul className="mt-2 divide-y divide-slate-100">
                  {members.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-2 py-2" data-member={m.id}>
                      <span className="min-w-0 flex-1 text-slate-900">
                        {m.icon} {m.name}
                        {m.you ? ' (you)' : ''}
                        {m.leader && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Leader</span>}
                      </span>
                      {group.isLeader && !m.you && (
                        <>
                          <button type="button" onClick={() => confirm(`Make ${m.name} the leader? You'll be an ordinary member.`) && patch({ leaderId: m.id }, `${m.name} leads the group now.`)} className="rounded-lg border border-amber-300 px-3 py-1 text-sm font-semibold text-amber-900 hover:bg-amber-50">
                            Make leader
                          </button>
                          <button type="button" onClick={() => remove(m)} className="rounded-lg border border-red-300 px-3 py-1 text-sm font-semibold text-red-800 hover:bg-red-50">
                            Remove
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => leave()} className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  Leave the group
                </button>
              </section>
            )}
            {status && (
              <p role="status" className="text-sm text-slate-900">
                {status}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
