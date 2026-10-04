'use client'

import { useEffect, useState, type ReactNode } from 'react'
import CheckinQuestion from './CheckinQuestion'
import { useAuth } from '../context/AuthContext'
import { STOP_REASONS, USEFULNESS, AWAY_DAYS } from '@/lib/checkin'
import { dayKey, daysSince, getPreviousVisitDay, getVisitDayCount } from '@/lib/disclosure'

/**
 * In-app check-ins on the Path (Riipen Labs, Group 2: "ask active users about
 * usefulness and inactive users why they disengaged"). At most one card at a
 * time, in place of `fallback`, and never on the same day as the team's
 * feedback form:
 *
 *   welcome back  first visit after two weeks or more away (on this browser):
 *                 what got in the way? Asked once per absence.
 *   usefulness    after five days of use, once the feedback form is done:
 *                 is it useful so far? Asked once.
 *
 * Both are optional and can be put off with "Not now", which counts as
 * answered so the question does not come back.
 */

const WELCOME_BACK_KEY = 'autinerary_checkin_welcome_back' // the absence (last visit day) already asked about
const USEFULNESS_KEY = 'autinerary_checkin_usefulness_v1'
const FEEDBACK_KEY = 'autinerary_feedback_completed_v1' // FeedbackGate
const USEFULNESS_AFTER_DAYS = 5

type Due = { kind: 'welcome_back'; lastVisit: string } | { kind: 'usefulness' } | null

export default function CheckinPrompt({ fallback }: { fallback?: ReactNode }) {
  const { supabaseUser, isLoading } = useAuth()
  const [due, setDue] = useState<Due>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (isLoading) return
    try {
      const lastVisit = getPreviousVisitDay()
      // Visits before the account existed (the landing page, say) are not an absence.
      const joined = supabaseUser?.created_at ? dayKey(new Date(supabaseUser.created_at)) : null
      const today = new Date().toISOString().slice(0, 10)
      if (lastVisit && joined && lastVisit >= joined && daysSince(lastVisit) >= AWAY_DAYS && localStorage.getItem(WELCOME_BACK_KEY) !== lastVisit) {
        setDue({ kind: 'welcome_back', lastVisit })
      } else if (
        localStorage.getItem(FEEDBACK_KEY) === 'true' &&
        localStorage.getItem(`${FEEDBACK_KEY}_on`) !== today &&
        getVisitDayCount() >= USEFULNESS_AFTER_DAYS &&
        !localStorage.getItem(USEFULNESS_KEY)
      ) {
        setDue({ kind: 'usefulness' })
      } else {
        setDue(null)
      }
    } catch {
      setDue(null)
    }
    setReady(true)
  }, [supabaseUser, isLoading])

  if (!ready) return null
  if (!due) return <>{fallback}</>

  const remember = () => {
    try {
      if (due.kind === 'welcome_back') localStorage.setItem(WELCOME_BACK_KEY, due.lastVisit)
      else localStorage.setItem(USEFULNESS_KEY, new Date().toISOString())
    } catch {}
  }
  const dismiss = () => {
    remember()
    setDue(null)
  }

  if (due.kind === 'welcome_back') {
    return (
      <CheckinQuestion
        kind="welcome_back"
        heading="Welcome back"
        intro="It's been a while. If something made Autinerary hard to keep using, telling us helps us fix it. This is optional."
        legend="What got in the way?"
        options={STOP_REASONS}
        commentLabel="Anything else you want to tell us?"
        thanks="Thank you. This helps us fix what got in the way."
        onAnswered={remember}
        onDismiss={dismiss}
      />
    )
  }

  return (
    <CheckinQuestion
      kind="usefulness"
      heading="One quick question (optional)"
      intro="You've been using Autinerary for a few days. Your answer shapes what we improve next."
      legend="Is Autinerary useful to you so far?"
      options={USEFULNESS}
      layout="chips"
      commentLabel="What would make it more useful?"
      thanks="Thank you. This shapes what we improve next."
      onAnswered={remember}
      onDismiss={dismiss}
    />
  )
}
