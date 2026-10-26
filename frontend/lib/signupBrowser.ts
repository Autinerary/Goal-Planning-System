// Server only: the browser the server robot uses (one-click sign-up and local
// services' contact forms). Locally, a Chrome on this machine
// (SIGNUP_ROBOT_CHROME); on Vercel, @sparticuz/chromium in its own headless
// mode ("shell": its args already say so, and it has no other).

import type { Browser } from 'puppeteer-core'

export async function robotBrowser(): Promise<Browser> {
  const puppeteer = (await import('puppeteer-core')).default
  if (process.env.SIGNUP_ROBOT_CHROME) return puppeteer.launch({ executablePath: process.env.SIGNUP_ROBOT_CHROME, headless: true })
  const chromium = (await import('@sparticuz/chromium')).default
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: chromium.headless, defaultViewport: { width: 1280, height: 900 } })
}
