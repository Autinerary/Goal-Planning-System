# What stays free: a decision for the team

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
- **What people are told now:** the home page says "Free during the beta".
  Its "Is Autinerary free?" answer says everything is free during the beta,
  including ResourceHub, Tidbits and family accounts.

## The decision

Before anything is paid, the team needs to agree where the line is, and say
so in the app. A starting point, following Group 5's principle:

**Keep free, always** (what builds trust, and what people who need it most
rely on):

- making a plan and working through it (the Path, races, milestones,
  calendar, journal)
- Start here, ResourceHub search, ratings and Tidbits
- accessibility settings, check-ins, and seeing, correcting or deleting
  your information

**Could be paid later** (extra, not essential):

- more AI-generated paths or regenerations than a fair-use allowance (the
  app already has per-person AI limits in `backend/core/budget.py`)
- organisation accounts for schools, employers and support services (for
  example, one person supporting many people)
- premium content or courses, if they are made

**The open question: family accounts.** They were planned as the paid
tier. But parents of neurodivergent children are among the people who "need
it most", and many parents arrive through the campaign (Facebook parent
groups). One option is to keep one supervised child free, and charge for
organisations instead.

Whatever is decided:

1. Write the line down here and on the home page's "Is Autinerary free?"
   answer, before any paid feature appears.
2. Tell beta testers before anything they use changes. What they made
   should stay theirs.
3. Check comparable apps' free tiers first (Group 5: "needs research into
   what similar apps keep free to set a fair line"). Their pricing changes
   often, so look it up at the time rather than relying on old notes.
