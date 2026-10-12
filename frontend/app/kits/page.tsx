import Link from 'next/link'
import type { Metadata } from 'next'
import { STARTER_KITS } from '@/lib/starterKits'

export const metadata: Metadata = {
  title: 'Starter kits for parents · Autinerary',
  description: 'Step-by-step guides for parents in Ontario: getting an autism assessment, and support at school with an IEP.',
}

const linkClass = 'font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950'

/**
 * /kits: the starter kits for parents (Riipen Labs, Group 24: "Surface 2
 * pre-curated 'Caregiver Starter Kits'", served "instantly ... when users
 * skip profiling"). No account needed; setup's "Skip to resources" opens it
 * for parents and people supporting someone.
 */
export default function KitsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Starter kits</p>
      <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">Starter kits for parents in Ontario</h1>
      <p className="mt-2 text-slate-800">Short, step-by-step guides for the things parents ask about most, with places that can help. No account needed.</p>
      <ul className="mt-6 space-y-3">
        {STARTER_KITS.map((kit) => (
          <li key={kit.id} className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
            <Link href={`/kits/${kit.id}`} className={`text-lg ${linkClass}`}>{kit.title}</Link>
            <p className="mt-1 text-slate-800">{kit.summary}</p>
            <p className="mt-1 text-sm text-slate-700">{kit.steps.length} steps · {kit.forWhom}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-slate-800">
        Looking for something else? <Link href="/start" className={linkClass}>Find starter resources</Link> for what you need today.
        Need help right now? <Link href="/help#talk-now" className={linkClass}>Who to call</Link>.
      </p>
    </main>
  )
}
