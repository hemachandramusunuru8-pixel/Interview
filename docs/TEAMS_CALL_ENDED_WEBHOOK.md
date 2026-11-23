# Teams call-ended webhook

## Outcome

The application subscribes to Microsoft Graph rich notifications for each confirmed Teams interview. When Graph emits `callEnded`, the worker validates the Microsoft JWT, verifies and decrypts the event, marks the interview completed using the actual call end time, advances the candidate to `interview_done`, and creates the assigned panelist's feedback request.

Teams cannot navigate or redirect a participant's browser when a meeting closes. The panelist receives the in-app/email feedback task and sees the completed interview on the panelist page after the next worker tick and page refresh.

## Runtime flow

1. A confirmed booking creates a rich subscription for `communications/onlineMeetings(joinWebUrl='{joinUrl}')/meetingCallEvents`.
2. The worker renews subscriptions before they expire. The code requests a 60-hour lifetime, below Graph's three-day maximum, and starts renewal inside the final 12 hours.
3. Graph validates `POST /api/webhooks/graph/meeting-events` with a plain-text validation token.
4. Real notifications are checked with `GRAPH_WEBHOOK_CLIENT_STATE` and inserted into `graph_meeting_notifications`. The route returns `202` promptly.
5. The scheduled worker validates all Graph JWTs, verifies the encrypted payload's HMAC-SHA256 signature, and decrypts it with RSA-OAEP-SHA1 plus AES-256-CBC.
6. Only a decrypted `callEnded` event completes an interview. `callStarted` and `rosterUpdated` are safely acknowledged without changing interview status.
7. Completion and feedback creation are idempotent. Duplicate notification deliveries cannot create duplicate feedback jobs.

If an interview has an active Graph subscription, the calendar end time alone no longer completes it immediately. A six-hour post-slot fallback prevents a permanently stuck interview if Microsoft never delivers the end event. Interviews for which subscription setup failed keep the existing scheduled-end fallback.

## Microsoft Entra configuration

The existing application registration needs the Microsoft Graph **application** permission `OnlineMeetings.Read.All` (or the existing higher `OnlineMeetings.ReadWrite.All`) with tenant administrator consent. Keep the existing permissions needed for calendar events, mail, and recordings.

Graph rich notifications require an RSA certificate. A self-signed certificate is supported because Graph uses only its public key. One OpenSSL example is:

```powershell
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 `
  -subj "/CN=interview-graph-webhook" `
  -keyout graph-webhook-private.pem -out graph-webhook-public.pem
openssl x509 -in graph-webhook-public.pem -outform DER -out graph-webhook-public.der
openssl base64 -A -in graph-webhook-public.der
```

Store the private key only in the deployment secret manager. Do not commit the PEM, DER, client state, or application credential. Delete local certificate files securely after the secrets are installed.

## Environment variables

| Variable | Value |
| --- | --- |
| `APP_BASE_URL` | Public HTTPS application origin; Graph cannot call localhost |
| `GRAPH_WEBHOOK_CLIENT_STATE` | Random secret, at most 128 UTF-8 bytes |
| `GRAPH_WEBHOOK_CERTIFICATE` | Base64-encoded DER public certificate, with no PEM headers |
| `GRAPH_WEBHOOK_CERTIFICATE_ID` | Stable identifier for this certificate, for example `interview-webhook-2026-01` |
| `GRAPH_WEBHOOK_PRIVATE_KEY` | Matching PKCS#8 PEM private key; literal `\n` sequences are accepted |
| `AZURE_TENANT_ID` | Tenant that owns the subscription |
| `AZURE_CLIENT_ID` | Application ID; also used as the validation-token audience |
| `AZURE_CLIENT_SECRET` | Application credential used to manage subscriptions |
| `CRON_SECRET` | Protects the scheduled worker endpoint |

Use a cryptographically random client state, for example a 32-byte random value encoded as hex. Never use the certificate ID as the client state.

## Deployment

1. Review and apply migration `0008_add_graph_meeting_events.sql` before deploying the application code.
2. Grant/admin-consent the Graph application permission.
3. Install all webhook secrets and set `APP_BASE_URL` to the final HTTPS origin.
4. Deploy the application and confirm the validation route is publicly reachable without a user session.
5. Keep `POST /api/cron/tick` running every five minutes. This processes notifications and renews subscriptions.
6. Confirm the cron response contains healthy `meetingSubscriptions` and `meetingNotifications` counters.

The application creates subscriptions automatically; no manual subscription POST is required.

## Acceptance test

1. Create an interview scheduled at least 30 minutes in the future and confirm it with the panelist.
2. Run a worker tick and verify `graph_call_subscription_id` and a future `graph_call_subscription_expires_at` exist.
3. Join as organizer, panelist, and candidate before the planned start time.
4. End the Teams call early.
5. Within one scheduler interval, verify the interview is `completed`, `actual_ended_at` matches the Teams event, the candidate is `interview_done`, and one feedback delivery exists for the assigned panelist.
6. Refresh the panelist interview list and open the feedback task.
7. Re-deliver the same notification or run the worker again; no second feedback task should appear.

## Monitoring and recovery

Monitor subscription failures, subscriptions expiring within 12 hours, the oldest pending notification, failed notification attempts, invalid signatures/JWTs, and the last successful cron tick. A repeated JWT or decrypt failure usually means the tenant/application IDs or certificate pair do not match. A `404` during renewal is recovered by creating a replacement subscription. For certificate rotation, first drain the notification inbox, remove the old Graph subscriptions, then deploy the matching new public certificate/private key/ID together and let the worker recreate subscriptions.

Microsoft references:

- [Teams meeting call update notifications](https://learn.microsoft.com/en-us/graph/changenotifications-for-onlinemeeting)
- [Rich-notification validation and decryption](https://learn.microsoft.com/en-us/graph/change-notifications-with-resource-data)
- [Webhook endpoint validation](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)
