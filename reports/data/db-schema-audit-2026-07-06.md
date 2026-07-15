# Database Schema Audit — 2026-07-06

**Scope.** The full composed public schema: 28 tables (314 columns), 1 view, 89 functions, 61 RLS
policies, 128 indexes, 22 triggers — produced by applying all 66 migrations
(`20260606142000` → `20260704096000`) to the local stack and dumping the result.
**Prod parity verified**: `supabase migration list --linked` shows all 66 applied to production, so
this audit describes the live prod schema (manual drift aside — see Follow-ups).

**Method.** Schema introspection (columns / constraints / indexes / FK delete rules / triggers /
policies / function bodies) cross-referenced field-by-field against app code (`app/`, `lib/`,
`scripts/`, `tests/`) by four parallel verification agents, with conflicting agent claims re-verified
by hand. Prior-audit false positives (`reports/architecture/`) were loaded first and are not
re-flagged.

---

## Executive summary

The schema is in fundamentally good shape — the integrity core (composite tenant-coherence FKs,
deny-by-default RLS, SECURITY-DEFINER-only ledger writes, one-stamp-per-day and one-birthday-per-year
partial uniques) is genuinely strong. The problems are **around the edges**:

1. **~13 confirmed dead or constant columns** across 6 tables (a whole removed feature's columns,
   an ROI trio that only ever holds zeros, a timezone facade, a plaintext-phone legacy column, and
   two columns whose CHECK constraints pin them to a single value).
2. **One dead subsystem**: staff (`staff_users` + 2 RPCs + an orphan lib module), reachable from
   nothing.
3. **One silent product bug**: four surfaces read `qr_downloaded` product events that nothing ever
   writes — the dashboard "QR downloads" metric is permanently 0.
4. **Two deletion-semantics pitfalls**: an auth-user deletion cascades away the entire loyalty
   ledger (contradicting the deliberate PII-erasure flow), and consent records — compliance
   evidence — die with the customer row while audit logs survive.
5. **Mechanical hygiene**: 7 duplicate indexes on the hottest write paths, a handful of unindexed
   FKs on erase/cascade paths, one plaintext-at-rest auth token (1-hour window), and one table with
   no purge path.

Nothing here is on fire. The recommended shape of the fix is one governance-spec'd cleanup
migration (P1 list) plus three small behavioral fixes (P0 list).

---

## 1. Dead fields — confirmed drop candidates

Each verified: no app read/write, no live DB-function dependency beyond its own DDL.

| # | Column(s) | Evidence |
|---|-----------|----------|
| 1 | `loyalty_cards.min_spend_pence`, `reward_pool_items.min_spend_pence`, `reward_events.min_spend_pence` (+ 3 CHECK constraints) | Feature removed by `20260624120000_remove_minimum_spend.sql` — the migration dropped the RPC *parameters* but never dropped the columns. Zero references in `app/`/`lib/`. The comment in that migration says redemption was never gated on spend. |
| 2 | `merchants.average_order_value_pence`, `merchants.estimated_gross_margin_bps`, `merchants.reward_cost_pence` (+ 3 CHECKs) | Written only by `create_merchant_onboarding()` as literal `0`s; no UI ever updates them; `get_merchant_dashboard_metrics()` does **not** read them (it aggregates event tables). ROI copy on marketing pages is static, not DB-driven. |
| 3 | `merchant_locations.timezone` | Never read anywhere. All business-date logic goes through `uk_business_date()`, which hardcodes Europe/London. A per-location setting that has never had a second value. |
| 4 | `customers.phone` (plaintext) | New customers are created with `phone: null` ([identity.ts:86](lib/customer/identity.ts)); the encrypted set (`phone_hmac`/`phone_ciphertext`/`phone_last4`/`phone_country`) is the live identity. Plaintext survives only on pre-migration rows, and `customers_masked` falls back to it to derive last4. **Drop requires prep**: backfill `phone_last4` for legacy rows, update the `customers_contact_present` CHECK, the masked view's LATERAL, and `prevent_verified_customer_contact_change()`. |
| 5 | `record_qr_download()` RPC | Zero call sites in app code. See §4.1 — its absence breaks a live metric. |
| 6 | Staff subsystem: `staff_users` table (incl. `pin_hash`), `add_staff_member()`, `set_staff_member_active()`, `lib/merchant/staff-members.ts` | The lib module has **zero importers**; no route or page reaches any of it. `is_staff_for_merchant()` is still referenced by two RLS policies (`qr_codes_select_owner_staff_admin`, `reward_pool_items_select_owner_staff_admin`) so removal must touch those policies too. Prior audit already flagged ~700 lines of dead staff-PIN SQL; this is the remaining live-but-unreachable perimeter. Decision needed: build the staff feature or excise it. |

### Constant columns (flexibility that isn't)

| Column | Why it's a constant | Options |
|--------|--------------------|---------|
| `merchant_locations.soft_geofence_trigger_stamp_number` | `CHECK (= 3)`. The stamping RPC reads it via `coalesce(x, 3)` — a constant either way. | Widen the CHECK to make it a real per-location knob, or drop the column and hardcode 3 in the RPC. |
| `billing_customers.plan` | `CHECK (plan = 'growth')` — one legal value, displayed in admin UI. | Keep only if a second plan is on the roadmap; otherwise drop. Related gap in §4.4. |
| `push_subscriptions.permission_state` | 5-value CHECK, but function bodies only ever produce `'granted'` (active) or `'unknown'` (disabled). `prompt`/`denied`/`unsupported` are never written. | Harmless; leave, but don't build logic expecting the other values. |
| `qr_codes.destination_type` | CHECK allows `join`/`stamp`/`redeem`/`staff`; only `'join'` is ever created, and the one-active-QR uniqueness is scoped to it. | Architectural placeholder — fine to keep, cheap to collapse. |

---

## 2. Redundancies

### Real ones

1. **`merchant_locations.address` (legacy single line) vs the structured address set.** Both are
   maintained: [venue-address.ts](lib/merchant/venue-address.ts) dual-writes the formatted line and
   falls back to it on read when `address_line_1` is missing. A derived display string persisted
   next to its source fields. Recommend: compute on read (or a generated column) and stop
   dual-writing once legacy rows are backfilled into structured fields.
2. **7 duplicate indexes** — non-unique indexes fully covered by another index's leading columns,
   all on write-hot tables (every stamp pays for them):
   `billing_customers_merchant_id_idx`, `customers_auth_user_id_idx`,
   `customer_memberships_merchant_id_idx`, `loyalty_cards_merchant_location_idx`,
   `merchant_locations_merchant_id_idx`, `reward_events_membership_id_idx`,
   `stamp_events_membership_id_idx`. All safe mechanical drops.
3. **`internal_admins.email`** duplicates `auth.users.email` (bootstrap-time copy, never updated —
   drift by design). Low stakes; either sync it or treat it as a label.

### Investigated and REFUTED — do not re-flag

These look redundant on the schema page but verification shows they're deliberate:

- **`notification_preferences.marketing_enabled` vs `consent_records`** — both live. The boolean is
  a preference toggle (written via `update_notification_preferences_for_customer`
  [push-subscriptions.ts:147](lib/notifications/push-subscriptions.ts), read by three notification
  gates); `consent_records` is the append-only compliance ledger. They compose with AND, so
  disagreement fails safe (no send).
- **`loyalty_cards.reward_expires_after_days` vs `reward_pool_items.reward_expires_after_days`** —
  a COALESCE override chain in `resolve_reward_event_expires_at()`: pool item wins, card is the
  merchant default.
- **`pending_reward_invites.matched_customer_id` vs `attached_customer_id`** — distinct lifecycle
  stages (identity-matched pre-join vs reward-created post-claim), with an identity-pinning guard
  that stops a second customer hijacking a matched invite.
- **Tenant-key denormalization** (`merchant_id`+`customer_id`+`membership_id` copied onto
  `stamp_events`, `reward_events`, `reward_scan_tokens`, …) — serves RLS filtering without joins,
  and the composite FKs (`*_membership_matches_context`) make the copies impossible to desynchronize.
  This is a strength, not a smell.
- **`reward_events.reward_name/reward_terms`** — issuance-time snapshot; correct (pool items are
  mutable, historical rewards must not be).
- **Paired `(merchant_id, customer_id)` and `(merchant_id, customer_id, id)` uniques** — the 3-col
  variants exist to be composite-FK targets; both are required.
- **`customers.phone_ciphertext` write-only** — compliance/recovery store by design.
- **`reward_events.birthday_year` "never read by app"** — load-bearing in the
  one-birthday-per-year unique index; keep.
- **`customer_sessions`** — the live session store (register/touch/revoke; touch is memoized
  per-request via `cache()`, no write amplification). Not vestigial next to Supabase auth.
- **Function pairs** (`*_for_customer` variants, `issue_self_service_stamp` overloads,
  `loyalty_availability_reason` overloads, `join_customer_membership{,_with_first_stamp}`,
  `{internal_,}issue_merchant_direct_reward`, `merchant_can_access_customer` overloads) — all
  verified live: auth-context vs service-role variants, wrapper+internal patterns, RLS references.
  `redeem_self_service_reward` is SQL-internal-called (prior audit false positive — still true).
- **`loyalty_cards.reward_name/reward_terms` (card level)** — still shown on the join page;
  post-join UIs use the `reward_events` snapshot. Vestigial-leaning but referenced; see §4.5 for
  the real (UX) issue.

---

## 3. Deletion-semantics pitfalls (highest-value fixes)

### 3.1 `auth.users → customers` is ON DELETE CASCADE — one deletion nukes the ledger

Deleting a Supabase auth user cascades: `customers` → `customer_memberships` → `stamp_events`,
`reward_events`, `notification_*`, `push_subscriptions`, `customer_sessions`, `consent_records`.
That is the merchant's business history and the trust ledger, gone via a single auth-dashboard
action — precisely what the 2026-07-04 prod bulk-delete incident did. It also contradicts the
deliberate erasure design: `admin_erase_customer_pii()` exists specifically to remove PII while
*preserving* the anonymized ledger. And it's asymmetric: `merchants.owner_user_id` is RESTRICT.

**Recommendation:** make `customers.auth_user_id` `ON DELETE RESTRICT` (or SET NULL), and route all
account deletion through the erasure RPC. This turns the incident class from "data loss" into "a
blocked delete with an error message".

### 3.2 `consent_records.customer_id` is CASCADE — compliance evidence dies with the account

Consent history is the thing you keep to *prove* past consent (PECR/UK GDPR posture). Today it
cascades away with the customer while `audit_logs` (SET NULL) survives — an inconsistent evidence
retention policy, and `admin_erase_customer_pii` becomes undermined if a hard delete beats it.

**Recommendation:** SET NULL (keep rows keyed by hashed contact / merchant), aligning with
`audit_logs` and `fraud_flags` (both already survive anonymized).

### 3.3 Minor, related

- `stamp_events.loyalty_card_id` / `reward_events.loyalty_card_id` are RESTRICT — so location
  deletion (CASCADE → cards) hard-fails once any history exists. Fine (cards are soft-deactivated),
  but any future "delete location" UI will hit it; document the soft-delete-only rule.

---

## 4. Improvement gaps & smaller pitfalls

1. **`qr_downloaded` has readers but no writer (silent metric bug).** Dashboard period counts
   ([dashboard-period-counts.ts:98](lib/merchant/dashboard-period-counts.ts)), the activity feed,
   pilot reports, and the analytics event registry all consume it; `record_qr_download()` is never
   called and no `recordProductEvent` caller emits it (poster/QR downloads are client-side, so no
   hook ever fired). The tile reads 0 forever. Fix: call the RPC (or `recordProductEvent`) from the
   QR/poster download paths — or remove the metric.
2. **`merchant_email_otp_aliases.supabase_token` is plaintext at rest.** Real Supabase auth OTP
   token, ≤1h TTL, scrubbed on consume, attempt-rate-limited (all good), but a DB read in the window
   yields a usable login token. Cheap hardening: store it encrypted (AES-GCM like
   `phone_ciphertext`) or exchange-and-scrub earlier.
3. **State/timestamp coherence is convention, not constraint, on `reward_events`.**
   `status='redeemed' ⇔ redeemed_at`, `'expired' ⇔ expired_at`, `'cancelled' ⇒ cancelled_reason`
   are maintained only inside RPCs. `pending_reward_invites_attached_shape` is the in-house
   precedent — add the equivalent CHECKs to `reward_events` (and `notification_events`
   `sent/cancelled` pairs).
4. **Billing interval (monthly vs £490 annual) is not in the DB** — only in Stripe subscription
   metadata. Churn/interval reporting will require Stripe API calls. If that reporting matters, add
   `billing_customers.billing_interval` maintained by the existing webhook; otherwise accept
   Stripe-as-source-of-truth deliberately.
5. **Card-level vs pool reward naming (UX trap).** The join page shows
   `loyalty_cards.reward_name/terms`; actual rewards come from pool items with their own names. A
   merchant can promise "Free pint" at join while the pool issues "Free dessert". Consider deriving
   the join-page copy from the pool (or validating consistency on save).
6. **Unindexed FKs on erase/cascade paths**: `fraud_flags.customer_id`, `fraud_flags.membership_id`,
   `notification_events.merchant_id`, `notification_events.membership_id`,
   `reward_scan_tokens.membership_id`, `reward_scan_tokens.consumed_by_merchant_id`,
   `pending_reward_invites.attached_{customer,membership,reward_event}_id` +
   `created_by_user_id`. Postgres doesn't auto-index FKs; every customer erase/delete scans these.
   All small tables today — cheap partial indexes when convenient, prioritize `fraud_flags` and
   `notification_events`.
7. **`rate_limit_buckets` has no purge path.** `enforce_rate_limit()` upserts but never deletes;
   one-off keys (per-IP, per-email) accumulate forever. Add a
   `delete where reset_at < now() - interval '1 day'` to the daily privacy-retention cron (the
   `reset_at` index already exists).
8. **Retention posture for append-only tables is undefined**: `product_events`, `audit_logs`,
   `notification_events`/`deliveries`, `stripe_webhook_events` grow unboundedly. Fine at pilot
   scale; write the retention decision down before it's a migration under pressure.
9. **`notification_events.event_type` 17-value CHECK** — every new notification type is a
   migration. Accepted trade-off (strict data) but worth knowing it's the churniest constraint in
   the schema.
10. **`push_subscriptions_allowed_endpoint_check` is NOT VALID** — pre-existing rows were never
    validated. One-time `VALIDATE CONSTRAINT` when convenient.
11. **`customer_memberships.last_visit_at` is write-only.** Updated on every stamp, surfaced
    nowhere — yet it's the obvious "regulars going quiet" signal for a pub product (and the natural
    feed for the promised-but-unbuilt weekly digest). Product gap, not schema waste: surface it
    rather than drop it.
12. **`notification_preferences.quiet_hours_*`** — enforced by the delivery worker but not
    user-settable, and `time without time zone` is implicitly Europe/London. Consistent with the
    UK-only posture; document the assumption (it will bite the first non-UK venue).

**Ops note (not a schema gap):** all four cron routes exist in `vercel.json`
(notifications 15m, privacy-retention daily, birthday-rewards daily, merchant-digest weekly) and
every expiry/purge function is reachable — but delivery depends on `CRON_SECRET` being set in prod
Vercel env, which per project history was still owed by the owner. Worth a one-minute check.

---

## 5. What's strong (leave alone)

- Composite tenant-coherence FKs (`*_matches_context`) making denormalized keys un-desyncable.
- Deny-by-default RLS with anon fully revoked; ledger writes only via SECURITY DEFINER RPCs.
- One-stamp-per-UK-business-day partial unique (verified: earned stamps always carry non-null
  `location_id` + `earned_business_date`; manual adjustments are deliberately exempt).
- One-birthday-per-year partial unique; idempotent Stripe webhook ledger (PK = `stripe_event_id`).
- `customers_masked` view (security_barrier, embedded row filter) + verified-contact immutability
  trigger with the erasure GUC escape hatch.
- Append-only enforcement trigger on `notification_deliveries`; PII scrubbing built into the invite
  lifecycle (hmacs nulled on expiry, claim token hash scrubbed after use).
- `text` + CHECK pseudo-enums, `timestamptz` throughout, pence-integer money.

---

## 6. Recommended plan

**P0 — behavioral fixes (small, high value)**
1. FK delete rules: `customers.auth_user_id` CASCADE → RESTRICT; `consent_records.customer_id`
   CASCADE → SET NULL (§3.1, §3.2).
2. Wire `qr_downloaded` (or remove the metric surfaces) (§4.1).
3. Encrypt `merchant_email_otp_aliases.supabase_token` at rest (§4.2).
4. Confirm `CRON_SECRET` set in prod Vercel env.

**P1 — one schema-hygiene migration**
5. Drop dead columns: 3× `min_spend_pence`, merchants ROI trio, `merchant_locations.timezone`
   (+ their CHECKs).
6. Drop 7 duplicate indexes.
7. Staff subsystem decision: excise (`staff_users`, 2 RPCs, `is_staff_for_merchant` policy refs,
   `lib/merchant/staff-members.ts`, `record_qr_download` if unfixed) — or schedule the feature.
8. `soft_geofence_trigger_stamp_number` and `billing_customers.plan`: make real or remove.
9. Plaintext `customers.phone` deprecation: backfill `phone_last4`, update CHECK/view/trigger, drop.

**P2 — robustness**
10. Status/timestamp coherence CHECKs on `reward_events` (+ `notification_events`).
11. FK support indexes (§4.6); `rate_limit_buckets` purge in the retention cron (§4.7).
12. `billing_interval` column if interval reporting is wanted (§4.4).
13. Retention policy doc for append-only tables; `VALIDATE CONSTRAINT` on the push-endpoint check.
14. Surface `last_visit_at` (lapsed-regulars / weekly digest).

These historical recommendations should be assessed individually before
implementation. Group or separate them according to current risk and scope.

**Follow-up verification:** this audit trusts migrations == prod. A `supabase db diff --linked`
would catch any manual prod drift (the staging env previously grew one drift column).
