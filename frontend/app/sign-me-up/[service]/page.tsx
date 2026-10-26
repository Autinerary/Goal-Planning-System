'use client'

import { Suspense, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import BackButton from '../../components/BackButton'
import SignupButton from '../../components/SignupButton'
import SignupDialogs from '../../components/SignupDialogs'
import { SIGNUP_ON } from '@/lib/signups'
import { resourceIdOfKey } from '@/lib/requests'
import { useSignups } from '@/lib/useSignups'

/**
 * Sign me up for one service (lib/signups.ts), where ResourceHub's button on
 * a listing leads: the same button, details check and new password as the
 * task view, without filling in the service's form.
 */
export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-lg">Loading…</div>}>
      <SignupPageContent />
    </Suspense>
  )
}

function SignupPageContent() {
  const params = useParams()
  // ResourceHub's link says which listing it came from (?resource=), so the sign-up is linked to it;
  // a local service's key (r-<id>) is the listing itself.
  const key = String(params.service || '')
  const resourceId = useSearchParams().get('resource') || resourceIdOfKey(key)
  const app = useSignups(resourceId ? [resourceId] : [])
  const recipe = app.serviceInfo(key)
  // A listing with no way to reach it still has a name to show.
  const listingName = resourceId ? app.requests[resourceId]?.name : null
  // …and is looked for on the web, once (they came here to ask it): its own website and email.
  const unreachable = !!resourceId && app.loaded && app.ready && app.unreachable(resourceId)
  const lookedUp = !!resourceId && !!app.requests[resourceId]?.lookedUp
  const looking = !!resourceId && !!app.lookingUp[resourceId]
  const tried = useRef(false)
  useEffect(() => {
    if (!unreachable || lookedUp || looking || tried.current || app.refusal) return
    tried.current = true
    void app.lookUp(resourceId!)
  }, [unreachable, lookedUp, looking, resourceId, app])

  return (
    <main className="min-h-screen p-4 md:p-8 surface-veil">
      <div className="mx-auto max-w-xl space-y-4">
        <BackButton fallback="/path" />
        <section aria-labelledby="signup-heading" className="rounded-2xl p-6 surface">
          <h1 id="signup-heading" className="text-2xl font-bold text-slate-900">
            {recipe ? `${recipe.kind === 'newsletter' ? 'Subscribe to' : recipe.kind === 'request' ? 'Ask to start with' : 'Sign up for'} ${recipe.name}` : listingName ? `Ask to start with ${listingName}` : 'Sign me up'}
          </h1>
          {!SIGNUP_ON || (app.loaded && !app.on) ? (
            <p className="mt-2 text-slate-800">One-click sign-up isn’t switched on yet.</p>
          ) : !recipe ? (
            <p className="mt-2 text-slate-800" data-signup-unreachable>
              {!app.unreachable(resourceId)
                ? 'There’s no one-click sign-up for that service yet.'
                : looking || (!lookedUp && !tried.current)
                  ? 'Their listing has no email or website: looking on the web for their own…'
                  : 'There’s no online way to reach them yet: we looked for their website and email, and found none we could check was theirs. Call or visit them instead.'}
            </p>
          ) : !app.loaded ? (
            <p className="mt-2 text-slate-800">Loading…</p>
          ) : !app.ready ? (
            <p className="mt-2 text-slate-800">One-click sign-up isn’t ready yet. Try again soon.</p>
          ) : app.refusal ? (
            <p className="mt-2 text-slate-800">{app.refusal}</p>
          ) : (
            <>
              <p className="mt-2 text-slate-800">
                {recipe.kind === 'request'
                  ? `Autinerary sends ${recipe.name} your request to start, with your name and ${app.email || 'your email'}: by email, or through the contact form on their website. They reply to you.`
                  : `Autinerary fills in ${recipe.name}’s own sign-up form for you, with your name and ${app.email || 'your email'}${recipe.kind === 'account' ? ', and makes a new password for you to save' : ''}.${recipe.note ? ` ${recipe.note}` : ''}`}
              </p>
              <div className="mt-4">
                <SignupButton app={app} service={recipe.key} resourceId={resourceId} />
              </div>
            </>
          )}
          <p className="mt-3 min-h-[1.25rem] text-sm text-slate-900" role="status" aria-live="polite" data-signup-note>
            {app.note}
          </p>
          <p className="mt-2 text-sm">
            <Link href="/calendar" className="font-semibold text-indigo-800 underline underline-offset-2">
              Back to your tasks
            </Link>
          </p>
        </section>
        <SignupDialogs app={app} />
      </div>
    </main>
  )
}
