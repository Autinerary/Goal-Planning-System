# Publishing the Autinerary extension to the Chrome Web Store

What the store's forms ask for, ready to paste. The package is made with
`node --experimental-strip-types scripts/package-extension.mjs`, which writes
`chrome-extension/dist/autinerary-<version>.zip`.

## Before you start

- **A developer account** at https://chrome.google.com/webstore/devconsole. It
  costs a one-time USD 5 fee, and the account holder sets it up.
- **The package** from the script above. It has no `key`, so the store gives
  the extension its own ID. It only talks to app.autinerary.ca and ResourceHub,
  never to localhost.
- **After publishing**, set these in the Vercel project goal-planning-app, then
  redeploy:
  - `NEXT_PUBLIC_SIGNUP_EXTENSION_ID`: the store's ID for the extension;
  - `NEXT_PUBLIC_SIGNUP_EXTENSION_URL`: its store page.

  Until then the app looks for the development ID, which only an unpacked copy
  has.

## The listing

**Name:** Autinerary

**Summary** (132 characters at most):
> Sign up for the services in your Autinerary plan in one click, and block distracting sites while you work.

**Description:**
> Autinerary turns goals into small, clear steps for neurodivergent people and
> the people who support them. This extension helps you act on your plan.
>
> Sign me up: when you press Sign me up in Autinerary, the extension opens that
> service's own sign-up page and fills it in for you, with your name, your email
> and a new strong password for you to save. You watch it happen. If the service
> asks for something only you can do (an "I'm not a robot" check, a payment, or
> a code from your email), it stops and shows you the page. It only ever fills
> in a form when you press Sign me up in Autinerary.
>
> Focus: block the sites you choose, set daily time limits, and keep private
> windows closed while you work.

**Category:** Productivity

**Language:** English

**Privacy policy:** https://app.autinerary.ca/privacy

**Screenshots** (1280×800): the task view's "Resources for this task", the
first-time name check, and the "Your new password" dialog. The app's local
build can make them (`.qa-local/browser/apply_shots.mjs` shows how).

## Single purpose

The store asks for one purpose:

> Help Autinerary members act on their plan: sign up for the plan's services in
> one click, and stay focused while doing the plan's tasks.

The store's single-purpose rule may see the site blocker and the sign-up as
two purposes. If a reviewer says so, publish the sign-up part on its own and
keep the blocker out of this listing. The blocker was never published or linked
from the app.

## Permissions, and why

| Permission | Why |
|---|---|
| `scripting` | Fills in a service's sign-up form, in the tab it opens, when you press Sign me up |
| `tabs` | Opens the service's sign-up page, follows it page by page, and (for focus) knows which site is open |
| `storage` | Keeps your blocked sites and time limits, and a sign-up's progress until it ends (session only) |
| `alarms` | Resets daily time limits |
| `declarativeNetRequest`, `declarativeNetRequestFeedback` | Blocks the sites you choose |
| `activeTab` | Focus mode on the current tab |
| Host permissions: all sites | You choose which sites to block, and the services you sign up for are on their own sites |
| `externally_connectable` (app.autinerary.ca, ResourceHub) | Lets Autinerary's pages ask it to sign you up, and only those pages |

**Remote code:** none. Every script is in the package.

## Data use (the store's privacy form)

- **Personally identifiable information.** Collected: your first name, last
  name and email, which Autinerary passes to the extension when you press Sign
  me up. Used only to fill in that service's form, then forgotten when the
  sign-up ends.
- **Authentication information.** Collected: the new account's password. Made
  by the extension and shown to you once in Autinerary. It is held only until
  then, in the browser's session storage, which is cleared when the browser
  closes.
- **Web browsing activity.** Used: for focus, the open site's address, kept on
  your device to count time against your limits. Never sent anywhere.
- **The store's certifications.** Not sold, not used for anything unrelated,
  not used for credit decisions. Tick all three.
