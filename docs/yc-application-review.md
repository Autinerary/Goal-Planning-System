---
title: "YC Application — Corrections and Rewrite"
subtitle: "Autinerary · Spring/Summer 2026"
date: "8 September 2026"
---

# Part 1 — Fix These Before Submitting

Three factual errors, one arithmetic error, one naming inconsistency. All are
checkable by a YC partner in under a minute.

## 1. AutoGen → LangGraph

The application says "AutoGen for multi-agent orchestration" in two separate
answers. Production reports:

```
orchestrator_type: LangGraph
active_model     : gpt-4o-mini
capability       : full
```

The `autogen` package is not installed. An `AutoGenOrchestrator` class exists
behind a `USE_AUTOGEN` flag that defaults to false and has never been enabled
in production.

**Why this one matters most.** Your application's credibility rests on Aayush
being the architect who knows this system. If an interviewer asks him to walk
through the AutoGen setup and the answer is "we actually use LangGraph," the
claim you most need believed is the one that breaks.

LangGraph is also the stronger answer: a state-machine orchestration is more
current and more interesting than AutoGen's group chat.

## 2. GPT-4 → GPT-4o mini

Production runs `gpt-4o-mini`. This is a *better* fact — it means one full
six-agent generation costs **$0.0027**. Unit economics are a YC question, and
this is a good answer.

## 3. Python 3.11 → 3.9

Local runtime is Python 3.9.6. Minor, but it is in the same sentence as the
other two.

## 4. The revenue arithmetic does not compute

Stated: `⅕ × 485 × $10 = $582M ARR`

Actual:

| Step | Value |
|---|---|
| Population across CA/US/UK/AU | 485M |
| × 1/5 neurodivergent | 97M |
| × 1% penetration | 970K users |
| × $10 × 12 months | **$116M ARR** |

$582M would require 4.85M users — 1% of the *entire* population, or 5% of the
neurodivergent one. The ⅕ is either dropped or double-counted.

$116M on defensible assumptions is a strong answer. $582M on broken ones
invites "what else didn't they check?"

## 5. "Hurtle" vs "Autinerary"

The founder video script says *"we've created Hurtle."* The company name field
says Autinerary. Same application.

## Verified correct — no change needed

pgvector similarity search · `text-embedding-ada-002` · Next.js 14 App Router ·
TypeScript · Tailwind · Supabase auth + Postgres · FastAPI + Uvicorn ·
six specialized agents

\newpage

# Part 2 — Rewritten Answers

## Tech stack (corrected)

> Frontend is Next.js 14 (App Router) with TypeScript and Tailwind, on Vercel.
> Backend is FastAPI with Uvicorn on Render. Supabase is the shared Postgres
> layer across both apps, with pgvector for similarity search that matches
> users on barrier profile.
>
> Orchestration is LangGraph: six specialized agents — path planning, pattern
> recognition, tool recommendation, calendar optimization, reflection
> analysis, adaptation — wired into two state machines, one for generation and
> one for adaptation.
>
> Agents run on GPT-4o mini by default, with GPT-4o and o4-mini selectable per
> agent, and Anthropic, Google and Groq wired behind the same interface.
> Embeddings are text-embedding-ada-002. One full generation is 14 model calls,
> ~10,200 tokens, 23 seconds, **$0.0027** — measured, not estimated, against a
> per-user usage ledger we enforce spend limits with.
>
> For AI coding tools: GitHub Copilot with Claude, and Claude Code. Founders
> design the architecture, review every change, and own all production
> decisions.

**Why this version is better:** it is accurate, it volunteers a real unit-cost
number, and the per-agent model selection shows engineering judgment rather
than a framework list.

## Are people using your product? (honest version)

> Three real users so far, plus 47 synthetic accounts we generated for load
> testing.
>
> The interesting part is what those three produced. Between two of them: nine
> distinct co-occurring conditions — autism, AuDHD, sensory processing,
> auditory processing, anxiety, PTSD, mood disorders, plus first-generation and
> immigrant status.
>
> That is the entire thesis in one data point. Nobody arrives with one clean
> label, which is why every tool built around a single diagnosis fails these
> users.
>
> Our pattern-recognition agent currently reports 0.2 confidence, because it
> has almost no corpus to match against. We built it to report that honestly
> rather than emit a plausible-looking number. Every figure the agents produce
> is derived from real data or gated on sample size — we audited the pipeline
> and removed every hardcoded value.

**Why this version is better:** it does not hide the number, and the last
paragraph is a claim about engineering integrity that a partner can verify in
your code. That is rare and it is checkable.

## Revenue (focused)

Replace seven streams with one plus a roadmap:

> Freemium SaaS. $10-20/month individual, $50-100/month for families and
> educators. Across Canada, the US, UK and Australia there are roughly 97
> million neurodivergent people; 1% at $10/month is $116M ARR.
>
> B2B licensing to school boards, therapy practices and autism organizations is
> the second step, and the one our Ontario partnerships point at directly. The
> other streams — vendor promotion, affiliate referral, anonymized research
> data — are real but they all depend on the same thing first: users.

**Why:** seven revenue streams before product-market fit reads as unfocused.
One, with the others named as later, reads as prioritization.

## Batch preference

Do not defer for patents or entity structure. YC is unimpressed by software
patents at seed stage, and "we need to finish foundational work before we're
ready for you" inverts what the program is for — while sitting badly against
"our hope is that YC helps us go full-time."

If you defer, defer for one reason:

> We're applying for Summer 2026 to use the time on the one thing that
> matters: going from 3 users to 500. We have ANSG chapters at 8 universities
> and Ontario autism org relationships already built. By the batch we intend
> to arrive with a real retention curve rather than a research summary.

\newpage

# Part 3 — What YC Is Actually Weighting

## In priority order

**1. Founders.** Determination over intelligence; "relentlessly resourceful."
Clarity, speed, and honesty about what is not working. **You are strong here** —
the origin story with your mother and "all three of us are terrible losers" are
the best lines in the application. Keep them.

**2. Make something people want — measured in usage.** Growth *rate* matters
more than absolute numbers. 10 → 40 in a month beats a flat 500. A small base
is not disqualifying; a static one is.

**3. A market that can get very large.** You have this.

**4. Insight.** "Barriers are addressed individually, but people experience
them in combination." This is genuinely good, and your own three users are
evidence for it.

## Scorecard

| Criterion | Status |
|---|---|
| Founders | Strong |
| Market | Strong |
| Insight | Strong |
| **Usage / growth** | **Weak — this is the blocker** |
| Clarity | Weak — roughly 2× too long |

## What they are explicitly not impressed by

- **Patents.** Mentioned three times; one is a reason to defer a batch.
- **Research volume as a substitute for users.** 200 REB-approved interviews is
  real work, but reads as "researched instead of shipped."
- **Length.** They read thousands of these.
- **Seven revenue streams** before product-market fit.

## The interview, if you get one

Roughly ten minutes, rapid-fire, often interrupting. *"What have you built?"*
*"How many users?"* *"How fast is it growing?"*

This is why the AutoGen error is disproportionately expensive: one correction
in a ten-minute technical exchange costs founder credibility you cannot rebuild
in the time remaining.

\newpage

# Part 4 — The Single Highest-Leverage Action

Not the writing. **Get to 50 weekly active users before submitting.**

Current state, from the live database:

| Signal | Count |
|---|---|
| Real signups | 3 |
| Reflections | 0 |
| Connections | 0 |
| Messages | 0 |
| Calendar tasks | 4 |

The application answers "Yes" to *are people using your product*, and claims
"pattern recognition across **thousands** of similar user journeys." Neither
survives one follow-up question.

You already hold the distribution to fix this: ANSG chapters across 8
universities, Ontario autism organization relationships, and 200 interviewees
who already agreed to talk to you. Those interviewees are a warm list.

Fifty real weekly users with a retention curve would improve this application
more than any rewrite. An application that says *"3 users in September, 200 by
November, here is the curve"* gets an interview. A working system with 200
interviews and 3 users usually does not.

## Suggested sequence

1. Fix the five factual errors above — one hour
2. Cut the application by half — one evening
3. Spend everything else on users until the deadline

## What is genuinely strong — do not bury it

- The origin story: your mother, the roadmap, the name
- "All three of us are terrible losers"
- MITACS-funded, REB-approved research with 200 participants
- A working six-agent system at $0.0027 per generation
- No fabricated numbers anywhere in the pipeline — verifiable in the code

---

*Technical claims in this document were verified against the live production
server and the codebase on 8 September 2026.*
