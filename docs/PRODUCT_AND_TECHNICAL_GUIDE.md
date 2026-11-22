# Interview Platform Product and Technical Guide

This guide describes the implementation reviewed on 22 November 2026. Proposed enhancements and defects are tracked in [APPLICATION_AUDIT.md](APPLICATION_AUDIT.md). Live deployment configuration must be verified separately.

## Product purpose and roles

Interview Platform coordinates internal recruiting from job creation through candidate decisions. Microsoft Graph sends email and organizes Teams interviews. Candidates have no application accounts; they receive invitations, reminders, and optional decision emails.

| Capability | Admin | Recruiter | Panelist |
| --- | --- | --- | --- |
| Manage users and roles | Yes | No | No |
| Read activity log | Yes | No | No |
| Create/edit jobs and candidates | Yes | Yes | No |
| Upload/download resumes | Yes | Yes | No in current route |
| Schedule/reschedule/cancel interviews | Yes | Yes | Accept/decline own requests; claim pipeline work |
| Submit feedback | No | No | Assigned panelist after completion |
| View feedback | Recruiting screens | Recruiting screens | Own interview feedback |
| Decide candidate outcome | Yes | Yes | No |
| Read notifications | Own | Own | Own |

Role homes are `/admin`, `/recruiter`, and `/panelist`. Access to another role's home redirects to the current user's home. Admin shares recruiting screens under `/jobs` but does not use Recruiter or Panelist dashboards directly.

Recruiter data is shared across the organization. `createdBy` records authorship and notification ownership; it is not a recruiter access boundary. Separate organizations/tenants are not implemented.

## User journeys

### Administrator

Sign in, open Users, and enter the new person's name, email, and role. The server creates an account with a random password and requests a password-setting email. The person follows the link and chooses a password. Public signup is disabled. Admin can edit names/roles and deactivate/reactivate users; custom actions prevent self-demotion and self-deactivation. Activity shows recent account and recruiting changes.

Invitation success currently does not prove durable email delivery. Deactivation does not reassign outstanding interviews or feedback. The broader Better Auth admin endpoints also need coverage, beyond the UI's safeguards.

### Recruiter

1. Create a job with title, department, description, skills, round count, and status.
2. Add a candidate to an open job, including contact/background details and a resume.
3. The candidate enters the waiting pipeline; active panelists are notified.
4. Send a direct request to one panelist or publish an open slot. Alternatively, a panelist may claim a waiting candidate and choose the time.
5. On acceptance/claim, the app creates a Teams event with candidate, panelist, and recruiter attendees.
6. Reschedule or cancel through candidate interview history when needed.
7. After completion and feedback, choose next round, selected, or rejected, optionally emailing the candidate.

There is no candidate availability approval step or screening rejection before a completed interview. Editing a candidate email does not synchronize existing calendar attendees.

### Panelist

Review own direct requests and accept or decline with an optional reason. Pipeline shows fixed open slots and waiting candidates. Claiming a waiting candidate also requires a time, zone, and duration. Join through the Teams link, then submit rating, recommendation, and comments after completion.

All active panelists can claim pipeline work without skill matching. Feedback is restricted to the assigned panelist. Draft feedback and assigned-panelist resume access are not implemented.

## States and business rules

### Jobs

Statuses are `open`, `on_hold`, and `closed`. Adding candidates, accepting direct requests, retrying booking, and claiming pipeline work require an open job. Jobs are retained rather than deleted. Closing a job does not automatically cancel already-confirmed events. Round count is 1–10.

### Candidates

| State | Meaning | Normal next action |
| --- | --- | --- |
| `uploaded` | Ready for first interview | Direct request or pipeline booking |
| `interview_scheduled` | Confirmed booking | Attend interview |
| `interview_done` | End time passed and completion processed | Feedback, then recruiter decision |
| `next_round` | Recruiter approved another round | Schedule next round |
| `selected` | Selected | Terminal in current implementation |
| `rejected` | Rejected | Terminal in current implementation |

A pending request does not itself change candidate stage. Pipeline visibility separately checks for live interviews. Next round equals completed interview count plus one. Decisions require `interview_done`, at least one completed round, and feedback for the latest completed round. Next round requires remaining configured rounds; selection/rejection can occur before all rounds are used.

### Interviews

| State | Behavior |
| --- | --- |
| `pending` | Direct request awaiting response or unclaimed pipeline slot |
| `scheduled` | Assigned/claimed; also used while external creation is still running |
| `declined` | Request refused; live reservation released |
| `cancelled` | Cancelled interview or locally rolled-back waiting-candidate booking |
| `completed` | End time passed and completion process ran |

Modes are `direct` and `pipeline`; unclaimed pipeline slots have no panelist. A partial unique index allows one pending/scheduled interview per candidate and round. A SQL exclusion constraint prevents overlapping pending/scheduled bookings for a panelist. It does not cover unrelated Outlook appointments or candidate conflicts across jobs.

Durations are 30, 45, 60, and 90 minutes. New/rescheduled bookings require five minutes of lead time. Start/end are timezone-aware UTC instants with a display zone. The UI defaults to `Asia/Kolkata` and offers eleven zones. Validation accepts zones recognized by the runtime. Daylight-saving boundaries need F08.

## Route inventory

| Routes | Purpose |
| --- | --- |
| `/` | Redirect to role home |
| `/login`, `/forgot-password`, `/reset-password` | Login and password recovery |
| `/admin`, `/recruiter`, `/panelist` | Role dashboards |
| `/admin/users`, `/admin/activity` | User management and audit entries |
| `/jobs`, `/jobs/new`, `/jobs/[id]` | List/create/edit jobs |
| `/jobs/[id]/candidates` | Candidates for a job |
| `/jobs/[id]/candidates/new` | Candidate creation and resume upload |
| `/jobs/[id]/candidates/[candidateId]` | Edit candidate and replace resume |
| `/jobs/[id]/candidates/[candidateId]/interviews` | History, scheduling, feedback, decisions |
| `/jobs/[id]/candidates/[candidateId]/resume` | Authorized signed-URL redirect |
| `/panelist/pipeline` | Open slots and waiting candidates |
| `/panelist/interviews` | Own requests, scheduled work, feedback due, history |
| `/panelist/interviews/[id]/feedback` | Submit/read own feedback |
| `/notifications` | Own newest notifications; mark-all-read |
| `/api/auth/[...all]` | Better Auth and admin plugin endpoints |
| `/api/cron/tick` | Secret-protected processing, GET and POST |
| `/api/health` | Public database connectivity diagnostic |

Mutation forms use Server Actions. Their generated identifiers are not a public stable integration API.

## Architecture

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Routing/UI | Next.js 16.4.6, React 19, TypeScript | Server pages, client forms, layouts/actions |
| Styling | Tailwind CSS 4, shared components | Consistent cards, tables, controls, badges |
| Authentication | Better Auth, Drizzle adapter, admin plugin | Passwords, resets, sessions, roles, bans, rate limits |
| Authorization | `src/lib/dal.ts`, route/action checks | Session and role restrictions |
| Persistence | Drizzle, `pg` pool, Supabase Postgres | Auth/hiring records, notifications, audit |
| Files | Supabase Storage | Private resume objects |
| Communication | Microsoft Graph app credentials | Email and service-mailbox Teams events |
| Background work | External scheduler → cron endpoint | Completion, feedback requests, reminders |
| Tests | Vitest | Rules, guards, validation, helpers, payloads |

Requests pass through the optimistic cookie-presence proxy to pages/actions, DAL authorization, and data/integration modules. DAL validates sessions, recognizes allowed roles, and rejects banned users. React `cache` memoizes session lookup within a request. Better Auth also has a 60-second signed-cookie session cache, so revocation immediacy must match that policy.

Database initialization is lazy, allowing builds without database access. Development reuses a connection pool; the database object is globally retained. Pool defaults are three connections on detected serverless hosts and five otherwise, adjustable through `DB_POOL_MAX`.

`loadInterview` reads an interview then its candidate/job/panelist/recruiter context. `confirmBooking` creates a Graph event, saves IDs/link, advances the candidate, notifies the recruiter, and logs activity. These operations are not atomic; the audit specifies a recoverable lifecycle.

## Data model

| Table | Main data and constraints |
| --- | --- |
| `user` | Name, unique email, role, banned status, optional skills |
| `session` | Unique token, expiry, user, session metadata |
| `account` | Provider/account and credential data |
| `verification` | Auth verification/reset data |
| `rate_limit` | Shared authentication throttling |
| `jobs` | Title, department, description, skills, rounds, status, creator |
| `candidates` | Job, contact/background, resume, stage; unique job/email |
| `interviews` | Candidate/job, round, mode, panelist, times, status, Graph/Teams IDs, reminder markers |
| `feedback` | Unique interview, panelist, 1–5 rating, recommendation, comments |
| `notifications` | Recipient, content/link, read/creation timestamps |
| `activity_log` | Actor, action, entity, JSON details, timestamp |

Recommendations are `move_forward`, `hold`, and `reject`. They do not directly advance candidate stage.

Migrations under `drizzle/` cover foundation, RLS, jobs, candidates, interviews/notifications, and feedback/reminders. The overlap exclusion constraint is hand-authored SQL in `0004_add_interviews.sql`; retain and integration-test it when generating later migrations. The migration expects an `extensions` schema for `btree_gist`, as in Supabase. A fresh generic Postgres fixture must account for that prerequisite.

RLS is enabled with no public policies. Application access uses privileged server connections and application authorization, not Supabase Auth JWT policies. Do not add broad public policies to fix a server connection problem.

## Resume handling

Allowed extensions are PDF/DOC/DOCX, maximum 5 MiB. Client checks size; server checks size, extension, and leading bytes. This is basic type screening, not malware scanning. Storage keys use random UUIDs under job IDs. Original names are display metadata. Replacement uploads precede old-object deletion.

The download route checks session, admin/recruiter role, UUIDs, and candidate/job association before issuing a URL valid for 60 seconds. The privileged Storage key stays on the server. Bucket privacy must be configured and verified separately.

## Environment configuration

Never commit real values or expose server secrets through public browser variables.

| Variable | Purpose | Requirement |
| --- | --- | --- |
| `DATABASE_URL` | Runtime Postgres | Required for data access |
| `DIRECT_URL` | Migration connection | Preferred; migration config falls back to runtime URL |
| `DB_POOL_MAX` | Connection limit | Optional; tune to actual host/pooler capacity |
| `AUTH_SECRET` | Auth signing/encryption | Required for deployment |
| `APP_BASE_URL` | Canonical auth/email origin | Set explicitly outside local development |
| `URL` | Hosting origin fallback | Used when app origin unset |
| `SUPABASE_URL` | Project API origin | Required for resumes |
| `SUPABASE_SECRET_KEY` | Privileged storage key | Required for resumes |
| `SUPABASE_STORAGE_BUCKET` | Resume bucket | Defaults to `resumes` |
| `AZURE_TENANT_ID` | Microsoft tenant | Required for Graph |
| `AZURE_CLIENT_ID` | Microsoft application | Required for Graph |
| `AZURE_CLIENT_SECRET` | Application credential | Required for Graph |
| `GRAPH_SERVICE_MAILBOX` | Organizer/sender mailbox | Required for Graph |
| `CRON_SECRET` | Scheduler credential | Required for scheduled processing |

`NETLIFY`, `VERCEL`, and `AWS_LAMBDA_FUNCTION_NAME` affect pool defaults. `AWS_REGION` appears in health output. App origin falls back to `URL`, then localhost; the tick script uses only `APP_BASE_URL` or localhost, so set `APP_BASE_URL` for remote runs.

`CLAUDE.md` recommends the session pooler for both database URLs; `src/db/index.ts` recommends the transaction pooler for serverless production. Reconcile these instructions for the actual host. Migration/runtime endpoints need not be identical. Percent-encode special characters in URL credentials.

There is no committed `.env.example`. The final `.env*` ignore currently overrides the earlier example exception; place the exception after the broad rule when adding a safe template.

## Setup and commands

1. Install the supported deployment Node version and run `npm ci`. The repository does not currently pin Node.
2. Configure `.env` for isolated development services using the inventory above.
3. Provision database and private resume bucket. Review target and migrations before `npm run db:migrate`.
4. Bootstrap an Admin. `CLAUDE.md` describes Better Auth CLI usage; verify installed CLI help/version and target before bootstrap. Do not keep a reusable default password.
5. Run `npm run dev`, or build and start for production-mode checks.
6. Configure Microsoft permissions, tenant consent, mailbox access, and Teams support. Test with designated recipients.
7. Install an external recurring scheduler; the tick script alone is not one.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production compilation |
| `npm run start` | Serve production build |
| `npm test` | Vitest suite |
| `npm run typecheck` | TypeScript validation |
| `npm run lint` | ESLint; currently also traverses nested worktrees |
| `npm run db:generate` | Generate migration; review resulting SQL |
| `npm run db:migrate` | Apply migrations to configured target |
| `npm run tick` | Process scheduled work once against running app |

Read installed Next.js guides in `node_modules/next/dist/docs/` before framework changes, as required by `AGENTS.md`. Use the lockfile. Do not regenerate auth schema or upgrade packages merely to start the application.

## Operations

An external scheduler should call `POST /api/cron/tick` every five minutes with `Authorization: Bearer <CRON_SECRET>`. The endpoint compares the secret in constant time for equal-length inputs. Missing configuration returns 503; invalid authorization returns 401. No recurring scheduler deployment definition was found in this checkout.

The worker expires past pending requests, completes ended scheduled interviews, advances candidates, enqueues feedback requests and 24-hour/1-hour reminders, then processes a bounded delivery batch. Each recipient has an independent durable task with lease recovery, attempt/error tracking, and exponential backoff. Bookings inside the last hour receive only that reminder. Cron responses distinguish enqueue counts from claimed, sent, and failed deliveries.

### Monitoring to add

Track last successful tick, oldest pending task, expired requests, calendar-sync failures, missing join links, recipient delivery attempts, feedback age, pool saturation, and request errors. Correlate interview/operation IDs. Exclude passwords, tokens, reset links, signed resume URLs, and unnecessary candidate data from logs.

### Recovery guide

| Symptom | Investigation and recovery |
| --- | --- |
| Missing invitation | Inspect event ID/mailbox/operation before retrying; avoid duplicate event creation |
| Missing reminder | Check heartbeat and marker; marker currently means claimed, not necessarily sent |
| Stuck candidate | Check expired pending reservation; current recovery is recruiter cancellation/rescheduling |
| Feedback blocked | Check assignment, completion, worker, and account status |
| Missing resume | Compare stored path/object and candidate/audit failures; restore if available |
| Login failure | Check account status, canonical origin, database, session service, rate limit |
| Slow page | Separate database and Graph latency; page-triggered completion can cause delays |

Use audited recovery tools where possible. Manual repair must reconcile both database and external calendar, recording old/new state.

### Deployment checklist

- Clean checkout, committed lockfile, pinned runtime, and validation plan completed.
- Reviewed migrations rehearsed on staging, including RLS and overlap constraint.
- Verified private storage, origin, auth secret, pool settings, Microsoft permissions, and secret ownership.
- Scheduler survives deployment and alerts on missed runs.
- Test mailbox proves invitation creation/update/cancellation, reminders, resets, and outcomes.
- Database and resume object backups restored successfully in rehearsal; database backup alone is insufficient for independent files.
- Release rollback criteria and support owner are defined.

## Source ownership map

| Area | Files |
| --- | --- |
| Auth/access | `src/lib/auth.ts`, `auth-client.ts`, `dal.ts`, `permissions.ts`, `nav.ts`, `src/proxy.ts` |
| Database | `src/db/`, `drizzle/`, `drizzle.config.ts` |
| Recruiting actions | `actions.ts` under `src/app/jobs` and candidate routes |
| Panelist actions | `actions.ts` under pipeline/interviews/feedback routes |
| Scheduling rules | `interviews.ts`, `pipeline.ts`, `outcomes.ts`, `time.ts`, `validation/interview.ts` |
| Communication | `graph.ts`, `booking.ts`, `notify.ts`, `emails.ts`, `scheduled-jobs.ts` |
| Storage | `storage.ts`, `validation/resume.ts`, resume route |
| Shared UI | `src/components/ui/`, `ShellChrome.tsx`, `AppShell.tsx`, `SlotFields.tsx`, `status.tsx` |
| Dashboard queries | `src/lib/dashboard.ts` |
| Operations | `scripts/tick.mjs`, health/cron routes |

## Decisions still needed

Agree shared versus assigned recruiter ownership; skill-based panelist eligibility; candidate availability approval; expiry/fallback timing; live-interview behavior on job closure; no-shows/withdrawals; correction rights; and retention/erasure. `PHASES.md` references two missing pipeline questions. Replace that placeholder with explicit decisions rather than guessing the original questions.
