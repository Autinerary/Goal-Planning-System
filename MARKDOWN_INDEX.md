# Markdown Index

This file indexes every Markdown document currently in the repository.

## Root

- [README.md](README.md): High-level overview of the Goal Planning System, its intended multi-agent architecture, and core user-facing flows.
- [SETUP.md](SETUP.md): Root setup guide for backend and frontend services, database setup, and local environment bootstrapping.

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