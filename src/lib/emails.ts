import { appBaseUrl } from "@/lib/base-url";
import { escapeHtml as e } from "@/lib/html";
import { formatInZone } from "@/lib/time";

type Mail = { subject: string; html: string };

export type Details = {
  candidateName: string;
  jobTitle: string;
  round: number;
  startsAt: Date;
  timeZone: string;
};

const when = (d: Details) => formatInZone(d.startsAt, d.timeZone);
const baseUrl = appBaseUrl;

export function panelistRequestMail(panelistName: string, d: Details): Mail {
  return {
    subject: `Interview request: ${d.candidateName} (${d.jobTitle}, round ${d.round})`,
    html:
      `<p>Hello ${e(panelistName)},</p>` +
      `<p>You have been asked to interview <b>${e(d.candidateName)}</b> for <b>${e(d.jobTitle)}</b> (round ${d.round}).</p>` +
      `<p><b>When:</b> ${e(when(d))}</p>` +
      `<p>Please accept or decline in the platform: <a href="${e(baseUrl())}/panelist/interviews">My interviews</a>.</p>`,
  };
}

export function recruiterDeclinedMail(recruiterName: string, panelistName: string, reason: string, d: Details): Mail {
  return {
    subject: `Declined: ${d.candidateName} (${d.jobTitle}, round ${d.round})`,
    html:
      `<p>Hello ${e(recruiterName)},</p>` +
      `<p>${e(panelistName)} declined the interview for <b>${e(d.candidateName)}</b> (${e(d.jobTitle)}, round ${d.round}) on ${e(when(d))}.</p>` +
      (reason ? `<p><b>Reason:</b> ${e(reason)}</p>` : "") +
      `<p>Please choose another panelist in the platform.</p>`,
  };
}

export function recruiterAcceptedMail(recruiterName: string, panelistName: string, d: Details): Mail {
  return {
    subject: `Confirmed: ${d.candidateName} (${d.jobTitle}, round ${d.round})`,
    html:
      `<p>Hello ${e(recruiterName)},</p>` +
      `<p>${e(panelistName)} accepted the interview for <b>${e(d.candidateName)}</b> on ${e(when(d))}. ` +
      `An Outlook invite with the Teams link has been sent to everyone.</p>`,
  };
}

export function eventBodyHtml(d: Details & { panelistName: string }): string {
  return (
    `<p>Interview for <b>${e(d.jobTitle)}</b>, round ${d.round}.</p>` +
    `<p>Candidate: ${e(d.candidateName)}<br>Panelist: ${e(d.panelistName)}</p>` +
    `<p>Join with the Teams link in this invite. External guests may wait in the lobby until the panelist admits them.</p>`
  );
}

export function eventSubject(d: Details): string {
  return `Interview: ${d.candidateName} - ${d.jobTitle} (Round ${d.round})`;
}

export function panelistCancelledMail(panelistName: string, d: Details): Mail {
  return {
    subject: `Cancelled: ${d.candidateName} (${d.jobTitle}, round ${d.round})`,
    html: `<p>Hello ${e(panelistName)},</p><p>The interview with <b>${e(d.candidateName)}</b> on ${e(when(d))} was cancelled.</p>`,
  };
}

export function panelistRescheduledMail(panelistName: string, d: Details): Mail {
  return {
    subject: `Rescheduled: ${d.candidateName} (${d.jobTitle}, round ${d.round})`,
    html:
      `<p>Hello ${e(panelistName)},</p><p>The interview with <b>${e(d.candidateName)}</b> moved to <b>${e(when(d))}</b>.</p>` +
      `<p><a href="${e(baseUrl())}/panelist/interviews">My interviews</a></p>`,
  };
}

const REC_LABEL = { move_forward: "Move forward", hold: "Hold", reject: "Reject" } as const;
export const RECOMMENDATION_LABEL = REC_LABEL;

export function feedbackRequestMail(panelistName: string, interviewId: string, d: Details): Mail {
  return {
    subject: `Please submit feedback: ${d.candidateName} (${d.jobTitle}, round ${d.round})`,
    html:
      `<p>Hello ${e(panelistName)},</p>` +
      `<p>Your interview with <b>${e(d.candidateName)}</b> (${e(d.jobTitle)}, round ${d.round}) has ended.</p>` +
      `<p>Please submit your feedback: <a href="${e(baseUrl())}/panelist/interviews/${e(interviewId)}/feedback">Give feedback</a>.</p>`,
  };
}

export function feedbackSubmittedMail(
  recruiterName: string,
  panelistName: string,
  rating: number,
  recommendation: keyof typeof REC_LABEL,
  d: Details,
  link: string,
): Mail {
  return {
    subject: `Feedback received: ${d.candidateName} (${d.jobTitle}, round ${d.round})`,
    html:
      `<p>Hello ${e(recruiterName)},</p>` +
      `<p>${e(panelistName)} submitted feedback for <b>${e(d.candidateName)}</b> (round ${d.round}).</p>` +
      `<p><b>Rating:</b> ${rating} / 5<br><b>Recommendation:</b> ${REC_LABEL[recommendation]}</p>` +
      `<p><a href="${e(baseUrl())}${e(link)}">Read the feedback and decide the next step</a>.</p>`,
  };
}

export function reminderMail(name: string, d: Details, joinUrl: string | null): Mail {
  return {
    subject: `Reminder: interview on ${when(d)}`,
    html:
      `<p>Hello ${e(name)},</p>` +
      `<p>This is a reminder of the interview for <b>${e(d.jobTitle)}</b> (round ${d.round}) with <b>${e(d.candidateName)}</b>.</p>` +
      `<p><b>When:</b> ${e(when(d))}</p>` +
      (joinUrl ? `<p><a href="${e(joinUrl)}">Join the Teams meeting</a></p>` : ""),
  };
}

export type Outcome = "next_round" | "selected" | "rejected";

export function outcomeMail(candidateName: string, jobTitle: string, outcome: Outcome): Mail {
  const text = {
    next_round: `We enjoyed speaking with you and would like to move you to the next round for the ${e(jobTitle)} position. We will be in touch shortly to schedule it.`,
    selected: `We are pleased to tell you that you have been selected for the ${e(jobTitle)} position. We will contact you soon with the next steps.`,
    rejected: `Thank you for your time and interest in the ${e(jobTitle)} position. After careful consideration we will not be moving forward with your application. We wish you every success.`,
  }[outcome];
  return {
    subject: `Your application for ${jobTitle}`,
    html: `<p>Hello ${e(candidateName)},</p><p>${text}</p><p>Kind regards,<br>The Hiring Team</p>`,
  };
}

export function waitingCandidateMail(
  panelistName: string,
  d: { candidateName: string; jobTitle: string; round: number },
): Mail {
  return {
    subject: `Candidate waiting for an interview: ${d.candidateName} (${d.jobTitle}, round ${d.round})`,
    html:
      `<p>Hello ${e(panelistName)},</p>` +
      `<p><b>${e(d.candidateName)}</b> is waiting for an interview for <b>${e(d.jobTitle)}</b> (round ${d.round}).</p>` +
      `<p>The first panelist to pick this interview takes it: <a href="${e(baseUrl())}/panelist/pipeline">Open the pipeline</a>.</p>`,
  };
}

export function openSlotMail(panelistName: string, d: Details): Mail {
  return {
    subject: `Interview slot open: ${d.candidateName} (${d.jobTitle}, round ${d.round})`,
    html:
      `<p>Hello ${e(panelistName)},</p>` +
      `<p>A recruiter opened an interview slot for <b>${e(d.candidateName)}</b> (${e(d.jobTitle)}, round ${d.round}).</p>` +
      `<p><b>When:</b> ${e(when(d))}</p>` +
      `<p>The first panelist to pick it takes it: <a href="${e(baseUrl())}/panelist/pipeline">Open the pipeline</a>.</p>`,
  };
}
