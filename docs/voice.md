# How Autinerary talks

Riipen Labs' Group 6 recommended "a welcome survey that uses a cohesive and
empathetic voice to build immediate trust with users", so that people "feel
welcome and supported in a safe environment". Start here, setup and the
pages after it are written this way. Use this page for anything new: a
screen, an email, a post.

## Nine rules

1. **Plain words, short sentences.** Say what happens next. "Two quick
   questions, then your path is ready", not "Complete the onboarding flow".
2. **Warm, never clinical.** Talk to a person, not a case. "People with
   similar experiences", "the norms you navigate". Never "suffer",
   "disorder" or "deficit", and never "barrier": we say **norms** (Odosa).
3. **Optional means optional.** Say so, and never make skipping cost
   anything. "Not sure yet" is always an answer; "Not now" always works.
4. **Nothing changes by itself.** Offer, don't push. The Path stays in
   Simple view until someone chooses "Show more"; the offer to show more
   comes from the second day, and "Not now" waits a week.
5. **Only say what is true.** No user counts, times or promises the app
   can't back up. "Free during the beta", not "free forever".
6. **Be open about information.** Say what we collect and link to the
   privacy page. The trust line, word for word: "We don't sell your
   information, show ads, or use it to train AI."
7. **Not clinical advice.** Resources are "places to start looking, not
   medical or clinical advice".
8. **People choose the words for themselves.** Riipen Labs, Group 15:
   "'Autistic person' and 'person with autism' are both used within the
   community: offer the choice rather than picking one house style". Each
   person picks identity-first, person-first or no preference in Settings,
   under Words we use, and the AI writes their plan and the assistant's
   answers that way. The app's own pages say "neurodivergent" where they can,
   and name the thing rather than the person ("an autism assessment").
   Never deficit-framed: no "suffers from", "despite" or "what's wrong".
9. **Calm, never urgent; AI named where it works.** No countdowns, no
   guilt, no artificial urgency (Group 15): a reminder says "do as much or as
   little as fits today", never "keep your streak going". Label things by
   what people get, and say once, plainly, where AI wrote something, with a
   link to how Autinerary uses AI (Group 18: "introducing AI transparently
   only at the specific step where it functions"). How things look is in
   [design-guide.md](design-guide.md).

## Before and after

| Before | After |
| --- | --- |
| Barrier-Specific Ratings | Ratings for your norms |
| Create Account | Create your free account |
| About you | Welcome. Let's start with you. There are no wrong answers. |
| Each individual task is YOU using TOOLS to REMOVE BARRIERS | Each task is you using tools to move forward |
| Stuck on a barrier? | Stuck on something? |
| You can turn them off in Settings. (There was no switch.) | You can turn them off in Settings, under Emails. (There is one.) |
| Your goals for today 🎯 … keep your streak going 🔥 | Your next step for today. Do as much or as little as fits today. |
| AI-Generated (a badge by the plan's title) | Your plan's steps were written with AI from your answers. How Autinerary uses AI |
| AI suggestions for your steps | Suggestions for each step |
| Dream for the other person | What do you hope this leads to for them? |
| Ideal relationship with ally | How would you like things to be between you and them? |
| Obstacle: What's stopping you from achieving this? | What might get in the way? |
| Five quick questions (optional) | A quick question (optional), with four more folded under it |

## Video, audio and the app's own voice

Riipen Labs' Group 11 suggested an explainer video, testimonials, podcasts
and a "how to use the app" video. Anything Autinerary publishes that moves
or speaks follows the nine rules above, and these:

1. **Captions on by default**, and a transcript beside it. Captions are written, not auto-generated and left unchecked.
2. **No sound until someone presses play.** Nothing plays by itself; a muted preview is fine.
3. **Short:** 60 to 90 seconds for a video. About 10 minutes for an episode, with a way to stop and pick up later.
4. **Calm pacing:** one idea at a time, no fast cuts, no flashing (no more than three flashes a second), and quiet or no music under speech.
5. **Always skippable**, and never in the way: the page works without watching.
6. **Real people, with consent.** Stories come from people who agreed in writing ([beta/testimonials.md](beta/testimonials.md)). Never actors presented as users, never invented quotes.
7. **Only what is true** (rule 5): show the app as it is now, and say "sample plan" when the data is made up.

When the app itself speaks (spoken descriptions, the read-aloud tour, voice
navigation), people choose the voice, the speed and the volume in Settings →
Accessibility, and can try it first. Every place that speaks uses those
choices (`frontend/lib/speech.ts`).

## Where the voice is set

- Start here: `frontend/lib/startHere.ts` (roles, needs, explanations).
- What Autinerary does for each group: `AUDIENCE_VALUE` in
  `frontend/app/onboarding/page.tsx`, which matches Start here.
- Emails: `frontend/lib/email.ts`; the first two weeks' recap lines in
  `frontend/lib/firstWeeks.ts`.
- Words for autism and ADHD: `frontend/lib/languageStyle.ts` (Settings) and
  `LANGUAGE_RULES` in `backend/core/llm.py` (what the AI is told).
- The one-line definitions of path, milestone and norms:
  `frontend/lib/terms.ts`.
- Tidbits starter questions: `backend/scripts/seed_tidbits_questions.py`.
