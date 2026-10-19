# The Tidbits round (October 2026)

This round worked through four notes from the team:

1. **The feedback of 31 August.** The same results came up for therapists,
   schools, doctors and parks. Specific learning disabilities had no
   services. Path Market paths had no resources of their own.
2. **The 5Qs report's to-do list.** Wait times, support for parents, help
   paying, the article series, AAC and social groups, and "Infographic to
   all emails".
3. **The Category Split.** The team's starter list of products.
4. **The Tidbits planning note.** The Bakery theme, Goals 1 to 10, and the
   v1.5 and v2.0 rounds.

This page says what was built, what is switched off and why, what needs
someone on the team, and what is left. Written 19 October 2026.

The database change is **STEP 83**
(`backend/database/migrations/2026_tidbits_round.sql`, at the end of
`setup/all_migrations.sql`).

- It was tested locally: 66 checks, `.qa-local/pgtest/step83_test.py`.
- It is **not pasted yet**.
- Until it is, every page works with the older database:
  - Tidbits "open soon", and questions work as before;
  - a listing's wait says "No one has said yet";
  - sponsored listings, when turned on, can only appear beside searches.

## What needs someone on the team

| What | Where | Why it waits |
| --- | --- | --- |
| Paste STEP 83 | [2026_tidbits_round.sql](../backend/database/migrations/2026_tidbits_round.sql) | Migrations are pasted by the team |
| Load the 10 articles as drafts, read each, publish | `node scripts/import-articles.mjs --apply` (after STEP 83) | Each has notes on what to check first |
| Hide 24 weight-loss businesses filed as "Therapist" | The SQL in [Feedback of 31 August](#the-feedback-of-31-august) | Changing live listings is the team's call |
| Find the old Tidbits web app | Goal 1 | Daniel has the link |
| Sponsored listings | [Goal 7](#goal-7-sponsored-listings-off) | Off: needs Autinerary's own Stripe account, the terms, and both flags |
| Outreach | [The 5Qs report](#the-5qs-report) | Services' "shout out" video, Autism Alliance of Canada, social-cue groups: people, not code |

## The feedback of 31 August

**"The same results come up for therapists, schools, doctors, parks."**

- A search with words also used results from the AI search, and those
  ignored the filters. They are now filtered like the rest: kind of place,
  cost, online or in person, age, source, tags, price and condition words.
  When a filter can't be applied to them, they are left out.
- The **Store** tile searched a category no listing has, so it always came
  back empty. It now opens the shop.
- 24 weight-loss businesses are listed as therapists: 13 Jenny Craig, 10 eWyn
  and 1 Purdy Ideal You. They came with Ontario's open data. Hiding them
  changes live listings, so it is left to the team. This SQL hides them (it
  doesn't delete them; `status = 'approved'` brings them back). The monthly
  ratings sweep only un-hides listings it hid itself.

  ```sql
  -- See them first
  SELECT id, name, location->>'city' AS city FROM public.resources
  WHERE category = 'Therapist' AND status = 'approved'
    AND (name ILIKE '%jenny craig%' OR name ILIKE '%ewyn%' OR name ILIKE '%ideal you%');
  -- Hide them
  UPDATE public.resources SET status = 'hidden'
  WHERE category = 'Therapist' AND status = 'approved'
    AND (name ILIKE '%jenny craig%' OR name ILIKE '%ewyn%' OR name ILIKE '%ideal you%');
  ```

**"No resources after specific learning disabilities."**

- The condition filter looked for the condition's id in a listing's text
  ("specific_learning_disabilities"), which no listing contains. It now
  looks for the words people use: learning disabilities, dyslexia,
  dysgraphia, dyscalculia; Tourette and tics; stuttering, dyspraxia and
  apraxia.
- **86 new services**, each checked on its own website, are now in
  ResourceHub:
  - **41 for the thinnest conditions**: Learning Disabilities Associations
    in 10 provinces, dyslexia, Tourette, stuttering and Down syndrome groups
    (`scripts/data/services/conditions.json`);
  - **45 for parents, social groups and AAC**: parent support across
    Canada, 8 social and PEERS® groups, and 9 AAC programs, such as
    Ontario's ADP communication aids, Holland Bloorview, BC's CAYA and the
    Glenrose I CAN Centre; a tenth, ACETS in Calgary, was already listed
    (`scripts/data/services/parents_social.json`).
- Now: specific learning disabilities finds **66** services (it found 1),
  motor and vocal differences 17 (it found 0), and Tourette 6.
- Not found: anything in Nunavut, a social group in Manitoba, or a PEERS
  program in Quebec.

**Path Market: "add resources based on the path".**

- **73 official pages for the 14 paths**, each checked on its own site
  (`frontend/lib/pathResources.json`). Medicine & Science, for example, has
  AFMC's admission requirements, OMSAS, MCAT and Casper accommodations, a
  real tuition table, NSERC's summer research awards and the Canadian
  Association of Physicians with Disabilities.
- They show in Path Market before you choose a path, and on the Path once
  you follow one: "Resources for your path", one line until opened, so the
  simple Path stays simple.
- Pages for one province or city say so ("Ontario", "BC", "Toronto"; two
  are "From the US" or "From the UK").
- **To add by hand**: canada.ca didn't load for our tools, so the Disability
  Tax Credit, RDSP, Canada Disability Benefit, the federal student grants,
  the Opportunities Fund and Canada's Food Guide are missing. So are OUAC's
  own pages (it refused us; U of T's and Ontario's pages are used instead).
- **Dates that change**: OMSAS's 1 October deadline has passed; the U of T
  tuition is 2026–27; ODSP changes every July; the Ontario Arts Council's
  June deadline has passed.
- Built by `.qa-local/pathways/build_public.py`.

## The 5Qs report

| The report | What was built |
| --- | --- |
| "Waittime is a universal bug (solution MUST be highlighted in SHub!!!)" | A rating can say how long you waited (6 choices), and a service can say its own wait in its Resource Account. Each listing shows "How long the wait is": the middle answer of the last two years, and what the service says (with its date). Therapists, doctors, school supports and social services also show "While you wait": support for parents, help paying, free services, and Tidbits from people who waited. There is a "Short wait" filter (a month or less). |
| "Lack of income-based funding (highlight ResourceHub features)" | ResourceHub's home page has a new row, **"Help that's hard to find"**: support for parents, help paying for services, free services, and short waits (shown once some services have one on record). |
| "SHUB - PARENT SUPPORT SYSTEMS tag" | The `parent_support` tag ("Support for parents": support groups, coaching, respite or advice for parents and caregivers). **101 services** have it: 57 new and 44 already in ResourceHub, tagged by `scripts/tag-parent-support.mjs`, which changes nothing else. |
| "Infographic to all emails" | Four tiles above the footer of every email that has one (setup reminders, the first-weeks emails, the newsletters): waiting is the hardest part, parents build the support system, help paying is hard to find, and the wins mean more. Each tile has a link to what helps. They give themes in our words and never quote anyone. |
| The article series | **10 drafts** by "Autinerary". Every fact has an exact quote from an official page. See [Goal 10](#goal-10-articles-sorting-the-best-and-the-chef-hat). |
| AAC | 9 AAC programs added (a tenth was already listed), and the AAC apps already in the shop (Proloquo2Go, Proloquo4Text, and TouchChat on the iPad entry). |
| Social cues, social groups | 8 social and PEERS® groups added. Partnering with them is the Connections team's. |
| "GET CONSENT TO PUBLISH!!!" | No survey answer is quoted anywhere: not in the emails, the articles or the app. |
| "Ask services to shout out their solutions", one big video, Autism Alliance of Canada | Not code: outreach is the team's. Nothing was sent. |
| Merch; undiagnosed parents; a VR simulation for the "Other" group | Not built. These are ideas for the team to decide on. |

## The Category Split (starter products)

**36 products added to the shop**: 18 for food, clothes and skin, and 18 for
games, toys and tech. The team named each one, and each was checked on its
maker's or seller's page (`scripts/data/products/starter_*.json`).

- **Food**: dino nuggets, Weetabix, graham wafers, Pop-Tarts, Nutella,
  Goldfish Flavour Blasted, Simply Cheetos, a soft pretzel (Farm Boy,
  Ontario only), mini pizzas, mochi and Pizza Pops. Allergens are in the
  notes.
- **Clothing and skin**: a full-body swimsuit (EcoStinger, priced in US
  dollars), a muslin blanket, soft sweatpants, and four eczema creams. None
  repeats a medical claim.
- **Games**: Stardew Valley, Minecraft, Animal Crossing, Roblox, Super Mario
  Bros. Wonder and Pokémon Scarlet/Violet, in a new **Video games** category.
- **Video game qualities**: No time pressure, No chat with strangers, No
  in-app purchases.
- **Toys**: a soft-play triangle, a floor spinner, an inflatable bouncer, an
  AR dinosaur globe, a colouring book, plush toys, a space book, a bubble
  machine and a fort kit.
- **Tech**: an LCD writing tablet (the "LED tablet") and the standard iPad,
  with honest notes on what speech apps cost.
- **Changed on review**:
  - Roblox keeps its entry but **not** "No chat with strangers": parents can
    turn chat off, but it is on until they do.
  - The bouncer doesn't say "indoors or outdoors": that came from a store's
    title, not Intex.
- **Held back**: Veggie Straws. Its gluten-free claim rests on a store's
  search page alone, so check the bag first.
- A new food quality, **Chewy**, joined the food "yes's" and "anti's" (the
  avoid list already had stringy, mixed textures and others).
- Sarang Kitchen was already in ResourceHub (two Toronto locations). Its
  page lists sensory features but not which location has the sensory room.
- "THIS IS A MITACS PROJECT!!!": noted in the [product portfolio](product-portfolio.md).

## The Tidbits planning note

### The Bakery theme

Golden, light and dark brown, with its own clouds. It is in Settings,
Accessibility, in both apps and through the hand-off, and colour strength
applies to it. Every shade keeps the contrast of the original colours (the
theme script's check: 100%).

### Goal 1: the old Tidbits web app

**Blocked.** Daniel has to find the link to the previous Tidbits, so its
style and features can be matched. Everything below was built from the note
itself.

### Goal 2: the rules pop-up, tags, anonymous posts, profiles

- **Two pages** the first time someone opens Tidbits, and before a first
  post, answer or rating: what Tidbits is for (short and sweet, and
  solution-oriented), then the community rules. Accepting is saved, so it
  shows once (until the rules change).
- **Filters on Tidbits**:
  - **Length** (Tidbit up to 500 words, Tadbit up to 1000);
  - **Source** (internal posts, rated or unrated; external reviews);
  - **Has Integrated Resources**: the services and products a Tidbit
    mentions, chosen by its writer and shown at its end.
- **Anonymous Tidbits**:
  - the writer's name and profile are never sent, except to the writer and
    moderators;
  - writing one still needs a community group.
- **13 groups to start**:
  - Autistic adults; ADHD; AuDHD;
  - Parents; Siblings; Teens and young adults; Students;
  - Learning differences; Tourette and tics; Anxiety and OCD;
  - Newcomers; Work; Professionals and allies.
  Who is in a group is private; only the count shows.
- **Profiles**: a picture can be uploaded in Tidbits' settings. Everyone
  without one gets the **chef hat** (Goal 10).

### Goal 3: Bites and Well-Dones

- **A Bite** is a Tidbit read: scrolled to its end, after 8 to 40 seconds
  depending on its length.
- **A Well-Done** is a rating from Underbaked (1) to Perfectly baked (5).
  You can't rate your own.
- Each has a small animation and a sound:
  - **Sounds are off** unless chosen ("Sounds in Tidbits", in ResourceHub's
    accessibility settings).
  - With reduced motion, there is no movement, only the message.

### Goal 4: My Tidbits

- Three tabs: **Published**, **Drafts** and **Previous Well-Dones**.
- **Drafts**: "Save draft" keeps a draft, which can be short and untitled,
  and "Keep writing" opens it again.
- A published Tidbit can be edited by its writer.

### Goal 5: short and sweet

- **Before writing**, the composer gives the rule: one idea, up to 500 words
  in a Tidbit or 1000 in a Tadbit.
- **While writing**, a live word count.
- **Over the limit**, "Keep it short & sweet!", and it can't be published.
- **The database checks the same limits**, so they can't be got around.

### Goal 6: moderation

- **Slurs**:
  - a post or comment with one is not saved, and the writer is told which
    rule;
  - the list is kept encoded, so it isn't in the code as plain text.
- **Swear words** are bleeped as "(bleep)", spelled around a filter or not
  (f*ck, sh1t, f.u.c.k, **bold**, with "!"), while words that only look like
  one are left alone (Scunthorpe, Dickens, Shitake). The unit test is
  `servicehub-mvp/lib/community/moderation.test.mjs`.
- **Everything else** (threats, harassment, hate, self-harm) goes to
  OpenAI's moderation check. Anything it flags is published but listed for
  a moderator under **"Flagged automatically"**, in the moderation page,
  with It's fine and Remove. Remove hides a post; it doesn't delete it.
  Self-harm gets a content note. The privacy page says so.

### Goal 7: sponsored listings (off)

"Resource Ads … for price/click-through rate", in Tidbits and in Paths ("1
of 3 recommended resources 'Promoted'"), with a way to pay to remove them.

**How they work once on:**

- **Where**:
  - beside matching searches;
  - under a Tidbit on its topic;
  - among a plan step's services, **third, and only after two of the
    plan's own**, so at most one in three is sponsored and none of the
    plan's suggestions is pushed out.
- **"Personalized" the way the privacy page can promise**: chosen by what
  the person is looking at (what they searched, the Tidbit, the step) and a
  province. Never by a profile of them. The business sees counts only.
  Always labelled "Sponsored", with "Why you see this".
- **Paid by the click**:
  - the owner chooses where it shows and what a click is worth (5 cents to
    $20), and pays a budget ($25 to $250 at a time) by card through Stripe
    Checkout;
  - each click spends the bid, once a day per person, and only after that
    person was counted seeing it (half of it on screen);
  - spending never goes past the budget, and the listing stops when the
    budget is spent;
  - when several match, each is shown in proportion to its bid.
- **Privacy**: who saw or clicked is kept only as a key that changes every
  day and can't be turned back into a person or an address.
- **Approval**: the team approves every promotion, and edited words go back
  to the team.
- **The way out of ads**: people on a paid plan, or with free access through
  an organization, never see one. Under each sponsored listing: "A paid
  plan has no sponsored listings", and the pricing page says so too.

**To turn them on** (none of this is done):

1. **Stripe**: Autinerary's own account. The test keys pasted on 19 October
   belong to another product (a "Catalyst student plan", whose webhook goes
   to another site), so they were not stored or used. Set in the app:
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (the webhook is
   `/api/stripe/webhook`), and `NEXT_PUBLIC_BUSINESS_ADDRESS` and
   `NEXT_PUBLIC_BUSINESS_PHONE`.
2. **The terms**: update "Managing a listing" with how promotions are paid
   for (draft below), and give the terms a new version (`lib/legal.ts`).
3. **The flag**: `NEXT_PUBLIC_SPONSORED=on` in **both** Vercel projects (the
   app and ResourceHub). The privacy page changes with the flag, from "we
   don't show ads" to how sponsored listings work.
4. Optional: `PROMOTION_SALT`, a long random string for the daily viewer
   key. Without it, the service key is used.

Draft for the terms, "Managing a listing":

> You can pay for a promotion. You choose where it may show and what a click
> is worth, and pay a budget in advance. Each click, at most once a day per
> person, spends what you chose a click is worth, never more than the
> budget; when the budget is spent, the promotion stops. We show a promotion
> only while the team has approved it, always labelled "Sponsored". What is
> left of a budget is yours: ask us for it back at any time.

### Goal 8: feedback

- "Send feedback" was already on every ResourceHub page, with labelled
  emails and the help chat.
- **New**:
  - from Tidbits, the emails are labelled **[Tidbits]**;
  - each post has **"Feedback for the team"**, labelled with its title, as
    services and products have "Report a problem with this listing".

### Goal 9: touch-ups, the site audible, documentation

- **"Listen to this Tidbit"**, by the title, reads only the Tidbit, not the
  comments. "Listen to this page" was already in every page's footer.
- UserWay stays off, as decided in Goals 6–11.
- **"Edit up Product Portfolio"**: [docs/product-portfolio.md](product-portfolio.md),
  written for someone new to Autinerary and for pitches.
- Also fixed:
  - Hare World's messages said "All messages are reviewed for safety",
    which isn't so. They now say who can message you, and how to report or
    block.
  - The phone "Filters" button showed 0 with some filters on, and its name
    didn't match its words.
  - A "Short wait" search showed shop items.

### Goal 10: articles, sorting, the best, and the chef hat

**Articles by "Autinerary".** Ten drafts, in `scripts/data/articles/`. They
are loaded as **unpublished drafts** with the byline Autinerary by
`node scripts/import-articles.mjs --apply` (after STEP 83). Every fact has
an exact quote from its source.

| Article | Length | Group |
| --- | --- | --- |
| What to do while you wait | Tadbit | Parents |
| Help paying for services: what to check first | Tadbit | Parents |
| Starting college or university: your accessibility office | Tadbit | Students |
| The autism timeskip: what changed in 15 years | Tadbit | Autistic adults |
| Asking for accommodations at work | Tidbit | Work |
| Making friends as an autistic adult | Tadbit | Autistic adults |
| Keeping friendships going | Tidbit | Autistic adults |
| Finding your people: social and peer groups | Tadbit | Teens and young adults |
| Ontario's autism program wait, compared with other provinces | Tadbit | Parents |
| Siblings: a different kind of closeness | Tadbit | Siblings |

Each ends with its sources, and with the ResourceHub searches that can help
where they fit the word limit. Three became Tadbits only because their
sources took them over 500 words.

**Before publishing**, read each one's `notes` in its data file. Most often:

- **Federal pages**: canada.ca didn't load for our tools, so federal facts
  were checked on Wayback Machine copies (December 2025 to October 2026,
  dated in the source labels). Open the live pages, check the amounts, and
  swap in the canada.ca links.
- **Amounts that change**: the Child Disability Benefit ($3,480), the
  Canada Disability Benefit ($204.20 a month), Ontario's ACSD, the $2,800
  student grant (until 2026–27).
- **Ontario-only**: the Ontario sections say so.
- **BC**: BC's Autism Funding ends 31 March 2027.
- **Events with dates**: they need updating once those dates pass.
- **Programs**: PEERS® and Befriend: some autistic people dislike them;
  decide whether to keep them.
- **The friendship series**: link its two posts to each other once both are
  live.

**Read the article here / See more from (platform) here.** On a rated
commentary that isn't ours, from its source link, with the platform named
(Reddit, Medium, YouTube, the National Autistic Society, CBC and others).

**Sorting.** Newest, or **Best**: Tidbits by their Well-Done score.

**The best Tidbit.** The **Chef's pick**: the best Tidbit of the last seven
days, with at least three Well-Dones, at the top of Tidbits. "Best" is a
Bayesian average:
`(sum of ratings + 10.5) ÷ (number of ratings + 3)`. A Tidbit with one 5
doesn't beat one with twenty 4.8s.

**The chef hat.** Every profile without a picture gets a chef hat in its
colour.

### v1.5: not built (remember IP)

The note asks that these not be built yet. Before they are, **the team
should consider intellectual property protection for the industrial
designs**:

- the bakery system of questions and answers (requests, "are you sure?"
  when a similar Tidbit exists, the editors' view of open questions);
- Chef Requests;
- Suggestions (like Community Notes);
- a Tidbit as a cue card or reminder in Paths;
- Focus Mode;
- the poster's character running a maze;
- Co-Bake and Recipes;
- Bake-Offs, with their four phases.

### v2.0: the roadmap

From the note, for later rounds:

- **Culture and location**: different places, different norms.
- **Languages.**
- **Professional partnerships**: for the Connections team, with the
  partnerships "master plan".
- **More articles**, from "Articles - Written & Ideas".
- **Premium features**:
  - analytics for writers;
  - an Annotations section for researchers;
  - no ads, priced at about what ads would earn, on top of the other
    features' costs (not the final price).

## Checks

| Check | Result |
| --- | --- |
| STEP 83, locally (`.qa-local/pgtest/step83_test.py`) | 66/66 |
| Moderation, Tidbits and sponsored-listing unit tests (ResourceHub, now in CI) | pass |
| The two apps' sponsored-listing code is the same (`scripts/qa/check-sponsored.mjs`, in CI) | pass |
| The app's unit tests | pass |
| Types, lint (no new problems), and production builds of both apps | pass |
| Browser suite for this round, locally, before STEP 83 (`.qa-local/browser/plan15.mjs`) | 37/37 |
| Accessibility, locally, signed out and in, phone and desktop, with this round's pages | 98 pages, no serious or critical problems |
| Services import | 86 saved: 41 conditions, 45 parents and social; 3 left out as already listed or not loading |
| Starter products import | 36 saved |
| Parent-support tags | 44 existing listings tagged |
