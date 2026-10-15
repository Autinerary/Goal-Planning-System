# Release checks

Riipen Labs, Group 30 (September 2026): "Errors during first use break
momentum and trust. This is a process issue: changes reach testers without a
consistent check." These are the checks every change gets, and the ones to
run by hand before a release that touches sign-up, setup or the Path.

## On every change (automatic)

`.github/workflows/checks.yml` runs on every push to `main` and every pull
request. A red run means the change should not reach testers until it is
fixed. Vercel and Render still deploy from the push, so look at the run
before telling testers about a change.

| Job | What it checks |
| --- | --- |
| App | `tsc --noEmit`; the unit tests in `frontend/lib/*.test.mjs` (places, path privacy, the "Complete your profile" rules, reminder dates); `next build` |
| ResourceHub | `tsc --noEmit`; `next build` (with placeholder public values) |
| Backend | `python -m unittest discover -s tests` (300-odd tests, with fakes for the database and the AI) |

No secrets are used, so it runs the same on the public and the private copy
of the repository. To run the same locally:

```sh
cd frontend && npx tsc --noEmit && for t in lib/*.test.mjs; do node --experimental-strip-types "$t"; done && npx next build
cd ../servicehub-mvp && npx tsc --noEmit
cd ../backend && ./venv/bin/python -m unittest discover -s tests
```

(`tsc` and `next build` rewrite `frontend/tsconfig.tsbuildinfo`; don't commit it.)

## Before a release that changes the first session (by hand)

1. **Sign up on a phone and on a laptop.** The "Create your free account"
   button should be on the first screen at 1280 by 720 and on a phone, and
   the browser should offer to fill in the fields. (Group 25: testers could
   not reach the end of sign-up.)
2. **Do setup three ways**: the two questions, "Skip setup for now" and
   "Skip to resources" (as a parent it should open the starter kits). Try the
   energy check-in's "Not much" and "Plenty". Then check the Path: your next
   step, Quick Links, Display, and "Complete your profile".
3. **Make a second plan** from the Path with an account that has norms and
   settings saved, and check nothing it had is gone (Settings, your norms in
   ResourceHub). This is where the October data-loss bugs were.
4. **Open "How it works"** on a few pages (it should explain the page and
   leave it usable), then **take the tour** from it, trying each task once.
5. **Open ResourceHub from the app** and save a resource: no second sign-in,
   and no token in the address bar.
6. **Turn on Soft colours and Words we use** (Display, then Settings), make
   a plan, and read it: the colours should be calmer at once, and the plan
   should use the words chosen. On a 375-pixel phone the top bar should be
   one row. (Groups 15, 16 and 19.)
7. **Ask for the first two weeks' emails** on a new account, then open a
   Tidbits post with a content note: the note should show first, and the
   post only when chosen. (Group 15.)
8. **On a phone, go through setup**: the first question shows without
   scrolling, and "Continue" opens the goal step at its card with the goal
   ideas on screen. On the home page, go through "A look inside" with the
   keyboard (arrow keys move between the screens). (Groups 12 to 14.)
9. **Run the accessibility checker** against the build:
   `node scripts/qa/check-accessibility.mjs` (see its header for the
   signed-in pages, ResourceHub's included). It exits 1 on a serious or
   critical problem.
10. **Look at the funnel report** after the first testers
   (`python -m scripts.onboarding_funnel` in `backend/`), comparing the new
   onboarding version with the one before.

The browser suites used for each Riipen Labs round live outside the
repository (they sign in with the QA accounts); the doc for each round says
which ran, for example [groups-25-30.md](groups-25-30.md).
