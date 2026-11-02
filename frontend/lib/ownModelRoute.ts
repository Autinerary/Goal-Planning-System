/**
 * Work that writes with AI, on the person's own device when "Use my own model" is on (lib/deviceRun.ts, runOnDevice;
 * backend api/routes/device.py, /run), or on our cloud model when it's off.
 *
 * When it's on but their model isn't ready: for something they asked for (adding a goal, the assistant), they're asked
 * before a cloud model is used, as when making a plan; for work done in the background (step guidance), nothing is
 * done and they're told why; and a journal entry is saved without an AI reading it. Never switched to the cloud
 * silently.
 */
import type { DeviceJob } from './deviceRun'
import type { OwnModelSettings, Ping } from './localModel'

export type RouteDeps = {
  settings: () => OwnModelSettings
  ping: (settings: OwnModelSettings) => Promise<Ping>
  token: () => Promise<string | null>
  run: (job: DeviceJob, request: unknown, settings: OwnModelSettings, token: string) => Promise<unknown>
  confirm: (question: string) => boolean
  cloudModel: () => string | undefined
}

async function browserDeps(): Promise<RouteDeps> {
  const [{ loadOwnModel, pingOwnModel }, { runOnDevice }, { createClient }, { toLlmConfig }] = await Promise.all([
    import('./localModel'), import('./deviceRun'), import('./supabase/client'), import('./modelPrefs'),
  ])
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  return {
    settings: loadOwnModel,
    ping: (s) => pingOwnModel(s),
    token: async () => (await createClient().auth.getSession()).data.session?.access_token ?? null,
    run: (job, request, settings, token) => runOnDevice({ apiUrl, token, settings, job, request }),
    confirm: (q) => window.confirm(q),
    cloudModel: () => toLlmConfig().model,
  }
}

export type Route = { route: 'device'; token: string; settings: OwnModelSettings } | { route: 'cloud' } | { route: 'none'; why: string }

/** Where this work runs now: on the device, on the cloud (their own model is off, or they said yes), or not at all
 *  (with why). Asks at most once. */
export async function chooseRoute(opts: { ask: boolean }, deps?: RouteDeps): Promise<Route> {
  const d = deps ?? await browserDeps()
  const settings = d.settings()
  if (!settings.enabled) return { route: 'cloud' }
  const [{ planRoute, cloudFallbackQuestion }] = await Promise.all([import('./localModel')])
  const token = await d.token()
  const ping = await d.ping(settings)
  const route = planRoute(ping, !!token)
  if (route.route === 'device' && token) return { route: 'device', token, settings: { ...settings, thinks: ping.ok && !!ping.thinks } }
  const why = route.route === 'ask' ? route.why : 'you need to be signed in to use it.'
  if (opts.ask && d.confirm(cloudFallbackQuestion(why, d.cloudModel(), false))) return { route: 'cloud' }
  return { route: 'none', why }
}

/** Do it where it should run: the job on the device, or `cloud()` (the endpoint as before). Throws the reason, in the
 *  person's words, when it isn't done. */
export async function withOwnModel<T>(job: DeviceJob, request: unknown, cloud: () => Promise<T>,
                                     opts: { ask: boolean; onDevice?: () => void }, deps?: RouteDeps): Promise<T> {
  const d = deps ?? await browserDeps()
  const where = await chooseRoute(opts, d)
  if (where.route === 'cloud') return cloud()
  if (where.route === 'none') {
    const { ownModelError } = await import('./deviceRun')
    throw ownModelError(opts.ask
      ? `Not done, because your own model isn’t ready: ${where.why} Try again when it is, or turn off “Use my own model” in Settings.`
      : `Your own model isn’t ready, so this wasn’t written: ${where.why}`)
  }
  opts.onDevice?.()
  return (await d.run(job, request, where.settings, where.token)) as T
}

/** For work that still makes sense without AI (a journal entry, saved and read by the agents' rules), on a route
 *  chosen with chooseRoute({ ask: false }) (once for many, as in an import): the job on the device, `cloud()` when their
 *  own model is off, or `withoutAI()` when it's on but not ready, rather than asking about a cloud model. */
export async function withOwnModelOrRules<T>(where: Route, job: DeviceJob, request: unknown, cloud: () => Promise<T>,
                                            withoutAI: () => Promise<T>, deps?: RouteDeps): Promise<T> {
  if (where.route === 'cloud') return cloud()
  if (where.route === 'none') return withoutAI()
  const d = deps ?? await browserDeps()
  return (await d.run(job, request, where.settings, where.token)) as T
}

/** What the person is told when something wasn't done: their own model's reason, or what the endpoint said (an error
 *  made with saidByServer); anything else, such as a network failure, gets the caller's usual words. */
export const saidByServer = (message: string): Error => Object.assign(new Error(message), { said: true })
export const wordsFor = (e: unknown, usual: string): string =>
  e instanceof Error && ((e as { ownModel?: boolean }).ownModel || (e as { said?: boolean }).said) ? e.message : usual
