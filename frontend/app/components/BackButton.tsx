'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * Back to the previous page, or to `fallback` when this page was opened
 * directly (a new tab, a link from an email). Riipen Labs, Group 34: "Add a
 * back button to every page".
 */
export default function BackButton({ fallback = '/path', label = 'Back', className = '' }: { fallback?: string; label?: string; className?: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className={`inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 ${className}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {label}
    </button>
  )
}
