# Goal 5: ratings, the monthly sweep and Community's Choice, October 2026

The team's planning note, "Goal 5: Recommendation Nomination System", worked
through on 18 October 2026: rate a service (from experience), comment on a
service (any time), nominate the best (monthly, through the newsletter), and
vote out the worst (the monthly rating sweep). It needs **STEP 79**
(`backend/database/migrations/2026_terms_ratings_community_choice.sql`, also
at the end of `setup/all_migrations.sql`).

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

## STEP 79

Paste it into Supabase's SQL editor, after STEP 78. It also holds Goal 2's
parts (the terms record, meetings, the free-first-visit tag). Idempotent:
applied twice in a local test, with 75 checks.

## For the team

- **The thresholds** above, and whether services should be emailed.
- **heydevs@autinerary.ca**: proof of use and the digests go there.
- **Ballot sizes**: five services, three shop items, three articles; and up
  to ten nominations of each kind per person per month.

## Checks

CHECKS
