# Barrier Connections — Taxonomy Template (for Madhu)

> **Purpose:** organize the "Barrier Connections" onboarding step properly.
> This is a **working template** — add your critiques in the `Madhu's notes`
> column, mark rows keep / change / remove, and flag anything that needs a
> "specify" sub-page.
>
> **Owner:** Madhu (diagnostic organization)
> **Status:** DRAFT — nothing here is final.

---

## ⚠️ Guardrail: do NOT turn this into a medical app

The more clinical detail we collect (formal severity scales, diagnostic
criteria, "clusters", levels), the more we risk being classified as a
**medical / diagnostic app** — which means 2+ years of testing instead of ~1
month. Every row below has a **Medical-risk** flag:

- 🟢 **safe** — plain identity / lived-experience label, no clinical claim
- 🟡 **caution** — borderline; keep wording lived-experience, avoid diagnosis
- 🔴 **high risk** — severity levels / clinical sub-typing; likely a "specify"
  page at most, or cut entirely. Needs explicit sign-off.

Rule of thumb: we ask **"what do you identify with / experience"**, never
**"what is your diagnosis / how severe is it"**.

---

## Current live structure (what's in the app today)

Source of truth: `frontend/app/onboarding/page.tsx` → `barrierCategories`.

### 1. Neurodivergence
| Sub-category | Items | Medical-risk | "Specify" page? | Madhu's notes |
|---|---|---|---|---|
| Neurodevelopmental | Autism, ADHD, AuDHD, Tourette Syndrome, Intellectual Disability | 🟡 | Autism Lvl 1–3? (🔴 — needs sign-off) | |
| Specific Learning Differences/Disorders | Dyslexia, Dyscalculia, Dysgraphia, Auditory Processing Disorder | 🟢 | | |
| Sensory (processing) | Sensory Processing Disorder, Synesthesia | 🟢 | | |
| Psychiatric Conditions | OCD, Schizophrenia, PTSD, Anxiety Disorder, Depression | 🟡 | | |
| Personality Disorders | BPD, Bipolar Disorder | 🟡 | Clusters A–C? (🔴 — needs sign-off) | Note: Bipolar is a mood disorder, not a personality disorder — recategorize? |
| Genetic Variations | Down Syndrome, Fragile X Syndrome | 🟢 | | |

### 2. Physical
| Sub-category | Items | Medical-risk | "Specify" page? | Madhu's notes |
|---|---|---|---|---|
| Mobility | Wheelchair User, Limited Mobility, Amputation | 🟢 | | |
| Chronic Conditions | Chronic Illness, Chronic Pain, Autoimmune Disorder, Epilepsy | 🟡 | | |

### 3. Sensory
| Sub-category | Items | Medical-risk | "Specify" page? | Madhu's notes |
|---|---|---|---|---|
| Vision | Blind, Low Vision, Color Blind | 🟢 | | |
| Hearing | Deaf, Hard of Hearing | 🟢 | | |

### 4. Social & Cultural
| Sub-category | Items | Medical-risk | "Specify" page? | Madhu's notes |
|---|---|---|---|---|
| Identity | Visible Minority, LGBTQ+, Gender Identity, Religious Minority | 🟢 | | |
| Circumstance | Language Barrier, First Generation, Immigrant / Refugee | 🟢 | | |

### 5. Economic & Access
| Sub-category | Items | Medical-risk | "Specify" page? | Madhu's notes |
|---|---|---|---|---|
| Economic | Limited Income, Food Insecurity, Housing Instability | 🟢 | | |
| Access | Limited Technology Access, Rural / Remote Area, Transportation Barrier | 🟢 | | |

---

## Odosa's asks — tracked against the current structure

| Ask | State | Notes |
|---|---|---|
| Split Physical & Sensory | ✅ Done | They are already separate top-level categories (§2 and §3). |
| Neurodivergence has categories (6 listed) | ✅ Done | All six present (§1). "Learning Differences" is currently labelled that way — Odosa wrote "Specific Learning Differences/Disorders"; rename? |
| Combined categories (ex. AuDHD) | ✅ Present | `AuDHD` under Neurodevelopmental. Add others? (e.g. OCD+ADHD, autism+anxiety) |
| Severity / sub-typing (Autism Lvl 1–3, PD Clusters A–C) | ⛔ Not added | Deliberately omitted — 🔴 medical-app risk. Decide: "specify" page, or cut. |
| Wording: identity is NOT the barrier | ✅ Done (copy) | Step is now "Your Systemic Barriers" with an explicit note. |

---

## Open questions for Madhu

1. **Severity/"specify" pages** — do we want them at all? If yes, which items,
   and how do we word them to stay lived-experience (🟢/🟡) not clinical (🔴)?
2. **Bipolar Disorder** is under "Personality Disorders" — should it move to a
   "Mood Disorders" sub-category (or into Psychiatric Conditions)?
3. **Combined categories** — which famous combos beyond AuDHD do we surface as
   their own selectable items vs. letting users pick two?
4. **Missing items** — anything absent that we should add (e.g. specific
   conditions, more identity/circumstance options)?
5. **"Learning Differences" vs "Specific Learning Differences/Disorders"** —
   which label do we use?

## How to hand edits back

Fill in the `Madhu's notes` columns above (or comment inline). Once you sign
off on a revised structure, the change goes into
`frontend/app/onboarding/page.tsx` → `barrierCategories` (and the same shape
should be mirrored in ServiceHub's barrier list for consistency).
