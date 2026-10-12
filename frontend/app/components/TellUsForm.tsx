'use client'

import { useAuth } from '../context/AuthContext'
import CheckinQuestion from './CheckinQuestion'
import { USEFULNESS } from '@/lib/checkin'
import { CONTACT_EMAIL } from '@/lib/contact'

/**
 * "Tell us how it's going", at any time, on the glossary (/help#tell-us) and
 * from "Tell us what's hard" in All places.
 *
 * Riipen Labs, Group 31: "allow first-time users to continue to submit more
 * feedback based off of their own experiences with the app", about "what
 * they liked/found overwhelming". Group 32: people should know "their
 * feedback directly shapes the app". Until now that was an email address,
 * or a check-in when the app asked. Kept with the check-ins as 'feedback'
 * (STEP 69), apart from the ones the app asks for.
 */
export default function TellUsForm() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (!user) {
    return (
      <p className="mt-3 text-sm text-slate-800">
        Signed in, you can tell us here. Or email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-indigo-800 underline underline-offset-2">{CONTACT_EMAIL}</a>.
      </p>
    )
  }
  return (
    <div className="mt-4">
      <CheckinQuestion
        kind="feedback"
        headingLevel="h3"
        heading="Tell us how it’s going"
        intro="What you tell us decides what we change next. Only the Autinerary team reads it."
        legend="Is Autinerary useful to you so far?"
        options={USEFULNESS}
        layout="chips"
        commentLabel="What do you like, and what is hard, missing or too much?"
        thanks="Thank you. We read every answer, and it decides what we change next."
        submitLabel="Send to the Autinerary team"
      />
    </div>
  )
}
