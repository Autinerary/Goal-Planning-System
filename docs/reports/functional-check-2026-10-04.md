# Functional check, 4 October 2026

Riipen Labs (Group 3) recommended "a functional and outreach check to make
sure all navigation items and links are functional on both desktop and
mobile", after finding a broken Facebook button, and a check of "the links
and controls, accessibility settings". This is that check, and what was fixed.

## What was checked

- Both apps (Autinerary and ResourceHub), signed out and signed in with a QA
  account, at desktop (1280 px) and phone (390 px) widths: 86 page views,
  with menus opened.
- Every link on those pages (251 different addresses): where each one ends
  up, after redirects.
- Every button: whether clicking it does anything.
- Every accessibility setting: whether it changes the page, survives a
  reload, tells screen readers its state, and resets.

## What was broken, and what happened

| Found | Where | Done |
| --- | --- | --- |
| The Facebook button goes nowhere: the link is `facebook.com/profile.php?id=100090773986522/`, with a stray `/` after the page number | The www.autinerary.ca website, which is a separate project (Next.js on AWS), not in this repository | **Still to fix in that site's code:** change it to `https://www.facebook.com/profile.php?id=100090773986522`, then open it once in a browser to confirm it is the right page. Instagram and TikTok links there work. |
| "Visit Resource" on the Tools page linked to `http://localhost:3001/...`, which only works on a developer's computer | Paths generated while the backend's `SERVICE_HUB_URL` setting was not set | Fixed in the app: those links now open ResourceHub, including in paths already made. `SERVICE_HUB_URL` was then set on Render, and a path generated afterwards had no localhost links (138 ResourceHub links). |
| "Learn More" on the Path did nothing | The "Unlock Multi-Path Management" card | Replaced with a card that says what exists: parents and guardians manage a family member's path on the Family page, with a link to it. |
| ResourceHub's Connection type, Rare and Highly requested filters were ignored: every result came back | ResourceHub search | They now filter. Shop products no longer appear under filters only places have. When a filter that depends on ratings finds nothing, the page says why and offers to clear all filters. |
| "Large" appeared twice on the accessibility page (widget size and text size), so it was easy to pick the wrong one | Settings > Accessibility | Widget size now shows boxes, not "Aa"; every size and colour choice tells screen readers which is selected. All other accessibility settings worked. |
| One place's website has moved: `tvdsb.ca/SirIsaacBrock.cfm` returns "not found" | A school's record in ResourceHub | Left as is: the new address could not be found. Update the record when it is known. |

Every page loaded, and every navigation item worked on both desktop and phone.

## Also changed from Group 3's slides

- **Unfamiliar terms:** each themed name in Quick Links says plainly what it
  is (for example "Pit Stop: your tools and the people helping you"), and the
  Path's cards describe themselves.
- **Less on screen at once:** the Path's Simple view, the default, now opens
  with one "Your next step" card and the essentials; the other actions and
  cards (including Reset) wait behind "Show more".
- **A clear step one:** the home page starts with "Start here: who are you
  here for?". The answer shows what Autinerary does for that person, and
  setup starts with it already chosen. After setup, parents are pointed to the
  Family page and allies to community questions and answers.
- **Where people came from:** the optional questions after setup ask where
  they heard about Autinerary, alongside the tracked links.
- **Measures:** the funnel report (`python -m scripts.onboarding_funnel`)
  now shows returns within 7 and 14 days, and how long after sign-up people
  mark their first step done.

## How to repeat it

From the repository root, with Chrome installed:

```
npm i --no-save puppeteer-core
QA_EMAIL=... QA_PASSWORD=... node scripts/qa/check-links.mjs
```

It prints pages that did not load, broken links and buttons that do nothing,
and saves everything to `check-links-result.json`. One known false alarm: a
link that redirects to the other app (ResourceHub's "Privacy Policy") shows as
`fetch-error`; check those in a browser.
