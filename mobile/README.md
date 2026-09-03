# Autinerary mobile

Native app, built for one thing the web cannot do: a **floating mascot that
sits over other apps**, showing the task you are on, draggable anywhere, tap
to come back.

A web page cannot draw outside its own tab — that is a browser security
boundary, not something to engineer around. Hence native.

## Platform reality

| | Floating bubble |
|---|---|
| Android | Yes — `SYSTEM_ALERT_WINDOW`, implemented in `modules/floating-bubble` |
| iOS | **No.** Apple permits no app to draw over another. The equivalent is a Live Activity, which is a separate build. |
| Web / PWA / TWA | No. A TWA is a web view, so a Play listing via Bubblewrap gets none of this. |

## Running it

Requires a **development build** — Expo Go cannot load custom native code.

```bash
npm install
cp .env.example .env        # fill in the Supabase values
npx eas build --profile development --platform android
```

Install the APK, then `npx expo start --dev-client`.

Builds go through EAS because there is no local Android SDK or JDK on the
machine this was written on.

## What talks to what

Nothing here forks the backend. The app is a second client for the same
FastAPI service and the same Supabase project the web apps use:

- `lib/supabase.ts` — auth, session in AsyncStorage
- `lib/api.ts` — current task: the path comes from
  `/api/onboarding/user/{id}/path`, completion from `race_progress`

The payload shape in `lib/api.ts` was verified against the live endpoint,
not inferred — milestones hang off `races[]`, tasks off `schedule[]`, and
there is no `pathPlanning` key despite the web app's naming.

## Status

Verified: scaffold, auth, current-task derivation (checked against a real
account — it picks the same milestone the web trail shows).

**Not yet verified: the bubble itself.** The Kotlin has never been compiled;
there is no Android toolchain on the authoring machine. It needs an EAS build
and a device, and should be expected to need iteration.
