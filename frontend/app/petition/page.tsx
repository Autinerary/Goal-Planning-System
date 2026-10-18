import type { Metadata } from 'next'
import Link from 'next/link'
import PetitionForm from './PetitionForm'
import { PETITION_HASHTAG, PETITION_TEXT } from '@/lib/petition'

export const metadata: Metadata = {
  title: 'Help us make Autinerary free · #FundAutinerary',
  description: 'Ask your government, university, college, workplace or city to fund Autinerary, so it stays free for neurodivergent people and families.',
}

/**
 * #FundAutinerary (the planning note's Goal 9: "Sign this petition for
 * Canadian Gov't/Your University/College/Workplace to Fund Us + Post
 * #FundAutinerary"), for anyone, signed in or not.
 */
export default function PetitionPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-amber-800">{PETITION_HASHTAG}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Help us make Autinerary free</h1>
        <p className="mt-4 leading-relaxed text-slate-800">{PETITION_TEXT}</p>
        <p className="mt-3 leading-relaxed text-slate-800">
          Universities, colleges, workplaces and governments already pay for services like this for the people they serve. When
          enough of their own people ask, they say yes, and Autinerary stays free for you and everyone like you.
        </p>
        <div className="mt-8">
          <PetitionForm />
        </div>
        <p className="mt-10 text-sm">
          <Link href="/pricing" className="font-medium text-indigo-800 underline underline-offset-2">
            How Autinerary is paid for
          </Link>
          {' · '}
          <Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">
            Back to Autinerary
          </Link>
        </p>
      </article>
    </div>
  )
}
