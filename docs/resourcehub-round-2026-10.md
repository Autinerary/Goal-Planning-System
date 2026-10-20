# The ResourceHub round (October 2026)

The team's notes for this round (mostly Odosa's) covered ResourceHub:
**My Resources**, **a resource's page**, **Tidbits**, **a shop item's page**,
**the filter sidebar**, and **ResourceHub overall**, with listings to add.
This page says what was built for each note, what needs someone on the team,
and the choices made where a note left room. Written 20 October 2026.

The database change is **STEP 86**
(`backend/database/migrations/2026_resourcehub_round.sql`, at the end of
`setup/all_migrations.sql`). It was tested locally on the whole schema: 33
checks, `.qa-local/pgtest/step86_test.py`. **It isn't pasted yet.** Until it
is, the parts that need it say they open soon (or stay hidden), and
everything else works. STEP 86 adds:

1. **Guides**: a third Tidbit length, up to 3000 words, only for posts with
   the Autinerary byline (which only the server sets). For the Learning pages.
2. **Facebook videos**, as a commentary source apart from Facebook posts.
3. **`saved_items`**: shop items and Tidbits kept in My Resources (services
   stay in `saved_resources`). Each person sees and changes only their own.
4. **`visuals`**: real art for the Visuals page. A row can't exist without the
   artist's two statements (made by them; not made by AI). It shows once an
   admin approves it.
5. **`products.contact_email`**: a maker's published email, for the team's
   contact list.

Nothing is deleted. Safe to re-run.

## What needs someone on the team

| What | Where | Why it waits |
| --- | --- | --- |
| Paste STEP 86 | `backend/database/migrations/2026_resourcehub_round.sql` in the Supabase SQL editor | Saving shop items and Tidbits, Visuals, the guides and the makers' emails need it |
| Then, after the paste | `node scripts/import-learning-guides.mjs --apply` and `node scripts/set-product-contacts.mjs --apply` | The five Learning pages as guides; 112 makers' emails onto 175 shop items |
| Review shared art | ResourceHub → Admin → Visuals (an admin; nobody is one yet, see the All Apps round) | Each piece waits for a person to look at it |
| Use the contact list | ResourceHub → Admin → Contact list (CSV) | Nothing is sent from it: it's a list to work from |

## My Resources

| Note | Now |
| --- | --- |
| "Categories in My Resources should be 2 layered; Layer 1 as Service, Post or Store Item, Layer 2 as layers in each individual place" | Wishlist, My Resources and Completed each start with **Services · Posts · Store Items** (with how many are in each). Under each, its own categories: a service's category, a shop item's group, a Tidbit's community group. "Save to My Resources" is on every shop item and Tidbit (STEP 86); before STEP 86, Posts and Store Items say they open soon |
| Error on My Resources and Wishlist: "Cannot read properties of null (reading 'location')" | Already fixed in an earlier round: a saved listing that can't be read any more (archived, or back under review) is left out and the page says so, instead of crashing. Checked again on both tabs (plan19) |

## A resource's page

| Note | Now |
| --- | --- |
| Phone breadcrumb: "gap here?" | The Home icon sits by its chevron again; its touch target is still full size (a wider invisible area) |
| "Rating Breakdown needs another layer (or 2): Diagnostics features as Layer 1 (Ex. Autism Level 1 vs Level 3), then the generally applicable areas (Ex. Sensory), both specific (Sensory in Autism) and general (Sensory)" | **By diagnosis** first: each diagnosis with its stars and raters, its levels side by side (Autism Level 1, Level 3), each level opening to its areas ("Sensory-Friendliness in Autism Level 1"), and each area for that diagnosis. Then **Each area, from everyone**. With no ratings yet it says what will show |
| "Change rating names from ____-Support to ____-Friendliness" | Sensory-Friendliness, Autism-Friendliness and so on, the same in the breakdown, the reviews and the rating form (`lib/ratings/areaNames.ts`) |
| Contact buttons for call and an email draft with a rewritten template | Already there (**Call** and **Draft an email**, with templates for accommodations, availability, cost or a general enquiry). They show when the listing has a phone or an email |
| Map image broken on phone and laptop | The 2D and 3D maps draw on both (checked on production with screenshots). One real fault fixed: on phones the 3D view's attribution button showed its "i" twice |

## Tidbits

| Note | Now |
| --- | --- |
| Tidbits by Autinerary from the Learning pages: each page its own Tidbit, the disclaimer at the top, quick links to each section | The five pages (Intro to Autism, A Deep Dive into Autism, Signs & Characteristics, Assessment & Diagnosis, Accessing Autism Services) become **guides** by Autinerary in the Parents group: the page's own disclaimer first, a line linking the page, its sections as headings (so Tidbits' **Quick Links** list them), its resources, what it was adapted from and its references. 1,122 to 1,664 words each, over a Tadbit's 1,000, hence STEP 86's guide length. The pages were read with a browser, every dropdown open (`scripts/data/learning/`). Published after the paste with `scripts/import-learning-guides.mjs --apply` |
| A "Solutions" category in the filter bar, highlighting the key sentence, with an option when writing a Tidbit | **Solutions** was already a tab (Tidbits whose writer marked a key sentence) and the key sentence already shows highlighted. New: **Write a Tidbit** has a **Key sentence** box, and "Use the sentence I selected above" takes it from the Tidbit itself |
| "Comment on" a highlighted part | Already there: **Comment on a highlighted part**, beside commenting; the reply shows the passage it's about |
| "This isn't for you": Super Tidbits Doc | Left for its own round, as the note says |

Also fixed: in any Tidbit, a link whose address has underscores in it (many
research links do) got broken by the italics rule. Links are now kept whole.

## A shop item's page

| Note | Now |
| --- | --- |
| Add the rating breakdown, community reviews, pattern insights and "Based on those who matched your Diagnostics profile" from services ("still missing ... most important part!") | All four show on every shop item, as on services, reviews or not. Each says what it needs: signed out, sign in and add your Diagnostics profile; no profile, add one; no matching reviewers yet, two or more people like you need to review it. The breakdown has the same layers as services |

## The filter sidebar

| Note | Now |
| --- | --- |
| A dropdown at every level (biggest titles, big titles, very small titles like Level 1-3 under Autism) | Every section opens and closes, and says how many of its choices are on: Resource Type, Norms, Personality, Life Category, Free or paid, Kind of service, Online, Wait, Age of service, Special Tags, Community Star Rating, Cost, Connection Type, Age Range, Minimum Overall Rating, Distance. Inside, each group does too (Services & Places, Activities, Shop, Commentaries and its sources, Trending), and each condition's kinds open under it (Autism's Level 1 to 3, ADHD's presentations) |
| Search for other famous combined categories like AuDHD | Norms has a **Combined** group: AuDHD, twice-exceptional (2e), dual diagnosis, DS-ASD, deafblindness and concurrent disorders. Each was checked against at least two health, education or national organisations' pages (19 others left out: slang, contested, too rare, or one condition rather than two). Searching finds the words each is written as |
| Visuals beside services, shop and Tidbits: real art, no AI | **Visuals** in the navigation: a gallery, **Share your art** (the artist's two statements: made by them, and not by AI), an upload that turns away files carrying AI tools' marks (Content Credentials' "trained algorithmic media", Stable Diffusion and ComfyUI settings, the tools' names), and the team's review. Signed-in, like the shop and Tidbits |
| Commentaries: Tidbits as commentaries (as solutions); source and URL fields; Tidbits get the Tidbits source; a source filter; "Check out their full page of commentaries here!"; Commentaries under Resource Type with News, Social Media Posts (Reddit, Twitter, Facebook), Videos (YouTube, TikTok, Instagram, Facebook) | **Commentaries** is under Resource Type: All commentaries, then News, Social Media Posts and Videos (Facebook is in both, STEP 86) and **Tidbits**. With Commentaries or the Tidbits source chosen, matching Tidbits come back beside the listings, each saying "Source: Tidbits" and showing its key sentence. With a source chosen, **Check out their full page of commentaries here!** opens everything from it. Commentaries already had their source and its link on their page |
| Connection Type to Norm; Age Range | Already there; now sections that open and close |
| Special Tags: "Autinerary's Own" (blue, pink and purple gradient, white bold, shiny); TRENDING with Today (bronze, shiny), This week (silver), This month (gold), This year (platinum); RARE; HIGHLY-REQUESTED | All of them, each looking as it does on a card, with a sweep of light across Autinerary's Own and the Trending tiers (still with Reduce motion). The tiers come from real saves (`get_resource_badges`): today 3, this week 10, this month 25, this year 100. Cards in the results show Autinerary's Own, Surprising Finds and a listing's Trending tier |
| Under Resource Type: Swimming, Horseback Riding, Animal Therapy | An **Activities** group with all three. Each finds what listings say about it (swim, aquatic; horseback, equestrian, therapeutic riding; animal-assisted, therapy dog, equine therapy, service dog), so it finds more than the two categories that existed |
| Services & Places: "Therapist" to "Therapy", with dropdowns for the types of therapy from our site's Autism Services dropdowns, and the bolded text as a further layer | **Therapy**, opening to the eight types on the Learning page (Behavioural, Developmental, Educational, Nutritional, Pharmacological, Psychological, Social-Relational, Other), each opening to the kinds the page names under it (ABA and IBI; speech, occupational, play and sensory therapy; and so on). Read from the page itself with every dropdown open; none added that it doesn't name |

## ResourceHub overall

| Note | Now |
| --- | --- |
| A new tag, SURPRISING FINDS: general-purpose things that turn out to suit norms well | A Special Tag (teal to green) to filter by, on cards and pages. The research below marks everyday places with it |
| Products show under Services; only services should | Fixed: search gives shop items only when a Shop type is ticked (or Tidbits' "services and products you mention" asks for both) |
| Mass add Ontario's most autism- and neurodivergent-friendly places (e.g. Sarang in Toronto) | See "Listings added" |
| Every added service's and product's email on a list | **Admin → Contact list**: every listed service's published email (1,497 today) and every shop item maker's (STEP 86), with a CSV. 112 of 149 makers' emails were found, each read on the page it came from; 37 publish only forms or phones (`scripts/data/products/contacts.json`) |
| Mass add real resources: after-death / "what if I'm not here" planning and insurance; fitting in at work; functioning in society; after school (swimming, equestrian, animals) | See "Listings added" |

## Listings added

Found by research agents and checked on each place's own pages (or a news
report about it): every quote, phone, email and address is compared word for
word with the saved page (`.qa-local/services3/bin/check.py`), and the import
fetches every website again and leaves out any that don't load. A place
ResourceHub already listed gets the checked description, tags and missing
contacts added to its listing instead of a second listing.

**215 new listings, and 25 listings ResourceHub already had now carry checked
details**, imported 20 October (`scripts/data/services/<topic>.json`, import
batches `curated-<topic>-2026-10`, so Spot Guides can see them):

| Topic | Checked | Already listed (enriched) | New | Where | Kinds |
| --- | --- | --- | --- | --- | --- |
| Ontario's most autism- and neurodivergent-friendly places (`on_friendly_places`) | 51 | 20 | 30 | 48 Ontario, 2 national (Cineplex sensory-friendly screenings, Walmart Canada's sensory-friendly hours), 1 Quebec | Museums, recreation and community centres, cafés, cinemas, city swims and skates, library sensory kits, a zoo and aquarium, an amusement park, a hospital dental clinic, Sarang. With two sensory swims at public pools, 50 listings now carry **Surprising Finds** |
| "What if I'm not here": future planning (`future_planning`) | 39 | 0 | 39 | 17 Ontario, 5 national, 17 other provinces | Henson trusts and wills, the RDSP and its grant and bond, guardianship and decision-making, legal clinics, planning networks (Partners for Planning and others). No insurer publishes a page about planning for a family member with a disability, so none is listed; five businesses (law firms, a credit union, a wealth manager) say so in their notes |
| Fitting in at work (`workplace`) | 47 | 3 | 44 | 19 Ontario, 11 national, 17 other provinces | Job coaching and readiness, neurodiversity employers (Specialisterne, auticon), accommodation and disclosure guides, rights at work, peer networks |
| Functioning in society (`independent_living`) | 48 | 0 | 48 | 31 Ontario, 4 national, 13 other provinces | Life skills, supported and semi-independent living, adult day programs, social groups for autistic adults, money and benefits help |
| After school: swimming, riding, animals (`after_school`) | 58 | 2 | 54 | 34 Ontario, 5 national, 19 other provinces | 22 adapted or one-to-one swim programs, 20 therapeutic riding centres, 10 animal programs (autism service dogs, therapy-dog reading, a care farm), 6 more after-school programs |

Three entries were left out because their sites didn't answer when the import
fetched them (two City of Guelph pages, one Simcoe County listing); re-running
`node scripts/import-curated-services.mjs --apply on_friendly_places after_school`
picks them up when they do. Some programs are closed to new families (three
autism service dog programs), seasonal, or rely on a source from 2024; each
says so in its notes for Spot Guides.

**Sarang Kitchen**: its own site lists two Toronto restaurants, 1056 Bloor St W
and 774 Danforth Ave. The Bloor listing (from OpenStreetMap) now carries the
checked description (sensory-friendly hours, sensory boxes, a multi-sensory
room; staff with autism or ADHD) and Surprising Finds; the Danforth listing
stays as it was. A third listing, from an earlier checked list with no address,
was the same restaurant as the Bloor one: it was archived (status
`rejected`, nothing deleted), and its source entry moved to `merged` in
`scripts/data/services/parents_social.json`.

## Tests

- `.qa-local/browser/plan19.mjs`: 49/49 against the local stack.
- Unit tests: `lib/community/markdown.test.mjs`, `lib/visuals/aiCheck.test.mjs`,
  `lib/search/keywordFilters.test.mjs` (new), with `tidbits` and `moderation`.
- The accessibility checker (`scripts/qa/check-accessibility.mjs`, signed in)
  and axe on the new pages: no serious or critical problems after one fix
  (Related Tidbits' grey text).
