# How Autinerary looks

Riipen Labs' Group 18 found that the app looked "visibly AI-generated":
"heavy emoji usage", "cluttered layouts" and features labelled "AI
recommendations" made it feel "impersonal" and less trustworthy, for people
deciding whether to share sensitive information. They asked for a visual
audit, and "a design guide so any future features maintain the same feel as
previous features". Group 16 asked for fewer colours and a calmer look, with
colour options for people who need them. This page is that guide. The words
are in [voice.md](voice.md); this is how things look.

Check new screens against W3C's guidance for cognitive accessibility,
[Making Content Usable for People with Cognitive and Learning Disabilities](https://www.w3.org/TR/coga-usable/),
and run `scripts/qa/check-accessibility.mjs` before a release.

## Rules

1. **Icons, not emoji, where people first meet Autinerary.** The home page,
   Start here, sign-up, setup, the page after setup, the tour and the Path's
   first screen use plain line icons (lucide), each one saying what the thing
   is: a map for a plan, a lightbulb for ideas, speech bubbles for Tidbits.
   Emoji stay where they are the content: spirit animals, avatars, memes, and
   the game-like screens (Races, Pit Stop, Hare World), which "Plain" look and
   Soft colours calm.
2. **No decorative sparkles.** A sparkle says "AI made this" on most of the
   web, so it is never decoration here. If something needs an icon, use one
   that names it.
3. **Say AI where it works, once, plainly.** Label things by what people get
   ("Suggestions for each step", "How your plan was made"), and say where AI
   wrote something on that page: "Written with AI from your goal", with a link
   to "How Autinerary uses AI" (`/help#ai`). No "AI-Generated" badges. The
   goal helper keeps its "AI helper" label, because that is the step where AI
   works.
4. **One action colour, and choices.** Actions use the indigo classes, which
   the colour theme turns into the theme's main colour: **Earthy** (forest
   green and watery blue) by default since October 2026, or Ocean, Sand or
   Classic (the original indigo), in Settings and Display, in both apps
   (`app/themes.css`, built by `scripts/themes/build-themes.mjs`; every theme
   keeps each pairing's contrast). Greens, ambers and reds are not themed:
   they mean done, careful and wrong. Display also offers light or dark,
   higher contrast, **colour strength** from softest to brightest (softer is
   what Soft colours was: every colour, emoji and pictures included) and calm
   motion, on every page before an account and inside the app. Colour never
   carries meaning on its own: a tick or a word goes with it.
5. **One thing to do first.** One filled button per screen, named for where
   it goes; everything else is an outlined button or a link (Groups 31 and
   33). Long parts are folded, with a plain summary ("How your plan was
   made", "Four more about setup").
6. **The app's own words, explained where they appear.** Path, milestone and
   norms are tapped open beside the word (`components/Define.tsx`,
   `lib/terms.ts`), and the glossary (`/help`) has the long versions.
7. **Nothing moves by itself.** No looping animation; Calm motion stops the
   rest. A celebration is short and can be closed.
8. **Same layout everywhere.** One page-title style (`text-2xl sm:text-3xl
   font-bold text-slate-900`), the same top bar on a phone and a computer,
   44-pixel touch targets, and on a phone the top bar's icons are 20 pixels
   with their names under them.

## The audit, 14 October 2026

Emoji and sparkle icons in the code of the screens people meet first (the
home page, Start here, setup, the page after setup, the tour and the voice
intro, the Path, Quick Links, the notification bell, the reminder email, the
journal's history and the suggestions page):

| | Before | After |
| --- | --- | --- |
| Emoji | 48 | 14 |
| Sparkle icons | 18 | 5 |

What went: the tour's and the voice intro's emoji (now icons), the confetti
on the page after setup, the emoji in the reminder email and notification
("🎯", "🔥"), the area emoji in setup, the "AI-Generated" badge, an unused
list of role emoji in setup's code, and the sparkles beside the Path's
links, Quick Links, the plan summary, setup's ideas and the home page.

What stays, and why: the bunny on setup's progress rail (the one playful
touch Group 9 asked to keep, now always whole); spirit animals and avatars
(chosen by the person); the notification bell's one marker; sparkles on the
suggestions page's section headings and the journal's history (both behind
an account, inside the app, for a later pass).

Across the whole app there are about 400 emoji in the code, most of them in
Races, Pit Stop and Hare World, the game-like screens shown in Full View.
They are the next pass, with a designer: Group 18 suggested "a UI/UX
designer ... to lead the redesign and visual audit".
