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
| 1.3 What you'll share, what you get, how we protect it; honest answers explained; "prefer not to say" always there; replace "5 minutes" | **New:** three columns at the top of "Before you sign up". Required is only age, who for and one goal. Honest answers give better matches, and "Prefer not to share" is always an answer. Then the trust line, and a link to the privacy page. "5 minutes" was removed in September (Group 1): the page now says "two quick questions". **New:** an 88-second explainer video at the top of "A look inside" (below). |
| 1.4 Preview the app inside | **New:** "A look inside": four phone screens of the real app, using a sample plan ("Learn a new language"). They show the Path, a step, the low-energy calendar and ResourceHub. |
| 1.5 What makes Autinerary different | **New:** "Why Autinerary" (it was "What you get"). One line: planning, services and advice from people with similar experiences, in one place and built around your norms; "Many apps do one of these. Autinerary connects them." Two cards were added: Tidbits, and planning around more than one norm, positive and non-clinical. |
| 1.6 Proof of impact: beta results as they are measured, and research on need | The report now counts **"saved a resource in their first week"**. Publish it, and other beta results, only once the trial has measured them, never as estimates. Research figures such as the CDC's "1 in 31" are about how common autism is, in the US. They suit funders and the press, not the home page, which speaks to someone deciding whether to sign up. |
| 1.7 Lived-experience testimonials | **New:** "Share your story" (`/share-your-story`), offered after someone answers "Very useful" to the usefulness check-in. The consent choices are those in [beta/testimonials.md](beta/testimonials.md). The team may shorten a story, the teller approves the exact final text in the app (they are emailed when it is ready), and can withdraw it at any time. Published stories appear in "In their words" on the home page, which stays hidden until there is one. Never write stand-ins. |
| 1.8 Free podcasts | **New:** a "Listen" section on the home page with resume and "Remind me later", hidden until there is an episode. Add one to `EPISODES` in `frontend/lib/media.ts`, with its audio, transcript and, for a story, the teller's consent. The episodes themselves are team content. |
| 1.9 A newsletter pop-up after 30-60 s, and "Want these saved and emailed to you?" | **New:** after 45 seconds on the home page, a small card at the bottom (not a box over the page) offers the weekly email: three places and ideas to start with, and one practical tip. It shows once per browser, never to people with an account, and never takes focus. Under the starter resources, **"Or get this list by email"**, with the weekly email as an unticked option. Both are double opt-in: the address gets one email asking to confirm, and nothing else until it is confirmed with a button, so nobody can sign up someone else. "Send this list to yourself" (share sheet or copied link) is still there for anyone who prefers no email. |

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

**Answer by chatting.** The first step offers "Prefer to answer by chatting?
Try the chat version" (`frontend/app/components/ChatSetup.tsx`). It asks the
same questions one at a time, with buttons first, plus an optional town or
city. It fills the same answers as the form, and reflects them back: "Great
to meet you, Sam. You're here for yourself, in Toronto, and focused on
Career". It is scripted, not an open chatbot (their Option 3). AI is used
only if someone types a goal in their own words, through the same goal
helper, labelled as AI. The report counts who used it and how many finished.

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

**People choose the time.** In setup and in Settings → Emails, a daily
reminder goes out at 9 AM, noon, 6 PM or 9 PM in the person's own time zone
(saved from their device). Vercel's plan runs each scheduled job once a day,
so there is one job for each hour (`vercel.json`, `/api/cron/reminders/<hour>`).
Each run sends the reminders whose time it is, at most one a day per person
(`frontend/lib/reminderRun.ts`). The reminder to finish setup now goes at
9 AM the next day where the person is.

**Texts.** Reminders by text are built (`frontend/lib/sms.ts`): a number gets
texts only after its owner types the code texted to it, and replying STOP
stops them. They stay hidden until Twilio is set up (below).

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

## The videos

Two videos, built from real screens of the sample plan, with captions on by
default, a transcript under each, and a calm AI voice that says it is one
(OpenAI's rules require that). Nothing plays by itself.
- **What Autinerary is** (88 seconds), on the home page.
- **How to use your Path** (63 seconds), on the page after setup and in "Getting started".

The script is `docs/media/videos.json`. `docs/media/make-videos.mjs`
rebuilds both, with their captions and transcripts, from a folder of phone
screenshots; how to run it is at the top of that file. A recording by a
person can replace either at any time: same file names in
`frontend/public/media/`, with a new transcript.

## To switch on

| What | What to do |
| --- | --- |
| Stories and the emails without an account | Paste `backend/database/migrations/2026_stories_and_newsletter.sql` (STEP 52) into the Supabase SQL editor. Until then the story page and email sign-up say they are not available. |
| The weekly email | In Vercel, set `NEWSLETTER_POSTAL_ADDRESS` to Autinerary Corp.'s mailing address. Canada's anti-spam law (CASL) requires it in every newsletter. Until it is set, people can sign up and get their list, but no weekly email is sent. Optional: `NEWSLETTER_FROM_EMAIL`. |
| Reminders by text | Make a Twilio account. Add a Verify service and a Canadian phone number or Messaging Service (US numbers need carrier registration). In Vercel, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, and `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`. Texts cost money per message. |
| Google Analytics | Make a GA4 property. In Vercel, set `NEXT_PUBLIC_GA_MEASUREMENT_ID` (G-...) and redeploy. Visitors are then asked once ("Allow" or "No thanks"), nothing loads before "Allow", Do Not Track and Global Privacy Control are respected, and the privacy page and home page say so by themselves. |
| Publishing a story | In the Supabase table editor, `stories`: put the final text in `final_text` (or leave it empty to use theirs) and set `status` to `awaiting_approval`. The teller is emailed and approves it in the app. Then set `status` to `published` and `published_at` to now. |

## For the team to make

1. **Stories and podcast episodes** from real people, with consent ([beta/testimonials.md](beta/testimonials.md)). The places for them are built and stay hidden until there is one.
2. **The screenshots**, retaken whenever those screens change. Use a test account with a sample plan, a phone-sized window (390 by 650, at 2x), and the Path, the first step, the calendar on Low Energy, and ResourceHub's home page. Hide cards that are not part of the screen (the install banner, check-ins). Save each as a 600 by 1000 JPEG in `frontend/public/preview/` under the same names, and update its description in `PREVIEW` (`frontend/app/page.tsx`).
3. **A narrated-by-a-person version of the videos**, if the team prefers a human voice.

## Built after first being decided against

On 6 October these were first left out, for the reasons below. The team asked
for them, so each is built in the most careful form:
- **GA4:** opt-in only, off until a measurement ID is set (above). Autinerary's own events still measure everything; GA sees only the people who allow it.
- **The timed offer:** a small card, once, after 45 seconds, never a box over the page, so it respects Group 1's "fewer secondary visual elements" as far as it can.
- **Email for people without an account:** double opt-in, at most one confirmation every 10 minutes per address, five sign-ups an hour from one place, and a hidden field that catches robots.
- **Answering by chatting:** scripted and buttons-first, not an open chatbot.
