# Markdown Index

This file indexes every Markdown document currently in the repository.

## Root

- [README.md](README.md): High-level overview of the Goal Planning System, its intended multi-agent architecture, and core user-facing flows.
- [SETUP.md](SETUP.md): Root setup guide for backend and frontend services, database setup, and local environment bootstrapping.

## Team docs (docs/)

Start here:

- [docs/new-team-members.md](docs/new-team-members.md): For anyone joining: what Autinerary is, how the code is laid out, running it, how changes reach users, and where everything is written down.
- [docs/debugging.md](docs/debugging.md): Problems the team has hit (deploys, cron jobs, database grants, email, search) and how to tell.
- [docs/pitch-facts.md](docs/pitch-facts.md): Numbers (each with a date) and what makes Autinerary different, for pitches and partners.
- [docs/product-portfolio.md](docs/product-portfolio.md): Every Autinerary product in one page (the app, ResourceHub, Tidbits, the shop, Hare World, Resource Accounts, emails): what it is, who it's for, what works, what is off.

The October 2026 planning note, round by round:

- [docs/planning-note-2026-10.md](docs/planning-note-2026-10.md): The Earthy theme and colour strength, AI search and the three-click team, the Ontario import, job partners and campus pages.
- [docs/service-directory-2026-10.md](docs/service-directory-2026-10.md): Goal 1, the service directory: tags, cost, the checked lists, the service loop and Spot Guides.
- [docs/contracting-2026-10.md](docs/contracting-2026-10.md): Goal 2: the Terms and Conditions, meetings with a team member, and the legal notes.
- [docs/ratings-and-community-choice-2026-10.md](docs/ratings-and-community-choice-2026-10.md): Goal 5: ratings from experience, comments, the monthly rating sweep and Community's Choice.
- [docs/goals-6-11-2026-10.md](docs/goals-6-11-2026-10.md): Goals 6 to 11: 3D maps, the results page, feedback, accessibility (Listen, UserWay), Resource Accounts, Spot Guides, the Positivity Quota, the provinces, and the V1.5 survey of services.
- [docs/subscriptions-2026-10.md](docs/subscriptions-2026-10.md): Goal 9: paid plans, the free month, free access, #FundAutinerary, and what consumer law asks for.
- [docs/products-round-2026-10.md](docs/products-round-2026-10.md): The products round: the Warm and Cool themes, products and their qualities, 40 categories, Users' Choice, buying through ResourceHub (off), the revenue model, Vendor Accounts and discounts, the help chat, taste profiles, and the v2.0 and v3.0 roadmap.
- [docs/tidbits-round-2026-10.md](docs/tidbits-round-2026-10.md): The Tidbits round: the 31 August feedback (search, learning disabilities, Path Market resources), the 5Qs report (wait times, support for parents, the email tiles, the article series), the starter products, and the Tidbits planning note (Bakery, the rules pop-up, Bites and Well-Dones, drafts, word limits, moderation, sponsored listings (off), the articles, v1.5 and v2.0).
- [docs/all-apps-round-2026-10.md](docs/all-apps-round-2026-10.md): The All Apps round: Info Mode's three modes in both apps, the adjustable sky, how you see the screen and voice commands, personality (optional, Big Five) and the answers about it, speaking and non-speaking, Dream Self without AI pictures, spirit animals, suggestions free first, trusted adults (off), and the welcome email for earlier accounts.
- [docs/gamification-review-2026-10.md](docs/gamification-review-2026-10.md): How fun each part of the app is, where people drop off (from the funnel), what each game-like part really does, and what would make it more fun.
- [scripts/data/products/BRIEF.md](scripts/data/products/BRIEF.md): The brief the product researchers worked from: what to look for, and how each product, quality and price is checked.
- [docs/terms-lawyer-review-2026-10.md](docs/terms-lawyer-review-2026-10.md): Questions for the lawyer, including paid plans and the shop.
- [docs/parent-forms-interview-2026-10.md](docs/parent-forms-interview-2026-10.md): An interview guide about the forms parents find hardest.

How we write, design and run things:

- [docs/voice.md](docs/voice.md): How Autinerary talks: nine rules, with before-and-after examples.
- [docs/design-guide.md](docs/design-guide.md): How things look.
- [docs/release-checks.md](docs/release-checks.md), [docs/data-residency.md](docs/data-residency.md), [docs/admin-role.md](docs/admin-role.md): Releasing, where data lives, and the admin role.

Riipen Labs students' feedback, round by round: [docs/groups-8-14.md](docs/groups-8-14.md), [docs/groups-15-19.md](docs/groups-15-19.md), [docs/groups-20-24.md](docs/groups-20-24.md), [docs/groups-25-30.md](docs/groups-25-30.md), [docs/groups-31-33.md](docs/groups-31-33.md), [docs/groups-34-36.md](docs/groups-34-36.md), and [docs/cohort-report-2026-09.md](docs/cohort-report-2026-09.md).

## Frontend

- [frontend/README_ENV_SETUP.md](frontend/README_ENV_SETUP.md): Frontend-specific environment variable setup, mainly for Supabase credentials and shared auth wiring.

## ServiceHub MVP

- [servicehub-mvp/README.md](servicehub-mvp/README.md): Main overview of the ServiceHub MVP, including product scope, stack, and core platform capabilities.
- [servicehub-mvp/SETUP.md](servicehub-mvp/SETUP.md): End-to-end setup guide for ServiceHub using Supabase, pgvector, SQL scripts, and local development config.
- [servicehub-mvp/ACCESSIBILITY.md](servicehub-mvp/ACCESSIBILITY.md): Accessibility and mobile UX standards for the ServiceHub app, aligned to WCAG-style requirements.

## ServiceHub MVP Docs

- [servicehub-mvp/docs/AGENT_ARCHITECTURE.md](servicehub-mvp/docs/AGENT_ARCHITECTURE.md): Detailed explanation of the ServiceHub multi-agent system, including agent roles, orchestration, and upgrade path.
- [servicehub-mvp/docs/AI_USAGE.md](servicehub-mvp/docs/AI_USAGE.md): Map of where AI logic is used across recommendations, validation, moderation, onboarding, and related features.
- [servicehub-mvp/docs/ARCHITECTURE_ALIGNMENT.md](servicehub-mvp/docs/ARCHITECTURE_ALIGNMENT.md): Gap analysis comparing the implemented ServiceHub system against the intended architecture and wireframe expectations.
- [servicehub-mvp/docs/GRANT_RATER_STATUS.md](servicehub-mvp/docs/GRANT_RATER_STATUS.md): Admin operations guide for granting or revoking rater permissions in the database.
- [servicehub-mvp/docs/MISSING_FEATURES.md](servicehub-mvp/docs/MISSING_FEATURES.md): Checklist of missing or partially implemented features relative to the planned product experience.
- [servicehub-mvp/docs/TESTING_CHECKLIST.md](servicehub-mvp/docs/TESTING_CHECKLIST.md): Comprehensive manual testing checklist covering functionality, performance, accessibility, security, and cross-browser behavior.
- [servicehub-mvp/docs/WHERE_AI_AND_EMBEDDINGS_ARE_USED.md](servicehub-mvp/docs/WHERE_AI_AND_EMBEDDINGS_ARE_USED.md): Feature-by-feature matrix showing where embeddings, AI agents, or both are used in the app.
- [servicehub-mvp/docs/WHERE_SIMILARITY_MATCHING_HAPPENS.md](servicehub-mvp/docs/WHERE_SIMILARITY_MATCHING_HAPPENS.md): Technical explanation of similarity matching across SQL pgvector queries, TypeScript helpers, and fallback cosine logic.

## ServiceHub MVP Libraries

- [servicehub-mvp/lib/auth/README.md](servicehub-mvp/lib/auth/README.md): Documentation for the Supabase authentication layer, auth context, route protection, and session handling.
- [servicehub-mvp/lib/embeddings/README.md](servicehub-mvp/lib/embeddings/README.md): Documentation for the local embeddings pipeline using Xenova and how embeddings are generated and consumed.

## ServiceHub MVP Scripts

- [servicehub-mvp/scripts/MIGRATION_SAVED_RESOURCES_STATUS.md](servicehub-mvp/scripts/MIGRATION_SAVED_RESOURCES_STATUS.md): Migration guide for adding status values like wishlist, current, and past to saved resources.
- [servicehub-mvp/scripts/quick-setup.md](servicehub-mvp/scripts/quick-setup.md): Short-form setup path for experienced developers who want the minimum required steps.
- [servicehub-mvp/scripts/SEEDING.md](servicehub-mvp/scripts/SEEDING.md): Guide for populating the database with development users, resources, and ratings test data.
- [servicehub-mvp/scripts/setup-checklist.md](servicehub-mvp/scripts/setup-checklist.md): Compact checkbox-style setup tracker for validating the main ServiceHub installation flow.
- [servicehub-mvp/scripts/setup-pattern-agent.md](servicehub-mvp/scripts/setup-pattern-agent.md): Setup guide for scheduling and running the Pattern Recognition Agent in the background.
- [servicehub-mvp/scripts/setup-storage.md](servicehub-mvp/scripts/setup-storage.md): Instructions for configuring Supabase Storage buckets and policies for uploaded rating images.
- [servicehub-mvp/scripts/SQL_SCRIPTS_TO_RUN.md](servicehub-mvp/scripts/SQL_SCRIPTS_TO_RUN.md): Ordered index of SQL scripts, what each script does, and when each one should be executed.