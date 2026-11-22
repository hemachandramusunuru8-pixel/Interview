# Interview Platform

An internal recruiting application for jobs, candidates, interview scheduling, Teams meetings, panelist feedback, and hiring decisions. Built with Next.js, TypeScript, Better Auth, Drizzle/Postgres, Supabase Storage, and Microsoft Graph.

## Documentation

- [Application audit](docs/APPLICATION_AUDIT.md) — prioritized defects, UI improvements, performance plan, missing workflows, and roadmap.
- [Product and technical guide](docs/PRODUCT_AND_TECHNICAL_GUIDE.md) — roles, journeys, routes, states, architecture, data model, configuration, setup, and operations.
- [Validation and release plan](docs/VALIDATION_PLAN.md) — completed checks, integration scenarios, concurrency tests, browser acceptance, and release gates.
- [Original phase plan](PHASES.md) — original plan; see the audit for implementation gaps.

The 22 November 2026 audit found release-blocking reliability issues. Candidate/resume consistency and recoverable Teams event creation are fixed in code; tests, types, lint, and production build pass. Migration `0006` must be applied through deployment, and the remaining reminder, concurrency, expiry, and workflow findings still need work.

## Development

Run `npm ci`, configure a private `.env` using the [environment inventory](docs/PRODUCT_AND_TECHNICAL_GUIDE.md#environment-configuration), and run `npm run dev`. Use isolated development services and a test mailbox. Review the setup guide before applying migrations to the configured database.

Validate with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. `npm run start` serves the production build. `npm run tick` processes scheduled work once; it does not install a recurring scheduler.

Before changing framework code, read `AGENTS.md` and the relevant installed guides under `node_modules/next/dist/docs/`.
