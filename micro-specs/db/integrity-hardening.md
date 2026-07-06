---
spec_id: MS-db-integrity-hardening
status: active
risk_class: migrations
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/db/**
  - supabase/migrations/20260707094000_integrity_hardening.sql
  - app/api/cron/privacy-retention/**
  - lib/security/**
  - tests/db/integrity-hardening.test.mjs
  - tests/micro-specs/db-integrity-hardening.test.mjs
implementation_surfaces:
  - supabase/migrations/20260707094000_integrity_hardening.sql
  - app/api/cron/privacy-retention/**
  - lib/security/**
  - tests/db/integrity-hardening.test.mjs
  - tests/micro-specs/db-integrity-hardening.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - reports/db-schema-audit-2026-07-06.md
related_tests:
  - tests/db/notifications.test.mjs
  - tests/db/issued-rewards-redemption.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - pnpm test:db output proving incoherent status rows are rejected, the new FK indexes exist, and the stale rate-limit purge deletes only buckets whose window ended over 24 hours ago.
  - Schema readback showing every new CHECK constraint is VALIDATED (no NOT VALID remnants, including the pre-existing push endpoint check).
approved_exceptions: []
---

# MS-db-integrity-hardening — Integrity hardening: coherence checks, FK indexes, retention purge

## 1. Exact Goal and User-Visible Outcomes

Impossible reward/notification states become unrepresentable, erase-path
lookups get index support, and the one unbounded-growth table gets a purge.
Concretely: a `reward_events` row can no longer claim `status='redeemed'`
without a `redeemed_at` (and the equivalent expired/cancelled shapes);
`notification_events` can no longer claim sent/cancelled without their
timestamps; the FK columns the audit found unindexed get supporting indexes
so customer-erasure and cascade paths stop seq-scanning; stale
`rate_limit_buckets` keys (per-IP, per-email — unbounded key cardinality with
no delete path today) are purged by the existing daily privacy-retention
cron; and the `push_subscriptions_allowed_endpoint_check` NOT VALID remnant
is validated. No user-visible behavior changes.

## 2. Blast Radius

May edit: `supabase/migrations/20260707094000_integrity_hardening.sql` (new),
`app/api/cron/privacy-retention/**` (add the purge call alongside the
existing retention calls), `lib/security/**` (only if the retention helpers
live there — follow wherever the existing privacy-retention route's helpers
sit), `tests/db/integrity-hardening.test.mjs` (new),
`tests/micro-specs/db-integrity-hardening.test.mjs` (new), and this spec's
folder.

Out of scope: the notification delivery worker and event producers (they
already maintain coherence by convention — this spec only makes the
convention enforceable); retention policy for append-only tables
(product_events, audit_logs, stripe_webhook_events — documented decision
deferred, not this spec); `vercel.json` (the cron entry already exists);
every RPC body except the new purge function.

## 3. Strict Constraints and Assumptions

- New CHECKs are added `NOT VALID` first, then any nonconforming legacy rows
  are repaired in the same migration, then `VALIDATE CONSTRAINT` — the
  migration must end with zero NOT VALID constraints, and must not fail on a
  database that has legacy incoherent rows.
- Coherence directions are one-way implications only (status ⇒ timestamp).
  Bidirectional forms are forbidden here: `redeemed_at` may legitimately
  outlive a later transition (e.g. a redeemed reward later cancelled by
  admin), so `timestamp ⇒ status` must NOT be constrained.
- The purge is a `SECURITY DEFINER` SQL function following the existing
  `purge_*` conventions (`purge_expired_reward_scan_tokens` is the model),
  callable by the service role, deleting `rate_limit_buckets` rows with
  `reset_at < p_now - interval '24 hours'`.
- In-flight rate-limit windows must never be purged (the 24h grace after
  reset_at guarantees this; `enforce_rate_limit` reuses a bucket row only
  within its window).
- Index list is fixed (see decisions); partial `WHERE <col> IS NOT NULL`
  indexes on nullable FK columns; plain b-tree on NOT NULL ones.
- Everything idempotent and replay-safe.

## 4. Decisions Already Made

- reward_events CHECKs: `status='redeemed' ⇒ redeemed_at IS NOT NULL`;
  `status='expired' ⇒ expired_at IS NOT NULL`;
  `status='cancelled' ⇒ cancelled_reason IS NOT NULL`.
- notification_events CHECKs: `status='sent' ⇒ sent_at IS NOT NULL`;
  `status='cancelled' ⇒ cancelled_at IS NOT NULL`.
- New FK support indexes: `fraud_flags(customer_id)`,
  `fraud_flags(membership_id)`, `notification_events(merchant_id)`,
  `notification_events(membership_id)`, `reward_scan_tokens(membership_id)`,
  `reward_scan_tokens(consumed_by_merchant_id)`,
  `pending_reward_invites(attached_customer_id)`,
  `pending_reward_invites(attached_membership_id)`,
  `pending_reward_invites(attached_reward_event_id)` — partial on the
  nullable ones (all of fraud_flags'/scan tokens' listed columns and the
  attached_* trio are nullable).
- `pending_reward_invites.created_by_user_id` gets NO index (references
  auth.users, no FK-driven delete path, admin-only reads) — considered and
  rejected.
- Purge wiring: the privacy-retention cron route calls the new purge function
  after its existing calls; failures are logged, non-fatal to the other
  retention steps (matching how the route already sequences multiple purges).
- `VALIDATE CONSTRAINT push_subscriptions_allowed_endpoint_check`; if legacy
  rows violate it, the migration DELETES them before validating (corrected at
  implementation time: disabling cannot satisfy a content CHECK, and a
  nonconforming endpoint is undeliverable dead weight; delivery history
  survives via the SET NULL foreign key). Local data has zero such rows.

## 5. Behavioral Requirements (EARS)

- IF a reward_events write leaves `status='redeemed'` with `redeemed_at`
  NULL, `status='expired'` with `expired_at` NULL, or `status='cancelled'`
  with `cancelled_reason` NULL, THEN THE database SHALL reject the write.
- IF a notification_events write leaves `status='sent'` with `sent_at` NULL
  or `status='cancelled'` with `cancelled_at` NULL, THEN THE database SHALL
  reject the write.
- THE existing reward and notification flows (unlock, redeem, expire, cancel,
  enqueue, deliver) SHALL continue to succeed unchanged — the constraints
  encode what those flows already do.
- WHEN the daily privacy-retention cron runs, THE system SHALL delete
  rate_limit_buckets rows whose reset window ended more than 24 hours ago
  and SHALL NOT touch buckets still inside or within 24 hours of their
  window.
- THE schema SHALL contain the nine new FK support indexes.
- THE schema SHALL contain no NOT VALID constraints after this migration.
- WHEN the migration chain is applied twice, THE second application SHALL be
  a no-op.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify (live DB, rolled-back transactions):

- Direct SQL attempts to write each incoherent shape fail with a check
  violation; the equivalent coherent writes succeed.
- A legacy-style incoherent row inserted before the constraints (fixture via
  constraint-less path is impossible post-migration — instead prove the
  migration's repair step by asserting current data validates).
- Existing redemption/expiry/notification suites stay green.
- Purge: seed buckets at now()-3d, now()-2h, now()+1h; run the function; only
  the 3-day bucket is gone.
- pg_indexes readback lists the nine new indexes; pg_constraint readback
  shows convalidated=true for every new check and the push endpoint check.

Task order: (1) failing DB tests for rejection shapes + purge behavior;
(2) migration (repair pass → checks NOT VALID → VALIDATE → indexes →
purge function → validate endpoint check); (3) cron route wiring; (4) green;
(5) `pnpm governance:run-gates --spec MS-db-integrity-hardening --record`
and advance with `governance:advance`.
