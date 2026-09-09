# Venue QR pause verification

Merchant Venue QR requires a separate six-digit email challenge to pause a join
QR. Resume stays one click with the existing launch checks. Internal admin
controls retain their existing authority and reason/audit requirements.

## Authority and delivery

`requestQrPauseCode` proves the current owner session. Only the service-role
issuer may create a challenge; its recipient is read from the verified owner in
`auth.users`, never the form. The salted bcrypt hash is bound to owner, email,
merchant, QR and status revision. Issuance leaves the QR unchanged. Codes become
usable only after the email provider accepts the send and the challenge is
marked ready. Send failures revoke that pending challenge.

`verify_and_pause_qr` authenticates the owner again, holds the owner, merchant,
QR and challenge locks, and checks expiry and revision. Verification consumption,
QR change, audit/product event and per-recipient confirmation records commit
atomically. Five wrong attempts lock a challenge; twenty owner attempts per
15 minutes block further guesses. Issuance has a 60-second owner/recipient
cooldown and five-send limit per 15 minutes. Resending supersedes the old code.
The UI resume RPC reports no-ops without claiming another email was queued.
There is no pause bypass using merchant sign-in codes, the old pause RPC, or a
direct authenticated QR status update. A used challenge can report completion
but cannot reapply the pause after resume.

Both owner sign-in and venue contact addresses receive separate confirmation
messages, deduplicated by trimmed lowercase address. Confirmations snapshot the
venue, recipients, status and database time. They are transactional, use the
existing Resend sender/Reply-To settings, and are independent of marketing
consent. QR provisioning preserves existing paused rows, including concurrent
create recovery; creating the first QR remains automatic.

## Outbox operation

The action schedules a prompt delivery attempt after the response. The protected
`GET /api/cron/qr-status-email-drain` runs every five minutes and claims at most
20 emails per invocation using five-minute leases and `SKIP LOCKED`. Each
provider send is bounded to 15 seconds and rechecks the live lease before every
provider attempt. Every retry uses `qr-status:<outbox-id>` as its stable provider
idempotency key. Attempts stop at 12 or 20 hours, keeping retries inside the
provider's 24-hour idempotency window. An accepted recipient is not retried just
because a different recipient failed.

Delivery failures never reverse a QR change. The UI describes confirmation as
queued; provider acceptance alone does not establish mailbox receipt. The
observed cron logs counts and safe failure codes, never codes or full addresses.
`qr_status_email_outbox` is service-role-only. Inspect due age, attempt count,
lease expiry, status and `failure_code` to investigate delivery. Terminal rows
remain available for investigation. Do not blindly reset a terminal row or
change its idempotency key: first reconcile the provider outcome, especially
when the 24-hour provider window has passed.

## Release and rollback

Apply the four `20260909200000`–`20260909200300` migrations in order through the
protected database promotion. Storage is additive; enforcement keeps the resume
signature and fails closed for older merchant pause clients. No new secrets or
sender configuration are needed. The new cron uses the existing `CRON_SECRET`.

The prior operational-signals RPC continues to return the seven jobs understood
by the deployed app. The new application reads `production_operational_signals_v2`
and requires all eight jobs, including the new drain. This preserves old-app
readiness and application rollback compatibility without weakening new-app
monitoring. After deployment, verify that the new cron has run within its
15-minute monitoring gap.

For an application rollback, retain the new database protections and outbox.
Old merchant pause controls will fail safely; resume and internal admin controls
remain available. Continue draining outstanding confirmations through the
protected endpoint on a compatible deployment until the application is restored.
Do not restore unverified merchant pause privileges as a rollback shortcut.

Before claiming production completion, record the exact application revision,
applied migration ledger, cron outcome, and a controlled venue's full pause and
resume journey. Check both recipient records and actual mailbox receipt. Local
UI fixtures and SQL tests establish different evidence and do not prove live
email delivery.
