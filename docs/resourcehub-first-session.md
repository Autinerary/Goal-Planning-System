# ResourceHub's first session

Riipen Labs' Group 8 ("Customer Experience Brief", 25 September 2026)
walked through ResourceHub's sign-up, from Welcome to a first resource. Their
guiding question was: "does each screen ask something proportionate to the
value the user has received so far, or does it ask for trust before earning
it?" This page covers what they found, what changed on 5 October 2026, and
how it is measured.

## What they found, and what changed

| Group 8 found | Now |
| --- | --- |
| Five steps (Welcome, Location, Norms, Impact, Context) before any resource | Three steps: who you are, one topic and what you hope to find, then "Here's a place to start" with real places |
| Location said "private and optional", but all three fields were required | Not asked in setup. It is asked where it is used: the home page, search ("Set your location to see places near you first") and the profile. It is optional everywhere |
| Impact repeated the severity slider from Norms | Gone from setup. It weighs recommendations and groups ratings by level, so it moved rather than vanished, as Group 8 advised: the profile asks "how much does it affect daily life?" for each topic, optionally and in words ("A little", "A lot"). An answer not given counts as the middle, as it always did for ratings. The Context step's life stage, goals and notes were never saved, so they are gone |
| Identity, health and disability asked up front | On the profile, under "More about you (optional)", where any answer can be changed or removed |
| Surrey, BC got Montreal results (3,675 km away) with no distance shown | With a location and no sort chosen, search shows places within 50 km first, nearest first, under "Near Surrey, BC", with each distance. Then "Broader options": organisations for your province or all of Canada (they have no map point, so AutismBC comes before Autism Ontario for someone in Surrey), then farther places, nearest first. When nothing is within 50 km, it says so and offers "Change location"; when only one or two are, it says how few. The distance filter says where distances are measured from ("From Surrey, BC · Change"). "Near <city>" on the home page uses coordinates too; it used to look at an arbitrary 200 of 9,561 places by city name |
| Cards showed large two-letter initials | An icon for the kind of place (a school, a doctor, a park). Real photos still show when there is one |
| Asked information "visibly leads nowhere" | "For you" on the home page shows places matched to your topic and what you hope to find, near you where possible. Each place says why it is there: "Rated for ADHD", "Mentions ADHD", or the kind of place you asked for. Setup's last step shows the first of them, and offers, in one optional line, to add a location to see places near you first |

The topic chips are the Neurodivergence norms, and a search finds any other.
For a parent, caregiver or professional, step 2 says matches are about the
person they support. The four "hoping to find" choices are the same as Goal
Planning's Start here: services, people with similar experiences, school or
work support, and sensory tools.

The home page also stopped making things up. When nothing was matched, it
gave places random star ratings and review counts, and showed "% match" scores
and agent notes for lists no agent made. It now shows only real ratings and
counts, and says when a list is just what is popular.

## Asking for more, later

Three prompts, from Group 8's mockups. Each counts how often it is shown and
answered, so each can be checked before more are added, as Group 8 advised.

- **Add a topic.** Searching for a topic that is not on your profile (for
  example "adhd") offers "Add ADHD to your topics?". "Not now" is remembered.
- **Want more like these?** After three saves of one kind of place that what
  you are looking for does not cover, on My Resources.
- **Welcome back.** A week or more after joining, if "More about you" is
  empty: "Take two minutes to sharpen your matches?" "Maybe later" asks again
  in a week. "No thanks" never asks again.

## Measures

From `python -m scripts.onboarding_funnel` (from `backend/`), section
"ResourceHub's first session". It needs STEP 51
(`backend/database/migrations/2026_resourcehub_events.sql`). Small groups
show as "<5".

| Group 8 asked for | What we report |
| --- | --- |
| "Onboarding completion rate" | Share of people who start ResourceHub's setup and finish it, and how many chose a topic |
| "Time from landing to first resource viewed" | Median time from a browser's first visit to the first place it opens, and from the start of setup |
| "Percentage of search results returned within the user's stated radius" | Share of first-page places within the radius, for searches by people with a location |
| "Validating each trigger before adding more" | For each prompt: shown, yes, no and later |
| "Bring them back in their first 7–14 days" | Share of first visits, and of people who finished setup, back on a later day within 7 and within 14 days |

## What it does not fix

- **Ratings.** "Rated by people like you" needs people to rate places.
  Today the only rated place that is listed is Autinerary itself (the other
  ratings belong to rejected seed entries, as the beta plan notes). So "Rated
  for ADHD" does not appear yet, and cards say "No reviews yet". Asking
  testers to rate places they know is what fills this in.
- **Goal Planning accounts.** People who sign up in Goal Planning and then
  open ResourceHub do not see ResourceHub's setup, since they have already
  answered Goal Planning's. "For you" asks them for a topic instead.
- **Testing.** Group 8 said its findings are "directional", from walkthroughs
  and research. The beta plan includes a session task for ResourceHub's setup.

Code: `servicehub-mvp/lib/onboarding/` (setup, matching, profile),
`servicehub-mvp/app/onboarding/page.tsx`, `app/profile/page.tsx`,
`components/home/ForYou.tsx`, `components/prompts/`, and the near-first order
in `lib/supabase/queries.ts` (`searchResources`).
