'use client'

import { useEffect, useState } from 'react'
import { Building2, ShieldCheck, Loader2, Check } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { VERIFICATION_META, type VerificationMethod } from '@/lib/trust'

interface Org { id: string; slug: string; name: string; description: string | null; is_verified: boolean; role: 'member' | 'leader' }
interface MemberNorm { type: string; method: VerificationMethod; vouchedByThisOrg: boolean }
interface Member { userId: string; role: string; name: string; norms: MemberNorm[] }

const NORM_LABELS: Record<string, string> = {
  autism: 'Autism', adhd: 'ADHD', ocd: 'OCD', bipolar: 'Bipolar Disorder',
  sensory_deaf: 'Deaf or Hard of Hearing', sensory_blind: 'Blind or Low Vision',
  physical_wheelchair: 'Wheelchair User', physical_mobility: 'Mobility Challenges',
  intellectual: 'Intellectual Disabilities', chronic_health: 'Chronic Health Conditions',
  mental_health: 'Mental Health Considerations',
}
const normLabel = (t: string) => NORM_LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [activeOrg, setActiveOrg] = useState<Org | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const loadOrgs = () => {
    fetch('/api/organizations/mine', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (Array.isArray(j?.organizations)) setOrgs(j.organizations) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(loadOrgs, [])

  const loadMembers = (org: Org) => {
    setActiveOrg(org); setMembers([]); setError('')
    fetch(`/api/organizations/members?orgId=${org.id}`, { cache: 'no-store', credentials: 'include' })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.json().catch(() => null))))
      .then((j) => setMembers(j.members || []))
      .catch((e) => setError(e?.error || 'Could not load members.'))
  }

  const join = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMsg('')
    const res = await fetch('/api/organizations/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ joinCode }),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok) setError(j?.error || 'Could not join.')
    else { setMsg(`Joined ${j.org.name}.`); setJoinCode(''); loadOrgs() }
  }

  const vouch = async (m: Member, norm: MemberNorm) => {
    if (!activeOrg) return
    setBusy(`${m.userId}:${norm.type}`); setError('')
    const res = await fetch('/api/organizations/vouch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        orgId: activeOrg.id, userId: m.userId, barrierType: norm.type,
        revoke: norm.vouchedByThisOrg,
      }),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok) setError(j?.error || 'Could not vouch.')
    else loadMembers(activeOrg)
    setBusy(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1">
          <Building2 className="w-6 h-6 text-indigo-600" aria-hidden="true" /> Organisations
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Community organisations can vouch for their members&apos; norms. Vouching records only
          which organisation confirmed it and when — never a diagnosis or any document.
        </p>

        {/* Join */}
        <form onSubmit={join} className="flex gap-2 mb-6">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter a join code"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">
            Join
          </button>
        </form>
        {msg && <p className="text-sm text-emerald-700 mb-4">{msg}</p>}
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-gray-500">You&apos;re not part of any organisation yet.</p>
        ) : (
          <ul className="space-y-3">
            {orgs.map((o) => (
              <li key={o.id} className="border border-gray-200 rounded-xl bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{o.name}</span>
                      {o.is_verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <ShieldCheck className="w-3 h-3" /> Verified
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{o.role}</span>
                    </div>
                    {o.description && <p className="text-sm text-gray-600 mt-1">{o.description}</p>}
                  </div>
                  {o.role === 'leader' && (
                    <button
                      onClick={() => loadMembers(o)}
                      className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                    >
                      Manage members
                    </button>
                  )}
                </div>

                {activeOrg?.id === o.id && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    {!o.is_verified && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                        This organisation isn&apos;t verified yet, so vouches can&apos;t be recorded.
                        An Autinerary admin verifies partner organisations.
                      </p>
                    )}
                    {members.length === 0 ? (
                      <p className="text-sm text-gray-500">No members loaded.</p>
                    ) : (
                      <ul className="space-y-2">
                        {members.map((m) => (
                          <li key={m.userId} className="rounded-lg border border-gray-200 p-3">
                            <div className="text-sm font-medium text-gray-900 mb-2">{m.name}</div>
                            {m.norms.length === 0 ? (
                              <p className="text-xs text-gray-500">No norms on their profile.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {m.norms.map((n) => {
                                  const vm = VERIFICATION_META[n.method] || VERIFICATION_META.self
                                  const key = `${m.userId}:${n.type}`
                                  return (
                                    <button
                                      key={n.type}
                                      onClick={() => vouch(m, n)}
                                      disabled={busy === key || !o.is_verified || n.method === 'professional'}
                                      title={vm.description}
                                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                                        n.vouchedByThisOrg
                                          ? 'bg-indigo-600 text-white border-indigo-600'
                                          : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                                      }`}
                                    >
                                      {n.vouchedByThisOrg && <Check className="w-3 h-3 inline mr-1" />}
                                      {normLabel(n.type)}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  )
}
