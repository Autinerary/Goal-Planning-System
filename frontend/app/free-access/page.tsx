import type { Metadata } from 'next'
import FreeAccessForms from './FreeAccessForms'

export const metadata: Metadata = {
  title: 'Free access · Autinerary',
  description: 'Use Autinerary free: as a student, through your workplace or government, or by explaining your situation.',
}

/**
 * Free access (the planning note's Goal 9, the four types: Students,
 * Employees, Other (government or city), None (explain your case, and help
 * advocate for your town)).
 */
export default function FreeAccessPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-indigo-800">Autinerary</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Use Autinerary free</h1>
        <p className="mt-4 leading-relaxed text-slate-800">
          Schools, workplaces and governments can pay for Autinerary for their people. If yours does, or you can&apos;t pay,
          here is how to use it free.
        </p>
        <FreeAccessForms />
      </article>
    </div>
  )
}
