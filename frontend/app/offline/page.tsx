import Link from 'next/link'

export const metadata = { title: 'Offline · Autinerary' }

/**
 * Shown by the service worker when a page is requested with no network and
 * nothing cached. Deliberately plain and reassuring rather than an error —
 * losing signal is not the user's mistake, and "something went wrong" is
 * exactly the wrong message for this audience.
 */
export default function OfflinePage() {
  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-b from-sky-50 to-white p-6">
      <div className="max-w-sm text-center">
        <div className="text-5xl mb-4" aria-hidden="true">🌙</div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">You&apos;re offline</h1>
        <p className="text-sm text-slate-600 mb-6">
          Autinerary needs a connection to load your path. Nothing has been lost — everything
          you&apos;ve done is saved and will be here when you&apos;re back.
        </p>
        <Link
          href="/races"
          className="inline-block px-5 py-2.5 rounded-xl bg-cyan-600 text-white font-semibold text-sm hover:bg-cyan-700"
        >
          Try again
        </Link>
      </div>
    </main>
  )
}
