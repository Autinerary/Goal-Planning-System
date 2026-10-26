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

## Local services: Send my request (STEP 91)

Most ResourceHub listings are clinics, programs and centres with no online
sign-up. For these the button is **Send my request** (`lib/requests.ts`,
`app/api/me/signups/request`): the person's request goes to the service, and
the service replies to them by email.

| The listing has | What happens |
|---|---|
| an email address | Autinerary emails the request. Replies go to the person, who gets a blind copy. |
| only a website | The server robot fills in the website's contact or booking form (`runContactForm` in `lib/signupKit.ts`), following its Contact link if need be. |
| a website with no form it can send | The request is emailed to the address the website shows, if one is clearly the service's own (`pickSiteEmail`). |
| neither | No button: "No online way to reach them yet". |
| (a place: park, café, bank…) | Nothing to sign up for. |

- **The request carries** the person's name and account email, and what they
  choose to add once: a phone number, who it's for (them, their child, someone
  they support), what they're looking for, and how they'd like to be
  contacted. They can read the message when they check their details.
- **The website's form:**
  - fields are placed by their own words;
  - a required box the words don't settle goes to the AI (`lib/formMapper.ts`,
    `gpt-4o-mini`) with the form's words only, never the person's;
  - a consent box is ticked, never a marketing one; a required choice gets a
    new-client, appointment or general option;
  - a robot check, or a question only the person can answer, stops it:
    nothing is sent. Then (if no address on their site fits, see below):
    - **with the extension (1.2.0),** the form opens in the person's own
      browser with everything else filled in (`contact-start` in
      `chrome-extension/signup.js`; the kit's hand-over mode,
      `runContactForm(..., { handOver: true })`, using the AI's reading of the
      boxes the server already had). They tick the check or answer, and send.
      The extension watches for that (the form's `submit`, then the next
      page's thanks, or thanks on the same page) and the app records it
      (`runner: extension`, `requested`). A required choice with no
      new-client option is also left to them.
    - **without it,** "Finish on their page" opens it, and **"I've sent it"**
      marks it sent (`sentByThem`, only for one waiting for them).
  - the app's message says what the form asks in its own words ("Date of
    birth", "Which location?").
- **The address on their website** (when there's no form it can send, or it
  stopped). The kit collects the addresses each page shows, with the words on
  their line, and `pickSiteEmail` scores them:
  - for: the service's front door (info@, intake@, the centre's own name@) on
    its own web address, words like "New clients" or "General inquiries" on
    its line, and a small practice's free mail address with its name;
  - against: a named person (only where nothing better is there);
  - never: media@, billing@, careers@, no-reply@, a web designer's, a parent
    council's or a PTA's, or another organisation's address;
  - nothing scores enough: the request doesn't go.
- **"Stop them":** each request has a signed link (`lib/requestLinks.ts`,
  `/emails/requests-stop`). It adds the address to `service_email_optouts`
  (STEP 79), the one list every email to a service checks, so Autinerary
  doesn't email it again: no requests, no surveys. The page then offers the
  website's form, or says there's no online way. If the list can't be read,
  nothing is sent. There's no List-Unsubscribe header: the person's blind copy
  would carry it too, and their mail app's Unsubscribe would stop the
  service's address.
- **Who sent it:** like the other emails to services, a request ends with
  Autinerary's name and mailing address (`NEWSLETTER_POSTAL_ADDRESS`), besides
  how to stop. Nothing else: no link to Autinerary's listings (the account
  holder's choice, 26 October 2026), so each email is only the person's own
  inquiry (Canada's anti-spam law).
- **Limits:** one request per person per listing, and 10 a day.
- **Never a test to a real service:** real websites were only ever tried in
  dry runs (filled in, never sent), with obviously-test details.

**How far it reaches** (36,238 approved listings, 26 October 2026):

| | Listings |
|---|---|
| Places (nothing to sign up for) | 25,703 |
| Services with an email address | 964 |
| Services with only a website | 3,128 |
| Services with neither | 6,443 |

Dry run on 29 of the website-only services' sites, 26 October 2026:

| Outcome | Sites |
|---|---|
| The form, filled in | 6 |
| Emailed to the address the site shows | 14 |
| No form, and no address that fits (staff only, a parent council, or none) | 7 |
| The site wouldn't load (certificate errors) | 2 |

So about 2 in 3 website-only services can be reached. With the 964 that have
an email address, that's about 3,100 of the 10,535 services. The 6,443 with no
email or website are the biggest gap: finding their websites would reach more
of them.

## Switches and settings

**Switched on 26 October 2026,** without the extension (no store listing):
`NEXT_PUBLIC_ONE_CLICK_SIGNUP=on` in both Vercel projects and `SIGNUP_ROBOT=on`
in the app's, in production. `.qa-local/browser/signup_on.mjs` checks it there
(21/21) without contacting any service; `signup_off.mjs` is the check for
switched off. To switch off, remove those and redeploy.

| Setting | Where | What it does |
|---|---|---|
| `NEXT_PUBLIC_ONE_CLICK_SIGNUP=on` | both Vercel projects (app and ResourceHub) | shows everything; until then the routes answer 404 |
| `SIGNUP_ROBOT=on` | the app's Vercel project | lets the server robot run |
| `SIGNUP_PARTNERS` | the app's Vercel project | partner services, as JSON, with each secret in its own environment variable |
| `NEXT_PUBLIC_SIGNUP_EXTENSION_ID` | the app's Vercel project | the extension's ID in its store, once published |
| `NEXT_PUBLIC_SIGNUP_EXTENSION_URL` | the app's Vercel project | its store page, once published: Microsoft Edge Add-ons (free; offered to Edge only) or the Chrome Web Store (offered to Chrome and Edge). Unset: nobody is sent to get it |
| `RESEND_API_KEY` | the app's Vercel project (already set) | sends requests by email |
| `APPLY_FROM_EMAIL` | the app's Vercel project (optional) | the From of a request; otherwise `REMINDER_FROM_EMAIL` |
| `OPENAI_API_KEY`, `OPENAI_FORM_MODEL` | the app's Vercel project | reading a website form's words (default `gpt-4o-mini`) |

- **Website forms need the server robot** (`SIGNUP_ROBOT=on`). Without it,
  only listings with an email address get Send my request.

- **Without the store ID,** the app uses the ID fixed by the key in
  `chrome-extension/manifest.json` (`nfhcdhdjijngooikmhoeebadceanmncf`).
- **The phone app** needs `EXPO_PUBLIC_APP_URL` and a new build: it gained
  react-native-webview, expo-crypto and expo-clipboard.
- **The server robot** uses `@sparticuz/chromium` on Vercel. Locally, set
  `SIGNUP_ROBOT_CHROME` to the path of a Chrome.
  - That browser couldn't be run on the Apple-silicon Mac it was built on, even
    in Amazon's own Lambda image (x86 emulation hangs Chromium).
  - On Vercel it needs `AWS_LAMBDA_JS_RUNTIME` (set in `lib/signupBrowser.ts`
    before the package loads): `@sparticuz/chromium` unpacks Amazon Linux
    2023's system libraries only when it recognises the Lambda runtime, and
    Vercel doesn't name it. Without it, 26 October's first check failed with
    "libnss3.so: cannot open shared object file".
  - `/api/me/signups/robot?check=1`, signed in, starts the browser, loads a
    blank page and gives its version, with no service and nobody's details.
    On production (26 October 2026): HeadlessChrome/131, about 3 seconds.
  - It uses `@sparticuz/chromium`'s own headless mode: `headless: true` would
    add a second headless switch that this build doesn't have.
- **The privacy page** gains "If you use Sign me up" when the switch is on
  (dated 26 October 2026 for it).

## Data

**STEP 90** (`backend/database/migrations/2026_one_click_signup.sql`) drops
STEP 89's two empty tables and adds `service_signups`:

- one row per person per service: which service, the ResourceHub listing when
  there is one, what ran it, and how it ended;
- never a password;
- the person reads their own rows, and only the server writes them;
- it is included in "Download my data".

**STEP 91** (`backend/database/migrations/2026_signup_requests.sql`):

- `service_signups` takes two more ways it ran, `email` and `form`, and one
  more outcome, `requested`. A listing's key is `r-` and its id without dashes.
- `service_email_optouts` (STEP 79) is where "Stop them" puts an address;
  only its description changes. Nobody signed in can read or add to it.

## Tests

| Test | What it checks | Result |
|---|---|---|
| `frontend/lib/signupKit.test.mjs` (CI) | every service's steps are well formed; no marketing box; matching web addresses | passes |
| `frontend/lib/signups.test.mjs` (CI) | words, names, who may, what runs it, Sign up for all | passes |
| `frontend/lib/signupPartners.test.mjs` (CI) | partner settings; signing and verifying, including replays; their answers | passes |
| `scripts/build-signup-kit.mjs --check` (CI) | the copies match | passes |
| `.qa-local/pgtest/step90_test.py` | STEP 90 run twice on the whole schema | 15/15 |
| `frontend/lib/requests.test.mjs` (CI) | which listings and how; the extras; the email and form message; choosing the address on a website, with the real sites' addresses | passes |
| `.qa-local/pgtest/step91_test.py` | STEP 91 run twice on the whole schema, and nobody signed in can read or add a stopped address | 15/15 |
| `.qa-local/signup-explore/kit_contact.mjs` | the contact-form filler on pretend sites: a Contact link, split names, a date of birth (AI words only, then hand-over), a robot check, newsletter-only, a framed form, a hidden consent box, a required choice, a dry run, a site with addresses but no form, and hand-over mode (the rest filled, the person ticks or answers and sends, read after) | 31/31 |
| `.qa-local/signup-explore/real_dry.mjs` | 29 real website-only services' sites, dry run: see "How far it reaches" | 20 of 29 |
| `.qa-local/browser/step91_live.mjs` | STEP 91 on production: the new runners and outcome, still nothing else; who can read or add a stopped address; nothing left behind | 15/15 |
| `.qa-local/browser/app_requests.mjs` | Send my request in the app with real listings and nothing reaching them: email to a Resend stand-in, and the robot's Chrome (`chrome-world.sh`) and the person's browser sending every address but this machine's and the database's to a pretend world; the details once, Send all requests, each way, a robot check handed over to the extension and finished by the "person", "I've sent it" without it, not twice, ResourceHub, "Stop them" | 56/56 (before STEP 91: 25/25) |
| `.qa-local/browser/ext_contact.mjs` | the extension finishing requests on pretend sites: a question, a required choice, a robot check on a form that answers in place, one it sends itself, what it refuses | 13/13 |
| `.qa-local/browser/app_signup.mjs` | (accounts) now with plain tools, never a real listing, which a request would really contact | 48/48 |
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

- **The extension isn't published.** The account holder won't pay the Chrome
  Web Store's fee (26 Oct), so Sign me up switches on without it:
  - the services that check for robots (Todoist, Notion, Autism Canada) show
    **"Sign up on their site"**, a link to their own sign-up page;
  - a form that needs the person (no extension to hand it to) has **"Copy my
    details for their form"** next to "Finish on their page" and "I've sent
    it";
  - nothing sends anyone to get the extension (`canAddExtension`).
  Microsoft Edge Add-ons is free ([how](extension-store-listing.md)); once
  1.2.0 is there and its page is set, Edge users get the in-browser sign-ups
  and hand-overs too.
- **The desktop app** can't finish a request's form yet: only the extension
  can. Without it, "Finish on their page" and "I've sent it".
- **Partners:** none yet. [The spec](partner-signups.md) is what to send them.
- **More services:** each new one is a recipe in `lib/signupKit.ts`, walked
  through once with a test account.
- **Plans don't recommend apps:** the tool agent doesn't recommend the apps in
  ResourceHub's shop yet, so Sign me up mostly appears on older plans and on
  ResourceHub listings.
