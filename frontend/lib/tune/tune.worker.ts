// The background worker the person's model is tuned in (lib/tunedModels.ts, tuneInThisBrowser), so the page keeps
// working: {type: 'tune', request} starts it, {type: 'cancel'} stops it; it answers with progress, then done or error.
import { Cancelled, tune } from './run'

let stop = false
self.onmessage = async (message: MessageEvent) => {
  const data = message.data
  if (data?.type === 'cancel') {
    stop = true
    return
  }
  if (data?.type !== 'tune') return
  stop = false
  try {
    const result = await tune(data.request, (progress) => self.postMessage({ type: 'progress', progress }), () => stop)
    self.postMessage({ type: 'done', result })
  } catch (e: any) {
    self.postMessage({ type: 'error', message: String(e?.message || e), cancelled: e instanceof Cancelled })
  }
}
