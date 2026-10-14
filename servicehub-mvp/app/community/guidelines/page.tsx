import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { CONTENT_NOTES } from '@/lib/community/contentNotes'

export const metadata: Metadata = {
  title: 'Community guidelines · Tidbits',
  description: 'How people treat each other in Tidbits, what moderators remove, how to report something, and content notes.',
}

const APP = (process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000').replace(/\/$/, '')

/**
 * Tidbits' community guidelines (Riipen Labs, Group 15: "Visible safety
 * signals in community spaces: clear moderation policy, content warnings,
 * and an easy report path, especially for first-time posters"; their risk
 * map: "Community space feels unmoderated or unsafe for a first post"). Every
 * line is what Tidbits does: pseudonyms (lib/community/pseudonym.ts), reports
 * to the moderation queue (/admin/community), locking and removal by
 * moderators, authors deleting their own posts, and content notes
 * (lib/community/contentNotes.ts). The app's Hare World messages follow the
 * same rules and are linked here from the app.
 */
export default function CommunityGuidelinesPage() {
  const h2 = 'text-xl font-bold text-gray-900'
  const list = 'mt-2 list-disc space-y-1.5 pl-5 text-gray-800'
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Tidbits', href: '/community' }, { label: 'Community guidelines', href: '/community/guidelines' }]} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
        <article className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Community guidelines</h1>
          <p className="mt-3 text-lg text-gray-800">
            Tidbits is where people with similar experiences ask questions and share what worked. These guidelines keep it
            a place where a first post feels safe.
          </p>

          <section className="mt-8" aria-labelledby="who-sees">
            <h2 id="who-sees" className={h2}>Who sees what you post</h2>
            <ul className={list}>
              <li>Tidbits is read by people signed in to Autinerary. This page is open to everyone.</li>
              <li>You post under a pseudonym, never your real name, and your account&apos;s details are never shown.</li>
              <li>You can delete your own posts and answers at any time.</li>
            </ul>
          </section>

          <section className="mt-8" aria-labelledby="how-we-treat">
            <h2 id="how-we-treat" className={h2}>How we treat each other</h2>
            <ul className={list}>
              <li>Be kind, and assume good intent. People here are at different points of their journey.</li>
              <li>Share what worked for you as your experience, not as the one right answer.</li>
              <li>Respect how people describe themselves: identity-first or person-first, and the words they use for their norms.</li>
              <li>Nothing here is medical or clinical advice. Suggest asking a professional when it matters.</li>
            </ul>
          </section>

          <section className="mt-8" aria-labelledby="what-removed">
            <h2 id="what-removed" className={h2}>What moderators remove</h2>
            <ul className={list}>
              <li>Personal details, yours or anyone else&apos;s: full names, addresses, phone numbers, a school or workplace that identifies someone.</li>
              <li>Hate, harassment, threats, and anything that mocks someone for how they work or who they are.</li>
              <li>Selling, advertising, and links that are not there to help.</li>
              <li>Medical claims presented as fact, such as cures, and anything that pushes someone away from care they need.</li>
            </ul>
            <p className="mt-3 text-gray-800">
              Moderators are people on the Autinerary team. They can remove a post or answer, or lock a question so it takes
              no new answers.
            </p>
          </section>

          <section className="mt-8" aria-labelledby="report">
            <h2 id="report" className={h2}>Reporting something</h2>
            <ul className={list}>
              <li>Every post and answer has a <strong>Report</strong> button. Choose it, say what is wrong in a few words, and send.</li>
              <li>A moderator reviews each report. The person you report is not told who reported them.</li>
              <li>In the app, a message in Hare World can be reported from the message itself, and anyone can be blocked from their card.</li>
            </ul>
          </section>

          <section className="mt-8" aria-labelledby="notes">
            <h2 id="notes" className={h2}>Content notes</h2>
            <p className="mt-2 text-gray-800">
              Writing about something hard? Add a content note when you ask. Readers see the note first, and open your post
              only if they choose. The notes are:
            </p>
            <ul className={list}>
              {CONTENT_NOTES.map((n) => <li key={n.id}>{n.label}</li>)}
            </ul>
          </section>

          <section className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5" aria-labelledby="right-now">
            <h2 id="right-now" className="text-lg font-bold text-gray-900">Need help right now?</h2>
            <p className="mt-1 text-gray-800">
              Tidbits is not watched around the clock. If you or someone else is in danger, call 911. In Canada you can call or
              text 9-8-8 at any time.{' '}
              <a href={`${APP}/help#talk-now`} className="font-medium text-blue-800 underline underline-offset-2">More people to call</a>
            </p>
          </section>

          <p className="mt-8">
            <Link href="/community" className="font-medium text-blue-800 underline underline-offset-2">Back to Tidbits</Link>
          </p>
        </article>
      </main>
      <Footer />
    </div>
  )
}
