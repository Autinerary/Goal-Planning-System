'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RECIPES, recipeForUrl } from '@/lib/signupKit'
import { desktopInfo, extensionInfo, onDesktopUpdate, signUpWithDesktop, signUpWithExtension, watchExtensionJob, type ExtensionInfo, type ExtensionStatus } from '@/lib/signupExtension'
import { SIGNUP_ON, outcomeMessage, pickRunner, type Runner, type SignupDetails, type SignupStatus } from '@/lib/signups'

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
  suggested: string
  robot: boolean
}

export interface SignupState {
  status: SignupStatus
  runner: string
  at: string
}

/** A service Sign me up can do: one of the kit's, or a partner's. */
export interface ServiceInfo {
  key: string
  name: string
  kind: 'account' | 'newsletter'
  terms?: string
  privacy?: string
  note?: string
}

interface PartnerInfo {
  key: string
  name: string
  hosts: string[]
}

export function useSignups(resourceIds: string[] = []) {
  const key = [...new Set(resourceIds.filter(Boolean))].sort().join(',')
  const [info, setInfo] = useState<Info>({ on: SIGNUP_ON, ready: false, refusal: null, email: null, details: null, suggested: '', robot: false })
  const [signups, setSignups] = useState<Record<string, SignupState>>({})
  const [listings, setListings] = useState<Record<string, string>>({})
  const [extension, setExtension] = useState<ExtensionInfo | null>(null)
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
      setInfo({ on: !!r.on, ready: !!r.ready, refusal: r.refusal || null, email: r.email || null, details: r.details || null, suggested: r.suggested || '', robot: !!r.robot })
      setSignups(r.signups || {})
      setListings(r.listings || {})
      setPartners(Array.isArray(r.partners) ? r.partners : [])
    }
    setExtension(ext)
    setDesktop(desk)
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
      if (r) return { key: r.key, name: r.name, kind: r.kind, terms: r.terms, privacy: r.privacy, note: r.note }
      const p = partners.find((x) => x.key === service)
      if (p) return { key: p.key, name: p.name, kind: 'account' }
      const b = brought.find((x) => x.key === service)
      return b ? { key: b.key, name: String(b.name).slice(0, 80), kind: b.kind === 'newsletter' ? 'newsletter' : 'account' } : null
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partners, desktop, extension],
  )

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
    [desktop, extension, info.robot, partners],
  )

  const record = (service: string, runner: Runner, status: SignupStatus | 'timeout', detail: string | null, resourceId?: string | null) =>
    fetch('/api/me/signups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ service, runner, status, detail, resourceId }),
    }).catch(() => null)

  const runOne = useCallback(
    async (service: string, resourceId: string | null | undefined, details: SignupDetails): Promise<void> => {
      const recipe = serviceInfo(service)
      const runner = runnerFor(service)
      if (!recipe || !runner || !info.email) return
      setRunning((r) => ({ ...r, [service]: true }))
      setNote(
        runner === 'extension' ? `Signing you up for ${recipe.name}: watch it in the new tab.`
          : runner === 'desktop' ? `Signing you up for ${recipe.name}: watch it in the new window.`
            : `Signing you up for ${recipe.name}…`,
      )
      let status: SignupStatus | 'timeout' = 'failed'
      let detail: string | null = null
      let pw: string | undefined
      let loginUrl: string | undefined
      if (runner === 'extension' || runner === 'desktop') {
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
      setSignups((s) => ({ ...s, [service]: { status: saved, runner, at: new Date().toISOString() } }))
      setRunning(({ [service]: _gone, ...rest }) => rest)
      // A partner makes the account itself: no password here, maybe a link to log in.
      setNote(`${outcomeMessage(recipe.name, recipe.kind, status, detail)}${runner === 'partner' && status === 'signed_up' ? ` ${recipe.name} will email you how to log in.` : ''}`)
      if (loginUrl) setLoginLink({ name: recipe.name, url: loginUrl })
      if (pw) setPassword({ service, name: recipe.name, password: pw })
    },
    [info.email, runnerFor, serviceInfo],
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
    async (items: { service: string; resourceId?: string | null }[], details: SignupDetails | null = info.details) => {
      if (info.refusal) { setNote(info.refusal); return }
      if (!details) { setAsking({ services: items }); return }
      if (busy.current) return
      busy.current = true
      try {
        for (const item of items) {
          if (!runnerFor(item.service)) {
            const name = serviceInfo(item.service)?.name || 'This service'
            setNote(`${name} needs the Autinerary extension for one-click sign-up.`)
            continue
          }
          await runOne(item.service, item.resourceId, details)
        }
      } finally {
        busy.current = false
      }
    },
    [info.details, info.refusal, runOne, runnerFor, serviceInfo],
  )

  /** The details were saved: carry on with what was asked. */
  const detailsSaved = useCallback(
    (details: SignupDetails) => {
      setInfo((i) => ({ ...i, details }))
      const was = asking
      setAsking(null)
      if (was?.services.length) setTimeout(() => void signUp(was.services, details), 0)
    },
    [asking, signUp],
  )

  return {
    on: info.on && SIGNUP_ON,
    ready: info.ready,
    loaded,
    refusal: info.refusal,
    email: info.email,
    details: info.details,
    suggested: info.suggested,
    robot: info.robot,
    extension,
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
    detailsSaved,
    editDetails: () => setAsking({ services: [] }),
    closeDetails: () => setAsking(null),
    /** The person has saved the password: forget it. */
    passwordSeen: () => setPassword(null),
    reload: load,
  }
}

export type Signups = ReturnType<typeof useSignups>
