'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'

interface Batch {
  batch: string
  pending: number
  approved: number
  hidden: number
  first_added: string
}

interface Place {
  id: string
  name: string
  category: string
  location: { city?: string | null; address?: string | null } | null
  contact_info: { website?: string | null } | null
  source_url: string | null
}

/**
 * What the service-adding loop and the bulk imports found, batch by batch,
 * for a Spot Guide to approve or hide (app/api/spot-guides). A batch can be
 * approved or hidden whole after a look at its places.
 */
export default function SpotGuideQueue() {
  const [batches, setBatches] = useState<Batch[] | null>(null)
  const [note, setNote] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const loadBatches = useCallback(async () => {
    const res = await fetch('/api/spot-guides', { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    setBatches(data.batches || [])
    setNote(data.note || data.error || '')
  }, [])
  useEffect(() => {
    loadBatches()
  }, [loadBatches])

  const loadPlaces = async (batch: string) => {
    setOpen(batch)
    setPlaces([])
    const res = await fetch(`/api/spot-guides?batch=${encodeURIComponent(batch)}`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    setPlaces(data.places || [])
  }

  const act = async (action: 'approve' | 'hide', batch: string, ids?: string[]) => {
    if (!ids) {
      const b = batches?.find((x) => x.batch === batch)
      const verb = action === 'approve' ? 'Approve' : 'Hide'
      if (!window.confirm(`${verb} all ${b?.pending ?? ''} pending places in ${batch}?`)) return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/spot-guides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, batch, ids }) })
      const data = await res.json().catch(() => ({}))
      setMessage(res.ok ? `${action === 'approve' ? 'Approved' : 'Hidden'}: ${data.changed}.` : data.error || 'That did not work.')
      if (ids) setPlaces((p) => p.filter((x) => !ids.includes(x.id)))
      else if (open === batch) setPlaces([])
      await loadBatches()
    } finally {
      setBusy(false)
    }
  }

  if (batches === null) return <p className="text-gray-700">Loading…</p>

  return (
    <div className="space-y-6">
      <p className="sr-only" role="status" aria-live="polite">
        {message}
      </p>
      {message && <p className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-800">{message}</p>}
      {note && <p className="text-sm text-gray-700">{note}</p>}
      {batches.length === 0 && !note && <p className="text-gray-700">Nothing is waiting.</p>}
      <ul className="space-y-3">
        {batches.map((b) => (
          <li key={b.batch} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">{b.batch}</p>
                <p className="text-sm text-gray-700">
                  {b.pending} waiting · {b.approved} approved · {b.hidden} hidden · added {new Date(b.first_added).toLocaleDateString('en-CA')}
                </p>
              </div>
              {b.pending > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => loadPlaces(b.batch)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
                    Look at them
                  </button>
                  <button type="button" disabled={busy} onClick={() => act('approve', b.batch)} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                    Approve all {b.pending}
                  </button>
                  <button type="button" disabled={busy} onClick={() => act('hide', b.batch)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60">
                    Hide all
                  </button>
                </div>
              )}
            </div>
            {open === b.batch && (
              <table className="mt-4 w-full text-left text-sm">
                <caption className="sr-only">Pending places in {b.batch}</caption>
                <thead>
                  <tr className="text-gray-600">
                    <th scope="col" className="py-1 pr-2 font-medium">Place</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Kind</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Where</th>
                    <th scope="col" className="py-1 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {places.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100 align-top">
                      <td className="py-2 pr-2 text-gray-900">
                        {p.name}
                        <span className="block text-xs">
                          {p.contact_info?.website && (
                            <a href={p.contact_info.website} target="_blank" rel="noopener noreferrer" className="mr-3 text-blue-700 underline">
                              Website<span className="sr-only"> of {p.name}</span>
                            </a>
                          )}
                          {p.source_url && (
                            <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 underline">
                              On the map<span className="sr-only"> ({p.name})</span>
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          )}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-gray-700">{p.category}</td>
                      <td className="py-2 pr-2 text-gray-700">{[p.location?.address, p.location?.city].filter(Boolean).join(', ') || 'Ontario'}</td>
                      <td className="py-2 whitespace-nowrap">
                        <button type="button" disabled={busy} onClick={() => act('approve', b.batch, [p.id])} className="mr-2 font-medium text-blue-700 underline">
                          Approve<span className="sr-only"> {p.name}</span>
                        </button>
                        <button type="button" disabled={busy} onClick={() => act('hide', b.batch, [p.id])} className="font-medium text-gray-700 underline">
                          Hide<span className="sr-only"> {p.name}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
