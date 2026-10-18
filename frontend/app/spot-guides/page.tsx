import type { Metadata } from 'next'
import Link from 'next/link'
import SpotGuideApply from './SpotGuideApply'

export const metadata: Metadata = {
  title: 'Spot Guides · Autinerary',
  description: 'Spot Guides check the new places Autinerary finds before anyone sees them. A few minutes when you have them, from home.',
}

const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

/**
 * The Spot Guides program (the team's planning note, October 2026, Goal 1's
 * "continuous service-adding loop with Spot Guides" and Goal 11's "Help us
 * rate our resources!" page, which links here): what Spot Guides do, and
 * applying.
 */
export default function SpotGuidesProgramPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-amber-800">Autinerary and ResourceHub</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Spot Guides</h1>
        <p className="mt-4 leading-relaxed text-slate-800">
          Every day, Autinerary finds new places across Ontario: therapists, pools, clinics, libraries and more. Spot Guides
          look at them before anyone else sees them, so what families find is real.
        </p>

        <section aria-labelledby="what" className="mt-8">
          <h2 id="what" className="text-xl font-bold text-slate-900">
            What a Spot Guide does
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-6 text-slate-800">
            <li>Opens the new places waiting in ResourceHub, a few at a time.</li>
            <li>Checks each one: is it real, still open, and described truthfully?</li>
            <li>Approves it, or hides it. Nothing is ever deleted, so a mistake can be undone.</li>
            <li>Never says a place is good or bad: that is for the people who use it, in their ratings.</li>
          </ul>
        </section>

        <section aria-labelledby="who" className="mt-8">
          <h2 id="who" className="text-xl font-bold text-slate-900">
            Who can be one
          </h2>
          <p className="mt-2 text-slate-800">
            Anyone 18 or older who knows an area, or a kind of service, and has a few minutes now and then. You do it from home,
            on a phone or a computer, whenever suits you.
          </p>
        </section>

        <section aria-labelledby="apply" className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 id="apply" className="text-xl font-bold text-slate-900">
            Apply
          </h2>
          <div className="mt-3">
            <SpotGuideApply />
          </div>
        </section>

        <p className="mt-8 text-sm text-slate-700">
          Other ways to help: rate the places you have used, and comment on any of them.{' '}
          <a href={`${HUB}/help-us-rate`} className="font-medium text-indigo-800 underline underline-offset-2">
            Help us rate our resources
          </a>
        </p>
        <p className="mt-6 text-sm">
          <Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">
            Back to Autinerary
          </Link>
        </p>
      </article>
    </div>
  )
}
