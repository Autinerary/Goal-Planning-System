import Script from 'next/script'

/**
 * UserWay's accessibility widget, only if the team turns it on
 * (NEXT_PUBLIC_USERWAY_ACCOUNT, in both apps; the planning note, October
 * 2026, Goal 10: "consider partnering with UserWay"). Off by default:
 * docs/goals-6-11-2026-10.md weighs it up, and the privacy page lists
 * UserWay whenever it is on.
 */
export const USERWAY_ACCOUNT = process.env.NEXT_PUBLIC_USERWAY_ACCOUNT || ''

export default function UserWay() {
  if (!/^[A-Za-z0-9]{4,40}$/.test(USERWAY_ACCOUNT)) return null
  return <Script id="userway" src="https://cdn.userway.org/widget.js" data-account={USERWAY_ACCOUNT} strategy="lazyOnload" />
}
