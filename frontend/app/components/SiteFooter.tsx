'use client'

import Link from 'next/link'
import { openCookieSettings } from '@/lib/consent'
import FeedbackButton from './FeedbackButton'

/** Where every policy is, who runs Autinerary, and the cookie settings, at the foot of every page. */
export const LEGAL_LINKS: { href: string; label: string }[] = [
  { href: '/about', label: 'About and contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/delete-my-data', label: 'Delete my data' },
  { href: '/credits', label: 'Credits and licences' },
]

export default function SiteFooter() {
  const link = 'font-medium text-slate-800 underline underline-offset-2 hover:text-slate-900'
  return (
    <footer className="border-t border-slate-200 bg-slate-50 px-4 py-6" data-site-footer>
      <nav aria-label="About, policies and contact" className="mx-auto max-w-5xl">
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-slate-700">
          {LEGAL_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={link}>{l.label}</Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={openCookieSettings} className={link}>Cookie settings</button>
          </li>
          <li>
            <FeedbackButton icon={false} className={link} />
          </li>
        </ul>
        <p className="mt-3 text-center text-sm text-slate-700">© {new Date().getFullYear()} Autinerary Corp., Ontario, Canada.</p>
      </nav>
    </footer>
  )
}
