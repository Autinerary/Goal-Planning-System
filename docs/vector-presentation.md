---
title: "Autinerary — Vector / Darmond Program Review"
subtitle: "Market focus, seed data, and demo evidence"
date: "8 September 2026"
---

# 1. Market & Scope

## Segments (from focus groups)

**Parent · Sibling · Diagnosed · Non-diagnosed**

Focus groups pushed us to narrow scope to these four. They are *relationship*
segments, not diagnosis segments — and our own data shows why.

## Supporting evidence — real users

Three real signed-up accounts. Between two of them, **nine distinct
conditions**:

| Condition | Category |
|---|---|
| Anxiety (×2) | Mental health |
| Autism | Neurodivergence |
| AuDHD | Neurodivergence |
| Sensory Processing Disorder | Neurodivergence |
| Auditory Processing Disorder | Neurodivergence |
| PTSD | Mental health |
| Mood disorders | Mental health |
| First Generation | Systemic |
| Immigrant / Refugee | Systemic |

**Finding.** Conditions co-occur and cross categories — neurodivergence,
mental health, and immigration status in the same two people. Single-diagnosis
segmentation does not fit real users. This is the quantitative echo of what the
focus groups told us qualitatively.

*Sample size is three. We report this as a qualitative observation, not a
distribution.*

\newpage

# 2. Seed Data Structure

## Users

| Population | Count | Status |
|---|---|---|
| Real signups | **3** | Real |
| Synthetic accounts | 47 | Generated for load/correctness testing |
| Orphaned barrier records | 218 | Legacy seed, no auth user |

The synthetic barrier distribution is close to uniform (Dyslexia 10, ADHD 10,
Chronic illness 10, Autism 10, Anxiety 7, ESL 7, OCD 7). That uniformity is an
artefact of generation. **We do not present it as market signal.**

## Resources — supply side

**132 total — 95 approved, 37 pending review**

| Category | Count |
|---|---|
| School | 24 |
| Park | 22 |
| Therapist | 21 |
| Store | 14 |
| Community Centre | 13 |
| Recreation | 10 |
| Doctor | 9 |
| Support Group | 9 |
| Employment | 5 |
| Housing | 4 |

**Field completeness:** contact_info 99.2% · location 99.2% ·
image_url 0% · price 0%

**Known gap.** Employment (5) and Housing (4) are our thinnest categories, and
they are exactly what the core use case depends on. Named here as a roadmap
item rather than discovered in questions.

\newpage

# 3. Demo vs Data

## One full generation, measured

| Metric | Value |
|---|---|
| Milestones produced | 16 |
| Wall-clock time | 23 seconds |
| LLM calls | 14 |
| Tokens | 10,158 |
| Cost | **$0.0027** |

Across the three paths currently stored, milestone counts range 16–48. We
quote the single measured run rather than an average, because n=3 is too thin
to average.

## Per-agent cost breakdown

| Agent | Calls | Tokens | Cost |
|---|---|---|---|
| Path planning | 10 | 5,552 | $0.00146 |
| Tool recommendation | 3 | 4,504 | $0.00118 |
| Calendar optimisation | 1 | 102 | $0.00003 |
| **Total** | **14** | **10,158** | **$0.0027** |

## Agent confidence — self-reported

| Agent | Confidence |
|---|---|
| Path planning | 0.95 |
| Tool recommendation | 0.76 |
| Calendar optimisation | 0.75 |
| Pattern recognition | **0.20** |

The 0.20 is the system working correctly. Pattern recognition matches a user
against similar prior users; with a small corpus it has little to match
against, and it reports that honestly rather than emitting a confident number.

**Provenance rule.** Every figure the agents produce is derived from real data
or explicitly gated on sample size and hidden below threshold. No placeholder
values. The pipeline was audited end-to-end to remove hardcoded numbers.

## Architecture

Six specialised agents — pattern recognition, path planning, tool
recommendation, calendar optimisation, reflection analysis, adaptation —
orchestrated as a LangGraph state machine over a shared Supabase project.

The model behind each agent is user-selectable (GPT-4o, GPT-4o mini, o4-mini,
with Anthropic/Google/Groq wired and awaiting keys), with low/medium/high
reasoning effort. Per-user spend limits are enforced against a durable usage
ledger.

\newpage

# 4. Roadmap to Program End

1. **Recruit into the four segments.** Replace three real users with a real
   sample. This is the single biggest gap.

2. **Close catalogue gaps.** Employment (5) and Housing (4) need depth; they
   carry the core use case.

3. **Populate `price` and `image_url`** — both currently 0% across 132
   resources.

4. **Track pattern-recognition confidence.** It sits at 0.20 today. As the
   corpus grows it should climb. That is our measurable learning signal, and
   it is instrumented now.

## Infrastructure note

Both Render and Supabase are on free tier. Free Supabase projects pause after
seven days of low activity; free Render sleeps after fifteen minutes idle with
a cold start of roughly one minute. Neither is production-safe for a public
launch. Upgrading is inexpensive and is a larger blocker to scale than LLM
cost, which is negligible at $0.0027 per onboarding.

\newpage

# 5. Speaking Script (~4 minutes)

## Market — 45 seconds

> We build AI life-planning for neurodivergent people and people facing
> systemic barriers.
>
> We ran focus groups, and they pushed us to narrow scope to four segments:
> parents, siblings, diagnosed, and non-diagnosed.
>
> Our own data says the same thing. We have three real users. Between two of
> them: nine distinct conditions — autism, AuDHD, sensory processing, auditory
> processing, PTSD, mood disorders, plus first-generation and immigrant status.
>
> Nobody arrives with one clean label. That is why we segment by relationship
> to the diagnosis, not by the diagnosis itself.

## Data — 45 seconds

> Being direct about what is real: three real signups, forty-seven synthetic
> accounts for load testing. The synthetic distribution is deliberately
> uniform — it is generated, so we do not present it as market signal.
>
> What is real is the resource catalogue. A hundred and thirty-two resources,
> ninety-five approved. Schools, parks, therapists, community centres.
> Ninety-nine percent have contact information and location.

## Demo — 90 seconds

*Run live, or play the recording.*

> This is one full generation. Six agents: pattern recognition, path planning,
> tool recommendation, calendar optimisation, reflection analysis, adaptation.
>
> Twenty-three seconds. Sixteen milestones across education, workplace,
> relationships, and health. Fourteen model calls, ten thousand tokens — a
> third of a cent.
>
> One thing worth pointing at: pattern recognition reports 0.2 confidence.
> That is honest. We do not yet have enough similar users to match against.
> Every number these agents produce is derived from real data or gated on
> sample size. Nothing is a placeholder.

## Ask and roadmap — 60 seconds

> By program end: recruit into those four segments and replace three users
> with a real sample.
>
> Close the catalogue gaps. Employment and Housing are our thinnest categories
> at five and four resources, and they are exactly what the core use case
> needs.
>
> And the measurable one: pattern-recognition confidence should climb from 0.2
> as the corpus grows. That is our learning signal, and it is instrumented
> today.
>
> The system runs. What we need is the sample.

\newpage

# 6. Anticipated Questions

**How many users do you really have?**

> Three real. Forty-seven synthetic for testing. I can show you the split.

*Never answer "50" — the follow-up costs more than the honest answer.*

**Is the synthetic data representative?**

> No. It is uniform by construction. It tests load and correctness, not market
> shape. We draw no conclusions from it.

**What does this cost at scale?**

> $0.0027 per onboarding, measured. LLM cost is not our constraint —
> infrastructure is. Both Render and Supabase are free tier and need upgrading
> before public launch.

**Where do the agent numbers come from?**

> Real data, or explicitly gated on sample size. We audited the whole pipeline
> and removed every hardcoded value. Low confidence displays as low confidence.

**Why relationship segments rather than diagnosis?**

> Because our real users hold nine co-occurring conditions between two people.
> Diagnosis segments would put the same person in four buckets. Relationship to
> the diagnosis is stable and it is how support actually gets organised.

---

*All figures verified against the live Supabase project and a measured agent
run on 8 September 2026. Synthetic and real populations are reported
separately throughout.*
