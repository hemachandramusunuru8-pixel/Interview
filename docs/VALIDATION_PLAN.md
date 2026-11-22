# Interview Platform Validation and Release Plan

Checks executed on 22 November 2026 are separated from required release tests. Passing unit tests does not prove calendar delivery, concurrent database correctness, or complete user acceptance.

## Completed checks

| Check | Result |
| --- | --- |
| `npm test` | 158 tests passed across 17 files after the F01–F09 code fixes |
| `npm run typecheck` | Passed |
| `npm run lint` | Exit 0; two warnings in a nested `.claude/worktrees` checkout |
| `npm run build` | Passed after Windows junction permission was granted |
| Public UI at 1440/768/375 pixels | Login, forgot-password, missing-token reset: 200, no page overflow |
| Anonymous protected routes | Admin, Recruiter, Panelist, Jobs, Notifications redirect to login |
| Admin UI | Dashboard/users/activity/jobs/new job/notifications/candidate list opened |
| Recruiter UI | Dashboard/jobs/new job/notifications opened; wrong-role pages redirect home |
| Third supplied account | Also reached Recruiter home; no Panelist browser session established |
| Responsive authenticated UI | New-job form and Recruiter dashboard fit all three widths |
| Mobile drawer | Escape does not close it, confirming F12 |
| Browser JavaScript | No uncaught page errors in the inspected routes |
| DST tests | New York spring gap and repeated hour are rejected; ordinary conversion remains covered |

Browser checks used the local production build at `http://localhost:3000` with configured backing services. Credentials are excluded from documentation. No hiring forms were submitted. No live invitation or shared-database concurrency experiments were performed.

Vitest also warned that ESM syntax in a CommonJS-loaded config will need attention under a future Vite native loader default; this is not a current test failure.

## Environments and fixtures

Use unit tests for pure rules; isolated integration tests for real Postgres migrations/constraints plus controlled Graph/Storage doubles; and staging browser acceptance with dedicated accounts and a test mailbox. Include the `extensions` schema and `btree_gist` prerequisite in fresh database fixtures. Concurrency tests need independent connections.

Fixtures should include Admin, two Recruiters, two active Panelists, an inactive Panelist, open/on-hold/closed jobs, two-round candidates, terminal candidates, and pending/scheduled/completed/expired interviews. Never inject failures into production hiring records.

Current access tests chiefly prove role guards and malformed-input checks occur before database work. They do not prove successful action predicates, real constraints, transactions, or external recovery.

## Required acceptance scenarios

| ID | Scenario | Expected result |
| --- | --- | --- |
| AUTH01 | Invite each role and set password | Correct role; expired/reused reset link rejected |
| AUTH02 | Anonymous direct action/route | Denied before data or integrations |
| AUTH03 | Recruiter calls admin action/plugin endpoint | Denied without mutation |
| AUTH04 | Panelist accesses another's feedback | Read/write denied |
| AUTH05 | Deactivate/demote with active cached session | Authority removed within documented policy |
| AUTH06 | Login from deep link | Safe internal destination restored; external redirect rejected |
| AUTH07 | Auth bursts across server instances | Trusted-IP rate limit works |
| JOB01 | Field limits and invalid job values | Useful errors and correct valid save |
| JOB02 | Close job with live requests | Explicit closure policy enforced |
| JOB03 | Reduce rounds below active/completed work | Reject or reconcile explicitly |
| CAN01 | Add candidate with resume | Database/object consistency |
| CAN02 | Duplicate email and case variants | Same-job duplicate blocked; no orphan object |
| CAN03 | Audit failure after candidate insert | No saved candidate loses resume |
| CAN04 | Concurrent resume replacements | Final referenced object preserved |
| CAN05 | Oversize/empty/renamed ZIP/bad signature | Rejected with no misleading success |
| CAN06 | Wrong-role/job/candidate resume URL | No signed URL issued |
| CAN07 | Edit candidate email after booking | Defined attendee-sync behavior |
| INT01 | Accept direct request | One local booking, one Graph event, correct attendees |
| INT02 | Decline or ignore request | Reservation released/fallback according to policy |
| INT03 | Two panelists claim same slot/candidate | Exactly one winner and event |
| INT04 | Same-panelist overlapping bookings | Real exclusion constraint rejects one |
| INT05 | Adjacent time intervals | Boundary behavior verified |
| INT06 | Accept/pick and cancel concurrently | No live orphan invitation or restored cancelled request |
| INT07 | Two reschedules, one external failure | Stale rollback cannot overwrite winner |
| INT08 | Graph success, database save failure | Existing event recovered without duplicate |
| INT09 | Graph event has no join URL | Event ID retained and recoverable status |
| INT10 | Close job while claiming slot | Closure policy checked at transition |
| INT11 | Reschedule after reminders sent | New-time reminders, stale tasks superseded |
| TIME01 | New York gap/repeated hour | Gap rejected; repeated-time choice explicit |
| TIME02 | London/Sydney transitions, India/UTC | Correct instants and display |
| WORK01 | Two cron executions overlap | Safe recovery and no permanently lost work |
| WORK02 | Stop worker after each claim/write | Interrupted work becomes retryable |
| WORK03 | One recipient fails | Independent delivery and retry tracking |
| WORK04 | Completion stage update fails | Interview/candidate converge |
| WORK05 | Missing/wrong cron secret | 503/401, no mutation |
| WORK06 | Large backlog and slow Graph | Bounded worker, responsive read-only pages |
| FB01 | Assigned panelist submits twice | One record; graceful duplicate handling |
| FB02 | Submit before completion | Defined completion/attendance policy enforced |
| FB03 | Latest round lacks feedback | Earlier feedback does not unlock decision queue |
| DEC01 | Concurrent contradictory outcomes | One transition; matching notifications |
| DEC02 | Decision succeeds, mail fails | Decision retained, failure visible, retry available |
| N01 | Older unread beyond first 100 | Bell/total agree; older items reachable |
| UI01 | Keyboard mobile drawer | Named dialog, contained focus, Escape, focus return |
| UI02 | Invalid form | Values preserved; associated/focused errors |
| UI03 | Long names/empty and large lists | Readable mobile layout and actionable states |
| UI04 | Loading/error/network interruption | Useful retry; no stuck busy controls |

## Two-round release journey

1. Admin invites a Recruiter and two Panelists; verify setup and role isolation.
2. Recruiter creates a two-round job and uploads a candidate resume.
3. Verify private resume access and intended panelist preparation permissions.
4. Send round-one direct request; accept and verify one event, correct zone, link, and all test attendees.
5. Reschedule; compare Outlook and app, including reminder recalculation.
6. Verify 24-hour/1-hour reminders through a controlled clock/worker setup.
7. Complete according to attendance policy and submit assigned-panelist feedback.
8. Recruiter chooses next round; old feedback must not unlock later decisions.
9. Post round-two slot and race two Panelists in separate sessions; verify one winner/event.
10. Complete round two, submit feedback, select final outcome, and send only to designated test recipients.
11. Check history, audit, notifications, calendar, and operational delivery records.
12. Repeat a cancellation and a failure/retry path, not only the happy path.

Record sanitized interview and external operation identities for diagnosis. Do not commit credentials, session storage, signed URLs, or real candidate documents.

## Performance validation

Use production builds and record host/database regions, network profile, dataset, and concurrency. Suggested test sizes are 100 jobs/1,000 candidates initially and 1,000 jobs/10,000 candidates next; these are test fixtures, not supported-capacity claims.

Measure cold/warm response p50/p95, SQL count/time, rendered row count, JS transfer, LCP/INP/CLS, Graph latency, and worker throughput. Include slow/unavailable services. Profile before indexing or caching.

Proposed starting targets, subject to agreement:

- Lists return bounded pages of about 25–50 rows.
- Warm normal page responses remain below one second at p95 under the agreed staging profile.
- Mutations acknowledge durable work without an unbounded broadcast delay.
- Worker backlog drains within delivery windows and alerts when it cannot.
- Reading a page never sends email or modifies calendar/business state.

## Release gates

Require isolated-service integration acceptance for F01, migration/live-Graph acceptance for F02–F09, acceptance with all three actual roles, deployed constraint/storage checks, the real two-round integration journey, scheduler monitoring, restore rehearsal, and rollback ownership. Explain and resolve delivery failures before general release.

A controlled internal pilot should name accepted limitations and monitor bookings. Build success and the current unit suite alone are insufficient for unattended production.

## Screenshot evidence

- [Desktop login](screenshots/login-1440.png)
- [Tablet login](screenshots/login-768.png)
- [Mobile login](screenshots/login-375.png)
- [Desktop New job](screenshots/new-job-1440.png)
- [Tablet New job](screenshots/new-job-768.png)
- [Mobile New job](screenshots/new-job-375.png)
