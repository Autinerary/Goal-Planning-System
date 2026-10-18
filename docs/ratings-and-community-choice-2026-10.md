# Goal 5: ratings, the monthly sweep and Community's Choice, October 2026

The team's planning note, "Goal 5: Recommendation Nomination System", worked
through on 18 October 2026: rate a service (from experience), comment on a
service (any time), nominate the best (monthly, through the newsletter), and
vote out the worst (the monthly rating sweep). It uses **STEP 79**
(`backend/database/migrations/2026_terms_ratings_community_choice.sql`) and
**STEP 80** (`2026_function_grants.sql`), both applied on 18 October 2026 and
at the end of `setup/all_migrations.sql`.

## What changed

| Asked for | Now |
| --- | --- |
| Rate any time, but only if (i) it is in your team, (ii) you recommended it, or (iii) you used it before joining | **Rating comes from experience.** A person may rate a service when it is in their team (a meeting arranged, signed on, or completed), when they recommended it, or when they used it before joining and an admin has seen their proof. The database checks it (`can_rate()`, and the ratings table's rule for new ratings), and so do both ways ratings are saved: ResourceHub's rating form and the app's Milestones stars. Ratings given before stay, and can still be edited. Pressing **Rate** without one of the three opens **Who can rate**, with each way: "Add to my team", what "recommended" means, and "I used it before I joined" |
| (ii) "recommended" | **Recommend** in ResourceHub is how a service is added, so whoever added a service recommended it. Recommending one that is already listed is now kept too (`resource_recommendations`), with the person's reason, and they are taken to it: "We have noted that you recommend it, so you can rate it". Recommending is done through the form, never directly, as it is what lets someone rate |
| (iii) not in the wishlist or team, not recommended, and proof "through email to heydevs@autinerary.ca" | **I used it before I joined** gives the person a code and opens an email to heydevs@autinerary.ca with the code in the subject, saying what counts as proof (a receipt, an invoice, an appointment confirmation, a letter or report) and that they can cover what they don't want to share. Only for a service that is not in their wishlist or team and that they did not recommend. An admin matches the email to the claim at ResourceHub's **Admin → Proof of use** (`/admin/proof-of-use`, by code and address) and approves or rejects it; then they can rate. The privacy page says the proof is used only to check, and the email deleted once checked: **please do delete them** |
| Comment on a service, any time | **Comments** on each service page, for anyone signed in, rating or not (`resource_comments`): up to 1,000 characters, the same spam and language checks as reviews, and people can remove their own. Before, a "comment" was only the text of a rating, which now needs experience |
| The rating sweep: under 4.0 a warning email; at 3.5 probation for two months; after two months, hidden with a private chance to come back; a calculation of what would bring it back; email us any services below 3.5 | **The monthly rating sweep** (`/api/cron/rating-sweep`, the 1st of each month; the database does it, `rating_sweep()`), for services with at least five ratings: **under 4.0, warned**; **at 3.5 or under, probation** for two months; **still 3.5 or under after two months, hidden** (out of search, `status = 'hidden'`, nothing deleted); **back above 3.5, restored** at the next sweep. It works out how many more ratings of 5 would bring each back above 3.5 (and up to 4.0). The team gets a **digest** each month of what changed and every service at 3.5 or under (to `RATING_SWEEP_TO`, else heydevs@autinerary.ca). **Services are emailed** about their own change (warned, probation with its end date, hidden with the number of 5s that would bring it back, back) at the address they publish, **only once `RATING_SWEEP_EMAIL_SERVICES=on` is set**. A hidden service stays reachable for the people who may rate it (in their team lists, and its page, with "Hidden for now" and the rating button): that is its "private chance": their new ratings bring it back |
| A disclaimer: "Not a single service rated lower than 4/5 stays" | On the directory and in the Terms: **"Ratings come from people who have used a service. A service rated under 4 out of 5 gets a warning; at 3.5 or under it has two months to improve, or it is hidden."** The note's wording would promise more than the rules do (a service between 3.5 and 4 stays, with a warning); a claim like that to the public should be exactly true |
| Nominate the Best: last week of the month, the newsletter asks people to vote for Community's Choice; tally at the end of the month; the winners get the Community's Choice tag; the same for products and articles | **Community's Choice.** All month, anyone signed in can **nominate** a service, a shop item or an article in ResourceHub (up to ten of each a month; "Nominate for Community's Choice" on its page). On the month's last Monday the **newsletter** (both versions, with and without an account) makes the month's **ballot** (the five most nominated services, three shop items and three articles) and carries a **vote** section with each reader's own link to `/community-choice`, where they pick one of each kind (signed in, they can vote there too). On the 1st (`/api/cron/choice-tally`) the votes are counted: the most votes wins each kind, ties going to the most nominated; winners are kept (`choice_winners`), **tagged Community's Choice** (services, articles, and shop items, which now have tags), and the team gets the result |
| A tag that stands out as much as "Autinerary's Own" | A **gold Community's Choice badge** with a trophy (`components/communityChoice/CommunityChoiceBadge.tsx`), on cards, on a service's or shop item's page with the month it won, and in the shop. Gold is not one of the colour themes' colours, so it looks the same in every theme. (The "Autinerary's Own" badge itself is only a filter today; it never shows on a card) |
| A banner on the directory: "Vote for this month's Community Choice service, through our Newsletter!" with Sign Up Now, and "Community Choice services are chosen through monthly nomination rounds, where all users can nominate a service!" | At the top of ResourceHub's search results: **"Vote for October's Community's Choice service, through our newsletter!"** with **Sign up now** (to the app's new newsletter page, `/newsletter`, which has its own sign-up and sends people with an account to Settings), the disclaimer, and the ratings note. It can be put away for the month |

## Turning things on

- **Emails to services** about their ratings: `RATING_SWEEP_EMAIL_SERVICES=on`
  in the app's Vercel settings. Off until the team has read them (they are in
  `frontend/lib/email.ts`, `serviceStandingEmail`). A service that replies
  "stop": add its address in the SQL editor:

  ```sql
  INSERT INTO public.service_email_optouts (email_key, note) VALUES (lower('<address>'), 'replied stop');
  ```

- **Where the digests go**: `RATING_SWEEP_TO` (default heydevs@autinerary.ca).
- **A dry run** of either job, which changes nothing and emails only the team:
  `/api/cron/rating-sweep?dry=1`, `/api/cron/choice-tally?dry=1`, with the
  cron secret.

## The thresholds

The note says "At 3.5, probation" and "Post 2 months or under 3.5/5, hidden".
Read as: at 3.5 or under, two months of probation; still 3.5 or under after
them, hidden. If "under 3.5" was meant to hide a service at once, it is one
setting in `rating_sweep()` (its arguments are the thresholds: 4.0, 3.5, two
months, five ratings). Five ratings is our addition, so that one bad first
rating cannot hide a service.

## STEPs 79 and 80

STEP 79 holds the database side of Goals 2 and 5 (also the terms record,
meetings and the free-first-visit tag). STEP 80 closes a gap it left:
Supabase gives every new function to signed-out and signed-in callers
directly, so STEP 79's "REVOKE ... FROM PUBLIC" left the sweep, the ballot
and the tally (which write, and take their date and thresholds as arguments)
callable by anyone for the few minutes between the two. STEP 80 makes those
three the server's only, and the rest signed-in only. Nothing was changed in
that time: no ballot, winner or hidden service existed, and the only calls
were the check's own dry runs. Both idempotent; the local test now copies
Supabase's default privileges, which is how it reproduces the gap and shows
it closed.

## For the team

- **The thresholds** above, and whether services should be emailed.
- **heydevs@autinerary.ca**: proof of use and the digests go there.
- **Ballot sizes**: five services, three shop items, three articles; and up
  to ten nominations of each kind per person per month.

## Checks

- **STEPs 79 and 80 in a local Postgres**: 75 checks for STEP 79 (rating
  from experience in each of its three ways,
  ratings from before the rule still editable, comments, the sweep's warning,
  probation, hiding after two months and coming back, the number of 5s
  needed, opt-outs, Toronto months, nominations and their limit, the ballot
  made once, one vote per kind, the tally and its tags), and 15 for STEP 80,
  with Supabase's default privileges copied: first the gap reproduced (anyone
  could run the sweep), then closed (only the server runs the sweep, ballot
  and tally; the rest signed in only; team members still rate).
- **On the live database, signed out** (`step79_live.mjs`, reads only), 26 of
  26: the new tables give nothing away, comments, ballots and winners are
  public, nothing can be written signed out, every function that is not for
  signed-out callers refuses them (HTTP 401), Toronto's month, an item's kind,
  the free first visit. **Signed in** (QA A), the sweep, ballot and tally
  refuse them (HTTP 403) and their own functions answer.
- **In the browser on production** (`plan12.mjs`), 39 of 39: the Terms page
  and where it is linked, the newsletter's page, Community's Choice's page and
  the closed vote, the directory's banner and "Sign up now", the terms notice
  and its record, rating refused (403) and "Who can rate", a proof-of-use code
  and its email, the claim on the admin page, scheduling a video call (a
  Jitsi link, the calendar's name and time without the link, the details kept
  privately and back on the next visit), being able to rate once in the
  team, Undo, a comment posted and removed, a nomination made and taken back,
  and "They offer a free first visit". Everything QA A did is undone.
- **The emails**, built from made-up rows (nothing sent): the vote section in
  both weekly emails, the team's digest, each email to a service, the tally;
  the vote links' signatures. 17 checks.
- **Unit tests** for the vote's calendar (Toronto months, the month's last
  Monday, leap years), in CI.
- **The earlier rounds on production**, after this deploy: Groups 31 and 31b
  (43, 34), 25 (72), default races (2), Group 34's live and admin checks (27,
  11), the planning note's search and team (42), Goal 1's directory (28), and
  the accessibility check, now with the new pages: 98 page views, no serious
  or critical problems.
