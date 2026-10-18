import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { surveySignatureMatches } from '@/lib/listings'
import SurveyForm from './SurveyForm'

export const metadata: Metadata = {
  title: 'What would you like in your Resource Account? · ResourceHub',
  robots: { index: false },
}
export const dynamic = 'force-dynamic'

const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

/**
 * The V1.5 survey for services (the planning note, October 2026, Goal 11),
 * from the link in their email. The link is signed for one listing, so the
 * answer is known to come from that listing's inbox; no account needed.
 */
export default async function ProviderSurveyPage({ searchParams }: { searchParams: { r?: string; t?: string } }) {
  const r = String(searchParams.r || '').toLowerCase()
  const t = String(searchParams.t || '')
  const ok = surveySignatureMatches(r, t)
  const { data: listing } = ok ? await createAdminClient().from('resources').select('id, name, image_url, image_is_generic').eq('id', r).maybeSingle() : { data: null }
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-indigo-800">ResourceHub</p>
        {!listing ? (
          <>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">This link doesn&apos;t work</h1>
            <p className="mt-3 text-slate-800">Please use the link in the email exactly as it came, or email heydevs@autinerary.ca.</p>
          </>
        ) : (
          <>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">What would {listing.name} like in its Resource Account?</h1>
            <p className="mt-3 leading-relaxed text-slate-800">
              Resource Accounts let services keep their listing right and see how people use it. Tell us what you&apos;d use. It
              takes a minute, and you don&apos;t need an account.
            </p>
            <SurveyForm
              r={r}
              t={t}
              name={listing.name}
              image={listing.image_url && !listing.image_is_generic ? listing.image_url : null}
              listingUrl={`${HUB}/resources/${listing.id}`}
            />
          </>
        )}
      </article>
    </div>
  )
}
