# Paid plans, free access and #FundAutinerary (Goal 9, October 2026)

The team's planning note asked for "the Khan Academy model": payments after
subscribing, monthly or yearly with a yearly discount, a paywall without a
plan, a free first month with nothing charged, feedback from people who
don't continue, partnerships with governments and universities, a "Help Us
Make This Free!" button with a timer, a petition (#FundAutinerary), and four
kinds of free access (students, employees, government or city, and "explain
your case").

All of it is built and **switched off**. Nobody sees a price or a paywall
until the team sets the flags below. Written 18 October 2026. This is not
legal or tax advice: the lawyer pack
([terms-lawyer-review-2026-10.md](terms-lawyer-review-2026-10.md), question 7)
and an accountant should check it before launch.

## What people see

| Page | Who | What |
| --- | --- | --- |
| `/pricing` | anyone | What stays free (ResourceHub, starter kits, help lines), the free month, both plans with prices read from Stripe, the four kinds of free access, the petition, and "The details" (who you pay, address, phone, email, currency, tax, when you pay, cancelling, refunds, changes) |
| `/billing` | signed in | Where you are (team, free access, a plan, the free month, or none), your plan (renewal date, first charge date, a payment problem), **Change plan, card or receipts** and **Cancel my plan**, choosing a plan with a "Before you continue" box and an "I agree" checkbox, free access, and the one question for people who don't continue |
| `/free-access` | signed in | A partner's code; registering as a student; "your workplace or city" (codes, and links to ask them through the petition); "None of these": your town, your situation, and a promise to help ask your town or school |
| `/petition` | anyone | #FundAutinerary: sign (asking the Government of Canada or a province, a university, a college, a workplace or a city), the counts, sharing |
| The paywall | signed in, free month over, no plan or free access | Instead of the page: "Your free month has ended", **See plans**, **Free access**, **Help us make this free**, the one question, ResourceHub (always free), Settings and Sign out. Billing, free access, the rules, Settings, Help and the public pages stay open (`PAYWALL_OPEN` in `frontend/lib/billing.ts`) |

Nothing anyone added is deleted when their free month ends.

## How it works

- **The free month** is ours, not Stripe's. It starts the first time the
  paywall applies to someone (`my_access()` in STEP 81), so people from the
  beta get a full month too. It needs no card and is never charged: when it
  ends, access stops until the person chooses a plan or free access. This is
  the lowest-risk design (no "negative option" billing: Ontario's CPA s. 13,
  Quebec s. 230(c), and the Competition Bureau's "subscription trap" cases).
- **Choosing a plan during the free month** still charges nothing in that
  month: Stripe's subscription starts with a trial that ends when the free
  month does (at least two days ahead, Stripe's minimum). The person has
  agreed to the price, and is emailed 3 days before the first charge.
- **Free access** (`access_grants`): a partner's code gives free access for
  the code's months; a student registers their school (pending until it
  partners); "explain your case" waits for the team. The team (admins and
  moderators) always has access.
- **The paywall** is a screen in the app (`frontend/app/components/Paywall.tsx`).
  Before launch, the AI routes (plan writing, the assistant) should also check
  `my_access()` on the server, so the paywall can't be skipped by someone who
  hides the screen.
- **The timer**: "Help us make this free!" counts down to the end of
  someone's free month on Billing, or to `NEXT_PUBLIC_FUND_CAMPAIGN_ENDS` on
  the pricing and petition pages. It updates once a minute, with no seconds
  and no red. Riipen Group 15 asked for "no countdown timers, guilt-based
  prompts, or artificial urgency", and Sylvia's chart asks for a timer, so it
  is only on those pages, never across the app. The team should decide
  whether to keep it.

## The database (STEP 81)

`backend/database/migrations/2026_subscriptions_accounts_petition.sql`:

- `subscriptions`: each person's plan, written only by the server from
  Stripe's notices. People read their own.
- `access_trials`: the free month.
- `access_grants`, `access_codes`, `redeem_access_code()`, `apply_for_access()`.
- `my_access()`: whether someone may use the app, and why.
- `subscription_feedback`: why people didn't continue (the app's question,
  and Stripe's cancellation reasons).
- `stripe_events`: each Stripe notice handled once.
- `billing_notices`: each billing email sent once, kept as the record that
  it went out.
- `petition_signatures`, `petition_counts()`.

Making a partner's code, in Supabase's SQL editor:

```sql
INSERT INTO public.access_codes (code, kind, organization, max_uses, months, expires_at)
VALUES ('UOFT-2026', 'student', 'University of Toronto', 500, 8, '2027-05-01');
```

`kind` is student, employee, government or partner. The team approves
students and "explain your case" requests in ResourceHub's admin Requests
page.

Reading the feedback:

```sql
SELECT moment, reason, count(*) FROM public.subscription_feedback GROUP BY 1, 2 ORDER BY 3 DESC;
```

## Turning it on

1. **Stripe** (start with a sandbox and test keys). The quickest way is one
   command, run by whoever holds the Stripe account, with its key in the
   environment:

   ```sh
   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs --monthly 9.99 --yearly 99.90
   ```

   It does everything in this step, can be run again safely, and prints the
   four values for Vercel. Use a Stripe account that is only Autinerary's:
   Stripe sends every event to every webhook endpoint in the account, so
   another app's endpoint would receive our customers' billing events.

   To check what is there without changing anything (it reads only, and
   prints no keys), run it with the same values as Vercel will have:

   ```sh
   STRIPE_SECRET_KEY=sk_test_... STRIPE_PRICE_MONTHLY=price_... STRIPE_PRICE_YEARLY=price_... \
     node scripts/stripe-check.mjs
   ```

   It says whether the variable names are the ones the app reads, the prices
   are Autinerary's, in Canadian dollars and not swapped, the webhook is for
   the app and hears every event it handles, the portal lets people cancel at
   the end of the period, and Connect is on for the shop. By hand, it is:
   - Make one product, "Autinerary", with two prices in CAD: monthly and
     yearly. The usual yearly discount is "2 months free" (10 times the
     monthly price, 16.7% off): Microsoft 365 Canada and Slack do exactly
     that; Notion says "up to 20%"; Khanmigo gives 8%.
   - Add a webhook endpoint `https://app.autinerary.ca/api/stripe/webhook`
     with these events: `checkout.session.completed`,
     `customer.subscription.created`, `.updated`, `.deleted`, `.paused`,
     `.resumed`, `.trial_will_end`, `invoice.paid` and
     `invoice.payment_failed`.
   - Set up the customer portal (Settings, Billing, Customer portal):
     - cancelling at the end of the period, with the cancellation reason
       collected (both on by default);
     - switching between the two prices;
     - updating the card;
     - invoice history;
     - French (Canada) available.
   - Revenue recovery (Settings, Billing): retry failed payments, then
     cancel the subscription if every retry fails.
   - Emails (Settings, Billing): turn on successful payment receipts. Our
     own emails cover the legal notices, so Stripe's trial reminders are
     optional.
2. **Environment variables** (Vercel, project goal-planning-app):
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`
     and `STRIPE_PRICE_YEARLY`. Prices are read from Stripe, so what is shown
     is what is charged.
   - `NEXT_PUBLIC_BUSINESS_ADDRESS` and `NEXT_PUBLIC_BUSINESS_PHONE`: the law
     asks for these before anyone pays and in the emailed copy. Checkout stays
     off without them.
   - `NEXT_PUBLIC_PAYMENTS=on`: people can choose a plan. Use it with test
     keys to try everything.
   - `NEXT_PUBLIC_PAYWALL=on`: the paywall and the free month start. This
     also turns payments on.
   - `STRIPE_TAX=on`: only once registered for GST/HST (see Tax).
   - `NEXT_PUBLIC_FUND_CAMPAIGN_ENDS` (optional): the petition's countdown
     date.
3. **Terms**: when payments go on, change `TERMS_VERSION` and
   `TERMS_UPDATED` in `frontend/lib/legal.ts` to that day, so everyone sees
   and accepts the Paid plans section (it is written for when plans start).
4. **Test** with Stripe's test cards (`4242 4242 4242 4242` succeeds;
   `4000 0000 0000 0341` fails at renewal) and a test clock to move through
   a free month and a renewal. Locally, use
   `stripe listen --forward-to localhost:3100/api/stripe/webhook`.

## The emails, and the law each answers

| Email | When | Why |
| --- | --- | --- |
| A copy of your agreement | Right after subscribing | Ontario, O. Reg. 17/05 s. 33: within 15 days, with what s. 32 lists, the person's name and the date. Quebec s. 54.7 too |
| Your free month ends on (date) | 3 days before a paid plan's first charge (Stripe's `trial_will_end`, with a daily check as a backup) | Quebec s. 187.29 (from 12 Sept 2026): 2 to 10 days before a free period ends, with the end date and the price |
| Your free month of Autinerary ends on (date) | 3 days before a no-card free month ends (only with the paywall on, and only for people without a plan or free access) | A kind heads-up: nothing is charged |
| Your free month has ended | Up to 3 days after it ends | The planning note's feedback question |
| Your yearly plan renews on (date) | 60 to 75 days before | Ontario, O. Reg. 17/05 s. 42: 30 to 90 days; inside Quebec's 90-to-60-day window if its Division VII applies |
| Your payment didn't go through | When a payment fails | So nobody loses access without knowing |
| Your plan is cancelled | When someone cancels | A confirmation |

The daily job is `/api/cron/billing-notices` (14:45 UTC). It does nothing
unless payments are on and Resend is set up. Don't run it against production
by hand.

## What else the law asks, and how it is met

- **Ontario, CPA 2002 ss. 37–40.** These rules apply because a plan can
  pass $50. The required facts are shown before paying, on the pricing page
  and in the "Before you continue" box. The person accepts with "I agree"
  and the button, and Stripe's page lets them go back. The emailed copy
  follows.
- **The CPA 2023** passed but is not in force. When it comes in, its
  regulations may add cancellation rules.
- **Quebec: an easy cancel button online** (s. 187.28). This is **Cancel my
  plan** on Billing, which opens Stripe straight at cancelling.
- **Competition Act: drip pricing.** No fees are added; tax is shown as
  "plus tax"; prices are read from Stripe. "Free" means free: the free month
  needs no card.
- **French (Quebec).** Before selling to people in Quebec, the terms and the
  checkout need French versions (Charter of the French language ss. 52, 55
  and 57). Stripe's checkout already follows the browser's language.
- **Universities, workplaces and cities** buying access for their people
  are business agreements, outside the consumer rules.

## Tax and fees

- **GST/HST**: registration is required once taxable sales pass $30,000 in a
  quarter, or over four quarters in a row. After that, charge by the
  customer's address:
  - 13% in Ontario;
  - 14% in Nova Scotia;
  - 15% in New Brunswick, Newfoundland and Labrador, and PEI;
  - 5% elsewhere.

  Sales to people outside Canada can be zero-rated. An accountant should
  say whether Autinerary counts as a service, intangible property or a
  computer-related service. Quebec's QST may also apply past $30,000 of
  sales there (not checked).
- **Stripe's fees in Canada**: 2.9% + C$0.30 per card payment, plus 0.7% for
  Billing, plus 0.5% for Tax (only where registered). That is about 7% of a
  C$10 monthly payment and about 4.4% of a C$100 yearly one, so yearly plans
  lose less to fees.

## How it compares with Khan Academy

Khan Academy keeps its core free with donations (it is a non-profit).
Khanmigo costs families US$4 a month or US$44 a year, is free for teachers,
and school districts pay US$10 per student per year. Autinerary's version:

- ResourceHub is always free;
- the app has a free month, then a plan;
- universities, workplaces and cities pay for their people;
- the petition asks them to.

The research behind this page, with every source, is in the session's
notes (18 October 2026); the statutes read were Ontario's CPA 2002, O. Reg.
17/05, the CPA 2023, Quebec's CPA (to 12 Aug 2026) and Bill 10 (S.Q. 2026,
c. 16), the Competition Act, and the CRA's GST/HST pages.
