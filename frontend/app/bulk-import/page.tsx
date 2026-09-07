'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight,
  Loader2, Sparkles, Trash2,
} from 'lucide-react'

const DIMENSIONS = [
  { id: 'education', label: 'Education' },
  { id: 'workplace', label: 'Workplace' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'health', label: 'Health' },
  // Odosa: never show the word "barrier". The key stays for data matching.
  { id: 'barrier', label: 'Norms' },
]

const RESOURCE_CATEGORIES = [
  'therapist', 'school', 'doctor', 'park', 'store', 'app', 'book',
  'support_group', 'organization', 'workshop', 'recreation', 'other',
]

interface Item {
  id: string
  kind: 'milestone' | 'resource'
  name: string
  description: string | null
  categoryKey: string | null
  dimension: string | null
  resourceCategory: string | null
  confidence: 'high' | 'low'
  included: boolean
}

/**
 * Mass recommending (Odosa): paste a list in any format, get it back as
 * milestones and resources filed under real life paths, then correct it —
 * "all at once, or at least go one by one".
 *
 * Both review modes exist because they serve different people: a table is
 * faster if you trust most of it, and one-at-a-time is far less
 * overwhelming if you don't — which matters for this audience specifically.
 *
 * Nothing is written until Save. Everything saved lands as pending review.
 */
export default function BulkImportPage() {
  const [text, setText] = useState('')
  const [items, setItems] = useState<Item[] | null>(null)
  const [categories, setCategories] = useState<{ key: string; title: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'table' | 'one'>('table')
  const [cursor, setCursor] = useState(0)
  const [saved, setSaved] = useState<{ milestones: number; resources: number } | null>(null)

  const parse = async () => {
    setBusy(true); setError(''); setSaved(null)
    try {
      const res = await fetch('/api/bulk-import/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j?.error || 'Could not read that list.'); return }
      const parsed: Item[] = (j.items || []).map((it: any) => ({ ...it, included: true }))
      setCategories(j.categories || [])
      setItems(parsed)
      setCursor(0)
      if (parsed.length === 0) setError('No milestones or resources found in that text.')
    } catch {
      setError('Something went wrong reading that list.')
    } finally {
      setBusy(false)
    }
  }

  const update = (id: string, patch: Partial<Item>) =>
    setItems((prev) => (prev || []).map((it) => (it.id === id ? { ...it, ...patch } : it)))

  const chosen = useMemo(() => (items || []).filter((i) => i.included), [items])

  const save = async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/bulk-import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: chosen }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j?.error || 'Could not save.'); return }
      setSaved({ milestones: j.milestones || 0, resources: j.resources || 0 })
      setItems(null)
      setText('')
    } catch {
      setError('Something went wrong saving.')
    } finally {
      setBusy(false)
    }
  }

  const lowConfidence = (items || []).filter((i) => i.included && i.confidence === 'low').length

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/path-market" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-600" /> Recommend a batch
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Paste a list of milestones and resources however you have it — bullets, numbered,
          messy notes. We&apos;ll sort them into life paths and you can fix anything before saving.
        </p>

        {saved && (
          <div className="mb-6 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-bold">Sent for review</p>
            <p className="mt-1">
              {saved.milestones} milestone{saved.milestones === 1 ? '' : 's'} and{' '}
              {saved.resources} resource{saved.resources === 1 ? '' : 's'}. They&apos;ll appear
              once an admin approves them.
            </p>
          </div>
        )}

        {!items && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder={`e.g.\n- Book an appointment with the campus disability office\n- Headspace app for sleep\n- Join a study group\n- Dr Chen, OT on Bloor St`}
              className="w-full rounded-xl border-2 border-slate-200 p-4 text-sm font-mono focus:border-purple-400 focus:outline-none"
            />
            <button
              onClick={parse}
              disabled={busy || text.trim().length < 10}
              className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? 'Reading…' : 'Sort this list'}
            </button>
          </>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-2 text-sm text-red-600">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{error}</span>
          </p>
        )}

        {items && items.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                <button
                  onClick={() => setMode('table')}
                  className={`px-3 py-1.5 text-xs font-semibold ${mode === 'table' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600'}`}
                >
                  Review all at once
                </button>
                <button
                  onClick={() => setMode('one')}
                  className={`px-3 py-1.5 text-xs font-semibold ${mode === 'one' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600'}`}
                >
                  One at a time
                </button>
              </div>
              <span className="text-xs text-slate-500">
                {chosen.length} of {items.length} selected
                {lowConfidence > 0 && ` · ${lowConfidence} need checking`}
              </span>
            </div>

            {mode === 'table' ? (
              <div className="space-y-2">
                {items.map((it) => (
                  <ItemRow key={it.id} item={it} categories={categories} onChange={update} />
                ))}
              </div>
            ) : (
              <div>
                <ItemRow
                  item={items[Math.min(cursor, items.length - 1)]}
                  categories={categories}
                  onChange={update}
                  expanded
                />
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={() => setCursor((c) => Math.max(0, c - 1))}
                    disabled={cursor === 0}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  <span className="text-xs text-slate-500">
                    {Math.min(cursor + 1, items.length)} of {items.length}
                  </span>
                  <button
                    onClick={() => setCursor((c) => Math.min(items.length - 1, c + 1))}
                    disabled={cursor >= items.length - 1}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-sm disabled:opacity-40"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={save}
                disabled={busy || chosen.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Send {chosen.length} for review
              </button>
              <button
                onClick={() => { setItems(null); setError('') }}
                className="px-4 py-3 rounded-xl border border-slate-300 text-slate-600 text-sm hover:bg-slate-50"
              >
                Start over
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function ItemRow({
  item, categories, onChange, expanded = false,
}: {
  item: Item
  categories: { key: string; title: string }[]
  onChange: (id: string, patch: Partial<Item>) => void
  expanded?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        !item.included
          ? 'border-slate-200 bg-slate-50 opacity-60'
          : item.confidence === 'low'
          ? 'border-amber-300 bg-amber-50'
          : 'border-slate-200 bg-white'
      } ${expanded ? 'p-5' : ''}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.included}
          onChange={(e) => onChange(item.id, { included: e.target.checked })}
          className="mt-1.5"
          aria-label={`Include ${item.name}`}
        />

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={item.name}
              onChange={(e) => onChange(item.id, { name: e.target.value })}
              className="flex-1 text-sm font-semibold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-purple-500 outline-none bg-transparent"
            />
            {item.confidence === 'low' && (
              <span className="text-[10px] font-bold text-amber-700 whitespace-nowrap">check this</span>
            )}
            <button
              onClick={() => onChange(item.id, { included: false })}
              aria-label="Discard"
              className="text-slate-300 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Milestone or resource — the model's guess, correctable. */}
            <select
              value={item.kind}
              onChange={(e) => onChange(item.id, { kind: e.target.value as Item['kind'] })}
              className="text-xs border border-slate-200 rounded-md px-1.5 py-1"
            >
              <option value="milestone">Milestone</option>
              <option value="resource">Resource</option>
            </select>

            <select
              value={item.categoryKey || ''}
              onChange={(e) => onChange(item.id, { categoryKey: e.target.value || null })}
              className="text-xs border border-slate-200 rounded-md px-1.5 py-1"
            >
              <option value="">Life path…</option>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>{c.title}</option>
              ))}
            </select>

            {item.kind === 'milestone' ? (
              <select
                value={item.dimension || 'education'}
                onChange={(e) => onChange(item.id, { dimension: e.target.value })}
                className="text-xs border border-slate-200 rounded-md px-1.5 py-1"
              >
                {DIMENSIONS.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            ) : (
              <select
                value={item.resourceCategory || 'other'}
                onChange={(e) => onChange(item.id, { resourceCategory: e.target.value })}
                className="text-xs border border-slate-200 rounded-md px-1.5 py-1"
              >
                {RESOURCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
            )}
          </div>

          {expanded && (
            <textarea
              value={item.description || ''}
              onChange={(e) => onChange(item.id, { description: e.target.value || null })}
              placeholder="Description (optional)"
              rows={3}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5"
            />
          )}
        </div>
      </div>
    </div>
  )
}
