'use client'

import { useEffect, useState } from 'react'
import BackButton from '../components/BackButton'
import { RECIPES } from '@/lib/signupKit'
import { extensionInfo, type ExtensionInfo } from '@/lib/signupExtension'

/**
 * The Autinerary extension (chrome-extension/): what it does for one-click
 * sign-up and how to get it. Whether it is already here is asked live.
 * NEXT_PUBLIC_SIGNUP_EXTENSION_URL is its Chrome Web Store page, once published.
 */
const STORE_URL = process.env.NEXT_PUBLIC_SIGNUP_EXTENSION_URL || ''

export default function ExtensionPage() {
  const [ext, setExt] = useState<ExtensionInfo | null | undefined>(undefined)
  useEffect(() => {
    extensionInfo().then(setExt)
  }, [])
  const services = Object.values(RECIPES)

  return (
    <main className="min-h-screen p-4 md:p-8 surface-veil">
      <div className="mx-auto max-w-2xl space-y-4">
        <BackButton fallback="/path" />
        <section aria-labelledby="extension-heading" className="rounded-2xl p-6 surface">
          <h1 id="extension-heading" className="text-2xl font-bold text-slate-900">
            The Autinerary extension
          </h1>
          <p className="mt-2 text-slate-800">
            With it, <strong>Sign me up</strong> fills in a service’s own sign-up form for you, in your browser, while you watch: your
            name, your email and a new password for you to save. If the service asks for something only you can do (“I’m not a robot”,
            a payment, or a code from your email), it stops and shows you that page.
          </p>
          <p className="mt-3 font-semibold text-slate-900" role="status" data-extension-status>
            {ext === undefined ? 'Checking…' : ext ? `It’s installed (version ${ext.version}). You’re ready.` : 'It isn’t installed in this browser.'}
          </p>
          {!ext && ext !== undefined && (
            <p className="mt-2 text-slate-800">
              {STORE_URL ? (
                <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-800 underline underline-offset-2">
                  Add it from the Chrome Web Store<span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                'It’s on its way to the Chrome Web Store. It works in Chrome and Edge on a computer.'
              )}
            </p>
          )}
          <h2 className="mt-5 text-lg font-bold text-slate-900">Services it can sign you up for</h2>
          <ul className="mt-2 grid gap-1 text-slate-800 sm:grid-cols-2">
            {services.map((r) => (
              <li key={r.key}>
                {r.name}
                {r.robot ? '' : ' (with the extension only)'}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-slate-700">
            The extension also blocks distracting sites and sets time limits, if you want it to. It only fills in a sign-up form when you
            press Sign me up in Autinerary.
          </p>
        </section>
      </div>
    </main>
  )
}
