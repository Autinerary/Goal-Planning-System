import Link from 'next/link'
import type { ReactNode } from 'react'
import { CONTACT_EMAIL } from '@/lib/contact'

/** The layout of the policy pages (About and contact, Cookies, Refunds, Delete my data, Credits), as Privacy's. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated?: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-indigo-800">Autinerary</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        {updated && <p className="mt-2 text-sm text-slate-700">Last updated {updated}.</p>}
        {intro && <div className="mt-6 leading-relaxed text-slate-800">{intro}</div>}
        {children}
        <p className="mt-10 text-sm">
          <Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">Back to Autinerary</Link>
        </p>
      </article>
    </div>
  )
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="text-xl font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-slate-800">{children}</div>
    </section>
  )
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-6">{children}</ul>
}

export const linkClass = 'font-medium text-indigo-800 underline underline-offset-2'

export function Mail({ subject }: { subject?: string }) {
  const href = `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`
  return <a href={href} className={linkClass}>{CONTACT_EMAIL}</a>
}
