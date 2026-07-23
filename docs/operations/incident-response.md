# Nabaperks incident response

## Severity and ownership

- **P0:** confirmed data exposure, cross-tenant access, fraudulent loyalty or
  billing mutation at scale, or total outage. Incident commander starts
  immediately; freeze deploys and customer-impacting jobs.
- **P1:** auth, provider, database or core loyalty path unavailable or unsafe
  with no acceptable workaround. Assign an incident commander and technical
  lead within 15 minutes.
- **P2:** degraded non-core flow, delayed notifications or support-impacting
  defect. Track with an owner and recovery target during the same business day.

The incident commander owns decisions and timeline. The technical lead owns
diagnosis and recovery. One communications owner gives consistent updates.

An automated rolling-SLO breach is a detection signal, not an automatic impact
classification. Assign P0, P1 or P2 from the current customer and data impact
above. During the seven-day SLO warm-up the control fails closed but deliberately
does not page; a post-warm-up breach or report-generation failure must page the
on-call owner and create or update the durable incident record.

## First 15 minutes

1. Open an incident record with UTC and UK-local timestamps. Automated
   readiness incidents must also have an acknowledged external page; the
   GitHub issue is evidence, not the paging channel.
2. Capture `/api/health`, `/api/readiness`, Vercel deployment/revision, Supabase
   status, latest migration, provider status, the current rolling SLO report and
   the first known bad request ID.
3. Classify whether the fault is deployment, database, auth, email, SMS, push,
   cron or billing. Do not rotate every credential or restart every dependency
   at once; preserve evidence and isolate the failing boundary.
4. Stop the smallest unsafe surface: rollback a deployment, disable a cron, or
   pause a provider worker. Do not delete customer, audit or ledger data.
5. If personal data may be affected, preserve access/audit evidence and begin
   the breach-assessment clock; escalate to the accountable business owner.

## Recovery checks

Recovery is not complete until:

- liveness and readiness are green on the intended revision;
- the original failing journey succeeds through its real channel;
- a server/database/provider readback proves the expected side effect;
- queues and retries are draining without duplicate effects;
- two consecutive scheduled Production smoke runs succeed after recovery; and
- the external paging receiver acknowledges the matching `resolve` event; and
- the communications owner has issued the recovery update.

## Evidence and communications

Never paste access tokens, raw phone numbers, customer emails, cookies, full
provider payloads or database URLs into incident notes. Use request IDs, masked
identifiers, provider event IDs and exact UTC timestamps. Record what was
observed, the decision made, who approved it and the verification readback.

For P0/P1 incidents, publish a plain-language internal update at start,
material change and recovery. If customers need notification, state what
happened, what data or service was affected, what has been done and what they
should do. Legal/regulatory notification decisions belong to the accountable
business owner, not the deploy operator.

## After recovery

Within two business days, create a governed follow-up that captures the causal
chain, detection gap, impact, recovery steps, durable prevention, owner and due
date. Update the production runbook and add a regression test or operational
probe that would have detected the incident earlier.
