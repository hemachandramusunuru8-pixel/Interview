# Interview Platform Application Audit

Reviewed on 22 November 2026 against commit `1e77359`. This is a whole-application review, not a review of a proposed diff.

## Executive assessment

**Verdict: REQUEST CHANGES before general production release.** The product has a coherent MVP workflow and a consistent UI. The highest-value next investment is booking reliability and operational recovery, followed by searchable work queues and accessibility. A redesign or framework replacement is not justified by the evidence.

The core journey exists: an administrator invites users; recruiters create jobs and upload candidates; panelists accept direct requests or claim pipeline work; Teams invitations are created; feedback supports the recruiter's final decision. However, partial failures can lose a resume, lose reminders, or leave the platform and calendar disagreeing. Several planned scheduling behaviors are incomplete.

Confidence is high for the identified source defects and the browser observations below. Concurrency failures are reasoned from concrete operation ordering, not reproduced against the shared database. External calendar delivery, production hosting configuration, and load capacity require the dedicated release tests in [VALIDATION_PLAN.md](VALIDATION_PLAN.md).

## Evidence and review boundaries

| Check | Result |
| --- | --- |
| Existing Vitest suite | 15 files, 148 tests passed |
| TypeScript | `npm run typecheck` passed |
| ESLint | Exit 0; two warnings inside a nested `.claude/worktrees` checkout, not the reviewed `src` tree |
| Production build | Passed; initial sandbox attempt failed because Windows denied a Turbopack junction, then the permitted rerun succeeded |
| Public UI | Login, forgot-password, and missing-token reset page returned 200 at widths 1440, 768, and 375; no page overflow |
| Anonymous protection | Admin, Recruiter, Panelist, Jobs, and Notifications redirected to login |
| Admin UI | Login, dashboard, users, activity, jobs, new-job form, notifications, and an existing candidate list opened successfully |
| Recruiter UI | Login, dashboard, jobs, new-job form, notifications, and unauthorized-role redirects worked |
| Responsive authenticated UI | New-job form and Recruiter dashboard had no page overflow at 1440, 768, and 375 pixels |
| Browser JavaScript | No uncaught page errors in the inspected authenticated/public screens |
| Mobile menu | Escape did not close the drawer; reproduced in browser |
| Panelist browser session | Not verified: both supplied non-admin accounts landed on `/recruiter` in the connected environment |
| Time conversion | Reproduced: New York `2027-03-14T02:30` converts to `01:30` local instead of being rejected |

No hiring forms, invitations, outcome emails, migrations, or role changes were submitted during the browser review. Application source was not modified. Screenshots are in [screenshots](screenshots/); they show actual public UI and the unsubmitted New job form. Authenticated screens with candidate records were not captured as documentation screenshots.

Local authenticated navigation samples were approximately 156–483 ms after login. These are single-machine observations with a small dataset, not percentile measurements, Core Web Vitals, or production performance guarantees.

## What should be retained

- Next.js server-rendered pages with small client components for interactive forms.
- Central session/role helpers and authorization inside actions, not just navigation guards.
- Zod input validation, UUID validation on record routes, and HTML escaping in email templates.
- Database protection against duplicate live candidate rounds and overlapping panelist bookings.
- Private resume access through a role-checked route and short-lived signed URLs.
- Clear shared UI primitives, consistent badges, empty states, pending button labels, and visible focus styling.
- An explicit feedback gate before recruiter decisions and a conditional update that prevents two final decisions winning together.
- The existing unit and access tests, while extending them to realistic integration cases.

## Prioritized findings

P1 means a significant correctness, reliability, or workflow defect to fix before broad release. P2 means an important usability, scaling, or operational improvement. P3 means optional refinement. No confirmed P0 exploit was established in this review.

| ID | Priority | Finding | Primary evidence |
| --- | --- | --- | --- |
| F01 | P1 | Resolved 22 Nov 2026: candidate and audit creation now share one transaction | `src/app/jobs/[id]/candidates/actions.ts:63–85` |
| F02 | P1 | Resolved in code 22 Nov 2026: calendar creation has stable retries and recovery state | `src/lib/booking.ts`, `src/lib/graph.ts`, migration `0006` |
| F03 | P1 | Resolved in code: versioned calendar-operation reservations prevent competing transitions | interview actions, panelist actions, migration `0007` |
| F04 | P1 | Resolved in code: completion and delivery claims are durable and retryable | `src/lib/scheduled-jobs.ts`, migration `0007` |
| F05 | P1 | Resolved in code: rescheduling advances a schedule revision and resets reminders | interview actions, migration `0007` |
| F06 | P1 | Resolved for past-start requests; pre-start response fallback remains a product-policy decision | `src/lib/scheduled-jobs.ts` |
| F07 | P1 | Resolved in code: accept/claim predicates require an open job | panelist interview/pipeline actions and query |
| F08 | P1 | Resolved in code: DST gaps and repeated ambiguous wall times are rejected | `src/lib/time.ts`, `src/lib/time.test.ts` |
| F09 | P1 | Resolved in code: pages are read-only; cron owns completion and delivery | panelist/candidate pages, cron worker |
| F10 | P2 | Recruiter decision list can show old feedback and totals are capped | `src/lib/dashboard.ts:82–100,131` |
| F11 | P2 | Lists are unbounded or silently capped without paging | Jobs, candidates, users, pipeline, interviews, notifications, activity pages |
| F12 | P2 | Mobile modal is incomplete for keyboard and assistive technology | `src/components/ShellChrome.tsx:114` |
| F13 | P2 | Email success copy is stronger than delivery evidence | `src/lib/notify.ts`, admin user actions, password callback |
| F14 | P2 | Notification unread totals disagree after the first 100 records | `src/app/notifications/page.tsx:21–22`, `NotificationsLink.tsx` |
| F15 | P2 | Public health response exposes infrastructure diagnostics | `src/app/api/health/route.ts` |
| F16 | P2 | No route-level recovery/loading UI or deployment test pipeline in the reviewed tree | `src/app`, repository root, ESLint config |

### F01 Candidate resume deletion after a successful save

**Status: resolved on 22 November 2026.** Candidate insertion and `logActivity` now use the same Postgres transaction. If either write fails, Postgres rolls both back before the uploaded object is cleaned up. The audit helper accepts the transaction writer so the audit row cannot accidentally use a separate connection.

Two focused tests verify that the same transaction writer reaches the audit helper and that a failed audit write cleans up the unreferenced object without notifying panelists. The full suite passes with 150 tests. Resume replacement concurrency and cleanup retries remain separate hardening work.

**Remaining integration acceptance:** run the injected audit failure against isolated Postgres and Storage services to verify the real rollback and object cleanup together.

### F02 Orphaned or duplicate calendar events

**Status: resolved in code on 22 November 2026; migration and live Graph acceptance remain.** Booking now has explicit `idle`, `creating`, `confirmed`, and `failed` states. The interview UUID is sent to Graph as `transactionId`, so a timed-out create can be retried with the same identity. A returned event ID is preserved even when its Teams link is missing, and retries reload known events rather than posting another one.

Failed or interrupted creation keeps the interview assigned to the winning panelist and exposes a retry action. A two-minute stale lease recovers processes that stop during creation. Local confirmation, candidate-stage advancement, and audit logging commit in one transaction. Only confirmed bookings can be completed, reminded, or counted as upcoming. Graph token/event calls now have 15-second timeouts. Microsoft documents `transactionId` specifically for avoiding redundant event creation on retries. [Graph event resource](https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0)

Seven focused booking/Graph tests cover stable identity, successful atomic confirmation, Graph failure, missing join URL, known-event reload, local-finalization failure, and payload deduplication. Migration `0006_add_booking_state.sql` backfills existing events as confirmed and unresolved scheduled rows as failed. Apply it through the normal deployment process before releasing this code. Staging must still simulate a timeout after real Graph creation and confirm that only one mailbox event exists.

### F03 Concurrent calendar changes have no operation guard

**Status: resolved in code on 22 November 2026; concurrent database acceptance remains.** Interviews now carry a monotonic version and an explicit calendar-operation state. Reschedule and cancellation reserve the operation with a conditional update before calling Graph; stale writers cannot finalize or roll back a newer operation. Acceptance, pipeline claims, booking confirmation, completion, and expiry require an idle calendar state.

For example, cancellation reads a pending interview. Acceptance then sets it to scheduled and starts creating the event. Cancellation writes cancelled using only the interview ID; it skips Graph cancellation because its earlier snapshot was pending. Acceptance subsequently saves the event ID and advances the candidate. The result can be a cancelled platform interview with a live invitation. The unconditional acceptance rollback can also overwrite a concurrent cancellation. Reschedule rollback can overwrite another successful reschedule.

**Fix:** use versioned transitions or conditional state updates across every lifecycle operation, with a durable operation owner for calendar synchronization. Reserve the transition before making external calls and reconcile the result afterward. Coordinate cancellation with in-flight creation instead of treating `scheduled` as proof that creation has finished.

**Acceptance:** concurrently run accept/cancel, pick/cancel, accept/reschedule, two reschedules, and reschedule/completion. The platform, candidate stage, and calendar must converge to one consistent outcome.

### F04 Claimed does not mean delivered

**Status: resolved in code on 22 November 2026; migration and failure-injection acceptance remain.** Completion, candidate advancement, feedback-task creation, and audit now commit together. Reminders enqueue one durable task per recipient and schedule revision. The worker claims bounded batches using `FOR UPDATE SKIP LOCKED`, recovers stale leases, records attempts/errors, and retries with exponential backoff. In-app notification insertion is idempotent. Email delivery is at-least-once because Microsoft Graph does not expose a send-mail idempotency key.

Reminders set their sent timestamps before email delivery. `notifyUser` catches email errors, so later jobs cannot distinguish successful delivery from a failed attempt. Completion sets `completed` and `feedbackRequestedAt` before updating the candidate or issuing feedback requests. A crash or database failure after that claim leaves work permanently excluded from later runs.

**Fix:** commit related local transitions together and record durable delivery tasks separately. Track attempts, delivery/acceptance status, next retry, and terminal failure for each recipient. Use retryable leases so interrupted workers can recover. Do not solve this by simply moving the timestamp after send: that alone reintroduces duplicate sends under concurrent workers.

**Acceptance:** interrupt a worker at each operation boundary, make individual recipients fail, and run two workers together. Local stages recover and unsuccessful deliveries remain retryable. Report claimed, completed, failed, and retried counts separately.

### F05 New interview time inherits old reminder markers

**Status: resolved in code on 22 November 2026.** Rescheduling increments `schedule_revision`, clears both reminder markers, and cancels retryable tasks from the prior revision. The next worker run creates reminders for the new schedule only.

Reschedule changes only start, end, and time zone. If the 24-hour or 1-hour reminder was already sent, moving the interview to a future day does not make those reminders eligible again.

**Fix:** tie reminder tasks to an interview schedule revision. Supersede old pending tasks and schedule new ones when the external and local reschedule complete. A minimal implementation must reset the relevant markers safely and handle already-running workers.

**Acceptance:** send both reminders, move the interview two days later, and verify the new schedule gets the appropriate reminders without sending stale-time reminders.

### F06 Requests never expire

**Status: partially resolved on 22 November 2026.** Pending direct requests and pipeline slots are cancelled and audited once their start time passes, releasing the live candidate-round constraint. The earlier pre-start response deadline and automatic fallback concept remains intentionally deferred until the business chooses a waiting period and notification policy.

The worker handles scheduled completion and reminders only. A pending request whose start time passes cannot be accepted, but still occupies the live candidate-round constraint and excludes the candidate from the waiting pipeline. An expired unclaimed pipeline slot has the same problem. Manual recruiter cancellation/rescheduling is the only recovery.

`PHASES.md` also promises ignored direct requests will fall back to the pipeline. Declining currently frees the candidate to reappear in the waiting list, but does not preserve the declined slot as an automatically broadcast pipeline offer.

**Fix:** define a response deadline and explicit expiry/fallback policy. Release expired reservations, alert the recruiter, and either publish a viable future slot or return the candidate to the waiting queue. Never announce a time that has already passed.

**Acceptance:** advance a test clock beyond the response deadline and start time. The candidate becomes actionable without manual database repair and the event is audited once.

### F07 Closing a job does not stop pending claims

**Status: resolved in code on 22 November 2026 for new claims.** Direct acceptance, retry, fixed-slot claim, and the open-slot list now require the related job to remain open. Policy for already-confirmed interviews and round-count reductions remains separate product work.

New scheduling checks job status, but `pickSlotAction` and direct acceptance only check the interview row. Posting an open slot and then closing its job still allows a panelist to claim it. The open-slots query also lacks the open-job condition. This conflicts with the application's displayed rule that new interviews cannot be booked for a closed job.

**Fix:** define what closure means for existing pending and scheduled work. Enforce that policy atomically during acceptance/claiming, including a concurrent close. Show the effect on outstanding interviews before closing a job. Also guard reductions in round count when candidates already have rounds in progress.

**Acceptance:** close or hold a job with a pending direct request and pipeline slot; neither can create a newly confirmed booking when policy forbids it. Existing booked interviews follow an explicit continuation/cancellation policy.

### F08 Daylight-saving gap conversion

**Status: resolved in code on 22 November 2026.** Conversion now round-trips the requested wall clock and rejects both nonexistent spring-forward times and ambiguous repeated autumn times. Focused New York tests cover both cases; broader London/Sydney acceptance remains in the release plan.

Executing the current helper with `2027-03-14T02:30` in `America/New_York` returned `2027-03-14T06:30:00.000Z`, which formats as `01:30` in that zone. The requested 02:30 local time does not exist that day. The two-pass offset algorithm does not verify the result against the original wall time. Autumn repeated times also need an explicit disambiguation policy.

**Fix:** reject non-round-tripping local times and clearly resolve repeated times. Show the resolved local time and UTC offset before confirmation. Cover both northern and southern hemisphere transitions.

**Acceptance:** the reproduced gap is rejected with a useful message, ordinary India bookings remain unchanged, and repeated-time behavior is specified and tested.

### F09 Visiting a screen processes the global backlog

**Status: resolved in code on 22 November 2026.** Completion calls were removed from all Server Components. Only the protected cron route runs expiry, completion, reminder enqueueing, and bounded delivery processing.

Panelist dashboard/interviews and candidate interview pages await `completeEndedInterviews()` without a user or candidate scope. A single page render can process all ended interviews, perform multiple database reads for each, and await email delivery serially. A slow Graph call or backlog therefore delays an unrelated user's page. GET rendering also causes business mutations and communications.

**Fix:** move completion and delivery to a bounded, monitored background worker. Keep pages read-only and show an understandable processing state when necessary. Alert on scheduler delay instead of masking it through page loads. Use batch limits and worker execution budgets.

**Acceptance:** seed a completion backlog and slow email responses in staging. Reading a page does not mutate records or send mail and its latency does not grow with the global delivery backlog.

### Other confirmed issues

- **F10:** `needsDecision` joins every completed interview with feedback for an `interview_done` candidate. After round two ends but before its feedback arrives, round-one feedback can incorrectly put the candidate in the decision queue. Multiple completed rounds can duplicate a candidate. The action correctly rejects an unavailable decision, but the dashboard misleads users. Select only the latest completed round, require its feedback, and count all eligible candidates separately from the six-item preview. Panelist upcoming count is also based on a five-item preview.
- **F11:** paginate jobs, candidates, users, interview history, and both pipeline sections. Notifications stop at 100 and activity at 200 without older-page navigation. Add stable ordering, search, filters, page counts, and deep links that retain the filters. Do not load all rows just to compute stage totals.
- **F12:** the mobile dialog has no accessible name, focus placement/trap/return, Escape handler, or background inertness. Add those behaviors and `aria-expanded`/`aria-controls` to the trigger. The WAI dialog pattern describes the expected keyboard behavior. [Modal dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- **F13:** broadcasts return the number of recipients considered, not successful deliveries; `allSettled` results are ignored. Password emails are launched without awaiting a durable task, while admin success text says an email was sent. Show queued/failed delivery states, support resend, and use a managed background lifecycle for serverless execution. Graph accepting a message is not proof it reached the inbox.
- **F14:** a user with unread notifications older than the newest 100 can see a nonzero bell but “all caught up” on the page, with the mark-all button hidden. Query the complete unread total separately and expose older records.
- **F15:** public health returns database host/port/name, server region, timing, and raw root error excerpts. Keep public liveness minimal; authenticate detailed diagnostics and use bounded readiness probes. The regex only redacts URL-shaped credentials, not all potentially sensitive diagnostic content.
- **F16:** add meaningful route error/retry and loading states. Scope lint to this project or ignore nested worktrees; the current lint spends effort on another checkout. Add CI for tests, types, lint, build, and isolated integration checks. No CI configuration was found in this checkout; a hosted pipeline may exist separately.

## UI and workflow improvements

### Navigation and dashboards

Keep the sidebar, restrained color palette, consistent cards, and role-oriented navigation. Make dashboard metrics link to the exact queue behind each number. Add “needs attention” sections for expired requests, missing feedback, failed invitations, and unsent outcome emails. Use real totals with “showing 6 of 24” previews.

Add a skip-to-content link. Preserve the intended destination after login so emailed links open the requested record rather than always landing on a dashboard. Keep the return destination restricted to valid internal paths. Use complete candidate names where truncation makes similar names indistinguishable.

### Jobs and candidates

Add name/email search, stage filters, job owner, department, and sorting. Turn stage count chips into usable filters. Use mobile candidate cards or a compact column layout; the shared table deliberately has a 640px minimum width, so table scrolling remains necessary on narrow phones even when the page itself fits.

Create a candidate overview that combines profile, resume, interview timeline, feedback, and next action. Existing interviews page is a good starting point. Prefill reschedule forms with current time, duration, and zone rather than blank fields with the India default. Explain the effect of changing candidate contact details after calendar invitations exist; currently candidate email edits do not update the calendar attendee list.

Add early screening rejection, candidate withdrawal, no-show, and administrative correction paths. Currently the only rejection path requires a completed interview and feedback. Do not treat every interview whose end time passed as proof it occurred. Preserve history and reasons for corrections.

### Scheduling and panelist preparation

Show a confirmation summary with candidate, job, round, panelist, duration, time zone, and notification recipients. Provide availability/conflict hints before submission, not just after a database constraint rejects it. The current overlap protection covers platform panelist interviews, not all Outlook appointments or candidate conflicts across jobs.

Provide assigned panelists with a scoped preparation view: relevant job description, resume, interview objectives, and rubric. The current resume route explicitly rejects panelists, and their interview list shows only limited background. Do not grant all panelists unrestricted candidate-library access to solve this.

Clarify who may claim pipeline work. The app currently broadcasts to all active panelists and does not use panelist skills to restrict claims. If skills are only informative, say so; if expertise eligibility is required, implement management, filtering, authorization, and audit together.

### Feedback and decisions

Keep the simple rating/recommendation/comments form for MVP, but add scoring guidance so ratings mean the same thing across panelists. Offer drafts/autosave, a clear submission confirmation, and a controlled amendment history. Add explicit decision confirmation when candidate email is selected, showing the recipient and message preview.

Support a recruiter-visible feedback due date and reminders, and a recovery path when an assigned panelist is deactivated before submitting. User deactivation currently does not reassign outstanding interview responsibilities.

### Forms and accessibility

Associate field errors and hints with controls, set `aria-invalid`, and move focus to the first error. Preserve form values after validation failure. Add visible focus styling on the proxy elements for visually hidden radios and the resume picker; a global outline on a clipped input is insufficient. Give the decline reason a persistent label, not only a placeholder. Represent scheduling mode selection with accessible selection semantics.

The mobile login has substantial vertical whitespace on a 900px-high screen. Test shorter phones and the software keyboard before changing alignment. Password visibility toggles and clearer network-error recovery would help; forgot-password currently shows the same completion state without checking returned service errors. Keep account-existence responses generic while distinguishing connectivity failures.

## Performance improvement plan

| Order | Change | Why it matters | Validation |
| --- | --- | --- | --- |
| 1 | Remove completion/email work from page rendering | Prevents global backlog and external API latency from blocking screens | Backlog + slow-service staging test |
| 2 | Durable delivery queue with bounded concurrency | Broadcasts currently start work for every active panelist at once | Throttling and worker-restart tests |
| 3 | Paginate and narrow list projections | Bounds HTML, query results, hydration, and browser DOM | Seed representative large datasets |
| 4 | Reduce query waterfalls and repeated interview context loading | Candidate detail performs sequential reads; each reminder loads multiple related rows | Trace SQL count and request spans |
| 5 | Tune indexes against measured query plans | Status/time, panelist/time, candidate/history, notification ordering are likely candidates | Staging execution plans and write-cost comparison |
| 6 | Add streaming/loading boundaries | Improves perceived speed while independent panels load | Slow-network navigation test |
| 7 | Instrument web and backend performance | Enables evidence-based optimization | Track p50/p95, query time, Graph time, worker lag, and page vitals |

Keep per-request session memoization. Do not globally cache private dashboard results without user/access-aware isolation. The 60-second auth cookie cache is an explicit revocation-delay tradeoff; reconcile documentation that describes revocation as immediate and require fresh authorization for sensitive administrative changes if immediate revocation is required.

Graph calls currently have no explicit timeout or retry policy. Add bounded timeouts, classify retryable errors, and obey `Retry-After` for throttling. Retrying event creation must first be safe under F02. [Microsoft Graph throttling guidance](https://learn.microsoft.com/en-us/graph/throttling)

Index suggestions above are investigation targets, not measured missing-index findings. No production query plan or load test was performed.

## Security and privacy decisions

The code implements a single shared organization: all recruiters can access all jobs and candidates. There is no tenant or job-assignment boundary. That is not automatically a vulnerability for an internal shared recruiting team, but must be explicit. Do not present this version as isolated multi-company SaaS.

Database RLS is enabled in migrations with no public data policies; server code uses a privileged connection. Therefore server-side authorization remains essential. Resume storage uses a privileged server-only key and assumes a private bucket. Verify bucket settings and public/API role access in the actual environment; source declarations do not prove deployed settings. Supabase explicitly warns that service keys bypass storage RLS. [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

Define retention and controlled erasure for resumes, candidate contact data, audit details, and backups. Current “never delete candidates” behavior preserves history but is not a complete retention strategy. Determine policy with the organization; this report is not a jurisdiction-specific legal assessment.

Treat file magic checks as basic type screening, not malware scanning. DOCX validation currently checks ZIP magic only. Consider quarantine and scanning before distribution, validate document structure, and decide whether legacy DOC is still required.

Review the full Better Auth admin API surface as well as custom UI actions. UI-only protections such as “cannot deactivate yourself” do not automatically constrain every plugin endpoint. Verify desired restrictions, session revocation, trusted proxy IP headers, rate limits, and administrative audit coverage in staging.

## Add, remove, and defer

| Action | Recommendation |
| --- | --- |
| Add first | Durable booking/delivery recovery; request expiry; scheduler monitoring; integration tests; search/pagination; accessible mobile navigation |
| Add next | Candidate screening/withdrawal/no-show, scoped panelist preparation, availability, feedback drafts/rubrics, reliable delivery status and resend |
| Add when needed | Recruiter ownership, reports/export, skill eligibility, notification preferences, corporate SSO/MFA, richer analytics |
| Remove or replace | Global job processing during page renders; inaccurate “nothing changed/everyone notified” copy; obsolete phase placeholder; boilerplate onboarding documentation |
| Simplify | Repeated interview transitions into a shared service with explicit invariants; shared audit/delivery behavior; lint scope excluding nested checkouts |
| Optional cleanup | Unreferenced starter SVG assets after checking references; unused font/skills fields only after deciding their intended feature |
| Defer | A visual rewrite, drag-and-drop pipeline, dark mode, AI ranking, microservices, and a new state-management framework until a real need is established |

## Delivery roadmap

### Stage 1 Reliability and release blockers

Apply and verify migrations `0006` and `0007`, add concurrent database/failure-injection tests, define the deferred pre-start fallback semantics, and verify booking and delivery recovery against a test mailbox. Exit when duplicate clicks, timeouts, crashes, and competing changes converge to a correct result.

### Stage 2 Daily recruiting efficiency

Fix dashboard/notification totals; add search, filters, pagination, accessible navigation, route recovery, candidate screening exceptions, and assigned-panelist preparation. Exit when a recruiter can find and act on a candidate without searching long lists and every important task works by keyboard/mobile.

### Stage 3 Operational readiness

Add delivery observability, job heartbeats, deployment checks, backup/restore rehearsal, private-storage verification, retention workflow, and support procedures. Execute a two-round candidate journey using dedicated Admin, Recruiter, and Panelist accounts with test recipients.

### Stage 4 Product expansion

Use observed demand to prioritize availability, rubric templates, feedback drafts, ownership, integrations, and reports. Measure completion rates and time spent waiting at each stage before adding more features.

These stages are dependency order, not calendar estimates. Assign engineering effort after the booking/delivery design and hosting constraints are agreed.
