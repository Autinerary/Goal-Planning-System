# Autinerary Feedback: Implementation and Release Review

Local working-tree status, 2026-09-19. Not deployed or approved for release.
Existing user data and unrelated changes were preserved. No email was sent,
no live child accounts were created, and no environment files were changed.

## Follow-Up: Path Market, Races, Calendar

This follow-up is local and uncommitted. It has not been pushed or deployed.
The earlier feedback commits were pushed separately; this report does not
claim that the new changes are already available in production.

### Implemented

| Area | Change |
| --- | --- |
| Path Market selection | Unframed category sections and model choices open an accessible review dialog. Suggested goals start unchecked; only explicitly chosen goals are added. Pending models cannot start a path. Related Tidbit topic links cover resumes, cold emails, course selection and time scheduling. |
| Selection persistence | Draft restoration completes before autosave begins. Successful submission does not recreate the cleared draft. Cached goals, dreams and obstacles use the same flattened values sent for generation. Chosen-model metadata is included in generation preferences. |
| Requested pathways | Model Jet, Adulting for Neurodivs, Addictions, healthy eating, Veganism, separate health/education streams, Entrepreneurship x ADHD/Neurodiv, and relationship/community pathways are listed as awaiting content. No recovery, Public Health or entrepreneurship curriculum was authored. |
| ResourceHub options | Healthy Options / Eating Healthy and Veganism were added to its taxonomy. Depression already existed. This adds filter choices, not reviewed resource inventory. |
| Races | All selected goals remain represented even if the backend returns fewer races. Race identities match goal names, not response positions. Goals include linked-milestone progress and unanswered/solved Tidbit links. The shared stats/resources/Dream Self area precedes List or Track. |
| Track and avatar | Main track shows a sliding five-stop window, current-position label and tappable stops. Desktop Pit Stop/current options align beside the current stop; mobile stacks them. Local Dream Self/Character Select avatar replaces the AI portrait and stickman. Completion calls the existing sound-preference-aware helper. |
| People and stats | Removed fabricated social suggestions, challenge opponents and estimated stats from Race overlays. Saved/connected people remain intact. Missing live stats have an explicit empty state. |
| Gamification | Calendar and Settings share controls for 0-7 animals, general/fast-slow/weekday assignment, color swatches, yearly/monthly/weekday themes and 0-31 day-of-month themes. All four Calendar layouts display date-specific assignments. Missing assignments do not fall back to another day's animal. |
| Calendar history | Manual tasks, ICS imports, confirmed photo imports, rescheduling and weather moves share undo/redo persistence. Added-task completion and timestamps participate in history. Dates survive basic ICS round trips and photo imports. Undo deletion is authenticated and scoped to both owner and task ID. |
| Save behavior | Forms retain input on failure. Calendar changes wait for account hydration, caches/stacks are account-scoped, and competing saves report an error. Preference writes are ordered; stale hydration cannot overwrite current edits. Initial preference rendering no longer causes saved-settings hydration errors. |
| Weather | Opt-in browser location and Open-Meteo forecasts, rain warnings, rain/sunny preference, offered day moves and optional automatic matching. Location sharing is disclosed before enabling. Missing forecast probabilities are not treated as sunny. |
| Responsive layouts | Week/Month grids scroll within their own bounds on narrow screens; surrounding controls wrap. Main Race view transitions respect reduced-motion preferences. |

### Still Partial or Blocked

- Pathway selection changes goal suggestions and carries model metadata. A
  substantially different, model-authored milestone/resource plan is **not
  implemented or verified**. Approved source material and integration into
  planning are still needed. Placeholder pathway listings are not usable curricula.
- Tidbit links use topic text plus unanswered/solved filters. They are **not
  semantic similarity retrieval**, and relevant posts may not exist. Live
  authenticated ResourceHub handoff was not tested in this batch.
- The existing Avoidance view was not redesigned. Advanced alternate Race
  layouts remain available in Full View; the five-stop treatment is the main
  trail view. Existing saved people were not deleted to force a reported count.
- Weekly themes currently mean recurring weekday themes, not numbered weeks
  of the year. Fast/slow assignment reads schedule day-type labels; an unknown
  pace shows neither animal. Legacy animal IDs outside the current artwork set
  are not migrated. Color changes are approximate hue rotations.
- Weather moves only **undated user-added tasks**, not generated-plan tasks or
  dated appointments. Automatic matching runs in visible List/Time Block day
  panels, not a background scheduler. It changes the recurring weekday, not
  one isolated occurrence. Failed automatic attempts require manual retry.
- History keeps at most 30 operations for the mounted calendar session; the
  stack does not survive refresh. Multi-task writes use compensating requests,
  not a database transaction. A lost response or failed compensation can require
  reload/reconciliation. Old unscoped device-only task caches are not imported
  into another account; the old storage key is left untouched.
- The existing ICS parser supports basic event fields; full recurrence rules,
  exceptions and named-timezone semantics remain unsupported. Generated-plan
  completion remains outside the added-task history implementation.
- Live forecast/location permissions, actual photo extraction, cross-device
  preference synchronization and production Supabase mutations were not tested.
  No claim of clinical review, measured usability improvement or production
  readiness follows from these local checks.

### Validation

- Frontend TypeScript: `tsc --noEmit --incremental false` passed.
- `node --test frontend/scripts/feedback-regression.cjs`: **14 passed**, including
  calendar inverses/compensation, deletion ownership, preference-write ordering,
  ICS dates, weather matching and gamification bounds/date lookup.
- ResourceHub taxonomy was checked for required entries and unique IDs. Its
  full application build was not a validation gate for this taxonomy-only change.
- Playwright with synthetic data and intercepted APIs: unchecked pathway ideas;
  one selected goal surviving onboarding reload; five selected Race goals and
  five visible track stops; correct current milestone; manual/photo/ICS undo and
  redo; manual task surviving reload; failed save retaining form input; assigned
  weekday animals and loaded assets; Settings color control; dialog Escape.
- Desktop 1440px and mobile 390px/320px layouts inspected. Race, Calendar and
  Settings checks found no page overflow; saved-settings Calendar reload and
  final Race/Settings loads had no captured runtime errors. Screenshots helped
  identify and fix a hydration defect during this batch.
- Browser photo extraction and forecasts were fixtures, not real-provider
  accuracy tests. The local preview is `http://localhost:3012`.

## Requirement Coverage

| Request | Local implementation | Remaining limits |
| --- | --- | --- |
| Help icon and title, three modes | Action is the default; Action -> Info -> Info + Action -> Action. Both help modes explain first and execute on a second click, matching the supplied specification. Mobile title is visible. | Both help modes intentionally behave alike. Authored explanations are incomplete; capture is click-based, not a complete keyboard-interaction layer. |
| Welcome emails | Authenticated completion calls a server endpoint that checks saved-path ownership and completion, sends a one-time welcome, and records a server-owned receipt. Provider idempotency is used. | Provider configuration is absent. Automatic retry/outbox is not implemented. Bulk send is not implemented or authorized yet. |
| Clearer roadmap, personalities, people | Simple navigation emphasizes Path, Calendar, and Task. Advanced tabs return in Full View; an already-open advanced tab stays reachable. People is optional in final guidance. | These changes reduce specific friction, but do not prove the app is easier. Terminology and screen density still need moderated testing. |
| Fun and drop-off review | Qualitative review and a measurement plan below. | No defensible enjoyment scores or ranked drop-off results are available. |
| Main Settings language controls | Alphabetical language list; German, Italian, and Portuguese join English, Spanish, French, and Chinese core dictionaries. Unsupported choices are disabled. Fixed stale DOM translation overwriting React updates. | Core-navigation coverage only, not full localization; native-speaker review remains. |
| Persistent Simplified View | Simple stays active until explicitly changed; usage days no longer expand it. Family/Reels and advanced planning tabs are reduced. Path action rows wrap on mobile. | Choice is device-local. Calendar and other screens still contain advanced controls; this is not a complete simplification of every workflow. |
| Four visual levels and customization | Existing Plain/Pretty/Exciting/Fun, side, widget-size, and accent controls are exposed together in Settings. Preferences retain existing account persistence. | Not arbitrary drag-and-drop layout customization. Existing age/tech-savviness visual caps remain. No consented cohort analysis was added. |
| Audible descriptions and voice | Opt-in spoken control descriptions; opt-in English destination navigation with explicit microphone start and confirmation. Input values are not read aloud. | No general voice conversation. Real microphone/browser speech-service behavior remains untested. Settings are device-local. |
| Nonlinear onboarding | Clickable sections, validators, and linked missing-required-section reporting. Age access is checked before later sections. | Optional sections can count as complete without answers. Progress position is not a measured completion percentage. |
| Age and guardian approval | Exact requested under-18 message. Signup stores server-owned DOB. Existing adults can review and attest to legal guardianship when creating a child; accounts start locked and unlock after linking and approval. Both backend generation routes check eligibility. | See release blockers below. This is attestation, not independently verified age or legal authority. |
| AuDHD | Selecting AuDHD removes and disables separate Autism/ADHD for that relationship; removing relationships updates the flattened selections. | Contradictory restored drafts and free-text variants are not comprehensively normalized. |
| More goal ideas | Expanded practical goal suggestions informed by NHS wellbeing guidance and Canadian budgeting guidance. | Not ResourceHub popularity or measured trends; no invented trend claims. Sources below. |
| Separate dream subjects | Self, other-person, and relationship dream fields, including per-goal self dreams. Parent-associated goals show the other-person dream first; otherwise self is first. | No distinct guardian relationship option was added to this ordering rule. |
| Alternate Persona and avatar editors | Independent local Dream Self and Alternate Persona appearance editors replace the user-facing AI portrait-generation controls. Existing saved portraits remain viewable. The follow-up replaces the Race portrait with the local avatar. | Legacy paid generation API still exists. |
| Spirit animals | General/pair/weekly modes, corrected weekday labels and counts, schedule-based fast/slow description, local full-color Twemoji PNGs and tinted previews with attribution. | Color rotation is approximate, not individually redrawn color variants. Other screens still use existing emoji artwork. Switching modes can discard extra selections. |
| Recommendation diagnosis and cost | Missing optional life stage uses a valid fallback. Free/cheap eligible candidates are sorted before the upstream shortlist; unknown/invalid prices sort last. No synthetic seeding was used as a cure. | Live inference and catalogue coverage unverified. Currency/billing-period normalization is absent. Proxy errors can still appear as empty results; stale recommendations and cross-app saving need further work. |
| Final guidance, then welcome | Final Step - Guidance -> Welcome to Dreamland -> Path. Earlier submission is now Create my Path. | Browser-tested with mocked APIs, not a live generated plan. |
| Related posts to Tidbits | Path/Pit Stop already target ResourceHub community; Races now uses the same handoff helper. | Live authenticated cross-app handoff untested. Existing URL-token transport needs security review. |

## Is It Easier?

Several concrete obstacles are removed: help no longer swallows the execution
click, Simple does not expand unexpectedly, onboarding sections are revisitable,
missing answers are named, and animal labels follow React state correctly.
That is evidence of repaired behavior, not evidence of improved user success.

The recommended primary workflow is Path -> next task -> completion/reflection.
Personas, people matching, comparisons, and extensive customization should be
optional branches. Help text and a tour alone will not resolve conceptual overload.
The feedback gate is excluded from onboarding but can still block Path; the tour
can still interrupt. Both need a product decision before claiming low-friction use.

## Fun Review: Hypotheses, Not Scores

| Area | Potential appeal | Friction to test |
| --- | --- | --- |
| Onboarding | Immediate visual customization and personal goal choices. | Nine sections, terminology, and optional choices can delay the first useful result. |
| Path and next task | Visible progress and a concrete next action. | Dense summaries, multiple metaphors, and competing actions can obscure what to do next. |
| Calendar | Turning intent into a manageable schedule. | Too many view and energy controls before the schedule has content. |
| Task completion and streaks | Short feedback loops and visible continuity. | Pressure after missed days; cosmetic rewards without useful progress. |
| Dream Self and Alternate Persona | Creative ownership and imagining a future self. | Two identities may be confusing or feel like required work; keep optional. |
| Spirit animals | Colorful personal companions and choice. | Seven selections can become repetitive; general mode should remain the easy default. |
| People and Tidbits | Relevant support and shared experience. | Matching expectations, privacy, empty results, and cross-app navigation. |
| Resources | Immediate practical benefit from affordable options. | Missing prices, weak relevance, and failed saving can quickly erode trust. |

### Drop-Off Evidence

The read-only coverage scan found 348 profiles, 82 with navigation history,
3,104 recorded visits, and zero `onboarding_step_completed` section events.
This includes test/synthetic accounts and is not a real-user funnel. A page visit
does not establish completion, abandonment, or enjoyment. No section can honestly
be named the largest drop-off point from these records.

Proposed measurement, not implemented: consented onboarding-start, section-valid,
submit-attempt, validation-failure, generation-success/failure, first-task-start,
and first-task-complete events. Deduplicate attempts, distinguish returning users
and technical errors, define an inactivity window, and exclude QA/synthetic users.
Do not log dreams, Norm text, transcripts, or other sensitive free text.
Use optional broad cohorts, minimum reporting sizes, retention limits, and deletion
support before comparing age, tech comfort, or accessibility preferences.

Run moderated tasks with low-tech-comfort participants, including returning to a
missing section, finding the next action, comparing a free resource, and finding
People. Record completion, time, assistance, misclicks, and a short optional
enjoyment/ease question. Compare against the previous flow before declaring success.

## Release Blockers and Operational Limits

- **Guardian access:** review attestation is not independent verification. Legacy
  guardian DOB can fall back to user-editable metadata. Missing DOB now blocks
  legacy adults from backend generation; a reconfirmation/migration path is needed.
  Existing pending-child approval, revocation, recovery after partial failure,
  and universal access enforcement across APIs are not complete. Do not present
  this as a production-ready verified-guardian system or universal minor lockout.
- **Email:** a private exclusion-filtered preview contains 41 candidate completed
  accounts with saved paths, from a paginated scan of 348 accounts. Exclusions
  are heuristic and require human review. The preview remains unapproved and
  zero messages were sent. Configure the provider securely and approve recipients
  before any batch delivery. No recipient identities belong in this document.
- **Delivery reliability:** welcome delivery is fire-and-forget. A receipt-write
  failure relies on the provider's finite idempotency window; this is not a durable
  exactly-once outbox. A controlled test send is still required.
- **Recommendations:** no live relevance study, pricing-unit normalization, or
  end-to-end ResourceHub saving validation was completed. Synthetic data would
  not establish real-user recommendation quality.
- **Accessibility/localization:** English voice commands only, partial dictionary
  coverage, incomplete authored help, and no assistive-technology acceptance study.
- **Residual product work:** full voice conversation, cohort analytics, all-screen
  simplification, consistent new avatar/art use across screens, and retirement of
  the unused image-generation API remain outstanding.

## Verification

- Frontend TypeScript check passed with `--noEmit --incremental false`.
- Eight saved frontend regression tests passed: view defaults, mode cycle, age
  boundaries, languages, translator updates, welcome safeguards, affordability,
  and guardian consent/linking/approval-failure behavior.
- Six backend authorization tests passed with mocked accounts and guardian links.
- Mocked browser checks covered nonlinear/missing onboarding sections, underage
  warning/blocked sections, AuDHD exclusions, independent avatar rendering, animal
  labels/counts, local image loading, tinted preview, and final-guidance transition.
- Styled animal-picker screenshots inspected at 390px and 1440px. Path horizontal
  overflow checks passed at 320px and 390px after responsive row repairs.
- Simple/Full tab visibility and explicit voice-start/confirmation were browser
  checked. Real audio capture, live email, live child creation, live planning, and
  authenticated ResourceHub handoff were not exercised.
- ResourceHub full typecheck still has pre-existing errors outside the touched
  ranking module. This is not a clean all-project release gate.
- Browser testing used fake account tokens and intercepted API requests. An
  invalid `{}` Life Stats fixture caused a render error; an unavailable-response
  fixture allowed validation to continue. This does not establish live API health.

Run the saved checks from the repository root:

```sh
node --test frontend/scripts/feedback-regression.cjs
.venv/bin/python -m unittest discover -s backend/tests -p test_onboarding_auth.py -v
frontend/node_modules/.bin/tsc --noEmit --incremental false --project frontend/tsconfig.json
```

Local preview: http://localhost:3012. Start Next with the frontend as the working
directory so Tailwind resolves the correct configuration. No commit, push, or
deployment was performed.

## Sources and Assets

- NHS wellbeing guidance: https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/five-steps-to-mental-wellbeing/
- Financial Consumer Agency of Canada budgeting guidance: https://www.canada.ca/en/financial-consumer-agency/services/make-budget.html
- Twemoji 14.0.2 animal PNGs, CC BY 4.0: [asset attribution](../frontend/public/spirit-animals/ATTRIBUTION.md).