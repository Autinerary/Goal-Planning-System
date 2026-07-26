# Path Market + Onboarding — User Feedback Triage (Madhu)

**Source:** User test of the Path Market → "Start this path" → onboarding flow.
**Date logged:** 2026-07-25

Each item below is tagged **[Bug]**, **[UX/Product]**, or **[Answered]** (the code
already settles the question — no work needed, just a decision/comms point), with
priority and the exact code location.

---

## P0 — Choosing a pathway gives the *same* onboarding as "start your own path"

> *"I get the same questions and steps once I click 'Start Pathway' … felt redundant."*

**The actual complaint:** picking a themed pathway (Medicine & Science, Career &
Workplace, etc.) produces the **identical onboarding** as starting from scratch.
The pathways are not differentiated from the generic "start your own path" flow.

**[UX/Product] Root cause (confirmed):** *every* entry point routes to the same
`/onboarding` with the same 9 static steps. The only thing choosing a pathway adds
is a `seedGoals` prefill — otherwise Medicine & Science == Career == "start your
own path" == signup.
- All entry points push to the same route:
  - `frontend/app/path-market/page.tsx:159` (a pathway's "Start this path")
  - `frontend/app/path-market/page.tsx:236` ("start from scratch")
  - `frontend/app/signup/page.tsx:47` (signup)
- Per-pathway difference is *only* the goal seed:
  `frontend/app/path-market/page.tsx:152-160` → read at
  `frontend/app/onboarding/page.tsx:488-506`
- The 9 onboarding steps are a single static array with **no per-path branching**:
  `frontend/app/onboarding/page.tsx:99-109`

### Fix 1a (PRIMARY) — Tailor onboarding per pathway
This is what the feedback is asking for: a chosen pathway should *feel* different
from the from-scratch flow.
- **Proposed:** extend `PathTemplate` (`path-market/page.tsx:29-40`) with a
  tailored-questions / focus-step field, and branch the steps array so e.g.
  Career & Workplace surfaces disclosure + accommodation prompts, Medicine &
  Science surfaces prereq/research prompts, and "start your own path" keeps the
  generic set.

### Fix 1b (SECONDARY) — Carry over already-collected info (returning users)
Madhu's second suggestion ("carry over the information … so they don't repeat").
Onboarding restores a **localStorage draft** within a session
(`frontend/app/onboarding/page.tsx:478-510`) but there is **no backend prefill**.
A user who already has barriers / location / diagnostic profile saved re-enters
everything. `hasCompletedOnboarding` exists but only gates redirects.
- `frontend/app/context/AuthContext.tsx:34, 116-118`
- **Proposed:** on onboarding mount, if `hasCompletedOnboarding`, fetch the saved
  profile and prefill barriers/location/diagnostic; drop the user at the
  path-specific step instead of step 0.

**Recommended order:** 1a first — it directly answers the redundancy complaint.

---

## P1 — Performance: slow entering & scrolling

**[Bug — needs repro]** Market page itself is static (8 cards), unlikely culprit.
Likely source is the onboarding page's continuously-animating background: 5 stacked
`blur-3xl` + `animate-pulse` cloud layers force nonstop GPU repaints → scroll jank
on lower-end machines.
- `frontend/app/onboarding/page.tsx:966-973`
- **Proposed:** gate/reduce the animated blur layers (or `will-change` / reduce
  count / respect `prefers-reduced-motion`); confirm with a repro + profiler trace.

---

## P1 — Daily goal reminders (phone / email notifications)

> *"Can we send notifications to their phone number or email to remind them of
> their goals for the day?"*

**[UX/Product — new feature] Status: opt-in + storage groundwork DONE. Delivery
pipeline remaining.**

Built:
- Reminder opt-in in the onboarding Personalize step — enable toggle, channel
  (email/SMS), contact (email prefilled), preferred time, and an explicit consent
  checkbox. `frontend/app/onboarding/page.tsx` (step 7).
- `ReminderPreferences` type + defaults + time presets: `frontend/lib/preferences.ts`.
- Persisted through the existing preferences path to
  **`profiles.preferences.reminders`** (cross-device, no migration). Sanitized so a
  half-opted-in reminder (no consent/contact) is stored disabled. Honest UI note
  that delivery isn't live yet — no dark pattern.

Remaining (separate workstream, blocked on infra):
- A scheduler (cron) that reads `profiles.preferences.reminders` and sends at the
  chosen time.
- An email/SMS provider (SMTP / Twilio) + credentials.
- Optional: promote `preferences.reminders` (JSON) to a dedicated, indexed
  `reminder_preferences` table once the scheduler queries it at scale.

---

## Direct questions — the code already answers these

### [Answered] "Ask which medications specifically? Too confidential?"
Current design deliberately avoids specifics — a single
yes/no/prefer-not-to-say, and **medication history + diagnosis status are never
sent to the AI** (only a bounded functional-support context is).
- `frontend/app/onboarding/DiagnosticProfileSection.tsx:181-184, 231`
- Enforced at submit: `frontend/app/onboarding/page.tsx:817-819`
- **Decision point:** keep as-is (recommended for privacy). Her instinct matches
  the existing guard.

### [Answered] "How is the 'how often do you use apps' data used?"
It's `techSavvy`, and it actively caps UI complexity:
`not_at_all` → cap 1, `somewhat` → cap 2.
- `frontend/lib/preferences.ts:100-102, 148-149`
- **Action:** optionally add a one-line in-context explainer so users see why
  it's asked.

### [Answered] "Is this only accessible through a laptop?"
No — responsive web app (Tailwind `sm:`/`md:` breakpoints throughout), works in a
mobile browser. No native app yet.
- **Action:** none required; comms point only.

---

## Suggested sprint slice
1. **P0 Fix 1a** — per-pathway tailored onboarding (directly answers the complaint).
2. **P1** — onboarding background repaint fix (quick, high perceived-quality win).
3. **P0 Fix 1b** — backend prefill / carry-over for returning users.
4. **P1** — notification opt-in + daily reminders (larger, own workstream).

---
---

# Round 2 — User Feedback Triage (Eliyana)

**Source:** Broader app test — onboarding, roadmap, milestone view, personalities, matching.
**Date logged:** 2026-07-25

Overarching theme (Eliyana): *"after onboarding, the roadmap, personalities, and
matching with people start to get confusing… don't want features to get lost or
overcomplicate the app."* Bias every decision below toward **less at once**.

---

## P0 — [Bug] Mobile milestone view layout broken — FIXED

> *"this is the milestone mobile view, apparently not supposed to look like this…"*

**Root cause:** the Tools/Barriers unified table used `grid grid-cols-1 md:grid-cols-2`
on both the header row and every data row (`frontend/app/milestones/page.tsx`). On a
narrow screen the grid collapsed to one column, so both column headers stacked at the
top disconnected from their cells, and each row's tool + barrier stacked — tools and
barriers interleaved with no labels.

**Fix (done):**
- Split headers now `hidden md:grid` (desktop only); mobile gets one combined
  "Tools & Barriers" header.
- Each cell shows a mobile-only label ("Tool to use" / "Barrier to unlock") so stacked
  pairs are self-explanatory.
- Empty placeholder cells are `hidden md:block` so mobile doesn't show dangling boxes.
- Desktop layout unchanged. Typechecks clean. (Visual QA on a device still recommended.)

---

## Theme — [UX] Progressive / simpler-by-default experience

> *"start out the app with a simple view (then maybe it progresses as you spend more
> time) so it doesn't overwhelm."*

Groundwork exists: `computeEnergy()` in `frontend/lib/preferences.ts` already **caps
visual energy** by age + tech comfort. What's missing is a *time/usage-based*
progression (unlock complexity as the user returns). That's a new mechanic (track
usage → raise a disclosure level → gate features), moderate size.

### [Quick win] Cut fast/slow spirit animals in simple view
> *"think about cutting the fast and slow day spirit animals for simple view."*

Onboarding offers three modes — general (1), fastSlow (2), weekly (7)
(`frontend/app/onboarding/page.tsx`, `spiritAnimalModes`). In a simple/low-energy view,
only offer "one spirit animal." Bounded, low-risk — a good first simplification.

---

## Built in this batch

- **Progressive disclosure** — `frontend/lib/disclosure.ts` (new). App starts SIMPLE and
  opens up over distinct-days used (simple → standard → full), with a manual override.
  Visits recorded app-wide in `AccessibilityProvider`. Path view has a **Show more /
  Simplify** toggle.
- **Cut fast/slow spirit animals in simple view** — onboarding hides fast/slow + per-day
  modes behind a "Show more options" expander in simple view (`app/onboarding/page.tsx`);
  the Path header shows a single guide instead of the fast/slow pair (`app/path/page.tsx`).
- **Streaks (with depth)** — `frontend/lib/streak.ts` (new) + `StreakBadge.tsx` +
  `StreakCelebration.tsx` (new). "Active" = **completing a task** (recorded in
  `app/tasks/[id]/page.tsx` `handleDone`, not app-open). **Freezes** auto-bridge a fully
  coverable missed day (earned +1 per 7-day milestone, capped at 5). **Milestone
  celebrations** at 3/7/14/30/60/100 days fire a full-screen overlay. Badge shows current
  streak + banked freezes.
- **First-run intro with microphone** — `app/components/FirstRunIntro.tsx` (new), mounted
  on the Path (first post-onboarding screen), shown once. Scripted 5-step walkthrough that
  **narrates via TTS** (SpeechSynthesis, toggleable) and takes **voice commands via a mic
  button** (SpeechRecognition: "next/back/skip/start"). Both speech features degrade
  gracefully (control disabled + tooltip) where unsupported; on-screen buttons always work.
- **Hare & tortoise task companions** — `app/components/TaskCompanions.tsx` (new). Fixed
  top-corner 🐇 + 🐢 that gently "dance" while you work a task and speed up on completion
  (the "two things at once" ADHD focus aid). Dismissible; CSS-animated so it respects
  `data-reduce-motion`.
- **Pit Stop cart** — already used a 🛒 cart with no "merchant" in code; leaned the copy
  further into the cart metaphor (`app/pit-stop/page.tsx`).

## Still open (smaller follow-ups)

- Cross-device sync for disclosure + streak state (currently localStorage, like the rest of
  the client prefs before their server hydrate).
- Streak "active" could also count other meaningful actions (milestone completion,
  reflection) — today it's task completion only.

---
---

# Round 3 — Calendar / Milestone / Pinwheel Feedback (Odosa, Liam)

**Date logged:** 2026-07-25. All items below are implemented (frontend typechecks clean).

- **Motivation message — prominent + changes each visit** — `app/path/page.tsx`. Reshuffles
  on every mount (per-visit seed, not daily) and renders as a large banner instead of small
  italic.
- **Milestone Tools/Barriers → collapsible dropdown** — `app/milestones/page.tsx`. A toggle
  bar ("Tools & Barriers · N tools · N barriers", chevron) collapses the whole table to slim
  the page. Default expanded.
- **Calendar Day/Week/Month toggle** — `app/calendar/page.tsx`. New period selector under the
  Low/Balanced/High energy buttons. Day = single day; Week/Month = full pattern (Month notes
  that the weekly pattern repeats — true day-by-date scheduling is a follow-up).
- **Calendar 24-hour time options** — `app/calendar/page.tsx`. The time picker is now a
  scrollable listbox of 00:00–23:00, hour by hour (was 09:00–17:00 only).
- **Wishlist didn't update in ResourceHub** — `app/api/me/resource-status/route.ts` +
  `app/milestones/page.tsx`. Root cause: milestone tools often lacked a real ResourceHub UUID,
  so the save silently no-op'd (or hit an FK error). Now the server resolves the tool to a real
  resource (verify UUID exists, else match by `resources.name`) before saving, so it shows up in
  ResourceHub. When a tool isn't catalogued, the UI reverts the optimistic state and shows an
  honest note instead of a fake "wishlisted" state. NEEDS DB/device verification.
- **"Under Construction" page** — `app/under-construction/page.tsx` (new). Friendly placeholder
  with optional `?feature=` label. Path Market "Coming soon" cards now route here instead of
  being dead buttons.
- **Summary below the progress bar (milestone view)** — already in place
  (`app/milestones/page.tsx` renders Summary immediately under the progress bar); no change
  needed.

Caveats: not visually verified (can't run the app here). The wishlist fix depends on the tool
name matching a catalogued `resources.name`; tools with no catalogue match still can't be added
(by design — they're not real resources). Calendar Month is a pattern view, not date-based.

---
---

# Round 4 — Settings/Task/Memory Feedback (Odosa, Eliyana)

**Date logged:** 2026-07-25. All items implemented (frontend typechecks clean, 0 errors).

- **Interactive Tour now actually explains things** — `app/components/InteractiveDemo.tsx`.
  Each step opens with a general description of the page ("This is the Paths View…") then
  lists what the key buttons do ("Compare — compare saved versions of your path…"). Covers
  Path, Races, Milestone, Calendar, Pit Stop, Journal, Settings.
- **Orange-white moving tab bug** — `app/tasks/page.tsx`. The striped awning used
  `animation: striped … infinite` (a constantly scrolling orange/white gradient) → read as a
  glitchy moving tab. Made static; removed the now-dead `striped` keyframe from both task pages.
- **Motivation wheel repetition** — `app/races/page.tsx`. The motivation is now picked once at
  the start of each day and stays stable (keyed by date), instead of a fresh quote every visit.
  Spinning still works to change it on purpose.
- **Add memory** — `lib/memory.ts` (new), `app/memory/page.tsx` (new), nav link.
  - *Messages to your future self*: write "keep doing good" / "do better" notes; listed with
    dates, deletable.
  - *Typical pattern & best day*: a per-weekday bar chart + "best day" derived from the days
    you've completed tasks (`getWeekdayStats` in `lib/streak.ts`), so you know what to aim for.
- **Videos / Progress Reels (long-term)** — nav entry added, routing to the Under Construction
  page (`?feature=Progress Reels`). Honest placeholder; the real reels/posts feature is a
  separate future build.
- **Summary below the progress bar (milestone view)** — already in place; confirmed, no change.

Calendar image items (Odosa) — Day/Week/Month toggle + 24-hour time — were delivered in Round 3.
The "Older/Younger Adult · Computer/Mobile" comment rows were placeholders ("…") with no
specific ask.

Caveats: not visually verified (can't run the app here). Memory notes + streak/pattern data are
localStorage (not cross-device yet). Progress Reels and true date-based calendar scheduling
remain future work.

---
---

# Round 5 — Notifications + De-hardcoding sweep

**Date logged:** 2026-07-25. Frontend typechecks clean (0 errors).

## Notification system (cross-device) — DONE
- `lib/notifications.ts` (new): in-app notification store (localStorage) + Web Notifications
  API (permission request, OS notifications), dedupe keys.
- `app/components/NotificationBell.tsx` (new): bell + unread badge + dropdown, mounted in the
  nav. Offers to enable browser notifications; drops a once-a-day "today's goals" nudge for
  users who enabled reminders.
- Wired: task completion + streak milestones push notifications (`app/tasks/[id]/page.tsx`).
- Works on laptop + Android/phone browsers. iOS Safari needs the app installed to the home
  screen (PWA) for OS notifications; the in-app center works everywhere. True push while the
  app is CLOSED needs a service worker + server push (separate workstream).

## De-hardcoding — "wire to real backend, no placeholders" (user-confirmed approach)
Real data comes from `AgentPathContext` / `/api/me/path` (Supabase user_paths) / FastAPI. The
sweep removes demo fallbacks and shows honest loading/empty/CTA states instead.

Done:
- **Task list view** (`app/tasks/page.tsx`): removed FALLBACK_TASKS/GOALS; real data only +
  empty CTAs; guarded progress math.
- **Milestone view** (`app/milestones/page.tsx`): removed demo races/tools/barriers; added
  loading + "no milestones" + "no tools/barriers" states; guarded divide-by-zero.
- **Path view** (`app/path/page.tsx`): removed demo races ("Graduate University" etc.); added
  empty-races CTA. People/mentor section kept as a feature, now labelled **Sample** (matching
  isn't wired to live data yet — user chose to keep it).

Remaining de-hardcode (same approach, queued):
- `app/races/page.tsx` — demo races + milestones.
- `app/calendar/page.tsx` — demo schedule blocks + "Race 1: Graduate University" + mentor schedule (label as sample).
- `app/milestones/[id]/page.tsx` — fully static demo milestone/tools.
- `app/tasks/[id]/page.tsx` — static `todaysTasks` list (wire to agent tasks).
- `app/pit-stop/page.tsx` — demo mentors + community groups (mentors → Sample label).
- `app/onboarding-confirmation/page.tsx` — demo mentors.
- `app/recommend-choices/page.tsx` — demo choices.

---
---

# Round 6 — De-hardcoding sweep COMPLETE

**Date logged:** 2026-07-25. Frontend typechecks clean (0 errors).

All remaining views now use real agent output (no demo fallbacks); absent data shows honest
loading/empty states, and the People/matching feature is kept but clearly labelled Sample.

- **tasks/[id]** (the "0/5 tasks" screen) — was 100% static mock; now wired to the agent's real
  task list (same source as the Tasks list), with an empty state.
- **races** — removed "Graduate University"/"Get Tech Job" demo; added loading + "no races"
  empty state. Role-model comparison (`comparePeople`) kept + labelled **Sample**.
- **calendar** — removed mock schedule fallback (empty state instead); "Race 1: Graduate
  University" now uses the real race name; mentor "Their Day" labelled **Sample**.
- **milestones/[id]** — deleted the entire `mockMilestones` catalogue (~245 lines); real agent
  milestone or a minimal stub (no fake tools).
- **pit-stop** — People/Hare World section now shows a **Sample** banner (connections are
  real-fetched; groups/metrics are examples until matching is live).
- **onboarding-confirmation** — role models/mentors labelled **Sample**.
- **recommend-choices** — deleted `mockChoicesByService`; real agent recommendations only
  (existing "No choices found" empty state covers absence).

### Net effect
Nothing fake renders as if it were real. After onboarding with a working backend, every view
shows real agent output. Without agent data, views show loading/empty/CTA states. The only
intentionally-retained sample content is the **People / mentor matching** feature, which is now
explicitly badged "Sample" everywhere it appears (per product decision).

Still not verified end-to-end (can't run the app here) — the agent-output SHAPE vs what each
view reads should be confirmed with a real onboarding run.

---

# Round 7 — Backend fix: real races per goal (synthesis engine)

**Date logged:** 2026-07-25.

**Bug (pre-existing backend stub):** `synthesis_engine._build_races` returned a single
hardcoded race `{id: 'race_1', name: 'Main Goal'}` with ALL milestones dumped in, ignoring
the user's goals — and its `race_1` id collided with the planner's `raceId` for goal #1,
mis-attributing progress.

**Fix:** `backend/core/synthesis_engine.py` + one-line orchestrator change.
- One race per goal: milestones grouped by the `raceId`/`goal` fields the path-planning
  agent already stamps on every milestone (no inference).
- Races named by the user's actual goal text; goals with zero milestones still get a race.
- Legacy payloads without `raceId` group by goal text; empty input → empty races (no
  fabricated "Main Goal").
- `path.races` + `path.milestones` now carry real data (compare/friend views read these);
  dropped the unused hardcoded `motivationWheel` stub.
- Orchestrator passes `state.goals` into `synthesize()` (adaptation path unchanged).

**Verified:** 5-case unit run against the real venv (grouping, empty-goal races, legacy
shape, empty input, adaptation untouched) — all pass; py_compile clean.

**Deploy notes:**
1. The Render backend must be redeployed for this to take effect.
2. Already-generated paths in `user_paths` are snapshots — they keep the old "Main Goal"
   race until the user regenerates (re-onboard / reset path). New onboardings get real races.

---

# Round 8 — Live 6-agent verification + critical quality-gate bug fix

**Date logged:** 2026-07-25. Ran the REAL production pipeline locally (OpenAI gpt-4o-mini,
APP_MODE=production, full onboarding-shaped payload incl. support context; no user_id passed
so zero Supabase writes).

## Bug found by the test (would have shipped): goals 2..n lost all milestones
`output_quality.ensure_generation_quality` deduped milestone names GLOBALLY. Goals share the
same 4 life dimensions, so later goals' same-named milestones were silently deleted —
48 milestones for 3 goals collapsed to 16, all from goal 1; races 2 and 3 rendered empty.
**Fix (backend/core/output_quality.py):** dedupe per goal (raceId scope); per-goal template
backfill for goals with zero milestones (instead of nuking everything); per-milestone task
padding (real tasks never discarded). Unit-tested + live-verified.

## Live results (all 6 agents)
- Generation 9.0s: 48 milestones (16/goal), 240 tasks (0 orphans), 288 tool recs keyed
  correctly by milestone id, 7-day schedule with worst/average/best scenarios, races named
  by the user's actual goals. Quality report: usedFallback=false, 0 backfilled.
- Content quality: genuinely personalized — milestones reference the support context
  (written instructions, visual schedules, 10-min chunks, quiet spaces). No garbage markers.
- Reflection agent: correct negative sentiment (0.3) on a rough-week reflection; sensible
  recommendations (meal reminders ← "skipped meals"); celebration item present.
- Adaptation agent: structurally correct; applies 0 adaptations without progress data
  (by design — the reflections route supplies completion data in production).

## Honest remaining items
- Hardcoded-but-intentional (all labelled "Sample" in UI): People/mentor matching content in
  path, races, pit-stop (incl. groups/match profiles), onboarding-confirmation; calendar
  mentor "Their Day". Product copy (tour scripts, goal-suggestion chips, path templates) is
  content, not mock data.
- Product polish (not garbage, but formulaic): task names follow 5 fixed stage patterns
  ("Research and gather information: <milestone>"). Reflection insights' what_works/
  what_doesnt_work sometimes empty. Pattern agent finds 0 similar users until the user base
  grows (cold start, expected).
- Local-only noise: "ServiceHub unreachable" (localhost:3001 not running here — Render env
  points at the deployed hub); pattern agent's Supabase pkg missing in local venv only
  (requirements.txt has supabase>=2.5.0 for Render).

Full payloads for eyeballing: /tmp/agent_live_llm_output.json, /tmp/agent_shape_test_output.json.

---

# Round 9 — No fake people anywhere + agent polish + pattern-RPC prod bug fix

**Date logged:** 2026-07-25. Frontend tsc: 0 errors; backend py_compile clean; all changes live-verified.

## Fake people fully removed (real connections everywhere)
Real source: `/api/connections` (Supabase `social_connections`) + `/friend/[id]` (real shared view).
- **path** — "Your People" card now fetches real connections; links to /friend/{id}; empty-state CTA. Sample badge gone.
- **races** — deleted the ~300-line `comparePeople` fake compare UI; compare now lists REAL connections routing to their real /friend page; honest empty state per category.
- **calendar** — deleted fabricated "Their Day/Week" schedules; comparison lists real linked mentors/role models → /friend page; honest empty state.
- **pit-stop** — connections start empty (API populates); removed invented rating/modelCount metrics; rival/mentor-task/support feeds + collab groups + match profiles start empty with honest "nothing yet" states; "Start Matching" honestly says suggestions are coming (needs the similarity backend).
- **onboarding-confirmation** — rewritten: real agent plan summary + "meet people in Hare World" CTA. The old fake two-step wizard (choices were never saved) is gone.

## Agent output polish (live-verified with real OpenAI)
- **Task names** (`path_planning_agent.py`): LLM now writes 5 specific sequential tasks per milestone ("Email the disability office for the form" style). Verified: 160 tasks, 0% formulaic, durations sane, 0 orphans. Templates remain as no-LLM fallback.
- **Reflection insights** (`reflection_analysis_agent.py`): LLM extracts what_works/what_doesnt_work/recommendations grounded in the actual text; keyword rules only fill gaps. Verified on a mixed reflection: what_works=["Body doubling…helped complete the accommodation form"], what_doesnt_work=[sleep, meals, noise-driven avoidance].

## Production bug found & fixed: pattern agent ALWAYS returned 0
`find_similar_pattern_users` has two overloads in Supabase; the agent omitted `query_user_id`,
making every call ambiguous (PGRST203) → silent fallback to 0 patterns, in prod too.
Fix (`pattern_recognition_agent.py`): always pass all five args (None → NULL keeps legacy
semantics). Live-verified against real Supabase: now retrieves 5 real similar users.
Optional cleanup migration: drop the legacy 4-arg overload.

## Env noise
- Tool agent: ServiceHub circuit breaker — logs unreachability once per run instead of per-milestone.
- Local venv synced with requirements.txt (openai + supabase now installed locally).
