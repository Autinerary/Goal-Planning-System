# The products round (October 2026)

The team's planning note for products asked for:

- warm and cool colours;
- real products, with the qualities people with norms need;
- up to 40 categories;
- rating statistics by norm and by connection to a norm;
- Users' Choice, and Community's Choice for the year;
- an online purchase system and a revenue model;
- a Vendor Account with discounts;
- better customer service, and a chatbot;
- and, for later, taste profiles (v1.5), an AI assistant and in-store navigation
  (v2.0), and culture, languages and other conditions (v3.0).

This page says what was built, what is switched off and why, and what is left.
Written 18 October 2026.

The database change is **STEP 82**
(`backend/database/migrations/2026_products_round.sql`, at the end of
`setup/all_migrations.sql`). It was tested locally twice (34 checks). The code
works before it is pasted.

## Colours and theme

There are two new themes in both apps:

- **Warm** (burnt orange, terracotta, apricot);
- **Cool** (soft lilac, lavender, periwinkle).

Both are in Settings, Accessibility, alongside Earthy, Ocean, Sand and Classic.

- They are built like the others (`scripts/themes/build-themes.mjs`): every
  shade keeps the contrast of the original colours (the script's check:
  100%).
- Warm keeps clear of amber, which means "warning".
- Colour strength (softest to brightest) applies to every theme, because it is
  a filter on the whole page.
- The theme reaches ResourceHub through the hand-off (`theme-warm`,
  `theme-cool`).

## Goal 1: products, with their qualities

**The research.** For each of the 40 categories, researchers look for products
neurodivergent people and families recommend, on Reddit, forums and autism
organisations' lists. Each product is then checked on its maker's or seller's
own pages, preferring products sold in Canada.

- **Every quality has a quote from those pages.** The quote is kept in the
  data files as `quality_evidence`.
- **Prices** are the ones shown on a page, or "varies".
- **Buy links** are checked when the product is saved.

The brief is [scripts/data/products/BRIEF.md](../scripts/data/products/BRIEF.md);
the checker and the tools are in `.qa-local/products/`, outside git.

**Found (18–19 October): 211 products, in all 40 categories,** in
`scripts/data/products/`:

| Group | Products |
| --- | --- |
| Food | 15 |
| Allergies | 11 |
| Clothes | 30 |
| Sensitive skin | 21 |
| Self-care | 20 |
| Sensory | 33 |
| Books | 23 |
| Movies & TV | 14 |
| Apps | 22 |
| Safety at home | 11 |
| Play & school | 11 |

- 196 are sold in Canada (a Canadian store, or a maker that ships here).
- 16 prices are in US dollars, shown as such.
- 67 have no price: food, books and films sold in many places, subscriptions,
  and pages that don't say which currency.
- Every maker page and buy link was loaded again before saving.

**What a reviewer should know:**

- **Left out:** products whose pages make medical claims ("clinically
  proven", "treats anxiety"). Our descriptions don't repeat claims from the
  pages we kept.
- **Allergens** (gluten-, dairy-, nut-, soy-free...) are quoted from the
  maker's own pages; a store's copy can be wrong (one showed another flavour's
  ingredients).
- **Where to watch** isn't checked for Canada for most films and series
  (Netflix and Disney+ pages can't be read by our tools); links say where they
  go, such as "HBO (US page)".
- **Walmart:** 15 everyday foods link to a Walmart Canada search ("(search)"),
  because Walmart's product pages turn our tools away.
- **Titles some may question**, kept for now, so the team can decide:
  - *Atypical* and *The Good Doctor* (the leads aren't played by autistic
    actors, so neither has "Neurodivergent cast");
  - *The Reason I Jump* (the way its people communicate is debated);
  - *Autism in Love* (its page uses older words);
  - the AngelSense tracker. It can't be taken off without a key, and it can
    answer calls by itself; its description says so, and that the wearer
    should be part of the decision.
- **Few "where people recommend it" links** (12): Reddit and most forums
  can't be read by our tools. Ratings in the shop will fill this in.

**To import** (after STEP 82, which adds the columns):

1. `node scripts/import-products.mjs` checks them again.
2. `node scripts/import-products.mjs --apply --archive-demo` saves them and
   archives the 16 "Demo Seller" placeholders. Archived, not deleted.

**Still needed from the team:**

- Odosa's starter list, which the note mentions but didn't include.
- The team's own list of products that worked, especially rare finds. Anyone
  signed in can add one with **Suggest a product** in the shop. The team checks
  it in ResourceHub's admin **Requests** ("Products to check before they go
  up").
- Suggestions now wait to be checked. Before STEP 82, a suggestion went live at
  once.

## Goal 3: categories

There are **40 categories in 11 groups** (`servicehub-mvp/lib/shop/taxonomy.json`).
The groups are:

- Food
- Allergies
- Clothes
- Sensitive skin
- Self-care
- Sensory
- Books
- Movies & TV
- Apps
- Safety at home
- Play & school

For example, Sensory has Sound, Light & sight, Touch & fidgets, Weighted & deep
pressure, Chewables, and Movement & seating.

- The shop shows the groups, and each opens to its categories.
- ResourceHub's search shows the groups.
- The old categories (books, clothing, crafts, food, self-care, supplies,
  toys, apps) still work: each maps to one of the 40.

The app keeps the same file (`frontend/lib/shop/taxonomy.json`).
`node scripts/qa/check-taxonomy.mjs` checks that the two match, that every
category has a group, and that there are 40 at most.

**Community's Choice for products** was already monthly. There is now also
**Community's Choice of the year**, for every kind of item:

- `choice_tally_year()` counts the year's votes; ties go to the most months
  won, then the most nominations.
- It runs after December's tally, in the monthly job.
- Winners get a "Community's Choice · of the year" badge.

## Goal 4: the quality list

There are 79 qualities, each for the groups it makes sense for. Some examples:

- Clothes: tagless, seamless or flat seams, soft fabric, easy closures, gentle
  compression.
- Food: crunchy, soft, smooth with no lumps, mild flavour, gluten-, dairy- and
  nut-free, free of the top allergens.
- Sensitive skin: fragrance-free (not just "unscented"), dye-free, for sensitive
  skin, unflavoured toothpaste.
- Sensory: turns down noise (with its dB), silent to use, weighted (with its
  kg), safe to chew, discreet.
- Books: by a neurodivergent author, audiobook, for parents.
- Movies: neurodivergent main character, captions, audio description.
- Apps: no ads, free, works offline, visual supports, iPhone, Android.
- Everywhere: sold in Canada, made for adults, made by or with neurodivergent
  people.

Core qualities are the filters.

- **Shown per item:** the product page has "What it's like", with each quality,
  what it means, and its values (noise reduction, weight, ages, material...).
  Cards show three.
- **Filters:** the shop shows the core qualities for the group you're in, as
  switches. A product must have all the ones switched on.
- **Sorting:** by category (the default: each category under its own heading),
  matches what you like (see v1.5), highest rated, price, newest, or name.

## Goal 7: rating statistics

Every kind of item now shows the same breakdown:

- the overall rating;
- the rating **per norm** (by norm and level);
- the rating **per connection to a norm**: lived experience, family,
  professionals, allies.

Services and articles had these. Products now have the per-connection part
too (`lib/shop/breakdown.ts`), from the snapshot each rating keeps of the
rater's norms and connections.

## Goal 8: Users' Choice

`users_choice_build()` runs each month, after Community's Choice.

- For each kind of item and its category, it finds the one rated highest
  (at least 4 out of 5, from at least three ratings) by each type of user:
  people who share a norm, or people with the same connection to a norm.
- The badge sits beside Community's Choice: "Users' Choice · families", or
  "Users' Choice · people who share ADHD".
- It shows on service, article and product pages and on shop cards.
- Every month is kept, and the newest is shown.

## Goal 9: buying, and the revenue model

**Built, switched off** (`NEXT_PUBLIC_SHOP_CHECKOUT=on` in both apps, with
Stripe Connect):

- **The cart and checkout** (`/shop/cart`). A product can be bought through
  ResourceHub only when its vendor chose to sell it there, their Stripe account
  can take payments, it has a price, and it is in stock. Each vendor is paid
  separately, so checkout is one vendor at a time.
- **Stripe Connect "direct charges."** The vendor is the seller (merchant of
  record), paid into their own account; ResourceHub keeps a fee from each sale
  (`SHOP_PLATFORM_FEE_PERCENT`, 8%). Shipping addresses are in Canada.
- **Orders** are written only from Stripe's notices (the webhook
  `/api/shop/stripe-webhook`, a Connect endpoint with its own secret
  `STRIPE_SHOP_WEBHOOK_SECRET`). Before STEP 82, people could write their own
  orders; now they can't.
- **The buyer's orders** (`/orders`) show status and tracking, and let them
  start a return.
- **The vendor's side** is in their Resource Account: set up getting paid
  (Stripe), mark a product "Sell it here", and process orders (mark shipped
  with tracking, mark delivered, or cancel and refund in full).

**To turn it on:**

1. In Stripe, enable Connect (Express accounts, Canada).
2. Add a Connect webhook for `checkout.session.completed` and
   `account.updated` to `https://servicehub-six.vercel.app/api/shop/stripe-webhook`.
3. In both Vercel projects, set `STRIPE_SECRET_KEY` and
   `NEXT_PUBLIC_SHOP_CHECKOUT=on`.
4. In ResourceHub's project only, also set `STRIPE_SHOP_WEBHOOK_SECRET`.

Shipping costs and taxes are the vendor's for now: they include shipping in
their price. Stripe Tax and shipping rates are the next step. Ask the lawyer
first (the lawyer pack, question 8).

**The revenue options in the note, weighed:**

| Option | What it would be here | For | Against |
| --- | --- | --- | --- |
| Vendor fee on sales | A share of each sale through ResourceHub (built: 8%) | Only earns when vendors earn; Stripe takes it automatically | Only covers products sold here, and most are sold elsewhere |
| Subscriptions | People: the app's paid plans ([subscriptions-2026-10.md](subscriptions-2026-10.md)). Vendors: a paid tier with more insight and discount campaigns | Steady; people already expect it | Must not lock away safety or basic listing; the free tier must stay useful |
| Advertising | Sponsored listings (built, off) | Pays from the first day | The privacy page and voice.md promise "we don't show ads"; trust is the product |
| Buyer fees | A fee on each purchase | Simple | Customers dislike it; the Competition Act counts a fee added at checkout as drip pricing, so it must be in the price |

**The recommendation:**

- Keep people's plans and institutional funding (schools, workplaces,
  governments) as the main income.
- Add the vendor fee when buying through ResourceHub starts, and perhaps a
  vendor tools subscription later.
- Keep advertising off. Don't charge buyers fees.

## Goal 10: the Vendor Account

The Resource Account (`app.autinerary.ca/business`) now has two types,
Service Provider and Product Vendor:

- **Vendors** add products they sell (they wait for the team, then are theirs
  to manage). They edit price, stock, brand, the price note and their product
  page at once; qualities and the name are checked by the team first. They sell
  through ResourceHub (above) and process orders.
- **Providers** add services they offer (each waits for the team, then is
  theirs to manage).

**Discounts:**

- **Discount events:** three to start, the same dates every year (Autism
  Acceptance Month in April, back to school, ADHD Awareness Month in October).
  The team adds more in the SQL editor.
- **Opting in:** a vendor opts each product in or out, with a percent, a sale
  price, or a code for their own store, or sets their own dates (a launch).
- **Notices:** a daily job tells vendors before each event, in their account
  and by email (`/api/cron/vendor-notices`).
- **Where it shows:** the shop shows a discount only during its dates, once
  discounts are on (`NEXT_PUBLIC_SHOP_DISCOUNTS=on`).

## Goal 11: customer service

- **Labelled emails.** "Send feedback" (both apps) opens a short menu:
  something isn't working, an idea, a question, a recommendation. Every email's
  subject says what it is about, for example `[Bug] [App]` or `[Listing]
  [Product] Loop Engage`. In Gmail, make a filter per label on the heydevs@
  group.
- **"Report a problem with this listing"** is on every service, article and
  product page.
- **The help chat**, on the Help page ("Ask a question"):
  - it answers with AI only from a short, checked list of facts
    (`frontend/lib/helpKnowledge.ts`; keep it true when features change);
  - it is labelled as AI;
  - nothing is saved;
  - it gives 911 and 9-8-8 first when someone may be in crisis;
  - otherwise it points to heydevs@;
  - it is limited to 30 questions an hour.

## Goal 12: accessibility and documentation

Done last round: "Listen to this page", the UserWay option, and the docs for
new team members, debugging and pitches. See
[goals-6-11-2026-10.md](goals-6-11-2026-10.md).

## v1.5: taste profiles

**Built:**

- **On a person's ResourceHub profile:** "What you like and avoid in
  products": 20 qualities (crunchy, soft fabric, tagless, quiet, weighted...).
  Optional, and only theirs to see.
- **In the shop:** "Matches what you like" puts products with what they like
  first, and avoided ones last.
- **`scripts/taste-profiles.mjs`:**
  - groups people by those answers and their norms with k-means, which is
    unsupervised learning;
  - keeps only groups of 10 or more, each described by what most of its people
    like and avoid;
  - never names anyone;
  - waits until at least 20 people have answered.
- A person's own profile shows on their profile page.

**Next:** when there are groups, "People with your taste profile liked..." in
the shop.

## v2.0 and v3.0: the roadmap (not built)

- **AI super assistant.** Personalised recommendations and the products they
  lead to, with filters for similar ones, by voice.
  - It builds on the app's assistant, the help chat, the qualities and taste
    profiles.
  - First step: let the help chat search the shop by qualities ("quiet,
    crunchy snacks").
  - Voice through ChatGPT or Gemini needs their APIs and a privacy review.
- **XR store navigation.** Finding norm-friendly (and unfriendly) options in
  stores and online, from home, and spoken for blind and low-vision people.
  - Google's Geospatial AR works only in phone apps (Goal 6's research), so
    this needs an Autinerary phone app.
  - First step: product pages already say where to get things; next, which
    Canadian stores stock them.
  - Then the same for services and articles, maybe as a separate extension.
- **v3.0.**
  - Culture and location (Spot Guides and Taste Buds across the docs, site and
    Trello).
  - Languages: the app has a translator; ResourceHub and the shop need it.
  - All neurodivergent conditions: the norms list already covers many.
  - Other technologies (autonomous delivery, vertical farms, Soylent and
    Impossible foods): each is a partnership question first.

## Checks

- **STEP 82**, on a local copy of the database with Supabase's grants: 34
  checks, all passing (`.qa-local/pgtest/step82_test.py`).
- **The browser suite** (`.qa-local/browser/plan14.mjs`, 61 checks, before
  STEP 82; all 61 pass on the local build and on production, 19 October;
  Goals 6 to 11's suite still passes, 52 of 52):
  - the help chat (an answer; 911 and 9-8-8 for someone in crisis);
  - the labelled feedback menus and "Report a problem";
  - the terms and privacy pages;
  - 12 closed doors;
  - the Warm and Cool themes with colour strength, in the app and through
    the hand-off;
  - the shop's groups, filters, search, sorting and older categories;
  - a product page; suggesting a product (it waits);
  - the cart and orders;
  - the Resource Account as a product vendor and as a service provider.
  - Everything it makes is removed at the end.
- **The accessibility checker** now covers the shop, a group with its
  filters, Suggest a product, the cart, orders and a product page, at phone
  and desktop widths: 84 pages and widths on production, no serious or
  critical problems. It found that the filters were links marked
  `aria-pressed` (for buttons only); they now say "(on)" to screen readers.
- **Unit tests:** the labelled emails (`frontend/lib/feedback.test.mjs`) and
  the Warm and Cool themes (`frontend/lib/preferences.test.mjs`). CI also
  checks that the two copies of the taxonomy match.

## Still with the team

1. **Paste STEP 82** into Supabase's SQL editor.
2. **Import the 211 products** once STEP 82 is in (Goal 1 above), and look at
   the titles some may question. Send Odosa's starter list.
3. **Keys and switches, when ready:**
   - `NEXT_PUBLIC_SHOP_DISCOUNTS=on`, with the first vendors;
   - `NEXT_PUBLIC_SHOP_CHECKOUT=on`, with Stripe Connect and
     `STRIPE_SHOP_WEBHOOK_SECRET`;
   - `SHOP_PLATFORM_FEE_PERCENT`;
   - `OPENAI_HELP_MODEL` (optional).
4. **Lawyer:** question 8 in the pack (the marketplace, discounts, describing
   others' products).
5. **Decide:** the vendor fee; whether vendors get a paid tier; more discount
   events.
