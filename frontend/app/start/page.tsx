import type { Metadata } from 'next'
import Link from 'next/link'
import FunnelPing from '../components/FunnelPing'
import StartHere from '../components/StartHere'
import AccountLink from './AccountLink'

export const metadata: Metadata = {
  title: 'Start here · Autinerary',
  description: 'Two quick questions, then neurodivergent-friendly starter resources that fit your situation. No account needed.',
}

/**
 * "Start here" on its own: the landing page for campaign links (Riipen Labs,
 * Group 4: "use campaign assets to send users to targeted landing paths
 * instead of a general destination"), e.g. /start?for=child&need=services.
 * Also where signed-in people reopen the path they saved (Quick Links).
 */
export default function StartPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FunnelPing event="landing_view" />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-lg font-bold">Autinerary</Link>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
              Beta
            </span>
          </div>
          <AccountLink />
        </div>
      </header>
      <main>
        <StartHere standalone />
      </main>
      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-2 text-sm text-slate-700 sm:flex-row">
          <Link href="/" className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-900">
            What is Autinerary?
          </Link>
          <Link href="/privacy" className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-900">
            Privacy
          </Link>
          <span>© 2026 Autinerary Corp. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
