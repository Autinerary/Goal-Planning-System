'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Plus, Loader2, ChevronRight, ShieldCheck, Crown } from 'lucide-react'
import { computeAge } from '@/lib/age'

interface Child {
  id: string
  name: string
  email: string | null
  dateOfBirth: string | null
  relationship: string
  hasCompletedOnboarding: boolean
  hasPath: boolean
}

export default function FamilyPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({ name: '', email: '', password: '', dateOfBirth: '', relationship: 'parent' })

  const load = async () => {
    try {
      const res = await fetch('/api/family/children', { cache: 'no-store', credentials: 'include' })
      if (res.ok) {
        const j = await res.json()
        setChildren(j.children || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name || !form.email || !form.password || !form.dateOfBirth) {
      setError('Please fill in every field.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/family/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const j = await res.json()
      if (!res.ok) {
        setError(j.error || 'Could not add child.')
        return
      }
      setForm({ name: '', email: '', password: '', dateOfBirth: '', relationship: 'parent' })
      setShowAdd(false)
      setLoading(true)
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/path" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to my Path
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <Users className="w-6 h-6 text-purple-500" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Family</h1>
        </div>
        <p className="text-slate-600 mb-4">
          Add children under 18 and supervise their journey. Each child gets their own account that you manage.
        </p>

        {/* Family plan (billing stub) */}
        <div className="mb-6 flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
          <Crown className="w-4 h-4" />
          {children.length > 0
            ? <span><strong>Family plan</strong> — supervising {children.length} {children.length === 1 ? 'child' : 'children'}.</span>
            : <span><strong>Family plan</strong> — add your first child to get started.</span>}
        </div>

        {/* Children list */}
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-3">
            {children.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No children yet — add one below.</p>
            )}
            {children.map((c) => {
              const age = c.dateOfBirth ? computeAge(c.dateOfBirth) : null
              return (
                <Link
                  key={c.id}
                  href={`/family/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white p-4 hover:border-purple-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {(c.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{c.name}{age != null ? ` · ${age}` : ''}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {c.hasPath ? 'Has a path' : c.hasCompletedOnboarding ? 'Onboarded, no path yet' : 'Not onboarded yet'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        )}

        {/* Add a child */}
        <div className="mt-6">
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" /> Add a child
            </button>
          ) : (
            <form onSubmit={submit} className="rounded-2xl border-2 border-slate-200 bg-white p-5 space-y-3">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-500" /> Add a child
              </h2>
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <input
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm"
                placeholder="Child's name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                type="email"
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm"
                placeholder="Child's login email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date of birth</label>
                <input
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </div>
              <input
                type="password"
                className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm"
                placeholder="A password for their account (min 8 chars)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <p className="text-xs text-slate-400">
                You’re creating your child’s account. Share the email &amp; password with them, or log in on their device.
              </p>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowAdd(false); setError('') }} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-800">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Add child
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
