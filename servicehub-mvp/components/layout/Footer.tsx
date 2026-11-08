'use client'

import Link from 'next/link'
import { openCookieSettings } from '@/lib/consent'
import FeedbackLink from './FeedbackLink'
import ListenButton from './ListenButton'
import PositiveNote from './PositiveNote'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <>
    {/* Listening and a note for today, on every page (the planning note, October 2026, Goals 10 and 11). */}
    <aside aria-label="Listen, and a note for today" className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 sm:px-2 lg:px-4">
        <PositiveNote />
        <ListenButton />
      </div>
    </aside>
    <footer className="bg-gray-900 text-gray-300" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-white text-lg font-semibold mb-4">ResourceHub</h3>
            <p className="text-sm mb-4">
              Places, services and products for neurodivergent people and the people who support them, with ratings from
              people who used them, shown by who rated.
            </p>
            <p className="text-xs text-gray-400">
              © {currentYear} Autinerary Corp., Ontario, Canada. All rights reserved.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/search"
                  className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
                >
                  Search Resources
                </Link>
              </li>
              <li>
                <Link
                  href="/resources/new"
                  className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
                >
                  Recommend Resource
                </Link>
              </li>
              <li>
                <Link
                  href="/campus"
                  className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
                >
                  Near a college or university
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="mailto:aayush@autinerary.ca"
                  className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
                >
                  Contact us
                </a>
              </li>
              <li>
                <FeedbackLink className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded" />
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
                >
                  Terms and Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: the rest of the policies, and the cookie settings (lib/consent.ts). */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
            {[['/about', 'About and contact'], ['/cookies', 'Cookies'], ['/refunds', 'Refunds'], ['/delete-my-data', 'Delete my data'], ['/credits', 'Credits and licences']].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="hover:text-white underline underline-offset-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded">
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <button type="button" onClick={openCookieSettings} className="hover:text-white underline underline-offset-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded">
                Cookie settings
              </button>
            </li>
          </ul>
        </div>
      </div>
    </footer>
    </>
  )
}
