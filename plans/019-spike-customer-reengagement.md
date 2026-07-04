# Plan 019: Spike — customer email re-engagement (consent + transport already exist)

> **Executor instructions**: This is a DESIGN SPIKE, not a build. The deliverable
> is a written design doc + a pilot recommendation. Do NOT ship a customer-comms
> channel from this plan. If a "STOP condition" occurs, stop and report. Update
> this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- lib/customer/consent.ts lib/notifications`

## Status

- **Priority**: P2 (high leverage — the hard parts already exist)
- **Effort**: M (spike: ~1 day to investigate + write up; pilot build is separate)
- **Risk**: LOW (spike); the eventual build carries deliverability/GDPR risk
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters (product)

Customer notifications are automated **push-only**, yet the plumbing for another
channel is already present: `lib/notifications/resend.ts` (email) and
`lib/notifications/twilio.ts` (SMS) exist, and the app **captures customer
marketing consent** (`lib/customer/consent.ts:31`, `record_customer_marketing_consent`
RPC) — with **no channel that consumes it**. Most customers never install a PWA
or grant web-push, so a "your reward expires Friday" / "you're 1 stamp away"
**email** to consented customers is a re-engagement lever whose consent capture,
event producers, and transport all already exist. The open question is product
(does email convert for this audience?) and compliance (unsubscribe/GDPR), not
plumbing — this spike scopes a safe pilot.

## Current state (evidence)

- Customer push events already produced: `next_stamp_available`,
  `reward_expiring_soon`, `dormant_progress` (`lib/notifications/delivery-worker.ts:73-78`).
- Transports exist but are under-used for customers:
  - `lib/notifications/resend.ts` → used only by the **merchant** weekly digest.
  - `lib/notifications/twilio.ts` → used **only** for SMS-OTP
    (`app/api/auth/hooks/send-sms/route.ts`, `lib/customer/verification.ts`).
- Consent captured but unconsumed: `lib/customer/consent.ts:31` +
  `record_customer_marketing_consent` RPC; the push channel reads
  `consent_records.channel = 'push'` (see
  `lib/notifications/push-marketing-eligibility.ts`) — there is no `channel =
  'email'` consumer.
- Marketing sells the digest as a **merchant** insight
  (`components/marketing/landing/venue-benefits.tsx:34`, `trust-pricing.tsx:13`,
  `faq.tsx:43`) — customer email is not promised, so this is additive.

## Spike deliverable

Write `docs/product/spikes/customer-email-reengagement.md` covering:
1. **Consent model**: confirm `consent_records` supports an `email` channel (or
   what a new channel value needs); define how email consent is captured at join
   (the join wizard already has a marketing opt-in) and revoked.
2. **Eligibility reuse**: map the email channel onto the existing eligibility
   gates — frequency cap (`lib/notifications/frequency-cap.ts`), quiet hours, and
   the latest-consent predicate — so email doesn't over-send or ignore opt-out.
3. **Pilot scope**: pick ONE event to pilot (recommend `reward_expiring_soon` —
   highest intent, clearest value), reusing the existing producer; define the
   email template (reuse `buildMerchantWeeklyDigestEmail`'s structure) and the
   send path via `sendTransactionalEmail`.
4. **Compliance**: unsubscribe link + one-click opt-out, GDPR lawful basis,
   suppression list, and how a customer erasure (already implemented) must also
   stop email — confirm the erasure RPC nulls the email so sends can't resume.
5. **Measurement**: the event(s) to capture (sent/opened/click→redeem) to judge
   lift, reusing the analytics taxonomy.
6. **Go/no-go**: effort for the pilot build, top risks, recommendation.

Optional: a throwaway `spike/*` branch stub of an email-channel eligibility
function (no send) to size the change. Do NOT merge.

## Commands you will need

Read-only investigation; `pnpm typecheck` to confirm any throwaway stub compiles.

## Scope

**In scope**: `docs/product/spikes/customer-email-reengagement.md` (create); an
optional never-merged `spike/*` branch.

**Out of scope**: shipping any customer email, new migrations on `main`, changes
to the OTP/auth SMS path, and the merchant digest.

## Done criteria

- [ ] `docs/product/spikes/customer-email-reengagement.md` exists and answers all six points
- [ ] The consent/eligibility reuse is mapped to concrete existing modules (file:line)
- [ ] Compliance section explicitly covers unsubscribe + interaction with the
      existing customer-erasure RPC (email must be nulled/suppressed)
- [ ] A single pilot event is chosen with a clear measurement plan
- [ ] No customer email is sent and no production code changed on `main`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- `consent_records` cannot represent an email channel without a schema change
  (size that migration in the doc; it changes the effort).
- The erasure path does NOT null the email (then email re-engagement could resume
  for an erased customer — flag as a compliance blocker to fix before any pilot).

## Maintenance notes

- The eventual pilot should reuse the delivery-worker eligibility gate (see plan
  010's extracted eligibility module if it lands) rather than duplicating it.
- Reviewer of the future build: unsubscribe + suppression + erasure-interaction
  are the compliance-critical paths.
