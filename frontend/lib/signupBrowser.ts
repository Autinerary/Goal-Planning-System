// Server only: the browser the server robot uses (one-click sign-up and local
// services' contact forms). Locally, a Chrome on this machine
// (SIGNUP_ROBOT_CHROME); on Vercel, @sparticuz/chromium in its own headless
// mode ("shell": its args already say so, and it has no other).

import type { Browser } from 'puppeteer-core'

export async function robotBrowser(): Promise<Browser> {
  const puppeteer = (await import('puppeteer-core')).default
  if (process.env.SIGNUP_ROBOT_CHROME) return puppeteer.launch({ executablePath: process.env.SIGNUP_ROBOT_CHROME, headless: true })
  // @sparticuz/chromium unpacks the system libraries Chromium needs (libnss3 and the rest, for Amazon
  // Linux 2023) only when it recognises AWS Lambda's Node 20/22 runtime, which Vercel's functions run on
  // but don't name ("libnss3.so: cannot open shared object file" on 26 Oct 2026). Name it before the
  // package loads: it reads this when it's first imported.
  if (!process.env.AWS_LAMBDA_JS_RUNTIME && !process.env.AWS_EXECUTION_ENV) process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs22.x'
  const chromium = (await import('@sparticuz/chromium')).default
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: chromium.headless, defaultViewport: { width: 1280, height: 900 } })
}
