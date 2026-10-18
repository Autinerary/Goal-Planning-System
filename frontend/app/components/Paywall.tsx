'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { isPaywallOpen, PAYWALL_ON } from '@/lib/billing'
import WhyNotContinue from './WhyNotContinue'

const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

interface Access {
  access: boolean
  reason: string
  pending?: boolean
}

/**
 * When the paywall is on (NEXT_PUBLIC_PAYWALL=on, lib/billing.ts) and
 * someone's free month has ended without a plan or free access: their
 * options, instead of the page. Billing, free access, the rules, their
 * account and ResourceHub stay open, and nothing they added is lost.
 * Off, it renders nothing.
 */
export default function Paywall() {
  const { user, logout } = useAuth()
  const pathname = usePathname() || '/'
  const [access, setAccess] = useState<Access | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const blocked = Boolean(PAYWALL_ON && user && access && !access.access)

  useEffect(() => {
    if (!PAYWALL_ON || !user) return
    let gone = false
    fetch('/api/me/access', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !gone && d && setAccess(d))
      .catch(() => {})
    return () => {
      gone = true
    }
    // Checked again on each page only while blocked, so a new plan shows at once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, blocked ? pathname : ''])

  const show = blocked && !isPaywallOpen(pathname)
  useEffect(() => {
    if (show) heading.current?.focus()
  }, [show])

  if (!show || !access) return null
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="paywall-heading" className="fixed inset-0 z-[70] overflow-y-auto bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <h1 id="paywall-heading" ref={heading} tabIndex={-1} className="text-2xl font-bold text-slate-900 outline-none sm:text-3xl">
          {access.reason === 'trial_over' ? 'Your free month has ended' : 'Choose how to keep using Autinerary'}
        </h1>
        <p className="mt-3 leading-relaxed text-slate-800">
          Your plan and everything you added are kept. Nothing has been charged. To keep using the app, choose a plan, or see
          whether you can use it free.
        </p>
        {access.pending && (
          <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-slate-900">
            We have your request for free access. We will email you when it&apos;s ready.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/billing" className="rounded-lg bg-indigo-700 px-5 py-2.5 font-semibold text-white hover:bg-indigo-800">
            See plans
          </Link>
          <Link href="/free-access" className="rounded-lg border border-indigo-700 px-5 py-2.5 font-semibold text-indigo-800 hover:bg-indigo-50">
            Free access
          </Link>
          <Link href="/petition" className="rounded-lg border border-amber-700 px-5 py-2.5 font-semibold text-amber-900 hover:bg-amber-50">
            Help us make this free
          </Link>
        </div>
        <div className="mt-8">
          <WhyNotContinue moment="trial_end" />
        </div>
        <p className="mt-8 text-sm text-slate-800">
          ResourceHub stays free:{' '}
          <a href={HUB} className="font-medium text-indigo-800 underline underline-offset-2">
            find services and read ratings
          </a>
          . Your account and data:{' '}
          <Link href="/profile/settings" className="font-medium text-indigo-800 underline underline-offset-2">
            Settings
          </Link>
          {' · '}
          <button type="button" onClick={() => logout()} className="font-medium text-indigo-800 underline underline-offset-2">
            Sign out
          </button>
        </p>
      </div>
    </div>
  )
}
