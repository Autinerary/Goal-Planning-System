import type { Metadata } from 'next'
import Link from 'next/link'
import { verifyCheckinToken } from '@/lib/checkinToken'
import { STOP_REASONS } from '@/lib/checkin'
import CheckinQuestion from '../components/CheckinQuestion'
import StopCheckinEmails from './StopCheckinEmails'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'One quick question · Autinerary',
  robots: { index: false, follow: false },
}

/**
 * Where the check-in email links to (app/api/cron/inactive-checkin). Works
 * without signing in: the link's signed token says whose answer it is.
 * ?stop=1 (the email's "Stop these emails" link) leads with turning them off.
 */
export default function CheckinPage({ searchParams }: { searchParams: { t?: string; stop?: string } }) {
  const token = typeof searchParams.t === 'string' ? searchParams.t : ''
  const valid = Boolean(token && verifyCheckinToken(token))
  const stopFirst = searchParams.stop === '1'

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <p className="mb-6 text-lg font-bold text-indigo-800">Autinerary</p>

        {!valid ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="mb-2 text-xl font-bold text-slate-900">This link has expired</h1>
            <p className="mb-4 text-slate-700">
              Check-in links work for 30 days. Thank you for opening it all the same. You can change check-in emails in Settings after signing in.
            </p>
            <Link href="/login" className="inline-block rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800">
              Sign in
            </Link>
          </div>
        ) : stopFirst ? (
          <StopCheckinEmails token={token} prominent />
        ) : (
          <>
            <CheckinQuestion
              headingLevel="h1"
              kind="inactive_email"
              heading="One quick question"
              intro="You haven't opened Autinerary for a couple of weeks, and that's okay. Telling us why helps us fix what got in the way. You don't need to sign in."
              legend="What got in the way?"
              options={STOP_REASONS}
              commentLabel="Anything else you want to tell us?"
              thanks="Thank you. This helps us fix what got in the way. You can come back to your Path any time."
              token={token}
            />
            <StopCheckinEmails token={token} />
          </>
        )}

        {valid && (
          <p className="mt-8 text-sm text-slate-700">
            <Link href="/login" className="font-medium text-indigo-800 underline underline-offset-2">
              Open Autinerary
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
