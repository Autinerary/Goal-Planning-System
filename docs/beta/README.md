# Beta testing kit: October 2026

Everything needed to run the beta in [the plan](../beta-test-plan-2026-10.md).
Use the files in this order:

| Step | File | For | When |
| --- | --- | --- | --- |
| 1 | [outreach.md](outreach.md) | Posts and messages, each with its own tracked link | This week (from 5 October) |
| 2 | [screener.md](screener.md) | Sign-up questions, to copy into a Google Form | Before posting |
| 3 | [consent.md](consent.md) | What testers agree to, in plain language | Sent with the session invitation |
| 4 | [session-script.md](session-script.md) | What the facilitator says and records, task by task | Each 40-minute session (12 to 23 October) |

The 30-day trial runs 12 October to 10 November. The app records the trial's
measures by itself; the report is `python -m scripts.onboarding_funnel`
(from `backend/`).

## Before anything goes out

Filled in on 5 October 2026:

- **Thank-you:** no incentive is promised; the posts thank people instead.
  If the team adds one (for example a gift card), say so in the screener,
  the consent text and the session script.
- **Booking:** people reply with two or three times that suit them, then get
  a calendar invitation with the video link.
- **Facilitator:** Aayush Bhan. Change the session script and the email
  sign-off if someone else runs sessions.
- **Sign-up form:** make it with [make-screener-form.gs](make-screener-form.gs)
  (paste it into https://script.google.com and click Run; it builds the
  whole form and a responses sheet), then put its link in outreach.md where
  it says `[[TEAM: Google Form link ...]]`.

Decisions these files assume, to confirm:

- **Contact address:** `aayush@autinerary.ca`, the same as the privacy page.
- **Recordings** are optional and deleted when the analysis is finished, by
  31 December 2026 at the latest.
- **Ethics review:** if this is part of a course or university project,
  check whether the institution's research ethics board has to approve it
  before anyone is recruited.

## Keeping testers' information safe

- Give each tester a code (P01, P02, ...) when they are booked. Notes,
  recordings and quotes use the code, never a name.
- Keep the screener answers, the list linking codes to names, and anything
  about being neurodivergent in one restricted spreadsheet. None of it goes
  into the app, a tracked link or the analytics.
- After 10 November, delete the screener answers of people who were not
  booked.
