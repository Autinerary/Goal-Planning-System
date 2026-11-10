/**
 * Make a plan with the small open model on this device (Settings, "Use my own model").
 *
 * Opens one WebSocket to the backend (backend/api/routes/device.py), sends the same body as onboarding's job
 * request, and answers each prompt the agents send by asking the model on this laptop (lib/localModel.ts). The
 * prompts and answers go between our server and this browser only, never to an AI company. One prompt at a time:
 * a laptop model answers one request at once anyway, and queued requests would only run down their timeouts.
 */
import type { Ask, OwnModelSettings } from './localModel'

export type DeviceRunResult = { pathId: string; answered: number; failed: number }

type SocketLike = {
  send(data: string): void
  close(): void
  onopen: ((ev?: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onerror: ((ev?: unknown) => void) | null
  onclose: ((ev?: unknown) => void) | null
}

export type DeviceRunOptions = {
  apiUrl: string
  token: string
  body: unknown
  settings: OwnModelSettings
  onStage?: (stage: string) => void
  /** Each answer as it comes back from the laptop, for a progress count. */
  onAnswer?: (answered: number, failed: number) => void
  openSocket?: (url: string) => SocketLike
  ask?: (settings: OwnModelSettings, ask: Ask) => Promise<string>
  timeoutMs?: number
}

/** A failure to show the person as it is: it says what happened with their own model, not a generic "try again". */
export const ownModelError = (message: string): Error => Object.assign(new Error(message), { ownModel: true })

export function deviceSocketUrl(apiUrl: string): string {
  return `${apiUrl.replace(/\/$/, '').replace(/^http/, 'ws')}/api/device/plan`
}

type Relay = {
  url: string
  start: Record<string, unknown>
  tooLong: string
  unreachable: string
  closed: string
  done: (message: any, answered: number, failed: number) => unknown
}

/** One connection to the backend that the agents' prompts come down, each answered by the model on this device, one at
 *  a time and in order, until the work is done (its result) or fails (its message). */
function relayOnDevice<T>(options: DeviceRunOptions, relay: Relay): Promise<T> {
  const ask = options.ask ?? (async (settings: OwnModelSettings, a: Ask) => (await import('./localModel')).askOwnModel(settings, a))
  const socket = (options.openSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike))(relay.url)
  let answered = 0
  let failed = 0
  let queue: Promise<void> = Promise.resolve()

  return new Promise<T>((resolve, reject) => {
    let finished = false
    const finish = (error: Error | null, result?: T) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      try { socket.close() } catch {}
      if (error) reject(error)
      else resolve(result as T)
    }
    const timer = setTimeout(() => finish(ownModelError(relay.tooLong)), options.timeoutMs ?? 30 * 60 * 1000)
    const send = (message: unknown) => { try { socket.send(JSON.stringify(message)) } catch {} }

    socket.onopen = () => send({ ...relay.start, token: options.token })
    socket.onerror = () => finish(ownModelError(relay.unreachable))
    socket.onclose = () => finish(ownModelError(relay.closed))
    socket.onmessage = (event) => {
      let message: any
      try { message = JSON.parse(String(event.data)) } catch { return }
      if (message?.type === 'prompt') {
        // One at a time, in order.
        queue = queue.then(async () => {
          try {
            // The server's safety check on this device (backend core/moderation.py) runs on the checker model.
            const settings = message.agent === 'safety_check' ? (await import('./localModel')).checkerSettings(options.settings) : options.settings
            const content = await ask(settings, {
              messages: message.messages, temperature: message.temperature, max_tokens: message.max_tokens, json: !!message.json,
              agent: typeof message.agent === 'string' ? message.agent : null, think: message.think === true,
            })
            answered += 1
            send({ type: 'answer', id: message.id, content })
          } catch {
            failed += 1
            send({ type: 'error', id: message.id })
          }
          options.onAnswer?.(answered, failed)
        })
      } else if (message?.type === 'stage' && typeof message.stage === 'string') {
        options.onStage?.(message.stage)
      } else if (message?.type === 'done') {
        const result = relay.done(message, answered, failed)
        if (result !== undefined) finish(null, result as T)
      } else if (message?.type === 'error') {
        finish(ownModelError(typeof message.message === 'string' ? message.message : 'Path generation failed. Please try again.'))
      }
    }
  })
}

export function makePlanOnDevice(options: DeviceRunOptions): Promise<DeviceRunResult> {
  return relayOnDevice<DeviceRunResult>(options, {
    url: deviceSocketUrl(options.apiUrl),
    start: { type: 'start', request: options.body },
    tooLong: 'Making your plan on your device took too long.',
    unreachable: 'Could not reach our server to make your plan.',
    closed: 'The connection closed before your plan was ready.',
    done: (message, answered, failed) => typeof message.pathId === 'string'
      ? { pathId: message.pathId, answered: message.answered ?? answered, failed: message.failed ?? failed }
      : undefined,
  })
}

/** Everything else that writes with AI, on this device: step guidance, a goal's steps, a journal entry's insights
 *  and plan changes, the assistant's answer, and goal ideas in setup (backend api/routes/device.py, /run). The result
 *  is what the job's own endpoint returns. */
export type DeviceJob = 'guidance' | 'goal-steps' | 'reflection' | 'assistant' | 'goal-helper' | 'agent-setup'

export function deviceRunUrl(apiUrl: string): string {
  return `${apiUrl.replace(/\/$/, '').replace(/^http/, 'ws')}/api/device/run`
}

export function runOnDevice<T = any>(options: Omit<DeviceRunOptions, 'body'> & { job: DeviceJob; request: unknown }): Promise<T> {
  return relayOnDevice<T>({ ...options, body: null }, {
    url: deviceRunUrl(options.apiUrl),
    start: { type: 'start', job: options.job, request: options.request },
    tooLong: 'That took too long on your device.',
    unreachable: 'Could not reach our server.',
    closed: 'The connection closed before it was done.',
    done: (message) => message.result ?? null,
  })
}
