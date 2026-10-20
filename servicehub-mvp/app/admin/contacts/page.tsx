'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Mail } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'

interface Row {
  kind: 'service' | 'product'
  name: string
  email: string
  category: string
  place: string
  website: string
  link: string
  added: string
}

/**
 * The team's contact list: every service's and shop item maker's published
 * email (the team's notes, October 2026). A list to work from, with a CSV
 * to download; nothing is sent from here.
 */
export default function AdminContactsPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [counts, setCounts] = useState<{ services: number; products: number; uniqueEmails: number } | null>(null)
  const [productsReady, setProductsReady] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | 'service' | 'product'>('all')

  useEffect(() => {
    fetch('/api/admin/contacts', { credentials: 'include' })
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (!r.ok) throw new Error(d?.error === 'Forbidden' ? 'For the team.' : d?.error || 'Couldn’t load the list')
        setRows(d.rows || [])
        setCounts(d.counts || null)
        setProductsReady(d.productsReady !== false)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Couldn’t load the list'))
  }, [])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (rows || []).filter((r) => (kind === 'all' || r.kind === kind) && (!t || `${r.name} ${r.email} ${r.category} ${r.place}`.toLowerCase().includes(t)))
  }, [rows, q, kind])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-800">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Admin
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <Mail className="h-7 w-7 text-blue-700" aria-hidden="true" /> Contact list
            </h1>
            <p className="mt-1 text-sm text-gray-700">
              Each listed service&apos;s and shop item maker&apos;s published email, to contact them. Nothing is sent from here.
            </p>
          </div>
          <a href="/api/admin/contacts?format=csv" className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            <Download className="h-4 w-4" aria-hidden="true" /> Download CSV
          </a>
        </div>
        {counts && (
          <p className="mt-4 text-sm text-gray-900">
            {counts.services.toLocaleString()} services and {counts.products.toLocaleString()} shop items; {counts.uniqueEmails.toLocaleString()} different addresses.
            {!productsReady && ' Shop items’ emails come once STEP 86 is in the database.'}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-6 text-sm text-red-800">
            {error}
          </p>
        )}
        {rows === null && !error && <p className="mt-6 text-gray-700">Loading…</p>}
        {rows && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="text-sm text-gray-900">
                <span className="sr-only">Search the list</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, emails, places" className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm text-gray-900">
                <span className="sr-only">Which</span>
                <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="all">Services and shop items</option>
                  <option value="service">Services</option>
                  <option value="product">Shop items</option>
                </select>
              </label>
              <span className="text-sm text-gray-700">{shown.length.toLocaleString()} shown</span>
            </div>
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-700">
                  <tr>
                    <th scope="col" className="px-3 py-2">Name</th>
                    <th scope="col" className="px-3 py-2">Email</th>
                    <th scope="col" className="px-3 py-2">Kind</th>
                    <th scope="col" className="px-3 py-2">Category</th>
                    <th scope="col" className="px-3 py-2">Place</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shown.slice(0, 500).map((r) => (
                    <tr key={`${r.kind}:${r.link}:${r.email}`}>
                      <td className="px-3 py-2">
                        <Link href={r.link} className="text-blue-800 underline-offset-2 hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-900">{r.email}</td>
                      <td className="px-3 py-2 text-gray-800">{r.kind === 'service' ? 'Service' : 'Shop item'}</td>
                      <td className="px-3 py-2 text-gray-800">{r.category}</td>
                      <td className="px-3 py-2 text-gray-800">{r.place}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.length > 500 && <p className="mt-2 text-xs text-gray-700">The first 500 are shown; the CSV has them all.</p>}
          </>
        )}
      </main>
    </div>
  )
}
