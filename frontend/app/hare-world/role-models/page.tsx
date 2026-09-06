'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Users, X } from 'lucide-react'

interface RoleModel {
  id: string
  name: string
  bio: string
  photo_url: string | null
  categories: string[]
  source_url: string | null
}

// Starting categories from Odosa's list — a submitter can also type their
// own, since a fixed list will never cover everyone this is meant to include.
const SUGGESTED_CATEGORIES = [
  'Black', 'Neurodivergent', 'Visible Minority', 'Parent', 'Sibling',
  'Young Leader', 'LGBTQ+', 'Disability', 'Immigrant',
]

/**
 * Role Model Galleria (Odosa): "Ex. Black, Neurodiv Role Model Page +
 * Categories."
 *
 * Empty until people submit and an admin approves — see
 * /api/role-models and STEP 28 for why nothing is pre-seeded here.
 */
export default function RoleModelGalleriaPage() {
  const [roleModels, setRoleModels] = useState<RoleModel[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = (category?: string | null) => {
    setLoading(true)
    const qs = category ? `?category=${encodeURIComponent(category)}` : ''
    fetch(`/api/role-models${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setRoleModels(j?.roleModels || []))
      .catch(() => setRoleModels([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(activeCategory) }, [activeCategory])

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/pit-stop?tab=haveworld" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Hare World
        </Link>

        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-600" /> Role Model Galleria
          </h1>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" /> Suggest someone
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          People to look to — submitted by the community, reviewed before they go live.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${!activeCategory ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-300'}`}
          >
            All
          </button>
          {SUGGESTED_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${activeCategory === c ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-300'}`}
            >
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : roleModels.length === 0 ? (
          <div className="text-center py-14 border-2 border-dashed border-slate-200 rounded-2xl">
            <p className="text-slate-500 text-sm">
              No one here yet{activeCategory ? ` in "${activeCategory}"` : ''}. Be the first to suggest someone.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {roleModels.map((rm) => (
              <div key={rm.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  {rm.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={rm.photo_url} alt={rm.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-purple-100 grid place-items-center text-purple-600 font-bold">
                      {rm.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-slate-900">{rm.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {rm.categories.slice(0, 3).map((c) => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 line-clamp-4">{rm.bio}</p>
                {rm.source_url && (
                  <a href={rm.source_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-purple-500 hover:underline mt-1 inline-block">
                    Source →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <SuggestForm onClose={() => setShowForm(false)} onSubmitted={() => load(activeCategory)} />
        )}
      </div>
    </div>
  )
}

function SuggestForm({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [categoriesText, setCategoriesText] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError('')
    const res = await fetch('/api/role-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name, bio,
        categories: categoriesText.split(',').map((c) => c.trim()).filter(Boolean),
        sourceUrl: sourceUrl || null,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(j?.error || 'Could not submit that.'); return }
    setDone(true)
    onSubmitted()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-900">Suggest a role model</h2>
          <button onClick={onClose} aria-label="Close"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {done ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            Thanks — this is queued for review and will appear once approved.
          </p>
        ) : (
          <div className="space-y-3">
            <input
              value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Why they belong here"
              rows={4} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={categoriesText} onChange={(e) => setCategoriesText(e.target.value)}
              placeholder="Categories, comma separated (e.g. Black, Neurodivergent)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Source link (optional, but helps it get approved)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              onClick={submit}
              disabled={busy || !name.trim() || bio.trim().length < 20}
              className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {busy ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
