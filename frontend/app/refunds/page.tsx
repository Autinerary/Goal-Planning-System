import type { Metadata } from 'next'
import Link from 'next/link'
import { PAYWALL_ON } from '@/lib/billing'
import { LegalPage, List, Mail, Section, linkClass } from '../components/LegalPage'

export const metadata: Metadata = {
  title: 'Refunds · Autinerary',
  description: 'Nothing is charged during the beta. Cancelling, refunds for mistakes, and buying from a vendor in ResourceHub.',
}

const UPDATED = '8 November 2026'

/**
 * The refund policy, in one place: what the terms (app/terms, Paid plans and The shop) and the pricing page already
 * say, for anyone looking for it by that name. Change them together.
 */
export default function RefundsPage() {
  return (
    <LegalPage
      title="Refunds"
      updated={UPDATED}
      intro={
        <p>
          {PAYWALL_ON
            ? 'Here is how cancelling and refunds work for a paid plan, and for anything you buy through ResourceHub.'
            : 'Autinerary is free during the beta, and nothing is charged. Before paid plans start we will tell you, and nothing is ever charged unless you choose a plan. This is how refunds will work then.'}
        </p>
      }
    >
      <Section id="plans" title="The Autinerary app">
        <List>
          <li>The first month is free, needs no card, and nothing is charged.</li>
          <li>Cancel any time in Billing, with “Cancel my plan”. Your plan runs to the end of the time you have paid for, and you are not charged again.</li>
          <li>Cancelling doesn’t refund time you have already paid for, unless the law gives you a refund.</li>
          <li><strong>Charged by mistake?</strong> Tell us within 30 days, at <Mail subject="Refund" />, and we will refund it.</li>
          <li>We email you before a yearly plan renews (60 to 75 days ahead), and at least 30 days before any price change, so you can cancel first.</li>
          <li>Deleting your account cancels your plan.</li>
          <li>There are no other fees: the price on the <Link href="/pricing" className={linkClass}>pricing page</Link>, plus GST or HST where it applies.</li>
        </List>
      </Section>

      <Section id="shop" title="Buying through ResourceHub">
        <List>
          <li>Buying in ResourceHub isn’t on yet, and we will tell you before it starts. Most products are bought from the seller, on the seller’s own site and terms.</li>
          <li>When it starts, the vendor is the seller: you pay them, and they handle returns and refunds, under their terms and the law. Ask the vendor first; if they don’t help, tell us at <Mail subject="Refund: a ResourceHub order" />.</li>
          <li>ResourceHub’s fee is paid by the vendor, not by you.</li>
          <li>Services you find in ResourceHub (a therapist, a program, a class) are paid to them directly, under their own policies.</li>
        </List>
      </Section>

      <Section id="rights" title="Your rights">
        <p>
          Nothing here takes away rights you have by law, for example under Ontario’s Consumer Protection Act, 2002. The
          rest is in the <Link href="/terms#paid-plans" className={linkClass}>Terms (Paid plans)</Link>.
        </p>
      </Section>
    </LegalPage>
  )
}
