# Interview Platform – Three Phases

Source: "Interview Platform – Workflow & Feature List" (Nov 20, 2026). The original six build phases (0–5) are regrouped into three.

## Phase 1 – Foundation (original phases 0, 1, 2)
- Microsoft setup: Entra ID app, permissions, admin consent, service mailbox. Test Graph: one event with Teams link, one email.
- Database tables, login, role-based access (Admin / Recruiter / Panelist).
- Admin creates, edits, deactivates users; welcome email.
- Jobs: create and edit. Candidates: upload resume and details, candidate list per job with stages.
- **Done when:** a test invite reaches three inboxes with a working Teams link; each role logs in and sees only its own screens; a recruiter can add a candidate to a job and see them in the list.
- Note: start the Microsoft admin consent request on day one. It depends on the IT team and can take the longest.

## Phase 2 – Scheduling (original phases 3, 4)
- Direct scheduling: recruiter picks panelist and time; panelist accepts or declines (email or in-app). On accept, create the Graph event; all three get the invite. Reschedule and cancel update the event.
- Pipeline scheduling: post interview to open pipeline, notify eligible panelists, first pick locks the slot. Declined or ignored direct requests fall back to the pipeline.
- **Done when:** one real interview is booked end to end, and two panelists clicking at once never double-book.
- Build direct first (no race condition), then pipeline. Pipeline depends on the two open questions the document refers to. `[NEED: the two open questions are not in the document text. Please share them.]`

## Phase 3 – Feedback, Stages and Go-live (original phase 5)
- Feedback form and feedback-request email after the interview.
- Recruiter moves candidate to next round, selected or rejected; optional outcome email to candidate.
- Reminders, activity log, in-app notifications, full end-to-end testing, launch.
- **Done when:** a candidate runs through two rounds to a final outcome.
