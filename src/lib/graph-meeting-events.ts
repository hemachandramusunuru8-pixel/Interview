import "server-only";
import {
  constants,
  createDecipheriv,
  createHmac,
  privateDecrypt,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "@/db";
import { graphMeetingNotifications, interviews } from "@/db/schema";
import { appBaseUrl } from "@/lib/base-url";
import {
  createMeetingCallSubscription,
  GraphRequestError,
  renewGraphSubscription,
} from "@/lib/graph";
import { completeInterview } from "@/lib/interview-completion";

const SUBSCRIPTION_LIFETIME_MS = 60 * 60 * 60 * 1000; // Safely below Graph's three-day maximum.
const SUBSCRIPTION_RENEW_WINDOW_MS = 12 * 60 * 60 * 1000;
const SUBSCRIPTION_LEASE_MS = 5 * 60 * 1000;
const NOTIFICATION_LEASE_MS = 5 * 60 * 1000;
const MAX_NOTIFICATION_ATTEMPTS = 8;
const GRAPH_NOTIFICATION_APP_ID = "0bf30f3b-4a52-48df-9a82-234910c4a086";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function webhookConfiguration() {
  const notificationUrl = `${appBaseUrl()}/api/webhooks/graph/meeting-events`;
  if (!notificationUrl.startsWith("https://")) {
    throw new Error("APP_BASE_URL must be a public HTTPS URL before Graph webhooks can be enabled");
  }
  const clientState = requireEnv("GRAPH_WEBHOOK_CLIENT_STATE");
  if (Buffer.byteLength(clientState, "utf8") > 128) {
    throw new Error("GRAPH_WEBHOOK_CLIENT_STATE must be at most 128 bytes");
  }
  return {
    notificationUrl,
    clientState,
    encryptionCertificate: requireEnv("GRAPH_WEBHOOK_CERTIFICATE").replace(/\s/g, ""),
    encryptionCertificateId: requireEnv("GRAPH_WEBHOOK_CERTIFICATE_ID"),
  };
}

function subscriptionExpiration(now: Date) {
  return new Date(now.getTime() + SUBSCRIPTION_LIFETIME_MS).toISOString();
}

type SubscriptionCandidate = {
  id: string;
  teamsJoinUrl: string | null;
  graphCallSubscriptionId: string | null;
  graphCallSubscriptionExpiresAt: Date | null;
};

async function claimSubscription(interviewId: string, now: Date): Promise<SubscriptionCandidate | null> {
  const stale = new Date(now.getTime() - SUBSCRIPTION_LEASE_MS);
  const [claimed] = await db
    .update(interviews)
    .set({ graphCallSubscriptionLockedAt: now })
    .where(
      and(
        eq(interviews.id, interviewId),
        eq(interviews.status, "scheduled"),
        eq(interviews.bookingState, "confirmed"),
        eq(interviews.calendarState, "idle"),
        isNotNull(interviews.teamsJoinUrl),
        or(isNull(interviews.graphCallSubscriptionLockedAt), lt(interviews.graphCallSubscriptionLockedAt, stale)),
      ),
    )
    .returning({
      id: interviews.id,
      teamsJoinUrl: interviews.teamsJoinUrl,
      graphCallSubscriptionId: interviews.graphCallSubscriptionId,
      graphCallSubscriptionExpiresAt: interviews.graphCallSubscriptionExpiresAt,
    });
  return claimed ?? null;
}

/** Creates or renews the rich Graph meeting-call subscription for one interview. */
export async function ensureMeetingEventSubscription(interviewId: string, now: Date = new Date()): Promise<boolean> {
  const config = webhookConfiguration();
  const row = await claimSubscription(interviewId, now);
  if (!row?.teamsJoinUrl) return false;

  const expirationDateTime = subscriptionExpiration(now);
  try {
    let subscription: { id: string; expirationDateTime: string };
    if (row.graphCallSubscriptionId && row.graphCallSubscriptionExpiresAt && row.graphCallSubscriptionExpiresAt > now) {
      try {
        subscription = await renewGraphSubscription(row.graphCallSubscriptionId, expirationDateTime);
      } catch (error) {
        if (!(error instanceof GraphRequestError) || error.status !== 404) throw error;
        subscription = await createMeetingCallSubscription({
          ...config,
          joinUrl: row.teamsJoinUrl,
          expirationDateTime,
        });
      }
    } else {
      subscription = await createMeetingCallSubscription({
        ...config,
        joinUrl: row.teamsJoinUrl,
        expirationDateTime,
      });
    }

    await db
      .update(interviews)
      .set({
        graphCallSubscriptionId: subscription.id,
        graphCallSubscriptionExpiresAt: new Date(subscription.expirationDateTime),
        graphCallSubscriptionLockedAt: null,
      })
      .where(eq(interviews.id, row.id));
    return true;
  } catch (error) {
    await db
      .update(interviews)
      .set({ graphCallSubscriptionLockedAt: null })
      .where(eq(interviews.id, row.id));
    throw error;
  }
}

/** Keeps all confirmed interview subscriptions alive despite Graph's short expiry. */
export async function ensureMeetingEventSubscriptions(now: Date = new Date(), limit = 25) {
  // Fail once per tick when deployment configuration is incomplete instead of
  // producing one identical error for every due interview.
  webhookConfiguration();
  const renewBefore = new Date(now.getTime() + SUBSCRIPTION_RENEW_WINDOW_MS);
  const stale = new Date(now.getTime() - SUBSCRIPTION_LEASE_MS);
  const due = await db
    .select({ id: interviews.id })
    .from(interviews)
    .where(
      and(
        eq(interviews.status, "scheduled"),
        eq(interviews.bookingState, "confirmed"),
        eq(interviews.calendarState, "idle"),
        isNotNull(interviews.teamsJoinUrl),
        or(isNull(interviews.graphCallSubscriptionExpiresAt), lte(interviews.graphCallSubscriptionExpiresAt, renewBefore)),
        or(isNull(interviews.graphCallSubscriptionLockedAt), lt(interviews.graphCallSubscriptionLockedAt, stale)),
      ),
    )
    .limit(limit);

  let active = 0;
  let failed = 0;
  for (const row of due) {
    try {
      if (await ensureMeetingEventSubscription(row.id, now)) active++;
    } catch (error) {
      failed++;
      console.error("Graph meeting-call subscription failed:", row.id, error);
    }
  }
  return { due: due.length, active, failed };
}

type EncryptedContent = {
  data: string;
  dataKey: string;
  dataSignature: string;
  encryptionCertificateId: string;
};

export type GraphMeetingNotification = {
  subscriptionId: string;
  clientState?: string;
  tenantId?: string;
  resourceData?: { id?: string };
  encryptedContent?: EncryptedContent;
};

type StoredNotification = {
  notification: GraphMeetingNotification;
  validationTokens: string[];
};

function secretMatches(received: string | undefined): boolean {
  if (!received) return false;
  const expected = process.env.GRAPH_WEBHOOK_CLIENT_STATE;
  if (!expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Performs the cheap shared-secret check and durably queues notifications before returning 202. */
export async function queueMeetingNotifications(input: unknown): Promise<number> {
  if (!input || typeof input !== "object") return 0;
  const body = input as { value?: unknown; validationTokens?: unknown };
  if (!Array.isArray(body.value) || body.value.length > 100) return 0;
  const validationTokens = Array.isArray(body.validationTokens)
    ? body.validationTokens.filter((token): token is string => typeof token === "string")
    : [];
  if (!validationTokens.length) return 0;

  const rows = body.value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const notification = raw as GraphMeetingNotification;
    if (typeof notification.subscriptionId !== "string" || !secretMatches(notification.clientState)) return [];
    const payload: StoredNotification = { notification, validationTokens };
    return [{
      subscriptionId: notification.subscriptionId,
      notificationId: typeof notification.resourceData?.id === "string" ? notification.resourceData.id : null,
      payload,
    }];
  });
  if (!rows.length) return 0;
  const inserted = await db.insert(graphMeetingNotifications).values(rows).onConflictDoNothing().returning({ id: graphMeetingNotifications.id });
  return inserted.length;
}

let graphJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function validateTokens(tokens: string[], tenantId: string) {
  if (tenantId !== requireEnv("AZURE_TENANT_ID")) throw new Error("Notification tenant does not match this application");
  graphJwks ??= createRemoteJWKSet(new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"));
  let tenantTokenFound = false;
  for (const token of tokens) {
    const { payload } = await jwtVerify(token, graphJwks, { audience: requireEnv("AZURE_CLIENT_ID") });
    const version = payload.ver;
    const expectedIssuer = version === "1.0"
      ? `https://sts.windows.net/${tenantId}/`
      : `https://login.microsoftonline.com/${tenantId}/v2.0`;
    if (payload.iss !== expectedIssuer) throw new Error("Invalid Graph notification issuer");
    const caller = version === "1.0" ? payload.appid : payload.azp;
    if (caller !== GRAPH_NOTIFICATION_APP_ID) throw new Error("Invalid Graph notification publisher");
    if (payload.tid === tenantId) tenantTokenFound = true;
  }
  if (!tenantTokenFound) throw new Error("No validation token matched the notification tenant");
}

export type MeetingCallEvent = {
  id?: string;
  eventType: "callStarted" | "callEnded" | "rosterUpdated";
  eventDateTime: string;
};

/** Verifies the HMAC and decrypts Graph rich resource data using the configured RSA key. */
export function decryptMeetingCallEvent(content: EncryptedContent): MeetingCallEvent {
  if (content.encryptionCertificateId !== requireEnv("GRAPH_WEBHOOK_CERTIFICATE_ID")) {
    throw new Error("Notification used an unknown encryption certificate");
  }
  const privateKey = requireEnv("GRAPH_WEBHOOK_PRIVATE_KEY").replace(/\\n/g, "\n");
  const symmetricKey = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
    Buffer.from(content.dataKey, "base64"),
  );
  const encryptedData = Buffer.from(content.data, "base64");
  const expectedSignature = Buffer.from(content.dataSignature, "base64");
  const actualSignature = createHmac("sha256", symmetricKey).update(encryptedData).digest();
  if (expectedSignature.length !== actualSignature.length || !timingSafeEqual(expectedSignature, actualSignature)) {
    throw new Error("Graph notification data signature is invalid");
  }
  const decipher = createDecipheriv("aes-256-cbc", symmetricKey, symmetricKey.subarray(0, 16));
  const json = Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString("utf8");
  const event = JSON.parse(json) as MeetingCallEvent;
  if (!["callStarted", "callEnded", "rosterUpdated"].includes(event.eventType) || Number.isNaN(Date.parse(event.eventDateTime))) {
    throw new Error("Graph notification contains an invalid meeting-call event");
  }
  return event;
}

type ClaimedNotification = { id: string; subscriptionId: string; attempts: number; payload: StoredNotification };

async function claimNotifications(now: Date, limit: number): Promise<ClaimedNotification[]> {
  const stale = new Date(now.getTime() - NOTIFICATION_LEASE_MS);
  const result = await db.execute<ClaimedNotification>(sql`
    with due as (
      select id from graph_meeting_notifications
      where attempts < ${MAX_NOTIFICATION_ATTEMPTS} and available_at <= ${now}
        and (state in ('pending', 'failed') or (state = 'processing' and locked_at < ${stale}))
      order by available_at, created_at for update skip locked limit ${limit}
    )
    update graph_meeting_notifications n
      set state = 'processing', locked_at = ${now}, attempts = n.attempts + 1, updated_at = ${now}
      from due where n.id = due.id
      returning n.id, n.subscription_id as "subscriptionId", n.attempts, n.payload
  `);
  return result.rows;
}

async function processNotification(item: ClaimedNotification) {
  const { notification, validationTokens } = item.payload;
  if (!notification.tenantId || !notification.encryptedContent) throw new Error("Incomplete rich Graph notification");
  await validateTokens(validationTokens, notification.tenantId);
  const event = decryptMeetingCallEvent(notification.encryptedContent);
  if (event.eventType !== "callEnded") return;

  const [interview] = await db
    .select({ id: interviews.id })
    .from(interviews)
    .where(and(eq(interviews.graphCallSubscriptionId, item.subscriptionId), eq(interviews.status, "scheduled")))
    .limit(1);
  if (!interview) return;
  await completeInterview({
    interviewId: interview.id,
    actorId: null,
    completedAt: new Date(event.eventDateTime),
    actualEndedAt: new Date(event.eventDateTime),
    source: "teams_webhook",
    enqueueFeedbackRequest: true,
  });
}

export async function processMeetingNotifications(now: Date = new Date(), limit = 25) {
  const claimed = await claimNotifications(now, limit);
  let processed = 0;
  let failed = 0;
  for (const item of claimed) {
    try {
      await processNotification(item);
      await db.update(graphMeetingNotifications).set({
        state: "processed", processedAt: new Date(), lockedAt: null, lastError: null,
      }).where(and(eq(graphMeetingNotifications.id, item.id), eq(graphMeetingNotifications.state, "processing")));
      processed++;
    } catch (error) {
      const delayMinutes = Math.min(60, 2 ** Math.min(item.attempts, 6));
      await db.update(graphMeetingNotifications).set({
        state: "failed",
        lockedAt: null,
        availableAt: new Date(now.getTime() + delayMinutes * 60_000),
        lastError: error instanceof Error ? error.message.slice(0, 1000) : "Unknown Graph notification failure",
      }).where(and(eq(graphMeetingNotifications.id, item.id), eq(graphMeetingNotifications.state, "processing")));
      failed++;
    }
  }
  return { claimed: claimed.length, processed, failed };
}
