# What stays free

Riipen Labs' Group 5 found "confusion between free vs. paid features". They
asked the team to "decide which features should stay free and which can be
paid", and to "keep the important stuff free for users who need it most",
because for a social-purpose company "free/premium decisions [have] the
potential to carry both trust and revenue".

## Where things stand (4 October 2026)

- **Nothing in the app costs anything.** There is no payment code in either
  app, and no credit card is ever asked for.
- **Family accounts were planned as the paid tier.** The database has a
  billing placeholder, `profiles.plan` ("free" for 387 accounts, "family"
  for 3, set when a parent adds a child), and its migration calls family
  accounts "the paid tier". No billing exists, and the Family page no
  longer shows a "Family plan" badge, because a tester read it as a
  subscription.
- **What people are told:** the home page says "Free during the beta". Its
  "Is Autinerary free?" answer gives the line below: everything is free
  during the beta, the core stays free after it, and paid extras may come
  later, mainly for organisations.

## The decision (4 October 2026)

Following Group 5's principle, the line is below. The home page's "Is
Autinerary free?" answer says the same.

**Free, always** (what builds trust, and what people who need it most rely
on):

- making a plan and working through it (the Path, races, milestones,
  calendar, journal)
- Start here, ResourceHub search, ratings and Tidbits
- accessibility settings, check-ins, and seeing, correcting or deleting
  your information
- a parent or guardian supervising their child's account (family accounts)

**Could be paid later** (extra, not essential):

- more AI-generated paths or regenerations than a fair-use allowance (the
  app already has per-person AI limits in `backend/core/budget.py`)
- organisation accounts for schools, employers and support services (for
  example, one person supporting many people)
- premium content or courses, if they are made

**Family accounts stay free.** They were planned as the paid tier
(`profiles.plan` is still a placeholder), but parents of neurodivergent
children are among the people who "need it most", and many arrive through
the campaign (Facebook parent groups). Organisations, which support many
people at once, are where paid accounts fit instead.

Before anything is paid:

1. Tell beta testers and users before anything they use changes. What they
   made stays theirs.
2. Check comparable apps' free tiers first (Group 5: "needs research into
   what similar apps keep free to set a fair line"). Their pricing changes
   often, so look it up at the time rather than relying on old notes.
3. Keep this page and the home page's answer in step.
