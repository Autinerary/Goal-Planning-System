# From first visit to coming back

Riipen Labs' Group 11 ("Customer Experience Optimization Report", 25
September 2026) reviewed the home page, the nine-step setup and the first 14
days. They recommended three stages: **value first**, **an AI guide inside
setup**, and **bringing people back**, with readability and accessibility
fixes across all three. They reviewed the old nine-step setup, so earlier
groups had already built part of it: Start here (Group 4), the two-question
setup (Group 5) and starter resources after setup.

This page says what Autinerary does now for each recommendation (as of 6
October 2026), what the team still needs to make, and what was decided
against, with the reasons.

## Stage 1: value first

| They recommended | What Autinerary does now |
| --- | --- |
| 1.1 A free taste on the home page: pick a need, see community-rated resources and a tip, then "Save these and build your free path" | **Start here** (Group 4), on the home page and at `/start`: who you are here for, what you need today, then real starter resources with one plain-language explanation. No account is needed. "Save this path" is the free account. |
| 1.2 "What brings you here today?" tiles, including "Just looking" | Start here's "Who are you here for?", with "Not sure yet", and the same question opens setup. The report splits its measures by the answer. |
| 1.3 What you'll share, what you get, how we protect it; honest answers explained; "prefer not to say" always there; replace "5 minutes" | **New:** three columns at the top of "Before you sign up". Required is only age, who for and one goal. Honest answers give better matches, and "Prefer not to share" is always an answer. Then the trust line, and a link to the privacy page. "5 minutes" was removed in September (Group 1): the page now says "two quick questions". The video is team content (below). |
| 1.4 Preview the app inside | **New:** "A look inside": four phone screens of the real app, using a sample plan ("Learn a new language"). They show the Path, a step, the low-energy calendar and ResourceHub. |
| 1.5 What makes Autinerary different | **New:** "Why Autinerary" (it was "What you get"). One line: planning, services and advice from people with similar experiences, in one place and built around your norms; "Many apps do one of these. Autinerary connects them." Two cards were added: Tidbits, and planning around more than one norm, positive and non-clinical. |
| 1.6 Proof of impact: beta results as they are measured, and research on need | The report now counts **"saved a resource in their first week"**. Publish it, and other beta results, only once the trial has measured them, never as estimates. Research figures such as the CDC's "1 in 31" are about how common autism is, in the US. They suit funders and the press, not the home page, which speaks to someone deciding whether to sign up. |
| 1.7 Lived-experience testimonials | Team content. The consent form is [beta/testimonials.md](beta/testimonials.md). |
| 1.8 Free podcasts | Team content. The rules for audio are in [voice.md](voice.md). |
| 1.9 A newsletter pop-up after 30-60 s, and "Want these saved and emailed to you?" | The pop-up was decided against (below). For keeping the list: **"Send this list to yourself"** under the starter resources, for anyone without an account. On a phone it opens the share sheet, so people can email, text or note the link themselves; on a computer it copies the link. The link reopens the same list, and Autinerary never collects an address. |

## Stage 2: help inside setup

**2.1 The goal helper.** Under the goal categories, one line: "Not sure how
to put it? Describe it in your own words", labelled **AI helper**. Opened, it
asks "What would you like to do or change?" and shows Group 11's own example.
It then suggests up to three goals. People pick one, and it lands in that
category's field, where they can change the words. It is in
`frontend/app/components/GoalHelper.tsx`, `backend/core/goal_helper.py` and
`POST /api/onboarding/goal-helper`.

| Their guardrail | How the helper meets it |
| --- | --- |
| Answers come only from vetted content, citing their source | It picks from the goal ideas setup already shows this person: each category's ideas and examples, and a chosen path's ideas. It may add **one** goal in the person's own words. Each suggestion says which it is: "from Autinerary's goal ideas" or "in your words". The model returns numbers from the list. The backend checks anything it writes itself: at most 12 words, the input guardrails, no links, and no clinical words the person did not use first. |
| Scope: never symptoms, diagnosis, medication or crisis; hand off to crisis support | It only turns words into goals and never gives advice. Words that suggest someone may be in danger get the crisis lines: 9-8-8 (Canada), 988 (US), and 911 if someone is in danger now. No AI call is made, and setup carries on. The goal validator's message now names the Canadian line too. |
| Buttons first, typing optional, labelled as AI, always skippable | The category buttons stay the main way in. The helper is one line until opened, says "AI helper", and adds nothing until a suggestion is picked. It also says that what is typed goes to OpenAI and is not saved. |

What it costs: one small call per ask (gpt-4o-mini). Each person gets at most
six asks in ten minutes, on top of the per-person AI limit
(`core/budget.py`), so it can never use up the allowance a path needs. The
usage ledger records it as `goal_helper`.

Not built: Group 11's optional "answer by chatting" mode, which would fill
every step through a chat. They suggested piloting the guide on the goal step
first, and the risks of their Option 3 (an open chatbot: made-up answers,
lost structure) apply to a chat that fills the whole of setup. Extend it only
if the measures below show the helper works.

**2.2 Save and finish later.** Answers were already kept in the browser as
people go (`autinerary_onboarding_draft`); it is now said:
- **"Need a break?"** under the step counter: "Your answers are saved on this device, so you can close this page and finish later."
- **Welcome back**, on the step they left: "Your answers were saved, so you are where you left off." It shows only when something was answered, and only on that step.
- **"Email me a reminder tomorrow"**, once the age question is answered. One email, the next morning, sent by the daily run (`app/api/cron/reminders`) at least six hours later, only if setup is still unfinished. It says "This is the only reminder we will send". It can be cancelled ("Don't send it"). The request is kept as `profiles.preferences.setupReminder`, and the privacy page lists it.

The draft is kept on the device people used, so the email says so. Keeping
drafts in the account, to continue on another device, would be the next step
if people ask for it.

**2.3 No dead end.** "No recommendations available yet" no longer exists:
the AI recommendations step left setup (Group 5), and the page after setup
leads with starter resources picked from the answers.

**2.4 Essentials first.** Done by Groups 5, 7 and 9: a default avatar
("customize later"), one goal is enough, and the dream is optional.

## Stage 3: bringing people back

**3.1 Three segments.** Autinerary counts with its own events, not GA4 (see
below). The report's **"Bringing people back"** section counts Group 11's
three groups, and what each gets now:

| Group | What brings them back now |
| --- | --- |
| Visited, but no account yet | Start here keeps their answers in the browser and reopens on their starter resources; "Send this list to yourself" keeps the link |
| Stopped during setup | Setup reopens where they left off, with "Welcome back"; one email if they asked for it. The report shows the last step each saw |
| Finished setup | Check-ins on the Path, "Getting started", and the emails and notifications they turned on |

**3.2 Email, in-app and push, at a time people choose.** People can opt in to
a daily reminder email, a check-in email after two weeks away, and
notifications. The report shows the share of accounts that opted in to each.

Setup used to offer text messages and a choice of time. Nothing sent texts,
and the daily send runs once, at 13:00 UTC. Setup now says what happens: "One
email a day, in the morning (Eastern time)". Choosing the time needs the send
to run every hour, which needs a Vercel Pro plan or a scheduler elsewhere.
On 6 October one account in 391 had reminders on, so that can wait.

**3.3 A starter checklist.** **"Getting started"** on the Path:
1. Save one resource.
2. Finish one step of your plan.
3. Try a low-energy day.

Each item ticks itself off, and the list can be hidden. Group 11 had "Add a
milestone" as the second item, but milestones come with the plan, so it is
finishing one. The list waits its turn in the Path's one-card slot. It shows
only when no check-in, skipped setup question or offer to show more is
waiting, so the Path still shows one card at a time. The "how to use the app"
video is team content; the one-minute tour already runs after setup.

**3.4 Measure before scaling.** In the funnel report (`python -m
scripts.onboarding_funnel`, from `backend/`):

| Group 11 asked for | In the report |
| --- | --- |
| Time to first value | "Reached something useful" (Group 10) |
| Onboarding start rate | Funnel: landing page, sign-up form, account, each setup step |
| Drop-off by step, completion | Funnel; "where people pause"; last step seen by those who stopped |
| 1-, 7- and 14-day return, by segment and source | "Returned the next day", within 7 and 14 days; columns for each, by who they are here for and by channel |
| Email and push opt-in rate | "Bringing people back": daily reminders, check-in emails, notifications, any of them |
| Saved a resource in the first week | "Bringing people back" |
| The AI guide against the standard goal step | "The goal helper": who got suggestions, who added one, and setup completion with and without it. People choose to use it, so this compares groups and does not prove cause and effect |

## All stages: readability and accessibility

- **Contrast:** measured on 6 October at phone and desktop width, on the pages that changed. No text is below WCAG AA.
- **One main action, clear next steps:** done for Groups 1, 3, 4 and 7.
- **Voice and sound:** new **Voice** settings in Settings → Accessibility: the voice (the device's own; better-sounding ones, such as those named "Natural" or "Enhanced", are listed first), speed (slower, normal, faster) and volume, with "Try it". They apply everywhere the app speaks: spoken descriptions, the read-aloud tour and voice navigation (`frontend/lib/speech.ts`). The task sound and spoken descriptions each have their own switch.
- **Video and audio:** rules in [voice.md](voice.md).

Two ResourceHub fixes came up while taking the screenshots:
- A search opened from a link (`/search?q=autism`, as Start here's links are) opened its suggestion list over the results. Suggestions now appear only while someone types.
- The hidden "Skip to main content" link showed as a black bar at the top of every page on phones. It is now fully hidden until it is focused.

## For the team to make

1. **An explainer video**, 60-90 seconds, following [voice.md](voice.md). Its place is "A look inside" on the home page.
2. **The screenshots**, retaken whenever those screens change. Use a test account with a sample plan, a phone-sized window (390 by 650, at 2x), and the Path, the first step, the calendar on Low Energy, and ResourceHub's home page. Hide cards that are not part of the screen (the install banner, check-ins). Save each as a 600 by 1000 JPEG in `frontend/public/preview/` under the same names, and update its description in `PREVIEW` (`frontend/app/page.tsx`).
3. **Testimonials** from a parent, a sibling and a neurodivergent adult, with consent: [beta/testimonials.md](beta/testimonials.md). Until there are real ones, the page has none. Never write stand-ins.
4. **Podcasts**, if the team makes them: about 10 minutes, with a transcript, never playing by themselves.
5. **A "how to use the app" video** for after setup, under the same rules.

## Decided against, for now

- **GA4.** The privacy page promises no advertising trackers, and Do Not Track and Global Privacy Control are respected. Setup also touches health-adjacent information. Autinerary's own events (STEP 45 onwards) already measure the whole funnel. This matches Group 11's own Decision 4: first-party channels only.
- **A timed newsletter pop-up.** It interrupts, against Group 1's "fewer secondary visual elements" and W3C's cognitive accessibility guidance on one thing at a time. There is no weekly newsletter to sign up for yet, and a mailing list needs consent records (CASL). When there is a newsletter, offer it in the page, never as a pop-up.
- **Emailing the starter list to an address typed in by someone without an account.** It would let anyone send Autinerary's emails to a stranger, and it needs its own consent record and abuse limits. "Send this list to yourself" does the same through the person's own email app.
- **A chat that fills the whole of setup**, and an open chatbot in place of setup (their Option 3), for the reasons above. Group 11 recommended against the chatbot too.
