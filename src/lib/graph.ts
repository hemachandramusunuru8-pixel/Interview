// Minimal Microsoft Graph client: app-only token + sendMail from the service mailbox.

type CachedToken = { value: string; expiresAt: number };
let cached: CachedToken | null = null;
const GRAPH_TIMEOUT_MS = 15_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;

  const tenant = requireEnv("AZURE_TENANT_ID");
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("AZURE_CLIENT_ID"),
      client_secret: requireEnv("AZURE_CLIENT_SECRET"),
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Graph token request failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.value;
}

export type MailInput = { to: string; subject: string; html: string };

export async function sendMail({ to, subject, html }: MailInput): Promise<void> {
  const mailbox = requireEnv("GRAPH_SERVICE_MAILBOX");
  const token = await getAccessToken();
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: false,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Graph sendMail failed (${res.status}): ${await res.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Calendar events with a Teams link. The event is organised by the service mailbox,
// so every attendee receives a standard Outlook invite.
// ---------------------------------------------------------------------------

export type Attendee = { name: string; email: string };

export type EventInput = {
  transactionId: string;
  subject: string;
  html: string;
  startsAt: Date;
  endsAt: Date;
  attendees: Attendee[];
};

// Graph wants a wall-clock string plus a zone. Sending UTC avoids any zone ambiguity; each
// attendee's calendar shows the meeting in their own time zone.
function utcWallClock(d: Date) {
  return { dateTime: d.toISOString().replace(/\.\d{3}Z$/, ""), timeZone: "UTC" };
}

export function buildEventPayload(input: EventInput) {
  return {
    transactionId: input.transactionId,
    subject: input.subject,
    body: { contentType: "HTML", content: input.html },
    start: utcWallClock(input.startsAt),
    end: utcWallClock(input.endsAt),
    attendees: input.attendees.map((a) => ({
      emailAddress: { address: a.email, name: a.name },
      type: "required",
    })),
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
    allowNewTimeProposals: false,
  };
}

async function graphRequest(method: string, path: string, body?: unknown) {
  const token = await getAccessToken();
  const mailbox = encodeURIComponent(requireEnv("GRAPH_SERVICE_MAILBOX"));
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Graph ${method} ${path.split("/")[1] ?? ""} failed (${res.status}): ${await res.text()}`);
  }
  return res.status === 204 || res.status === 202 ? null : res.json();
}

/** Creates the event and returns the Teams join link and the event id. */
export async function createInterviewEvent(input: EventInput) {
  const event = (await graphRequest("POST", "/events", buildEventPayload(input))) as {
    id: string;
    onlineMeeting?: { joinUrl?: string } | null;
  };
  return { eventId: event.id, joinUrl: event.onlineMeeting?.joinUrl ?? null };
}

/** Reloads an event created by an earlier attempt, including a Teams link that finished provisioning later. */
export async function getInterviewEvent(eventId: string) {
  const event = (await graphRequest("GET", `/events/${encodeURIComponent(eventId)}`)) as {
    id: string;
    onlineMeeting?: { joinUrl?: string } | null;
  };
  return { eventId: event.id, joinUrl: event.onlineMeeting?.joinUrl ?? null };
}

/** Moves the event; Outlook sends the attendees an updated invite. */
export async function rescheduleInterviewEvent(eventId: string, startsAt: Date, endsAt: Date) {
  await graphRequest("PATCH", `/events/${encodeURIComponent(eventId)}`, {
    start: utcWallClock(startsAt),
    end: utcWallClock(endsAt),
  });
}

/** Cancels the event; Outlook sends the attendees a cancellation. */
export async function cancelInterviewEvent(eventId: string, comment: string) {
  await graphRequest("POST", `/events/${encodeURIComponent(eventId)}/cancel`, { comment });
}

// ---------------------------------------------------------------------------
// Teams recordings. Requires OnlineMeetings.Read(Write).All and OnlineMeetingRecording.Read.All, plus a
// Teams application access policy granted to the service mailbox user (the meeting organizer).
// ---------------------------------------------------------------------------

let serviceUserId: string | null = null;

/** Object id of the service mailbox user, who organises every interview meeting. */
async function organizerId(): Promise<string> {
  if (serviceUserId) return serviceUserId;
  const token = await getAccessToken();
  const mailbox = encodeURIComponent(requireEnv("GRAPH_SERVICE_MAILBOX"));
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}?$select=id`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Graph user lookup failed (${res.status}): ${await res.text()}`);
  serviceUserId = ((await res.json()) as { id: string }).id;
  return serviceUserId;
}

async function meetingsRequest(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const user = await organizerId();
  return fetch(`https://graph.microsoft.com/v1.0/users/${user}/onlineMeetings${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers as Record<string, string> | undefined) },
  });
}

/** The Teams meeting id behind a join link, or null if Teams has no such meeting. */
export async function findOnlineMeetingId(joinUrl: string): Promise<string | null> {
  const filter = encodeURIComponent(`JoinWebUrl eq '${joinUrl.replace(/'/g, "''")}'`);
  const res = await meetingsRequest(`?$filter=${filter}`);
  if (!res.ok) throw new Error(`Graph meeting lookup failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { value?: { id: string }[] };
  return body.value?.[0]?.id ?? null;
}

export type GraphRecording = { id: string; meetingId: string; createdDateTime?: string; endDateTime?: string };

/** Recordings Teams has finished processing for a meeting (often none until a few minutes after it ends). */
export async function listMeetingRecordings(meetingId: string): Promise<GraphRecording[]> {
  const res = await meetingsRequest(`/${encodeURIComponent(meetingId)}/recordings`);
  if (!res.ok) throw new Error(`Graph recordings list failed (${res.status}): ${await res.text()}`);
  return ((await res.json()) as { value?: GraphRecording[] }).value ?? [];
}

/**
 * The recording video. Redirects are not followed, so the caller can send the browser straight to
 * Microsoft's own link when Graph offers one; otherwise the bytes are returned to stream through.
 */
export async function fetchRecordingContent(meetingId: string, recordingId: string, range?: string | null) {
  return meetingsRequest(`/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}/content`, {
    redirect: "manual",
    headers: range ? { Range: range } : undefined,
  });
}
