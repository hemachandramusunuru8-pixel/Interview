# Interview Platform

Candidate-to-feedback interview workflow, with Teams meetings via Microsoft Graph. Plan: see `PHASES.md`.

## Stack
Next.js 16 (App Router, TypeScript, Tailwind) · Supabase Postgres · Drizzle ORM · Better Auth (email + password, admin plugin) · Microsoft Graph for email and Teams.

## Commands
- `npm run dev` – dev server
- `npm run build` – production build
- `npm run typecheck` – `tsc --noEmit`
- `npm test` – Vitest unit tests
- `npm run db:generate` – generate a migration after editing `src/db/schema.ts`
- `npm run db:migrate` – apply migrations (uses `DIRECT_URL`)
- `npx auth@latest generate --config src/lib/auth.ts --adapter drizzle --dialect pg --output src/db/auth-schema.ts` – regenerate Better Auth tables after changing `src/lib/auth.ts`
- `npx auth@latest create-admin --config src/lib/auth.ts --email <email> --name <name>` – create the first Admin (type the password at the prompt)

## Conventions
- Next 16: the route guard is `src/proxy.ts` (not `middleware.ts`). Read `node_modules/next/dist/docs/` before using Next APIs.
- Proxy only does an optimistic cookie check. Real session and role checks live in `src/lib/dal.ts` (`requireRole`); every protected layout, page and server action must call it.
- No public sign-up. Only an Admin creates users; a new user sets their password from an emailed link.
- Deactivate users (ban) instead of deleting them. Banning revokes their sessions.
- Every table has row-level security enabled (`drizzle/0001_enable_rls.sql`). New tables need the same.
- `.env` is never committed. Passwords inside database URLs must be percent-encoded (`@` becomes `%40`).
- Use the Supabase Session pooler string (IPv4) for `DATABASE_URL` and `DIRECT_URL`; the `db.<ref>.supabase.co` direct host is IPv6-only and times out from Node on this network.

## Scheduled jobs
- `src/lib/scheduled-jobs.ts` closes finished interviews (asks the panelist for feedback) and sends reminders (24 h and 1 h before). Each step claims rows with a single UPDATE, so repeated runs never double-send.
- A scheduler must call `POST /api/cron/tick` every 5 minutes with header `Authorization: Bearer $CRON_SECRET`. Locally, run `npm run tick` against the running app.
- Opening the panelist "My interviews" page or a candidate's interviews page also closes finished interviews, so feedback still appears if the scheduler is late. Reminders only go out when the scheduler runs.
