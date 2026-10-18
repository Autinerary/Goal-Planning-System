# For the lawyer: reviewing Autinerary's terms, October 2026

A short pack to hand an Ontario lawyer with the Terms and Conditions
(app.autinerary.ca/terms, `frontend/app/terms/page.tsx`) and the privacy page
(app.autinerary.ca/privacy). It says what Autinerary is, what the terms
promise, and the questions we most want answered. Prepared 18 October 2026.

## What Autinerary is

- **Autinerary Corp.**, Ontario. A planning app (goals, steps, a calendar,
  check-ins) and ResourceHub, a directory of services, products and articles
  for neurodivergent people and the people who support them. One account for
  both. Adults 18+; a parent or guardian can add a supervised account for a
  child under 18.
- **Free during the beta.** Paid subscriptions (monthly or yearly, a free
  first month, free access through universities, workplaces and governments)
  are being built, switched off.
- **Listings** come from OpenStreetMap (ODbL), services' own websites,
  research, and users' recommendations. About 35,000 places in Ontario once
  the current import is published. Nobody at Autinerary vets each one.
- **Ratings** come only from people with experience of a service (in their
  team, recommended by them, or proof of earlier use). A monthly sweep warns,
  puts on probation and hides services rated low; it can email services at
  the address they publish.
- **Community's Choice**: monthly nominations and a newsletter vote; winners
  get a badge. No prize.
- **AI** (OpenAI) writes plans and suggestions and reads searches; labelled.
- **Data** is stored in the United States (Supabase, AWS us-east-2), which
  the privacy page says.

## What we most want checked

1. **Limits on responsibility** (section "Limits on responsibility"): "as
   is", no responsibility for services, sellers or other people, a cap of the
   greater of 12 months' fees and CAD $100, and a narrow indemnity, each "to
   the extent the law allows", with a statement that consumer rights under
   Ontario's Consumer Protection Act, 2002 are kept. Enforceable as written
   for consumers? Anything to add or remove?
2. **Acceptance**: sign-up says "By creating an account you agree to the
   Terms and Conditions and the Privacy policy" next to the button (no
   checkbox), and each acceptance is recorded with its version and time.
   People who joined before see a one-time notice with "OK". Enough?
3. **Directory and ratings**: the disclaimers that listings are run by
   others and may be wrong, that a rating is people's experience and not our
   finding, and the monthly sweep that hides services rated 3.5 or under for
   two months. Any defamation or competition-law exposure in hiding a
   business, or in emailing it about its ratings (Canada's anti-spam law)?
4. **Community's Choice**: is a monthly vote with a badge and no prize a
   "contest" under the Competition Act or anything else? Do the rules need
   more (eligibility, disqualification)?
5. **Children**: 18+ to sign up, parent-managed accounts for under-18s, with a
   guardian attestation recorded. Anything the terms should say for parents?
6. **Health information**: people may record conditions, diagnoses and
   sensory needs (optional, for personalising). We are not a health
   information custodian. Anything the terms or privacy page should add
   (PIPEDA express consent, PHIPA)?
7. **Payments** (built, switched off): the terms now have a Paid plans
   section (`#paid-plans`), and `docs/subscriptions-2026-10.md` maps each
   rule we found to what the app does. Please review:
   - Ontario CPA 2002 ss. 37–40 and O. Reg. 17/05 ss. 31–33 (disclosure,
     accept or decline, the copy within 15 days): is our pricing page,
     the "Before you continue" box with its "I agree", Stripe's page, and the
     emailed copy enough?
   - O. Reg. 17/05 ss. 41–42: does a monthly plan that runs until cancelled
     count as "renewed" each month? We email 60 to 75 days before a yearly
     renewal; is that the right window?
   - s. 13 (negative option): our free month needs no card and never turns
     into a paid plan by itself; someone who subscribes during it is first
     charged when it ends, having agreed to that price. Is that clean?
   - Quebec (if we sell there): the cancel button (s. 187.28) and the notice
     2 to 10 days before a free period ends (s. 187.29, we send it 3 days
     before); does Division VII (ss. 214.1–214.11) reach an app subscription,
     which would change how a yearly plan renews? French versions of the
     terms and checkout (Charter of the French language ss. 52, 55, 57).
   - Refunds: "unless the law gives you a refund, cancelling doesn't refund
     time already paid for; charged by mistake, tell us within 30 days".
   - Free access for people who "explain their case and help advocate": any
     problem with access in return for advocacy?
8. **Sponsored listings** (planned, switched off): service providers could
   pay to be shown, labelled "Sponsored", chosen by what was searched, never
   by personal data. The privacy page now says "we don't show ads". What must
   change, and how much notice must users get?
9. **Governing law**: Ontario, with the courts of Ontario unless local law
   lets people use their own courts. Users in Jamaica: anything needed?
10. **Name and address**: the terms say "Autinerary Corp."; emails carry the
    mailing address. Should the registered address and corporation number be
    on the terms page?

## Where things are

- Terms: `frontend/app/terms/page.tsx` (version in `frontend/lib/legal.ts`).
- Paid plans, and the law we found on them: `docs/subscriptions-2026-10.md`.
- Privacy: `frontend/app/privacy/page.tsx`.
- Contracting research and legal notes: `docs/contracting-2026-10.md`.
- Ratings and Community's Choice rules: `docs/ratings-and-community-choice-2026-10.md`.
