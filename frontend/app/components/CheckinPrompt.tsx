'use client'

import { useEffect, useState, type ReactNode } from 'react'
import CheckinQuestion from './CheckinQuestion'
import { useAuth } from '../context/AuthContext'
import { STOP_REASONS, USEFULNESS, EARLY_REASONS, AWAY_DAYS } from '@/lib/checkin'
import { dayKey, daysSince, getPreviousVisitDay, getVisitDayCountSince } from '@/lib/disclosure'
import { checkinDue, type CheckinDue } from '@/lib/checkinDue'

/**
 * In-app check-ins on the Path (Riipen Labs, Group 2: "ask active users about
 * usefulness and inactive users why they disengaged"). At most one card at a
 * time, in place of `fallback`. Which one is due, and when, is
 * lib/checkinDue.ts: welcome back after two weeks away; on days 3 to 6, how
 * is it going (Group 12's day 3); from day 7, is it useful so far (Group 12's
 * day 7).
 *
 * All are optional and can be put off with "Not now", which counts as
 * answered so the question does not come back.
 */

const WELCOME_BACK_KEY = 'autinerary_checkin_welcome_back' // the absence (last visit day) already asked about
const USEFULNESS_KEY = 'autinerary_checkin_usefulness_v1'
const EARLY_KEY = 'autinerary_checkin_early_v1'
const FEEDBACK_KEY = 'autinerary_feedback_completed_v1' // FeedbackGate
type Due = CheckinDue

export default function CheckinPrompt({ fallback }: { fallback?: ReactNode }) {
  const { supabaseUser, isLoading } = useAuth()
  const [due, setDue] = useState<Due>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (isLoading) return
    try {
      const lastVisit = getPreviousVisitDay()
      const joined = supabaseUser?.created_at ? dayKey(new Date(supabaseUser.created_at)) : null
      const today = new Date().toISOString().slice(0, 10)
      setDue(checkinDue({
        joined,
        day: joined ? daysSince(joined) : 0,
        lastVisit,
        daysAway: lastVisit ? daysSince(lastVisit) : 0,
        awayDays: AWAY_DAYS,
        visitDays: joined ? getVisitDayCountSince(joined) : 0,
        feedbackDone: localStorage.getItem(FEEDBACK_KEY) === 'true',
        feedbackToday: localStorage.getItem(`${FEEDBACK_KEY}_on`) === today,
        welcomeBackAskedFor: localStorage.getItem(WELCOME_BACK_KEY),
        earlyAsked: Boolean(localStorage.getItem(EARLY_KEY)),
        earlyToday: localStorage.getItem(`${EARLY_KEY}_on`) === today,
        usefulnessAsked: Boolean(localStorage.getItem(USEFULNESS_KEY)),
      }))
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
      else if (due.kind === 'early') {
        localStorage.setItem(EARLY_KEY, new Date().toISOString())
        localStorage.setItem(`${EARLY_KEY}_on`, new Date().toISOString().slice(0, 10))
      } else localStorage.setItem(USEFULNESS_KEY, new Date().toISOString())
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

  if (due.kind === 'early') {
    return (
      <CheckinQuestion
        kind="early"
        heading="How is it going so far? (optional)"
        intro="A few days in. One tap tells us what to fix while it still matters to you."
        legend="What fits best?"
        options={EARLY_REASONS}
        commentLabel="Anything you'd like us to know?"
        thanks="Thank you. Your answer goes straight into what we fix next."
        onAnswered={remember}
        onDismiss={dismiss}
      />
    )
  }

  return (
    <CheckinQuestion
      kind="usefulness"
      heading="One quick question (optional)"
      intro="You've been using Autinerary for a little while. Your answer shapes what we improve next."
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
