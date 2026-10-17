import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { INSTITUTIONS, campusTown } from '@/lib/campus'

export const metadata = { title: 'Near a college or university | ResourceHub' }

/**
 * Near a college or university (the team's planning note, October 2026:
 * services near universities and colleges, as a partnership package). Every
 * public college and university in Ontario, each with what is near its
 * campuses.
 */
export default function CampusesPage() {
  const groups = [
    { heading: 'Universities', items: INSTITUTIONS.filter((i) => i.kind === 'university') },
    { heading: 'Colleges', items: INSTITUTIONS.filter((i) => i.kind === 'college') },
  ]
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="w-8 h-8 text-blue-700" aria-hidden="true" />
            <h1 className="text-3xl font-bold text-gray-900">Near a college or university</h1>
          </div>
          <p className="max-w-2xl text-gray-700">
            Places near each campus in Ontario: study spots, cafés, counselling, doctors, swimming and job programs, for
            students and the people who support them. Choose a school.
          </p>
          {groups.map((g) => (
            <section key={g.heading} aria-labelledby={`campus-${g.heading}`} className="mt-8">
              <h2 id={`campus-${g.heading}`} className="text-xl font-semibold text-gray-900">
                {g.heading}
              </h2>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((i) => (
                  <li key={i.slug}>
                    <Link
                      href={`/campus/${i.slug}`}
                      className="block rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <span className="block font-medium">{i.name}</span>
                      <span className="block text-sm text-gray-600">
                        {i.campuses.length === 1 ? campusTown(i.campuses[0]) || '1 campus' : `${i.campuses.length} campuses`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="mt-8 text-xs text-gray-600">Campus locations © OpenStreetMap contributors (ODbL).</p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
