import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MapPin } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { INSTITUTIONS, NEAR_CAMPUS, campusTown, institution, nearCampusHref } from '@/lib/campus'

export function generateStaticParams() {
  return INSTITUTIONS.map((i) => ({ slug: i.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const i = institution(params.slug)
  return { title: i ? `Near ${i.name} | ResourceHub` : 'Near a campus | ResourceHub' }
}

/** One college or university: for each campus, what is near it, one click each. */
export default function CampusPage({ params }: { params: { slug: string } }) {
  const inst = institution(params.slug)
  if (!inst) notFound()
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/campus" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 underline">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            All colleges and universities
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Near {inst.name}</h1>
          <p className="mt-2 max-w-2xl text-gray-700">
            Nearest first from each campus. Places are rated by people with similar norms as more of them are rated.
          </p>
          <div className="mt-6 space-y-6">
            {inst.campuses.map((c) => (
              <section key={`${c.lat},${c.lng}`} aria-labelledby={`c-${c.lat}`} className="rounded-lg border border-gray-200 bg-white p-5">
                <h2 id={`c-${c.lat}`} className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <MapPin className="w-5 h-5 text-blue-700" aria-hidden="true" />
                  {c.name}
                  {campusTown(c) && <span className="text-sm font-normal text-gray-600">{campusTown(c)}</span>}
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {NEAR_CAMPUS.map((k) => (
                    <li key={k.q}>
                      <Link
                        href={nearCampusHref(c, k.q)}
                        className="inline-flex min-h-[44px] items-center rounded-full border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-900 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {k.label}
                        <span className="sr-only"> near {c.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-8 text-xs text-gray-600">Campus locations © OpenStreetMap contributors (ODbL).</p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
