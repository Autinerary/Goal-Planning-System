import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { gaEnabled } from '@/lib/analytics'
import { USERWAY_ACCOUNT } from '../components/UserWay'
import { LegalPage, List, Mail, Section, linkClass } from '../components/LegalPage'
import CookieSettingsButton from './CookieSettingsButton'

export const metadata: Metadata = {
  title: 'Cookies · Autinerary',
  description: 'What Autinerary and ResourceHub keep in your browser, why, and your choice about counting visits.',
}

const UPDATED = '8 November 2026'

// On a phone the table can scroll sideways, so its box can be reached and scrolled with the keyboard (WCAG 2.1.1).
function Table({ label, rows }: { label: string; rows: [ReactNode, ReactNode, ReactNode][] }) {
  return (
    <div className="overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700" tabIndex={0} role="region" aria-label={label}>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-300">
            <th scope="col" className="py-2 pr-3 font-semibold text-slate-900">Name</th>
            <th scope="col" className="py-2 pr-3 font-semibold text-slate-900">What it is for</th>
            <th scope="col" className="py-2 font-semibold text-slate-900">How long</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, what, how], i) => (
            <tr key={i} className="border-b border-slate-200 align-top">
              <td className="py-2 pr-3 font-mono text-xs text-slate-900">{name}</td>
              <td className="py-2 pr-3">{what}</td>
              <td className="py-2">{how}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The cookie policy, for the app and ResourceHub (ResourceHub's /cookies comes here). Every name below is what the two
 * sites set (checked with a browser on 8 November 2026, .qa-local/compliance/cookie_audit.mjs) or what their code
 * keeps (lib/consent.ts lists what counting keeps). Change it when either changes.
 */
export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookies, and what we keep in your browser"
      updated={UPDATED}
      intro={
        <p>
          Autinerary and ResourceHub keep a few things in your browser: cookies that keep you signed in, and settings kept in
          the browser’s own storage. Counting how the sites are used waits for your OK. There are no advertising cookies,
          and nothing here is sold.
        </p>
      }
    >
      <Section id="choose" title="Your choice">
        <p>
          The first time you visit, we ask whether we may count visits. “Essential only” and “Allow counting” are equally easy,
          and you can change your answer at any time:
        </p>
        <List>
          <li><CookieSettingsButton /> (also at the foot of every page).</li>
          <li>In the app, in Settings, under Emails and notifications.</li>
          <li>If your browser sends Global Privacy Control or Do Not Track, nothing is counted, whatever you choose.</li>
          <li>Your browser’s settings can clear or block all of this. Blocking cookies stops you staying signed in.</li>
        </List>
      </Section>

      <Section id="essential" title="Essential: always on">
        <Table
          label="Essential cookies and storage"
          rows={[
            ['sb-…-auth-token (in two parts)', 'Keeps you signed in, on the app and on ResourceHub. A cookie from our sign-in provider, Supabase.', 'Until you sign out, or about 13 months'],
            ['autinerary_a11y', 'ResourceHub only: your accessibility settings (text size, dark mode), so the page is right before it appears. A cookie.', 'One year'],
            ['autinerary_cookie_consent, rh_cookie_consent', 'Your answer to the question about counting visits, on each site.', 'Until you change it'],
          ]}
        />
        <p>
          Our host, Vercel, may set a short-lived cookie of its own to check that you are a person, if it sees unusual traffic.
        </p>
      </Section>

      <Section id="settings" title="Your settings: kept in this browser only">
        <p>These are in the browser’s storage, not cookies. They stay on your device and are not sent to us, unless it says so.</p>
        <List>
          <li>Display and accessibility settings, unfinished setup answers, the tour’s progress, and which notes and prompts you have already seen.</li>
          <li>The pages you have opened this time, for the way back, and the days you have used the app, so it can show more of itself as you go, and your streak.</li>
          <li>Things that live only here: your agents (My agents), your own model’s settings, and your Start here answers.</li>
          <li>A copy of the app’s files, so it opens when you are offline.</li>
          <li>
            If you use a model in your browser: its files (about 1.2 GB) and any model you tuned, in this browser’s storage, for
            you alone. Take them out in <Link href="/settings/models" className={linkClass}>Models</Link>.
          </li>
        </List>
      </Section>

      <Section id="counting" title="Counting visits: only with your OK">
        <p>
          These help us see where people get stuck, and fix it. They hold a random ID and which parts of the sites are opened,
          never anything you type, and they are not used for ads. Until you allow it, none of them is made.
        </p>
        <Table
          label="Counting, only if you allow it"
          rows={[
            ['autinerary_visitor_id, rh_visitor_id', 'A random ID for this browser, sent with each count.', 'Until you say no, or clear it'],
            ['autinerary_first_touch', 'The website and campaign link that first brought you here, if any.', 'The same'],
            ['autinerary_area_days, autinerary_last_open_day, rh_visit_day, rh_visit_at, rh_first_resource_at', 'So each part of the app, and each day’s visit, is counted once a day.', 'The same'],
            ['autinerary_movement', 'The order of pages you open (their paths only, not the rest of their address). When you are signed in it is saved with your account, to see how people move through the app.', 'The same'],
            ...(gaEnabled()
              ? ([['_ga, _ga_…', 'Google Analytics, with the same counts. Google signals and ad personalization are off.', 'Up to two years']] as [ReactNode, ReactNode, ReactNode][])
              : []),
          ]}
        />
        <p>Saying no removes them from this browser.</p>
      </Section>

      <Section id="others" title="Other companies, when you use them">
        <p>Some parts of the sites come from other companies, which may set their own cookies under their own policies, but only when you use them:</p>
        <List>
          <li>Sign in with Google, and our feedback form (Google Forms).</li>
          <li>Video rooms for calls you book (Jitsi Meet, by 8x8).</li>
          <li>Maps on a ResourceHub listing (OpenStreetMap, and OpenFreeMap through Cloudflare for the 3D view). They get your network address and the map area.</li>
          <li>If you use a model in your browser, its files come from Hugging Face and GitHub, which get your network address.</li>
          {USERWAY_ACCOUNT && <li>The accessibility menu (the round button), from UserWay, if you open it.</li>}
        </List>
        <p>
          <Link href="/privacy#others" className={linkClass}>Privacy</Link> lists everyone who handles your information, and what
          they get.
        </p>
      </Section>

      <Section id="changes" title="Changes and questions">
        <p>When this changes, we update the date at the top. Questions: <Mail subject="Cookies" />.</p>
      </Section>
    </LegalPage>
  )
}
