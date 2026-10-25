# One-click sign-up (October 2026)

## The ask

The account holder asked for this on 25 October 2026. Their words, lightly
tidied:

> a button that I click on and I sign up for the service, bypassing filling the
> form on their site

The task view should also show the step's resources, with a **Sign up for all**
that covers that page only. The first version emailed services an application
(STEP 89). That was the wrong reading of the ask, and it never went live: it is
removed, and STEP 90 drops its tables.

## How it works

**Sign me up** creates the person's account on the service itself, with no
typing. It uses the first of these that can:

| What runs it | Where | What it does |
|---|---|---|
| **Partner** | services that give us an API (`lib/signupPartners.ts`, [the spec](partner-signups.md)) | no form at all: a signed request, and the service makes the account |
| **Desktop app** | when the person is in the Autinerary desktop app (`desktop/signup.js`) | the service's page opens in a window of the app's own and is filled in |
| **Extension** | Chrome or Edge, with the Autinerary extension (`chrome-extension/signup.js`) | the service's page opens in a new tab and is filled in while the person watches |
| **Server robot** | anyone else, only for services with no robot check (`lib/signupRobot.ts`) | a browser on our server fills it in |
| **Phone app** | its **Sign up** tab (`mobile/screens/SignupScreen.tsx`) | the page opens in a web view and is filled in |

All five run one **kit**: each service's sign-up steps, written by hand from
its real pages, and one runner. The kit lives in `frontend/lib/signupKit.ts`.
`scripts/build-signup-kit.mjs` copies it to the extension, the desktop app, the
phone app, the server robot and ResourceHub, and CI fails if a copy is out of
date.

The runner works page by page, and runs again after every page load:

- **It fills in the fields:** name, email, and a new password for an account.
- **It ticks boxes, with limits.** It ticks the service's terms box only,
  because the person agreed to those terms in Autinerary. It never ticks a
  marketing box, and never fills a trap field meant for robots.
- **It sends each page once.**
- **It can end in five ways:**
  - **signed up**;
  - **check your email** (the service sent a link or code);
  - **you already have an account**;
  - **needs you**: a robot check, a payment, or a code from their email. The
    page is left in front of the person, with everything filled in. When they
    finish it, the runner carries on and reports how it ended;
  - **didn't go through**, with the service's own words when it has any.
- **It never gets around a robot check.** A check that passes by itself
  (Cloudflare's usual automatic pass) is waited for, up to 6 seconds; any other
  check is handed over.

### Passwords

Each new account gets its own strong password, made where the runner runs (the
extension, the desktop app, the phone app or the server). It is shown to the
person once, with a **Copy** button, to save. Autinerary never stores it.

### Checking once

The first time, the person checks their first and last name. These are saved
in `profiles.preferences.signup` with the time they agreed. The email is their
account's own. Before anything is sent, they see each service's terms. After
that, Sign me up is one click, and Sign up for all goes through a page's
services one after another.

### Where it shows

- the task view's **Resources for this task**, with Sign up for all;
- each tool card on the Milestone view;
- `/sign-me-up/<service>` in the app, which is where ResourceHub's **Sign me
  up** button on a listing goes;
- ResourceHub's **My Resources**, in a **Signed up** tab;
- the phone app's **Sign up** tab.

The page `/extension` says what the extension does and whether it is installed.

## The services so far

All were walked through on 25 October with test accounts, at the account
holder's yes. The test accounts are plus-addresses of the team's admin inbox.
Their addresses and passwords are kept locally, not in the repo, in
`.qa-local/signup-test-accounts.json`.

| Service | Kind | Server robot? | What we found |
|---|---|---|---|
| Focusmate | account | yes | email and password → name, and the 17+ and terms box → "check your email" |
| Headspace | account | yes | email and terms box → name and password → signed in |
| Speechify | account | yes | email and password → signed in. It shows nothing when the email already has an account |
| CHADD | newsletter | yes | Mailchimp form, with a trap field left empty → "Thank you for subscribing" |
| Todoist | account | no | Cloudflare refused an automated browser. It usually passes in a person's own browser |
| Notion | account | no | refused an automated browser; it emails a code |
| Autism Canada | newsletter | no | everything filled in, then "I'm not a robot" for the person to tick |

These can't be done for people:

- **Calm** blocks automated browsers outright.
- **Reddit** asks every visitor to prove they're human.
- **BetterHelp** asks health questions, which are the person's to answer.

**Plans made since September** recommend ResourceHub listings, which are
mostly local services. Sign me up appears on a listing when its website is one
of these services. Plans from July still hold the generic suggestions, such as
Focusmate, Notion, Todoist, Calm and BetterHelp.

## Switches and settings

| Setting | Where | What it does |
|---|---|---|
| `NEXT_PUBLIC_ONE_CLICK_SIGNUP=on` | both Vercel projects (app and ResourceHub) | shows everything; until then the routes answer 404 |
| `SIGNUP_ROBOT=on` | the app's Vercel project | lets the server robot run |
| `SIGNUP_PARTNERS` | the app's Vercel project | partner services, as JSON, with each secret in its own environment variable |
| `NEXT_PUBLIC_SIGNUP_EXTENSION_ID` | the app's Vercel project | the extension's Chrome Web Store ID, once published |
| `NEXT_PUBLIC_SIGNUP_EXTENSION_URL` | the app's Vercel project | its store page, once published |

- **Without the store ID,** the app uses the ID fixed by the key in
  `chrome-extension/manifest.json` (`nfhcdhdjijngooikmhoeebadceanmncf`).
- **The phone app** needs `EXPO_PUBLIC_APP_URL` and a new build: it gained
  react-native-webview, expo-crypto and expo-clipboard.
- **The server robot** uses `@sparticuz/chromium` on Vercel. Locally, set
  `SIGNUP_ROBOT_CHROME` to the path of a Chrome.
  - That browser couldn't be run on the Apple-silicon Mac it was built on, even
    in Amazon's own Lambda image (x86 emulation hangs Chromium).
  - After switching `SIGNUP_ROBOT` on, open `/api/me/signups/robot?check=1`
    while signed in. It starts the browser, loads a blank page and gives its
    version, with no service and nobody's details. Do this before anyone uses
    the robot.
  - It uses `@sparticuz/chromium`'s own headless mode: `headless: true` would
    add a second headless switch that this build doesn't have.
- **The privacy page** gains "If you use Sign me up" when the switch is on.
  Bump its `UPDATED` date then.

## Data

**STEP 90** (`backend/database/migrations/2026_one_click_signup.sql`) drops
STEP 89's two empty tables and adds `service_signups`:

- one row per person per service: which service, the ResourceHub listing when
  there is one, what ran it, and how it ended;
- never a password;
- the person reads their own rows, and only the server writes them;
- it is included in "Download my data".

## Tests

| Test | What it checks | Result |
|---|---|---|
| `frontend/lib/signupKit.test.mjs` (CI) | every service's steps are well formed; no marketing box; matching web addresses | passes |
| `frontend/lib/signups.test.mjs` (CI) | words, names, who may, what runs it, Sign up for all | passes |
| `frontend/lib/signupPartners.test.mjs` (CI) | partner settings; signing and verifying, including replays; their answers | passes |
| `scripts/build-signup-kit.mjs --check` (CI) | the copies match | passes |
| `.qa-local/pgtest/step90_test.py` | STEP 90 run twice on the whole schema | 15/15 |
| `.qa-local/signup-explore/kit_fake.mjs` | the runner against a pretend service on this machine: both pages, exists, a slow service, a check that passes by itself, one the person ticks, an app-like page, a dry run, a service that never answers | 11/11 |
| `.qa-local/signup-explore/kit_live.mjs` | the real services: first page filled without sending (7/7), and the whole flow with the existing test accounts ending "exists" | Focusmate, Headspace and CHADD pass |
| `.qa-local/browser/ext_signup.mjs` | the extension in Chrome with the real services | 12/12 |
| `.qa-local/browser/ext_fake.mjs` | the extension with the pretend service, including a hand-over the person finishes | 11/11 |
| `.qa-local/desktop/harness.js` | the desktop app's code with the pretend service | 9/9 |

The phone app type-checks. It can't run here: it needs an EAS build.

Chrome 137 and later ignore `--load-extension`, so the extension is loaded
through the DevTools protocol (`Extensions.loadUnpacked`, with `pipe: true` and
`--enable-unsafe-extension-debugging`).

## Not done yet

- **Publishing the extension** to the Chrome Web Store needs the account
  holder's developer account.
- **Partners:** none yet. [The spec](partner-signups.md) is what to send them.
- **More services:** each new one is a recipe in `lib/signupKit.ts`, walked
  through once with a test account.
- **Plans don't recommend apps:** the tool agent doesn't recommend the apps in
  ResourceHub's shop yet, so Sign me up mostly appears on older plans and on
  ResourceHub listings.
