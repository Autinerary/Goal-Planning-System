# October campaign: links and QR codes

Riipen Labs' Group 5 recommended one thing above all: "build a clear path
from the October campaign to app sign-ups". They found the campaign had "no
defined connecting awareness touchpoints to activation", and that "marketing
and tech teams [need] to agree on a clear call-to-action".

## The call to action

Use the same words everywhere (merch, the comic, research posts, social):

> **Find neurodivergent-friendly resources in two questions.**
> Scan the code, or go to `app.autinerary.ca/c/<code>`.

Every link opens **Start here**: two quick questions, then a few starter
resources and "Save this path", which is the free account. Nothing to sign
up for before people see something useful.

## The links

Each short link is tracked: the funnel report shows how many visitors,
accounts and returns came from each (`python -m scripts.onboarding_funnel`,
from `backend/`, "By channel").

| Where | Short link | Opens | QR code |
| --- | --- | --- | --- |
| Merch | /c/merch | Start here | [merch.svg](qr/merch.svg) |
| The comic | /c/comic | Start here | [comic.svg](qr/comic.svg) |
| Research posts and papers | /c/research | Start here | [research.svg](qr/research.svg) |
| Community partners and role models | /c/partners | Start here | [partners.svg](qr/partners.svg) |
| Facebook (parents) | /c/facebook | Starter information for parents, with a line on privacy under "Save this path" | [facebook.svg](qr/facebook.svg) |
| TikTok (adults) | /c/tiktok | People with similar experiences, starting with Tidbits | [tiktok.svg](qr/tiktok.svg) |
| Reddit (adults) | /c/reddit | People with similar experiences, starting with Tidbits | [reddit.svg](qr/reddit.svg) |

All are `https://app.autinerary.ca/c/...`. The Facebook, TikTok
and Reddit paths follow Group 5: "trust/safety for Facebook parents vs. peer
tools for TikTok/Reddit adults". People can change either answer.

An unknown code still opens Start here, so a typo is never a dead end. To
add a link, add a line to `frontend/lib/campaign.ts`.

## The address

The app's own address is `app.autinerary.ca`: an A record in Route 53
(`app`, pointing at Vercel's `76.76.21.21`), added to the goal-planning-app
project in Vercel. The old address, `goal-planning-app.vercel.app`, keeps
working, so links already shared still open.

## Before printing anything

**Printed codes cannot be changed.** Scan each printed proof with a phone
before the full print run. The codes use high error correction, so they
still scan when printed small or on fabric. Keep them at least 2 cm wide,
with the white border around them.

To make the codes again (for example after adding a link):

```
npm i --no-save qrcode
node scripts/campaign/make-qr-codes.mjs
```
