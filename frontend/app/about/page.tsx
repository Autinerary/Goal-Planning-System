import type { Metadata } from 'next'
import Link from 'next/link'
import { BUSINESS } from '@/lib/billing'
import { CONTACT_EMAIL } from '@/lib/contact'
import { PROOF_EMAIL } from '@/lib/legal'
import { goHubHref } from '@/lib/serviceHub'
import { LegalPage, List, Mail, Section, linkClass } from '../components/LegalPage'

export const metadata: Metadata = {
  title: 'About and contact · Autinerary',
  description: 'Who runs Autinerary and ResourceHub, and how to reach us.',
}

/**
 * Who runs Autinerary, and how to reach them (business details). The mailing address is the one every newsletter
 * carries (NEWSLETTER_POSTAL_ADDRESS in Vercel, Canada's anti-spam law), or NEXT_PUBLIC_BUSINESS_ADDRESS when the team
 * sets one for paid plans; read when the site is built, so a new address needs a new deploy, as for the emails.
 */
export default function AboutPage() {
  const address = (BUSINESS.address || process.env.NEWSLETTER_POSTAL_ADDRESS || '').trim()
  return (
    <LegalPage
      title="About and contact"
      intro={
        <p>
          Autinerary is a planning app for neurodivergent people and the people who support them: one goal becomes small
          steps, planned around your energy, with services and tools for each step from ResourceHub, its directory. Both
          are in beta, and free during the beta.
        </p>
      }
    >
      <Section id="who" title="Who runs it">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[11rem_1fr]">
          <dt className="font-semibold text-slate-900">Business</dt>
          <dd>{BUSINESS.name}, Ontario, Canada</dd>
          <dt className="font-semibold text-slate-900">Mailing address</dt>
          <dd>{address || <>On request, by email to <Mail subject="Mailing address" /></>}</dd>
          <dt className="font-semibold text-slate-900">Email</dt>
          <dd><Mail /></dd>
          {BUSINESS.phone && (
            <>
              <dt className="font-semibold text-slate-900">Phone</dt>
              <dd>{BUSINESS.phone}</dd>
            </>
          )}
          <dt className="font-semibold text-slate-900">Websites</dt>
          <dd>
            The app at <Link href="/" className={linkClass}>app.autinerary.ca</Link>, and{' '}
            <a href={goHubHref('/')} className={linkClass}>ResourceHub</a>, which shares its accounts.
          </dd>
        </dl>
      </Section>

      <Section id="contact" title="How to reach us">
        <List>
          <li>Anything, including questions about your information or a request to see, correct or delete it: <Mail />. We reply within 30 days, usually much sooner.</li>
          <li>Something hard to use, or not working with your screen reader, keyboard or other tools: <Mail subject="Accessibility" />, or Feedback at the foot of any page.</li>
          <li>Proof that you used a service before you joined, to rate it: <a href={`mailto:${PROOF_EMAIL}`} className={linkClass}>{PROOF_EMAIL}</a>.</li>
          <li>A security problem: <Mail subject="Security" />. Please don’t share the details publicly until we have fixed it.</li>
          <li>If you are in crisis or in danger now: call or text 9-8-8, or call 911. Autinerary isn’t a crisis service.</li>
        </List>
      </Section>

      <Section id="policies" title="Our policies">
        <List>
          <li><Link href="/privacy" className={linkClass}>Privacy</Link>: what we collect, why, and who else handles it.</li>
          <li><Link href="/terms" className={linkClass}>Terms and Conditions</Link>: the agreement for using Autinerary and ResourceHub.</li>
          <li><Link href="/cookies" className={linkClass}>Cookies</Link>: what is kept in your browser, and your choice about counting visits.</li>
          <li><Link href="/refunds" className={linkClass}>Refunds</Link>: nothing is charged during the beta; what happens when paid plans start.</li>
          <li><Link href="/delete-my-data" className={linkClass}>Delete my data</Link>: how to delete your account or anything else we keep.</li>
          <li><Link href="/credits" className={linkClass}>Credits and licences</Link>: the fonts, pictures, maps and models we use, and their licences.</li>
        </List>
        <p className="text-sm text-slate-700">Contact for {BUSINESS.name}: {CONTACT_EMAIL}.</p>
      </Section>
    </LegalPage>
  )
}
