import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, List, Mail, Section, linkClass } from '../components/LegalPage'

export const metadata: Metadata = {
  title: 'Delete my data · Autinerary',
  description: 'Delete your Autinerary account, or ask us to delete anything else we keep about you.',
}

const UPDATED = '8 November 2026'

/**
 * How to delete your data, with or without an account (the data deletion request). The account itself is deleted by
 * its owner on Your profile (app/profile/AccountControls.tsx, /api/me/account); everything else is by email, answered
 * within 30 days, as Privacy says.
 */
export default function DeleteMyDataPage() {
  return (
    <LegalPage
      title="Delete my data"
      updated={UPDATED}
      intro={<p>You can delete your account yourself, straight away, or ask us to delete anything else we keep about you.</p>}
    >
      <Section id="account" title="If you have an account">
        <p>
          <Link href="/profile#delete" className={linkClass}>Delete your account</Link> on Your profile (sign in first). It
          deletes your account and everything linked to it straight away: your plan, calendar, journal, people, photos, and
          what you posted in Tidbits and ResourceHub. It can’t be undone.
        </p>
        <List>
          <li>Copies in our database host’s backups are gone within 30 days. Photos are deleted at once.</li>
          <li>Resources you suggested stay in ResourceHub, without your name. Totals in our reports, which identify no one, stay. So does anything the law requires us to keep, such as payment records.</li>
          <li>A model, agent or pathway you shared is taken down with your account. People who already added a copy keep theirs.</li>
          <li>Can’t sign in? Email <Mail subject="Delete my account" /> from your sign-in address, and we will delete it within 30 days.</li>
          <li>A parent or guardian deletes a child’s account from <Link href="/family" className={linkClass}>Family</Link>.</li>
        </List>
      </Section>

      <Section id="parts" title="Only some of it">
        <List>
          <li>Erase your progress, or your progress and your plan, in <Link href="/profile/settings" className={linkClass}>Settings</Link>, after downloading a copy if you like.</li>
          <li>Delete a moment on your Memories page, and remove norms or details you shared on <Link href="/profile/diagnostic" className={linkClass}>your profile</Link>.</li>
          <li>Journal entries, or anything else on its own: email <Mail subject="Delete part of my data" /> from your sign-in address, and say what.</li>
          <li>Take down a model you shared in <Link href="/settings/models/share" className={linkClass}>Share my model</Link>, or an agent in <Link href="/agents" className={linkClass}>My agents</Link>.</li>
          <li>Pause your account instead, on Your profile: we send you nothing and nobody can find you until you come back.</li>
        </List>
      </Section>

      <Section id="device" title="What is only on your device">
        <p>
          Your agents, your own model, and settings kept in this browser never reach us, so only you can delete them: take a
          model out in <Link href="/settings/models" className={linkClass}>Models</Link>, remove an agent in My agents, or clear
          this site’s data in your browser’s settings.
        </p>
      </Section>

      <Section id="no-account" title="If you don’t have an account">
        <List>
          <li>Emails you asked for (the weekly email, a Start here list): the link at the bottom of every one stops them.</li>
          <li>
            To have your email address deleted from our list as well, or a #FundAutinerary signature, or anything else: email{' '}
            <Mail subject="Delete my data" /> from the address you used, and say what you would like deleted.
          </li>
        </List>
      </Section>

      <Section id="next" title="What happens next">
        <p>
          We may ask you to confirm from the same address that it is you. We delete it within 30 days and tell you when it is
          done. If you aren’t happy with how we handled it, see <Link href="/privacy#choices" className={linkClass}>Privacy</Link> for
          who else you can contact.
        </p>
      </Section>
    </LegalPage>
  )
}
