import type { Metadata } from 'next'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { voteSignatureMatches } from '@/lib/choiceLinks'
import { monthName, previousMonth, torontoMonth, votingOpen } from '@/lib/choiceTime'
import { CHOICE_DISCLAIMER, CHOICE_KINDS, loadBallot, loadWinners } from '@/lib/communityChoice'
import VoteForm from './VoteForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Community's Choice · Autinerary",
  description: "How Community's Choice works: nominate all month in ResourceHub, vote in the newsletter in the month's last week.",
}

const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

/**
 * Community's Choice (the team's planning note, October 2026, Goal 5): how it
 * works, the month's vote in its last week (opened from the newsletter's
 * link, or signed in), and last month's winners.
 */
export default async function CommunityChoicePage({ searchParams }: { searchParams: { v?: string; m?: string; t?: string } }) {
  const now = new Date()
  const month = torontoMonth(now)
  const open = votingOpen(month, now)
  const admin = createAdminClient()

  // Who is voting: the newsletter's signed link, or the signed-in account.
  let voter = ''
  const fromLink = searchParams.v && searchParams.m === month && voteSignatureMatches(searchParams.v, month, searchParams.t)
  if (fromLink) voter = String(searchParams.v).toLowerCase()
  else {
    const supabase = createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) voter = `u:${user.id}`
  }

  const ballot = open ? await loadBallot(admin, month).catch(() => []) : []
  const mine: Record<string, string> = {}
  if (voter && ballot.length) {
    const { data } = await admin.from('choice_votes').select('kind, item_id').eq('month', month).eq('voter', voter)
    for (const row of data || []) mine[row.kind] = row.item_id
  }
  const last = previousMonth(month)
  const winners = await loadWinners(admin, last).catch(() => [])
  const groups = CHOICE_KINDS.map((k) => ({ id: k.id, plural: k.plural, items: ballot.filter((b) => b.kind === k.id) })).filter((g) => g.items.length > 0)

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-amber-800">Autinerary and ResourceHub</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Community&apos;s Choice</h1>
        <p className="mt-4 leading-relaxed text-slate-800">{CHOICE_DISCLAIMER}</p>

        {open && groups.length > 0 ? (
          <section aria-labelledby="vote-heading" className="mt-8">
            <h2 id="vote-heading" className="text-xl font-bold text-slate-900">
              Vote for {monthName(month)}&apos;s Community&apos;s Choice
            </h2>
            <p className="mt-2 text-slate-800">The most nominated this month. One vote of each kind; you can change it until the month ends.</p>
            {voter ? (
              <VoteForm
                month={month}
                monthLabel={monthName(month)}
                groups={groups}
                mine={mine}
                v={fromLink ? String(searchParams.v) : undefined}
                t={fromLink ? String(searchParams.t) : undefined}
              />
            ) : (
              <p className="mt-4 rounded-lg bg-amber-50 p-4 text-slate-900">
                Vote from the link in this week&apos;s newsletter, or{' '}
                <Link href="/login?returnTo=/community-choice" className="font-medium text-indigo-800 underline underline-offset-2">
                  sign in
                </Link>{' '}
                to vote. No newsletter yet?{' '}
                <Link href="/newsletter" className="font-medium text-indigo-800 underline underline-offset-2">
                  Sign up
                </Link>
                .
              </p>
            )}
          </section>
        ) : (
          <section aria-labelledby="nominate-heading" className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 id="nominate-heading" className="text-lg font-bold text-slate-900">
              Nominations for {monthName(month)} are open
            </h2>
            <p className="mt-2 text-slate-800">
              On any service, shop item or article in ResourceHub, choose “Nominate for Community’s Choice”. In the month’s last
              week, the newsletter carries a vote among the most nominated.
            </p>
            <p className="mt-3 flex flex-wrap gap-3">
              <a href={`${HUB}/search`} className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900">
                Find something to nominate
              </a>
              <Link href="/newsletter" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                Get the newsletter
              </Link>
            </p>
          </section>
        )}

        <section aria-labelledby="how-heading" className="mt-10">
          <h2 id="how-heading" className="text-xl font-bold text-slate-900">
            How it works
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-800">
            <li>All month, anyone signed in can nominate services, shop items and articles in ResourceHub, up to ten of each.</li>
            <li>In the month’s last week, the newsletter carries a vote among the most nominated: five services, three shop items and three articles.</li>
            <li>Each person, or newsletter subscriber, has one vote of each kind.</li>
            <li>On the 1st, the votes are counted. The winners get the Community’s Choice badge in ResourceHub.</li>
          </ol>
          <p className="mt-3 text-sm text-slate-700">
            Nominations or votes that look automated or organised to game the result can be left out (see the{' '}
            <Link href="/terms#community-choice" className="font-medium text-indigo-800 underline underline-offset-2">
              Terms
            </Link>
            ).
          </p>
        </section>

        {winners.length > 0 && (
          <section aria-labelledby="winners-heading" className="mt-10">
            <h2 id="winners-heading" className="text-xl font-bold text-slate-900">
              {monthName(last, true)}&apos;s Community&apos;s Choice
            </h2>
            <ul className="mt-3 space-y-2">
              {winners.map((w) => (
                <li key={w.kind} className="text-slate-800">
                  <span className="font-semibold">{CHOICE_KINDS.find((k) => k.id === w.kind)?.label}:</span>{' '}
                  <a href={w.url} className="font-medium text-indigo-800 underline underline-offset-2">
                    {w.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-sm">
          <Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">
            Back to Autinerary
          </Link>
        </p>
      </article>
    </div>
  )
}
