'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RECIPES, recipeForUrl } from '@/lib/signupKit'
import { canAddExtension, contactWithExtension, desktopInfo, extensionInfo, onDesktopUpdate, signUpWithDesktop, signUpWithExtension, watchExtensionJob, type ExtensionInfo, type ExtensionStatus } from '@/lib/signupExtension'
import { SIGNUP_ON, outcomeMessage, pickRunner, type Runner, type SignupDetails, type SignupStatus } from '@/lib/signups'
import { NO_EXTRAS, formMessage, formSubject, type RequestExtras, type RequestHow } from '@/lib/requests'

/**
 * One-click sign-up on a page (lib/signups.ts): where each of the person's
 * sign-ups is, whether the Autinerary extension is here, and Sign me up
 * itself. The first time, it asks for the details (`asking`) and carries on
 * once they're saved. A new account's password is held here only until the
 * person has seen it (`password`), then forgotten.
 */

interface Info {
  on: boolean
  ready: boolean
  refusal: string | null
  email: string | null
  details: SignupDetails | null
  extras: RequestExtras
  suggested: string
  robot: boolean
  /** Requests through a website's form can run (the server robot is on). */
  forms: boolean
}

export interface SignupState {
  status: SignupStatus
  runner: string
  at: string
  /** How it went, in a word or two (e.g. "unconfirmed": their site didn't say it was received). */
  detail?: string | null
}

/** A service Sign me up can do: one of the kit's, a partner's, or a local service (a request). */
export interface ServiceInfo {
  key: string
  name: string
  kind: 'account' | 'newsletter' | 'request'
  terms?: string
  privacy?: string
  note?: string
  /** Its own sign-up page (the kit's services), or a local service's website: where to finish by hand. */
  start?: string
}

interface PartnerInfo {
  key: string
  name: string
  hosts: string[]
}

export function useSignups(resourceIds: string[] = []) {
  const key = [...new Set(resourceIds.filter(Boolean))].sort().join(',')
  const [info, setInfo] = useState<Info>({ on: SIGNUP_ON, ready: false, refusal: null, email: null, details: null, extras: NO_EXTRAS, suggested: '', robot: false, forms: false })
  // Local services on this page: how a request reaches each (by listing id).
  const [requests, setRequests] = useState<Record<string, { key: string; how: RequestHow; name: string; site?: string | null; lookedUp?: boolean }>>({})
  // Listings being looked up on the web for a way to reach them (app/api/me/signups/lookup).
  const [lookingUp, setLookingUp] = useState<Record<string, boolean>>({})
  // After a hand-over from a website's form, by service: its page to finish on, and whether the
  // extension has it open there, filled in (and is watching for it being sent).
  const [handOver, setHandOver] = useState<Record<string, { url: string; inExtension: boolean }>>({})
  const [signups, setSignups] = useState<Record<string, SignupState>>({})
  const [listings, setListings] = useState<Record<string, string>>({})
  const [extension, setExtension] = useState<ExtensionInfo | null>(null)
  // Whether this browser could add the extension (it's in a store this browser takes): known after the page loads.
  const [canAdd, setCanAdd] = useState(false)
  const [desktop, setDesktop] = useState<ExtensionInfo | null>(null)
  const [partners, setPartners] = useState<PartnerInfo[]>([])
  const [loaded, setLoaded] = useState(false)
  const [running, setRunning] = useState<Record<string, boolean>>({})
  const [asking, setAsking] = useState<{ services: { service: string; resourceId?: string | null }[] } | null>(null)
  const [password, setPassword] = useState<{ service: string; name: string; password: string } | null>(null)
  const [note, setNote] = useState('')
  const [loginLink, setLoginLink] = useState<{ name: string; url: string } | null>(null)
  const busy = useRef(false)

  const load = useCallback(async () => {
    if (!SIGNUP_ON) return
    const [r, ext, desk] = await Promise.all([
      fetch(`/api/me/signups?ids=${encodeURIComponent(key)}`, { cache: 'no-store', credentials: 'include' }).then((x) => x.json()).catch(() => null),
      extensionInfo(),
      desktopInfo(),
    ])
    if (r) {
      setInfo({ on: !!r.on, ready: !!r.ready, refusal: r.refusal || null, email: r.email || null, details: r.details || null, extras: r.extras || NO_EXTRAS, suggested: r.suggested || '', robot: !!r.robot, forms: !!r.forms })
      setSignups(r.signups || {})
      setListings(r.listings || {})
      setRequests(r.requests || {})
      setPartners(Array.isArray(r.partners) ? r.partners : [])
    }
    setExtension(ext)
    setDesktop(desk)
    setCanAdd(canAddExtension())
    setLoaded(true)
  }, [key])

  useEffect(() => {
    load()
  }, [load])

  // In the desktop app, after a hand-over: the sign-up's real end, when the person has finished the step.
  const desktopUpdate = useRef<(u: ExtensionStatus & { service: string }) => void>(() => {})
  useEffect(() => {
    onDesktopUpdate((u) => desktopUpdate.current(u))
  }, [])

  // Services the extension or the desktop app can do that this version of the app doesn't know yet.
  const brought = [...(desktop?.catalog || []), ...(extension?.catalog || [])].filter((c) => c && typeof c.key === 'string' && !RECIPES[c.key])

  /** The service's name, kind and terms: the kit's, a partner's, or one the extension brings. */
  const serviceInfo = useCallback(
    (service: string | null | undefined): ServiceInfo | null => {
      if (!service) return null
      const r = RECIPES[service]
      if (r) return { key: r.key, name: r.name, kind: r.kind, terms: r.terms, privacy: r.privacy, note: r.note, start: r.start }
      // A local service: only one there's a way to reach, or one already asked (its status still shows).
      const local = Object.values(requests).find((x) => x.key === service)
      if (local) return local.how !== 'none' || signups[local.key] ? { key: local.key, name: local.name, kind: 'request', note: local.how === 'email' ? 'By email' : 'Through their website', start: local.site || undefined } : null
      const p = partners.find((x) => x.key === service)
      if (p) return { key: p.key, name: p.name, kind: 'account' }
      const b = brought.find((x) => x.key === service)
      return b ? { key: b.key, name: String(b.name).slice(0, 80), kind: b.kind === 'newsletter' ? 'newsletter' : 'account' } : null
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partners, desktop, extension, requests, signups],
  )

  /** A local service's request key, for a ResourceHub listing the kit doesn't sign up for (null: no online way, and never asked). */
  const requestFor = useCallback(
    (resourceId: string | null | undefined): string | null => {
      const x = resourceId ? requests[resourceId] : null
      return x && (x.how !== 'none' || signups[x.key]) ? x.key : null
    },
    [requests, signups],
  )
  /** A listing with no online way to reach it at all. */
  const unreachable = useCallback((resourceId: string | null | undefined): boolean => !!resourceId && requests[resourceId]?.how === 'none', [requests])

  /** The service a web address is, if Sign me up can do it. Never a ResourceHub page: a listing is matched by its own website. */
  const serviceFor = useCallback(
    (url: string | null | undefined): string | null => {
      if (!url || /\/resources\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(url)) return null
      const recipe = recipeForUrl(url)
      if (recipe) return recipe.key
      let host = ''
      try {
        host = url ? new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '') : ''
      } catch {
        return null
      }
      const matches = (hosts: string[]) => Array.isArray(hosts) && hosts.some((h) => host === h || host.endsWith(`.${h}`))
      return (host && (partners.find((p) => matches(p.hosts)) || brought.find((b) => matches(b.hosts)))?.key) || null
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partners, desktop, extension],
  )

  /** What can run this service's sign-up for this person, now. */
  const runnerFor = useCallback(
    (service: string): Runner | null => {
      // A local service: by email, or its website's form when the robot can run.
      const local = Object.values(requests).find((x) => x.key === service)
      if (local) return local.how === 'email' ? 'email' : local.how === 'form' && info.forms ? 'form' : null
      const recipe = RECIPES[service]
      const partner = partners.some((p) => p.key === service)
      if (!recipe && !partner && !brought.some((b) => b.key === service)) return null
      return pickRunner({
        partner,
        desktop: !!desktop?.services?.includes(service),
        extension: !!extension?.services?.includes(service),
        robot: !!recipe?.robot && info.robot,
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [desktop, extension, info.robot, info.forms, partners, requests],
  )

  // What a local service's form gets (the same words the server's robot types; lib/requests.ts).
  const requestOf = (details: SignupDetails, extras: RequestExtras, serviceName: string) => {
    const input = { ...details, email: info.email || '', extras, serviceName }
    return { firstName: details.firstName, lastName: details.lastName, email: info.email || '', phone: extras.phone, message: formMessage(input), subject: formSubject(input) }
  }

  const record = (service: string, runner: Runner, status: SignupStatus | 'timeout', detail: string | null, resourceId?: string | null) =>
    fetch('/api/me/signups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ service, runner, status, detail, resourceId }),
    }).catch(() => null)

  const runOne = useCallback(
    // The details and extras come with each run: just saved, they may not be in `info` yet.
    async (service: string, resourceId: string | null | undefined, details: SignupDetails, extras: RequestExtras): Promise<void> => {
      const recipe = serviceInfo(service)
      const runner = runnerFor(service)
      if (!recipe || !runner || !info.email) return
      setRunning((r) => ({ ...r, [service]: true }))
      setNote(
        runner === 'extension' ? `Signing you up for ${recipe.name}: watch it in the new tab.`
          : runner === 'desktop' ? `Signing you up for ${recipe.name}: watch it in the new window.`
            : recipe.kind === 'request' ? `Sending your request to ${recipe.name}…`
              : `Signing you up for ${recipe.name}…`,
      )
      let status: SignupStatus | 'timeout' = 'failed'
      let detail: string | null = null
      let pw: string | undefined
      let loginUrl: string | undefined
      let extensionNote = ''
      if (runner === 'email' || runner === 'form') {
        // A local service: the request goes from the server (email, or its website's form).
        const res = await fetch('/api/me/signups/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ resourceId }),
        }).catch(() => null)
        const j = await res?.json().catch(() => null)
        if (res?.ok) {
          status = j.status
          detail = j.detail || null
          if (j.status === 'needs_you' && j.url) {
            // Their form wants something only the person can do: with the extension, it opens in
            // their own browser with everything else filled in; they tick or answer, and send.
            const handed = extension?.features?.includes('contact')
              ? await contactWithExtension(j.url, requestOf(details, extras, recipe.name), j.mapping)
              : null
            if (handed?.status === 'requested') {
              // The check passed by itself in their browser, and it went.
              status = 'requested'
              detail = null
              await record(service, 'extension', 'requested', null, resourceId)
            } else if (handed?.status === 'needs_you' && handed.jobId) {
              setHandOver((h) => ({ ...h, [service]: { url: j.url, inExtension: true } }))
              extensionNote = ' It’s open in a new tab with everything else filled in: finish it there and send.'
              const jobId = handed.jobId
              void watchExtensionJob(jobId, 30 * 60 * 1000).then(async (later) => {
                if (later?.status !== 'requested') return
                await record(service, 'extension', 'requested', later.detail || null, resourceId)
                setSignups((s) => ({ ...s, [service]: { status: 'requested', runner: 'extension', at: new Date().toISOString() } }))
                setHandOver(({ [service]: _done, ...rest }) => rest)
                setNote(outcomeMessage(recipe.name, 'request', 'requested'))
              })
            } else setHandOver((h) => ({ ...h, [service]: { url: j.url, inExtension: false } }))
          }
        } else detail = j?.error || 'That didn’t work.'
      } else if (runner === 'extension' || runner === 'desktop') {
        const person = { ...details, email: info.email }
        const r: ExtensionStatus = runner === 'extension' ? await signUpWithExtension(service, person) : await signUpWithDesktop(service, person)
        status = r.status === 'running' || r.status === 'unknown' ? 'failed' : r.status
        detail = r.detail || null
        pw = r.password
        await record(service, runner, status, detail, resourceId)
        // Handed over: when the person finishes the step, the extension sees the next page; say so then.
        if (status === 'needs_you' && runner === 'extension' && r.jobId) {
          void watchExtensionJob(r.jobId).then(async (later) => {
            if (!later) return
            const s2: SignupStatus = later.status === 'timeout' || later.status === 'running' || later.status === 'unknown' ? 'failed' : later.status
            await record(service, runner, s2, later.detail || null, resourceId)
            setSignups((s) => ({ ...s, [service]: { status: s2, runner, at: new Date().toISOString() } }))
            setNote(outcomeMessage(recipe.name, recipe.kind, s2, later.detail))
            if (later.password) setPassword({ service, name: recipe.name, password: later.password })
          })
        }
      } else {
        const res = await fetch(runner === 'partner' ? '/api/me/signups/partner' : '/api/me/signups/robot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ service, resourceId }),
        }).catch(() => null)
        const j = await res?.json().catch(() => null)
        if (res?.ok) {
          status = j.status
          detail = j.detail || null
          pw = j.password
          loginUrl = j.loginUrl
        } else detail = j?.error || 'That didn’t work.'
      }
      const saved: SignupStatus = status === 'timeout' ? 'failed' : status
      setSignups((s) => ({ ...s, [service]: { status: saved, runner, at: new Date().toISOString(), detail } }))
      setRunning(({ [service]: _gone, ...rest }) => rest)
      // A partner makes the account itself: no password here, maybe a link to log in.
      setNote(`${outcomeMessage(recipe.name, recipe.kind, status, detail)}${runner === 'partner' && status === 'signed_up' ? ` ${recipe.name} will email you how to log in.` : ''}${extensionNote}`)
      if (loginUrl) setLoginLink({ name: recipe.name, url: loginUrl })
      if (pw) setPassword({ service, name: recipe.name, password: pw })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [info.email, info.extras, extension, runnerFor, serviceInfo],
  )

  desktopUpdate.current = (u) => {
    const recipe = serviceInfo(u.service)
    if (!recipe) return
    const s2: SignupStatus = u.status === 'timeout' || u.status === 'running' || u.status === 'unknown' ? 'failed' : u.status
    void record(u.service, 'desktop', s2, u.detail || null)
    setSignups((s) => ({ ...s, [u.service]: { status: s2, runner: 'desktop', at: new Date().toISOString() } }))
    setNote(outcomeMessage(recipe.name, recipe.kind, s2, u.detail))
    if (u.password) setPassword({ service: u.service, name: recipe.name, password: u.password })
  }

  /** Sign me up for one or several services, one after another. */
  const signUp = useCallback(
    async (items: { service: string; resourceId?: string | null }[], details: SignupDetails | null = info.details, extras: RequestExtras = info.extras) => {
      if (info.refusal) { setNote(info.refusal); return }
      if (!details) { setAsking({ services: items }); return }
      if (busy.current) return
      busy.current = true
      try {
        for (const item of items) {
          if (!runnerFor(item.service)) {
            const s = serviceInfo(item.service)
            const name = s?.name || 'This service'
            setNote(
              s?.kind === 'request' ? `Requests through ${name}’s website aren’t switched on yet.`
                : canAdd ? `${name} needs the Autinerary extension for one-click sign-up.`
                  : `${name} can’t be signed up for from here: use the link to sign up on its own site.`,
            )
            continue
          }
          await runOne(item.service, item.resourceId, details, extras)
        }
      } finally {
        busy.current = false
      }
    },
    [canAdd, info.details, info.extras, info.refusal, runOne, runnerFor, serviceInfo],
  )

  /** The details were saved: carry on with what was asked. */
  const detailsSaved = useCallback(
    (details: SignupDetails, extras?: RequestExtras) => {
      setInfo((i) => ({ ...i, details, extras: extras || i.extras }))
      const was = asking
      setAsking(null)
      if (was?.services.length) setTimeout(() => void signUp(was.services, details, extras || info.extras), 0)
    },
    [asking, info.extras, signUp],
  )

  /**
   * A listing with no email or website: look on the web for its own (lib/contactLookup.ts).
   * Found and checked, Send my request appears; otherwise it says so. Returns how a request reaches it now.
   */
  const lookUp = useCallback(
    async (resourceId: string): Promise<RequestHow | null> => {
      const name = requests[resourceId]?.name || 'them'
      setLookingUp((l) => ({ ...l, [resourceId]: true }))
      setNote(`Looking for a way to reach ${name}…`)
      const res = await fetch('/api/me/signups/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resourceId }),
      }).catch(() => null)
      const j = await res?.json().catch(() => null)
      setLookingUp(({ [resourceId]: _done, ...rest }) => rest)
      if (!res?.ok) {
        setNote(j?.error || 'That didn’t work. Try again.')
        return null
      }
      const how: RequestHow = j.how
      setRequests((r) => (r[resourceId] ? { ...r, [resourceId]: { ...r[resourceId], how, lookedUp: true, site: j.found?.website || r[resourceId].site } } : r))
      setNote(
        how === 'none'
          ? `We couldn’t find a website or email for ${name} that we could check was theirs. Call or visit them instead.`
          : `Found ${j.found?.email ? 'an email address' : 'a website'} for ${name}: you can send your request now.`,
      )
      return how
    },
    [requests],
  )

  /** "I've sent it": they finished a handed-over form on the service's own page. */
  const markSent = useCallback(
    async (service: string, resourceId: string | null | undefined) => {
      const name = serviceInfo(service)?.name || 'the service'
      const res = await fetch('/api/me/signups/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resourceId, sentByThem: true }),
      }).catch(() => null)
      const j = await res?.json().catch(() => null)
      if (!res?.ok) { setNote(j?.error || 'That didn’t save. Try again.'); return }
      setSignups((s) => ({ ...s, [service]: { status: 'requested', runner: s[service]?.runner || 'form', at: new Date().toISOString() } }))
      setHandOver(({ [service]: _done, ...rest }) => rest)
      setNote(`Marked as sent: ${name} will reply to you by email.`)
    },
    [serviceInfo],
  )

  return {
    on: info.on && SIGNUP_ON,
    ready: info.ready,
    loaded,
    refusal: info.refusal,
    email: info.email,
    details: info.details,
    extras: info.extras,
    suggested: info.suggested,
    forms: info.forms,
    requests,
    requestFor,
    unreachable,
    handOver,
    robot: info.robot,
    extension,
    /** This browser could add the extension from its store (otherwise never send anyone to get it). */
    canAddExtension: canAdd,
    desktop,
    loginLink,
    signups,
    listings,
    running,
    asking,
    password,
    note,
    setNote,
    runnerFor,
    serviceInfo,
    serviceFor,
    signUp,
    markSent,
    lookUp,
    lookingUp,
    detailsSaved,
    editDetails: () => setAsking({ services: [] }),
    closeDetails: () => setAsking(null),
    /** The person has saved the password: forget it. */
    passwordSeen: () => setPassword(null),
    reload: load,
  }
}

export type Signups = ReturnType<typeof useSignups>
