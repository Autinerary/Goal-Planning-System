# Goal 2: the contracting system, October 2026

The team's planning note, "Goal 2: Contracting System", worked through on 18
October 2026. Two things were asked to be built (Terms and Conditions;
scheduling a video call or an in-person meeting, with a free first visit),
and five questions were asked about contracts. This page says what was built,
and answers the questions.

Prices and laws below were read on the vendors' and governments' own pages on
18 October 2026 (links at the end). This is research, not legal advice: a
lawyer in Ontario should look at the terms and at any contract feature before
it is used for real.

## What was built

| Asked for | Now |
| --- | --- |
| "OUR APP NEEDS AN APPROPRIATE TERMS & CONDITIONS!!!" | **Terms and Conditions** at `/terms` (`frontend/app/terms/page.tsx`), one set for the app and ResourceHub, written as plainly as the privacy page and matching what the apps really do: 18 or older (a parent or guardian manages a child's account), free during the beta, not advice and not a crisis service (911, 9-8-8), AI labelled and fallible, listings run by other people, agreements with services are between the person and the service, the rating rules and the monthly sweep, Community's Choice, what people post, what not to do, the shop sells nothing, limits on responsibility that keep consumer rights (Ontario's Consumer Protection Act, 2002), Ontario law. Linked from the app's and ResourceHub's footers, sign-up ("By creating an account you agree to …"), the Google sign-in's date-of-birth step, and every email's footer. Each acceptance is recorded with its version (`terms_acceptances`, STEP 79): at sign-up, or, for people who joined before, from a one-time notice at the top of the app ("Autinerary now has Terms and Conditions … OK") |
| "Add ability to schedule video call + (potential) in-person meet w/ free 1st visit" | In Build a Team, once a service is on the team: **Schedule the meeting**: a video call, a phone call or in person; a day and a time; for a video call, the service's link or **Make a free video link** (a Jitsi Meet room nobody can guess, no account needed); in person, the place (the service's address to start with); and whether it is the free first visit. It goes in the Autinerary calendar as "Video call with …" (the time only: connections can see a calendar), the details stay with the person's team (`saved_resources.meeting`, which only they can read), and the person can **add it to their own calendar app** (an .ics file with the link or place) and **email the service this time** from their own email app. Nothing is sent to the service by us. **Free first visit** is a new tag (`free_first_visit`): a filter, a chip on cards, a box in Recommend ("They offer a free first visit"), and the meeting form says so; Inclusion Canada's benefits navigators, whose page offers a free meeting, have it already |

Also fixed on the way: the calendar's list and time-block views showed a dated
task on that weekday every week (a meeting three weeks out also appeared this
Tuesday); dated tasks now show only in their own week there. The under-18
message said a trusted-adult sign-in was coming; family accounts already
exist, and it now says a parent or guardian can add them.

## On contracting services

### 1. Contract requests between people and services, maybe by email

> Can we do this in a way that doesn't put us at serious legal risk? If so,
> how and what API(s), and what would it cost per contract? If not, why not,
> and is it an absolute no or just time?

**Yes, with modest risk, if Autinerary stays the go-between and never the
author of the contract.** Not an absolute no; a few weeks to set up properly,
most of it legal review rather than code.

What makes it safe enough:

- **Electronic signatures are valid.** Ontario's Electronic Commerce Act, 2000
  says a requirement to sign is met by an electronic signature (s. 11), that
  consent to deal electronically can be inferred from conduct (s. 3), and that
  a contract can be made by clicking (s. 19). It **does not apply to** wills,
  trusts made by wills, powers of attorney for property or personal care, and
  negotiable instruments (s. 31). Jamaica's Electronic Transactions Act is
  similar, applies only where both sides agreed to deal electronically (s. 5),
  and excludes wills, transfers of land, trusts and powers of attorney. So:
  never for wills, powers of attorney or trusts, which matters for the Future
  planning listings (Henson trusts): those stay information only.
- **We must not draft or fill in contracts for people.** Ontario's Law
  Society Act counts selecting, drafting or completing a document that affects
  someone's legal interests, on their behalf, as legal services (s. 1(6)), and
  only licensees may provide them (s. 26.1; fines up to $25,000, then $50,000).
  So the contract must be **the service's own agreement** (or a template a
  lawyer wrote that the service adopts), and Autinerary only carries it. To
  generate contracts ourselves, the route is the Law Society's Access to
  Innovation sandbox (participants are "deemed compliant"; it includes
  document generators; its five-year pilot ends in November 2026 and the Law
  Society is consulting on extending it) or a lawyer partner.
- **Email.** Under Canada's anti-spam law, an email that consists solely of
  one person's inquiry or application to a business, about that business, is
  outside the consent rules (s. 6(5)(b)). If we add anything promotional
  ("claim your listing"), it becomes a commercial message, needing consent
  (implied for an address the business conspicuously publishes, s. 10(9)(b),
  if the message is relevant to it), our identification and an unsubscribe.
  So a request email carries only the person's request. Today's version (built)
  goes **from the person's own email app**, which is simplest of all.
- **Privacy.** A care contract carries sensitive information: express consent,
  say plainly who receives it, and that it may be stored outside Canada
  (PIPEDA and the Privacy Commissioner's guidance). Keep health details out of
  the request itself (name, contact, the service wanted, times); the provider
  collects intake through its own records. If we ever hold health records for
  clinicians, Ontario's PHIPA makes us their agent or electronic service
  provider, with its own duties (O. Reg. 329/04 s. 6).
- **Our terms already say** agreements are between the person and the
  service, and that we will explain any request or signing feature before it
  is used.

How, in three steps:

1. **Now (built):** the meeting and "Email them this time", from the person's
   email. Free, no legal exposure.
2. **Next:** "Send a request" from Autinerary's address on the person's
   behalf, through Resend (already used), with the service's reply going to
   the person (reply-to), and nothing but the request in it.
3. **Then:** e-signature: the service uploads its own agreement once as a
   template; the person signs it inside ResourceHub (embedded signing); both
   get a signed copy with an audit trail. Choose a vendor with a Canadian
   region if contracts carry anything sensitive.

### 2. One streamlined contract for a cluster of services

> e.g. multiple schools with accessibility service forms, to reduce the
> paperwork families and students do.

**One common form that schools accept instead of their own: not something we
can do alone.** Each school sets what it needs. The Ontario Human Rights
Commission's policy lets an education provider ask for information from a
qualified health professional where there is a reasonable basis (s. 8.7), and
says the provider should bear its cost (s. 8.6); diagnosis is generally not
needed ("a diagnostic disclosure is purely voluntary"). The 2026–27 OSAP
Disability Verification Form must be completed by a regulated health care
professional, with a licence number and stamp. We found **no province-wide
common accommodation form**: Algonquin accepts the OSAP form; Ontario Tech,
Fanshawe and Lakehead use their own. So it is **not an absolute no, but it
takes time**: it needs the schools to agree, like the universities did for
admissions with one application centre.

**What we can do without that, at low risk: "fill once, reuse".** The family
or student keeps their details once (needs and limitations, not a diagnosis,
which is optional); for each school, Autinerary pre-fills **that school's own
form** for them to check, sign and send themselves. What only a clinician can
complete still comes from the clinician; we can help ask for it. No API is
needed to pre-fill a PDF form (free libraries do it); signing, when a school
accepts e-signatures, costs what is in the table below.

The note's internal priority stands: talk to parents (the connections in
Jamaica, Nobellum) about **which forms are worst**: which take longest, and
which ask for the same things again. A short list to bring: the OSAP
Disability Verification Form; college and university accessibility intake
forms; Ontario Autism Program registration (AccessOAP); Developmental Services
Ontario's application; the Disability Tax Credit (T2201); ODSP; school
board requests for an IPRC or IEP; and their Jamaican equivalents.

### 3. "Agentifying" it: one form, agents do the rest, with a way to clarify

**The most promising route, as long as agents draft and people decide.** Not
an absolute no.

- **Agents fill drafts, never sign or submit.** Each pre-filled answer shows
  where it came from; anything the agent is unsure of becomes a question to
  the person (the "option to clarify"), never a guess. The person reviews,
  changes, signs and sends.
- **The review step is required anyway.** The Electronic Commerce Act says a
  person who makes a material error dealing with an electronic agent is not
  bound if they were given no chance to prevent or correct it (s. 21).
- **Transcribe, don't advise.** Copying the person's own answers into a form
  is fine; choosing legal options for them is legal judgment (above).
- **Benefit forms are sworn statements in practice.** On ODSP or the
  Disability Tax Credit, the person must confirm every answer; the agent flags
  anything uncertain.
- **Privacy:** sending health details to an AI provider needs express consent
  and saying so on the privacy page (it already names OpenAI for plans and
  search); prefer fixed field mapping from the profile for known fields, and
  the model only for free text.

Cost: the AI's part per form is small next to e-signature; the real cost is
building and checking each form's mapping, which is why the parents' "worst
forms" list comes first.

### 4. The prices the team remembered

Confirmed or corrected on each vendor's own page (18 October 2026). Several
"per user" figures were really **per document or envelope**.

| Remembered | What the page says | Verdict |
| --- | --- | --- |
| DocuSeal "$20???" | Cloud Pro **$20 per user a month** ($200 a year), **plus $0.20 per document signed through the API or embedding**; bulk send 50 a month free, then $0.20. Free plan: 10 requests a month, no API. Open-source self-hosted: free (AGPL, keeping DocuSeal's attribution). API servers in the US and EU; no Canadian region named | Right, plus the per-document fee |
| DigiSigner "~$50/mo" | TEAM **$50 a month billed yearly** ($75 monthly), up to 5 senders, website use only. The **API is extra: $0.50 a document**, bought 100 at a time ($50 minimum), on top of a PRO or TEAM plan | Partly right |
| SignWell "~$50/mo" | **No such plan.** API: **25 documents a month free**, then **$0.85** each (to 200), **$0.60** (to 1,000), $0.50 (to 5,000); "contact us" at 500+ a month. Web plans $10–12 and $30–36 a month | Wrong: pay as you go |
| DocuSign "~$100/mo, at 40 users only" | API Starter **CA$100 a month** billed monthly (CA$66 a month yearly; US$75 / US$50) for **40 envelopes a month, not 40 users**. Intermediate CA$598 monthly for 100 envelopes. Canada is one of its data regions | Right price, wrong unit |
| Dropbox Sign "$140/mo, at 50 users only" | API Essentials **CA$135 a month** billed monthly (CA$1,200 a year) for **50 signature requests a month, not 50 users**; embedded signing only from API Standard (CA$400 a month for 100). Canadian data residency on Premium | Close, wrong unit |
| (not on the list) BoldSign | API **$30 a month with 40 envelopes**, then **$0.75 each**; embedded signing; **data residency in Canada on all plans**; SOC 2 Type II | Worth a look |
| (not on the list) Documenso | Open source; Teams $40 a month yearly with embedded signing; Platform $250 a month; self-hosted free | Worth a look |

What a contract costs, by volume (list prices, one envelope per contract,
monthly billing):

| Vendor | 10 a month | 100 a month | 1,000 a month |
| --- | --- | --- | --- |
| DocuSeal Pro | $2.20 each | $0.40 | $0.22 |
| DigiSigner PRO + API | $3.00 | $0.75 | $0.53 |
| SignWell API | free (under 25) | $0.64 | not published (about $0.63) |
| DocuSign API | CA$10.00 | CA$5.98 | not published |
| Dropbox Sign API | CA$13.50 | CA$2.25 (CA$4.00 with embedding) | not published |
| BoldSign API | $3.00 | $0.75 | $0.75 |
| Documenso Teams | $4.00 | $0.40 | $0.04 |

**For us:** SignWell to try (free under 25 a month), then BoldSign if
contracts carry anything sensitive (Canadian data, embedded signing, $0.75
each). DocuSign and Dropbox Sign cost the most per contract at our volumes.

## Checks

The Terms page, its links, the notice and its record, and the meeting
scheduler (video link, calendar, privately kept details, the email to the
service, Undo) are checked in the browser on production with Goal 5's
(`docs/ratings-and-community-choice-2026-10.md`, Checks): 39 of 39.

## For the team

- **A lawyer's read of the Terms** before launch, and before any contract
  feature: they are written to be accurate to the apps, not by a lawyer.
- **The legal name and address**: the terms use "Autinerary Corp."; add the
  registered address if the lawyer wants it there (emails already carry the
  mailing address).
- **heydevs@autinerary.ca** receives proof of use and the monthly digests
  (Goal 5); make sure that inbox exists and someone reads it.
- **Which forms are worst**: the conversation with parents comes before any
  form-filling work.

## Sources (read 18 October 2026)

- Ontario Electronic Commerce Act, 2000: ontario.ca/laws/statute/00e17
- Canada's anti-spam law: laws-lois.justice.gc.ca/eng/acts/E-1.6; CRTC's FAQ on it
- PIPEDA: laws-lois.justice.gc.ca/eng/acts/P-8.6; the Privacy Commissioner's meaningful consent and cross-border guidelines
- PHIPA and O. Reg. 329/04: ontario.ca/laws/statute/04p03, ontario.ca/laws/regulation/040329
- Law Society Act: ontario.ca/laws/statute/90l08; By-Law 4; the Law Society's Access to Innovation pages (read through web.archive.org; lso.ca blocks scripts)
- Jamaica's Electronic Transactions Act: laws.moj.gov.jm
- Ontario Human Rights Commission, Policy on accessible education for students with disabilities (2018); the 2026–27 OSAP Disability Verification Form
- Pricing: docuseal.com/pricing, digisigner.com/pricing and /api-pricing, signwell.com/api-pricing and /pricing, ecom.docusign.com/plans-and-pricing/developer, sign.dropbox.com/products/dropbox-sign-api/pricing, boldsign.com/pricing, documenso.com/pricing
