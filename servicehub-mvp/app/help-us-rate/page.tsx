import Link from 'next/link'
import { MapPin, MessageSquare, ShieldCheck, Star, Users } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { APP_URL } from '@/lib/appSignIn'

export const metadata = { title: 'Help us rate our resources | ResourceHub' }

/**
 * "Help us rate our resources!" (the team's planning note, October 2026,
 * Goal 11: a page at the end of the navbar, linking to the Spot Guides
 * program page on Autinerary's site): the ways anyone can help ResourceHub's
 * ratings be true, and the Spot Guides program for people who want to do
 * more.
 */
export default function HelpUsRatePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl font-bold text-gray-900">Help us rate our resources!</h1>
          <p className="mt-3 text-lg text-gray-800">
            ResourceHub lists about 35,000 places. What makes it useful is what people who have used them say. Here is how you
            can help.
          </p>

          <section aria-labelledby="rate" className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
            <h2 id="rate" className="flex items-center gap-2 text-xl font-semibold text-gray-900">
              <Star className="h-5 w-5 text-amber-700" aria-hidden="true" /> Rate what you have used
            </h2>
            <p className="mt-2 text-gray-800">
              Ratings come from people who have used a service: one in your team, one you recommended, or one you used before you
              joined (send us proof, and you can rate it). Open its page and choose <span className="font-medium">Rate this resource</span>.
            </p>
            <p className="mt-3 flex flex-wrap gap-3">
              <Link href="/my-resources" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                Your team and saved places
              </Link>
              <Link href="/search" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50">
                Find a place you have used
              </Link>
            </p>
          </section>

          <section aria-labelledby="comment" className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
            <h2 id="comment" className="flex items-center gap-2 text-xl font-semibold text-gray-900">
              <MessageSquare className="h-5 w-5 text-blue-800" aria-hidden="true" /> Comment, recommend, nominate
            </h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-6 text-gray-800">
              <li>Anyone signed in can comment on any service: a question, a tip, what you have heard.</li>
              <li>
                Missing a place? <Link href="/resources/new" className="font-medium text-blue-800 underline">Recommend it</Link>, and
                you can rate it.
              </li>
              <li>Nominate the best for this month&apos;s Community&apos;s Choice, on its page.</li>
            </ul>
          </section>

          <section aria-labelledby="guides" className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-6">
            <h2 id="guides" className="flex items-center gap-2 text-xl font-semibold text-gray-900">
              <ShieldCheck className="h-5 w-5 text-amber-800" aria-hidden="true" /> Become a Spot Guide
            </h2>
            <p className="mt-2 text-gray-800">
              Spot Guides check the new places Autinerary finds before anyone sees them: is it real, open, and described
              truthfully? A few minutes when you have them, from home.
            </p>
            <ul className="mt-3 space-y-1.5 text-gray-800">
              <li className="flex items-start gap-2">
                <MapPin className="mt-1 h-4 w-4 flex-shrink-0 text-amber-800" aria-hidden="true" /> Know your area? You know which
                places are real.
              </li>
              <li className="flex items-start gap-2">
                <Users className="mt-1 h-4 w-4 flex-shrink-0 text-amber-800" aria-hidden="true" /> Your checks help families find
                what fits, faster.
              </li>
            </ul>
            <p className="mt-4">
              <a href={`${APP_URL}/spot-guides`} className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900">
                About the Spot Guides program
              </a>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
