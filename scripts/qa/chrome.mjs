/**
 * How the QA scripts start Chrome.
 *
 * Chrome runs its network service in a process of its own. During long or
 * back-to-back runs on a Mac it sometimes crashed and was restarted (Chrome's
 * log: "Network service crashed or was terminated, restarting service"). A
 * private browser context keeps its cookies only in that process's memory,
 * so the restart wiped the sign-in: every page after it was checked as a
 * signed-out visitor, at a random point in the run, with nothing in the app
 * or its servers touching the session (found 12 October 2026, about one run
 * in five). With the network service inside the browser process there is
 * nothing separate to restart.
 */

export const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export const CHROME_ARGS = ['--enable-features=NetworkServiceInProcess2']

/** puppeteer.launch options: headless Chrome with the network service in-process. */
export function chromeOptions(extra = {}) {
  return { executablePath: CHROME, headless: true, ...extra, args: [...CHROME_ARGS, ...(extra.args || [])] }
}
