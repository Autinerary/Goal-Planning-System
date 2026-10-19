<!-- The brief the researchers worked from (18 October 2026). Their drafts were checked with
.qa-local/products/bin/check_products.py, reviewed, and saved here by .qa-local/products/convert.py
(without each draft's _sources and unverified lists). docs/products-round-2026-10.md, Goal 1. -->

# Brief: products for ResourceHub's shop (checked 2026-10-18)

ResourceHub is Autinerary's free directory for neurodivergent people (autism, ADHD and more) and their
families in Canada. Its shop **lists products people find useful and where to get them; it does not sell
anything**. Today is 18 October 2026. Your job: find real products in your categories that neurodivergent
people and their families actually recommend, check each one on its maker's or seller's OWN pages, and
write the ones that check out as draft JSON entries, with the qualities people with norms look for.

Folder (call it S): `.qa-local/products` (outside git)

- `S/taxonomy.json`: the 40 categories (in 11 groups) and the qualities. Use only these ids. A quality
  can be used for a product only if its `groups` include the product's category group, or `"*"`.
- `S/sites/`: pages kept by the fetch tool. `S/drafts/`: where you write your draft.

## Tools (run with `python3 -I`)

    P=.qa-local/products
    python3 -I $P/bin/fetch.py $P/sites URL [URL ...]           # fetch + keep (cached; --force to fetch again)
    python3 -I $P/bin/show.py  $P/sites URL                     # status, title, first 3000 characters
    python3 -I $P/bin/show.py  $P/sites URL --grep 'tagless|seam|cotton|\$'
    python3 -I $P/bin/show.py  $P/sites URL --links 'shop|product|buy'
    python3 -I $P/bin/check_products.py $P/sites $P/taxonomy.json $P/drafts/<yourfile>.json   # run until 0 errors

Only pages kept by fetch.py count: the checker compares every quote and price word for word with them.
`show.py` needs the URL exactly as given to fetch.py. You may use WebSearch (mode "standard", at most 25
searches in all) to find what people recommend and to find a product's own page; then fetch the page
with fetch.py. Do not use curl or WebFetch. Do not edit the tools. Write only in `S/drafts/` (and
`S/sites/` through fetch.py).

## Step 1: find candidates

For each of your categories, find **5 to 8 real products** that neurodivergent people or their families
recommend. Good places to learn what people use:
- Reddit threads (r/autism, r/AutismInWomen, r/ADHD, r/SensoryProcessing, r/Autism_Parenting,
  r/AutisticAdults, r/aspergers...), and other forums;
- autism and ADHD organisations' and occupational therapists' lists;
- products made for sensory needs (tagless and seamless clothing, adaptive lines, ear defenders...).

Prefer products **sold in Canada** (a Canadian store, or a maker that ships to Canada). Prefer specific
products (one item or one line) over whole brands, and well-known, still-sold products over obscure ones.
Avoid medical claims, supplements, anything sold as a treatment or cure, and anything unsafe for children.
No two entries for the same product.

## Step 2: check each one on its own pages

Fetch the product's page on its maker's site (or the main seller's page), and anything else you need (a
Canadian store's page, the shipping page). Every field comes from those pages. Never invent; never copy
marketing superlatives.

Entry (all keys required, nothing extra):

    {"slug": "loop-engage-earplugs", "name": "Loop Engage", "brand": "Loop",
     "category": "sensory-sound",
     "description": "1 to 3 plain sentences in our own words: what it is and who it suits.",
     "qualities": ["noise_reduction", "discreet", "sold_in_canada"],
     "quality_evidence": {"noise_reduction": "<exact quote>", "discreet": "<exact quote>",
                          "sold_in_canada": "store:https://www.example.ca/..."},
     "values": {"noise_reduction_db": "16", "material": "silicone"},
     "price": 49.95, "currency": "CAD",
     "price_note": "Price on loopearplugs.com on 18 October 2026",
     "maker_url": "https://...",
     "buy_links": [{"label": "Loop", "url": "https://..."}, {"label": "Best Buy Canada", "url": "https://..."}],
     "community": [{"label": "Recommended in r/autism", "url": "https://..."}],
     "evidence": "<an exact quote, 5 to 40 words, from the maker's page, showing what it is>",
     "notes": "1 to 3 sentences for a reviewer.",
     "_sources": ["<URLs given to fetch.py whose text holds the evidence, qualities and price>"]}

- **name**: as the maker names it. **brand**: the maker.
- **category**: exactly one of the 40 category ids.
- **qualities**: only qualities the pages support. Each one needs a **quality_evidence** entry: an exact
  short quote from the kept pages (copy it from show.py). For `sold_in_canada` you may instead write
  `"store:<url>"` with the URL of a Canadian store page in `buy_links` (a `.ca` store, or one the
  checker knows, such as amazon.ca, indigo.ca, well.ca, the App Store or Google Play), or a quote such as
  "We ship to Canada". `for_adults` / `for_children` need a quote too (sizes, ages, "for adults"). Fewer,
  well-supported qualities are better than many guessed ones.
- **values**: only the keys in taxonomy.json `values` (noise reduction in dB, weight in kg, ages, pages,
  running time, rating, chew strength, material), as short strings, from the pages. `{}` is fine.
- **price**: the number shown on a kept page (the checker looks for it, e.g. "49.95"), with its
  **currency**. Prefer a Canadian price in CAD. If the price isn't on a page you can fetch, or varies (food,
  books, films), use `null` and `null`, and say why in **price_note** ("Prices vary by store",
  "Free with in-app purchases", "Rent or buy; streaming varies"). Free apps: price 0, currency "CAD".
- **maker_url**: the product's own page on the maker's site (one of `_sources`, or where it redirected).
- **buy_links**: 1 to 4 places to get it, each fetched with fetch.py: the maker, a Canadian store, the App
  Store or Google Play for apps, the publisher or a bookstore for books, where to watch for films and
  series. Label each with the store's name.
- **community**: 0 to 2 links to where people recommend it (a Reddit thread, a forum), each fetched with
  fetch.py and loading. Never quote people from them. `[]` is fine.
- **evidence**: a short exact quote from the maker's page.
- **notes**: anything a reviewer should know (sizes or ages, a recall, Canada availability, a subscription).

Drop (into `unverified`, with the reason) anything you can't confirm: the page is gone or blocked, it
isn't sold any more, it isn't available in or shipped to Canada and has no Canadian seller, or it makes
medical claims.

## Draft file

`S/drafts/<your file>.json`, exactly:

    {"topic": "products_<your part>", "checked": "2026-10-18", "entries": [...], "unverified": [...]}

Build it with a small Python script if that is easier (keep scripts in `S/drafts/work_<your part>/`).
Valid UTF-8 JSON; keep pages' own characters (curly apostrophes) in quotes. **Save the draft as you go**
(every few products), so no work is lost. Run check_products.py until 0 errors; read the warnings.

## Your report

Under 250 words: per category, how many kept; anything a reviewer should look at (prices in USD,
products that need checking by hand, borderline choices). Do not paste the JSON.
