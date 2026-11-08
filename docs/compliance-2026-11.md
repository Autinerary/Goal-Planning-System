# Compliance checklist, November 2026

The team's 20-item compliance checklist, item by item: what was done, where it lives, and what is still open. It
covers the Autinerary app (app.autinerary.ca) and ResourceHub, which share one account and one set of policies.

This is engineering work, not legal advice. Have a lawyer read the privacy policy, the terms and the refund policy
before paid plans start.

## How to check it again

- `node scripts/qa/check-compliance.mjs`: in a real browser, signed out. Nothing is counted before Allow, in either
  app; the banner's two choices look the same; Essential only, Cookie settings and Global Privacy Control work. It
  also checks that the new pages open without signing in, that the footer links every policy, and that the skip link
  works. Stop links must refuse bad signatures, and ResourceHub must send its policy pages to the app's. It blocks
  the counting requests it sees, so it writes nothing. `APP=` and `HUB=` point it at a local build.
- `node scripts/qa/check-accessibility.mjs`: axe-core, WCAG 2.1 A and AA plus 2.2 target size, at phone and
  desktop widths. The checklist's new pages are on its list.
- Unit tests, from `frontend/`, each run with `node --experimental-strip-types`:
  - `lib/consent.test.mjs`: both apps' consent rules.
  - `lib/emailStop.test.mjs`: the stop links and every email's footer.
  - `lib/billing.test.mjs`: the policies stay open past the paywall.
- `backend/tests/test_adapters.py`: the Llama naming rule.

Checked on the live sites on 8 November 2026, after the deploy:

- `check-compliance.mjs`: 41/41.
- The accessibility checker: 130 page checks, signed out and signed in, with no serious or critical problems.
- A signed-in account that accepted the old terms sees the notice saying what changed.

## The 20 items

| # | Item | Status | Where |
|---|------|--------|-------|
| 1 | Privacy policy | Done | `/privacy` |
| 2 | Terms of service | Done (version 2026-11-08) | `/terms` |
| 3 | Refund policy | Done | `/refunds` |
| 4 | Cookie policy | Done | `/cookies` |
| 5 | Cookie consent banner | Done, both apps | `CookieConsent` in each app |
| 6 | Check form consents | Done | sign-up, Path Market sharing |
| 7 | No unnecessary data | Done (STEP 100 applied) | consent gating, movement log |
| 8 | Audit third-party SDKs | Done | below |
| 9 | Remove dark patterns | Done | feedback form, banner |
| 10 | Remove hidden fees | Done (nothing is charged in the beta) | `/refunds`, `/pricing`, `/terms#paid-plans` |
| 11 | Remove fake reviews | Done (STEP 99 applied) | `2026_public_ratings.sql` |
| 12 | Remove unsupported claims | Done | ResourceHub home and footer |
| 13 | Accessibility alt text | Passing | the accessibility checker |
| 14 | Fix color contrast | Passing | the accessibility checker |
| 15 | Keyboard navigation | Done | skip link, Escape on dialogs |
| 16 | Add business details | Done | `/about`, every footer, every email |
| 17 | Age consent for kids' data | Unchanged; see open items | `/privacy#children`, `/terms#who` |
| 18 | Unsubscribe link in emails | Done | `lib/email.ts`, `lib/emailStopLinks.ts` |
| 19 | License fonts/images | Done; one open item | `/credits` |
| 20 | Data deletion request | Done | `/delete-my-data`, `/profile#delete` |

### 1. Privacy policy

`/privacy` was updated on 8 November 2026 to cover what was added since October:

- Use my own model.
- Build my training set. The server takes names and contact details out of the chosen items to show them, and keeps
  none of the text. Only a record of the approval is kept, as item codes.
- My agents, which are kept in the browser.
- Tell Autinerary what you need. What people type is not saved.
- Sharing models, agents and pathways: what is kept, what is checked, and what others see. Other people never see
  who shared it.
- Counting how the app is used, which is now opt-in.
- The page-order log, which keeps addresses only.

Hugging Face and GitHub are listed as providers (they serve the in-browser models). So is OpenAI's moderation check on
shared agents. The page links to the cookie policy, Delete my data and About.

### 2. Terms of service

`/terms` has a new section, "Agents, your own model, and what you share". It covers:

- the open models' licences (Qwen3 under Apache 2.0, and Llama 3.2's Community License and Acceptable Use Policy);
- the licence people give when they share something: use, copy and build on it, for free;
- the checks, with no promise that shared things work;
- taking things down.

One new conduct rule was added. The version is now `2026-11-08` (`frontend/lib/legal.ts`). Because the version
changed, people who accepted the old terms see the notice again, and it says what changed (`TERMS_CHANGE`).

### 3. Refund policy

`/refunds` brings the terms' Paid plans and The shop into one page:

- Cancelling.
- No refund for time already paid, unless the law gives one.
- Mistaken charges refunded within 30 days.
- Notice before renewals and price changes.
- For ResourceHub orders, the vendor is the seller and handles refunds.
- Ontario's Consumer Protection Act, 2002.

### 4. Cookie policy

`/cookies` lists every cookie and storage key in both apps, grouped by purpose:

- **Essential:** the Supabase sign-in cookie, ResourceHub's accessibility cookie, and the consent answer.
- **Settings:** kept in the browser.
- **Counting:** only after Allow.
- **Other companies:** the services some features use.

It has a Cookie settings button.

A cookie audit of the live sites on 8 November found only two cookies. Both apps set the sign-in cookie,
`sb-<project>-auth-token`, in two parts. ResourceHub also sets `autinerary_a11y`.

### 5. Cookie consent banner

Both apps (`frontend/app/components/CookieConsent.tsx`, `servicehub-mvp/components/layout/CookieConsent.tsx`) ask on
the first visit:

- "Essential only" and "Allow counting" look the same.
- Nothing is counted until Allow (`lib/consent.ts`). No visitor ID is made, no usage event is sent, and the page-order
  log isn't kept.
- Google Analytics, when it is set up, loads only after Allow.
- A browser sending Global Privacy Control or Do Not Track counts as no, whatever is pressed.
- "No" removes what counting kept.
- "Cookie settings" in every footer, and the setting in Settings, change the answer.
- The app's old Google Analytics question, `autinerary_ga_consent`, is read once and replaced.

### 6. Check form consents

- No consent box starts ticked. A search of both apps found none.
- Sharing a pathway in Path Market needs a confirmation that everyone credited agreed to be named. The server
  enforces it (`/api/path-models`).
- ResourceHub's own sign-up page recorded no acceptance of the terms, so it was removed. `/signup` on ResourceHub now
  goes to the app's sign-up, which records acceptance (`terms_acceptances`).

### 7. No unnecessary data

- **Counting waits for consent:** see item 5.
- **The page-order log (`profiles.movement`)** kept whole addresses, so searches came along with them, and so did the
  codes in links that work without signing in (check-in, stopping emails). Three changes:
  - The browser now keeps the address only, in `lib/movement.ts`.
  - The server keeps only the address, label and time of each visit, in `/api/me/movement`.
  - **STEP 100** (`2026_movement_paths_only.sql`) strips the logs already saved. Applied on 8 November 2026; checked
    on the live database afterwards: no saved visit still carries a "?" or "#".
- ResourceHub's map marker images came from cdnjs. They are now served by ResourceHub (`public/leaflet/`).

### 8. Third-party SDKs and services

On a first, signed-out visit to the live sites (8 November), the pages contacted only:

- their own servers;
- the planning service on Render;
- OpenStreetMap's tiles, on a listing's map;
- cdnjs, which is now removed (see item 7).

Fonts are self-hosted (`next/font`). The full list, and what each service gets, is in the privacy policy's "Who else
handles it" and the cookie policy's "Other companies".

| Service | Loads | When |
|---|---|---|
| Supabase | sign-in, data | always (essential) |
| Vercel, Render | hosting | always |
| OpenStreetMap tiles, OpenFreeMap | maps | when a map is shown |
| Google Analytics | page counts | only after Allow, and only if `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set |
| Google Forms | the feedback form | when it is opened |
| Jitsi Meet | video rooms | when someone joins a call |
| Hugging Face, GitHub | in-browser models | when someone uses a model in the browser |
| UserWay | accessibility menu | off (`NEXT_PUBLIC_USERWAY_ACCOUNT` unset) |
| Stripe | payments | off until paid plans |
| OpenAI, Resend, Twilio, Open-Meteo | server-side or on request | see the privacy policy |

### 9. Dark patterns

- The feedback form (`FeedbackGate`) used to block the app until someone said they had sent it. It is now optional:
  - "Not now" asks again in a week; so does Escape.
  - "Don't ask again" never asks again.
  - "I sent it" thanks them.
- The cookie banner offers two equal choices.
- There are no countdowns or guilt prompts. That was an earlier rule (Riipen Labs, Group 15).

### 10. Hidden fees

Nothing is charged during the beta. The pricing page, the terms and `/refunds` all say the same:

- the price, plus GST or HST, and no other fees;
- ResourceHub's shop fee is paid by the vendor.

### 11. Fake reviews

Most of ResourceHub's ratings came from test, QA, seed and made-up accounts, and were shown as community ratings.
STEP 99 (`2026_public_ratings.sql`) keeps every rating, in `ratings_all`, and shows only real people's.
`public.ratings` becomes a view that leaves those accounts out, except that a person still sees their own. The view
applies to every reader: the apps, server code, crons and functions. Averages, search order, a service's standing,
Users' Choice and wait times are worked out from real people's ratings only. Tested locally:
`.qa-local/pgtest/step99_test.py`, 17/17.

Applied on 8 November 2026. Checked on the live database afterwards: every rating is still kept in `ratings_all`, and a
signed-out visitor, and the server, see only real people's ratings. On ResourceHub, a service with no real ratings says
"No ratings yet". Few services have enough real ratings yet, so the home page's "Highest Ratings" sections (a service
needs 5 real ratings, or 3 within a category) are hidden until some do, instead of showing a heading over nothing.
`check-compliance.mjs` checks for that.

### 12. Unsupported claims

ResourceHub's home page and footer said "community-verified", which it isn't. They now say ratings come "from people
who used them, shown by who rated". A search of both apps found no other absolute claims ("proven", "guaranteed",
"certified" and similar).

### 13, 14. Alt text and contrast

The accessibility checker passed every page on its list with no serious or critical problems: signed out, signed in,
and with `ALL=1`. That includes axe's image-alt and color-contrast rules. One new problem was found and fixed: on a
phone, the cookie tables scroll sideways, so they can now be reached with the keyboard.

### 15. Keyboard navigation

- The app has a "Skip to main content" link, the first thing Tab reaches. ResourceHub already had one.
- Escape now closes the report dialog, Create Collab Group and the feedback form.
- Focus moves into the feedback form when it opens.

### 16. Business details

`/about` shows Autinerary Corp., Ontario, Canada. It also has the mailing address (the `NEWSLETTER_POSTAL_ADDRESS`
setting), how to reach us (contact, accessibility, proof of use, security, crisis lines) and the websites. Every
footer of both apps names the company and links to it. Every email to people now names the sender and gives the
mailing address (item 18).

### 17. Age consent for kids' data

Unchanged, and consistent with the policies:

- Someone must be 18 to make their own account; sign-up checks the date of birth.
- A parent or guardian adds a child from Family and manages that account. They must say whether they are the
  child's legal parent or legal guardian, and tick that they are and approve the supervised account. The server
  refuses the account without it (`/api/family/children`).
- Children's accounts can't use Sign me up.
- Moments from a Family account stay private.

Teen sign-up with a trusted adult's approval exists in the code, behind `NEXT_PUBLIC_TEEN_REQUESTS`. It is off, and
STEP 84 (its table) hadn't been applied when last checked, on 19 October (see open items).

### 18. Unsubscribe links

Every email now says why it came, how to stop it, who sent it and the mailing address:

- **Daily reminder:** a signed "Stop these emails" link that works without signing in (`lib/emailStopLinks.ts`,
  `/emails/stop`). It also has one-click unsubscribe headers (`List-Unsubscribe`, `List-Unsubscribe-Post`).
- **Check-in:** the same one-click headers (`/api/checkin/stop`). Its stop link now works for a year; its question is
  open for 30 days. Canada's anti-spam law asks for at least 60 days.
- **Welcome and "your story is ready":** sent once. They say where to turn other emails off, and who to write to.
- **Vendor discount event emails:** had no way to stop. They now have a signed stop link, and vendors who stop them
  still see the notices in their Resource Account.
- **Service emails** (rating standing, outreach) say "reply stop". Replies now reach the team's inbox (`replyTo`),
  which adds the service to `service_email_optouts`.
- **Already compliant:** the setup reminders, the first two weeks' emails, the newsletter, and texts (reply STOP).

### 19. Licences for fonts and images

`/credits` credits everything that asks for it:

- OpenStreetMap (ODbL);
- OpenFreeMap / OpenMapTiles;
- Open-Meteo (CC BY 4.0);
- Atkinson Hyperlegible (OFL);
- Lucide;
- Twemoji (CC BY 4.0);
- Avataaars and DiceBear;
- the 3D creator's MakeHuman parts, by author (CC0 and CC BY, from `public/avatar3d/credits.json`);
- Poly Haven;
- Qwen3 (Apache 2.0);
- Llama 3.2: "Built with Llama", the licence and the Acceptable Use Policy;
- IPIP, and the open-source software.

Shared models built on Llama are now listed with names starting "Llama", as Llama's licence asks, and say "Built with
Llama" (`backend/api/routes/adapters.py`).

The `/gamification` mock was removed: its background was a screenshot of a commercial game.

### 20. Data deletion requests

`/delete-my-data` explains how to delete. With an account, people delete it themselves on Your profile, straight
away. Parts can be deleted in the app or by email. Without an account, the stop link and email work. Replies come
within 30 days. Deleting an account now also takes down the person's shared model files and shared pathways.

## Open items

1. **STEP 99 and STEP 100 are applied** (8 November 2026). Note for new databases: STEP 99 uses a `security_invoker`
   view, which needs Postgres 15 or later, and STEP 100 does nothing where `profiles.movement` doesn't exist (on the
   live database the column was added by hand, outside the runbook).
2. **Page-order logs saved before people were asked.** They were kept for signed-in people without a yes, and the old
   privacy page didn't describe them. STEP 100 stripped them down to addresses. Clearing them entirely
   (`UPDATE public.profiles SET movement = NULL;`) would match "only after Allow" fully. The team decides.
3. **Have a lawyer read** the privacy policy, the terms, the refund policy and the cookie policy before paid plans
   start, and before turning on teen sign-up.
4. **Teen sign-up** (`NEXT_PUBLIC_TEEN_REQUESTS`, STEP 84). Before turning it on:
   - review how consent works for minors (under PIPEDA, and Quebec's Law 25, which needs a parent's consent under 14);
   - update the privacy and terms pages, which now say accounts are 18+.
5. **The cloud background pictures** (`frontend/public/cloud-bg-*.jpg`) have no record of where they came from. Replace them, or find their
   source and licence.
6. **Open-Meteo's free API is for non-commercial use.** Take a subscription before Autinerary earns money.
7. **`NEWSLETTER_POSTAL_ADDRESS` must stay set** on Vercel. The address on `/about` and in every email comes from it.
8. **Service emails' "reply stop"** is handled by hand: add the address to `service_email_optouts`.
9. **UserWay**, if it is turned on, loads a third-party script on every page. Decide whether it waits for consent.
10. Two backend tests reach the Supabase project with read-only calls (a sign-in check with a fake token, and one read
    of a test user's memory). They write nothing, but tests should stay offline.
