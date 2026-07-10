---
spec_id: MS-merchant-reward-preset-atomic-add
status: active
risk_class: rls-rpc-ledger
owner: codex
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/merchant/reward-preset-atomic-add.md
  - micro-specs/evidence/MS-merchant-reward-preset-atomic-add.json
  - app/app/card/actions.ts
  - app/dev/app-harness/launch/page.tsx
  - components/merchant/loyalty-card-form.tsx
  - lib/merchant/reward-presets.ts
  - supabase/migrations/20260710110000_atomic_reward_preset_add.sql
  - tests/db/helpers/reward-pool-fixture.mjs
  - tests/db/reward-preset-atomic-add.test.mjs
  - tests/unit/reward-presets.test.mjs
  - tests/micro-specs/reward-preset-atomic-add.test.mjs
  - tests/micro-specs/reward-presets.test.mjs
  - tests/e2e/helpers/merchant-reward-preset-live-db.ts
  - tests/e2e/merchant-reward-presets-flow.ts
  - tests/e2e/merchant-reward-presets.spec.ts
  - tests/e2e/merchant-reward-presets.desktop.spec.ts
  - tests/e2e/merchant-reward-preset-atomic-add-flow.ts
  - tests/e2e/merchant-reward-preset-atomic-add.spec.ts
  - tests/e2e/merchant-reward-preset-atomic-add.desktop.spec.ts
implementation_surfaces:
  - micro-specs/merchant/reward-preset-atomic-add.md
  - micro-specs/evidence/MS-merchant-reward-preset-atomic-add.json
  - app/app/card/actions.ts
  - app/dev/app-harness/launch/page.tsx
  - components/merchant/loyalty-card-form.tsx
  - lib/merchant/reward-presets.ts
  - supabase/migrations/20260710110000_atomic_reward_preset_add.sql
  - tests/db/helpers/reward-pool-fixture.mjs
  - tests/db/reward-preset-atomic-add.test.mjs
  - tests/unit/reward-presets.test.mjs
  - tests/micro-specs/reward-preset-atomic-add.test.mjs
  - tests/micro-specs/reward-presets.test.mjs
  - tests/e2e/helpers/merchant-reward-preset-live-db.ts
  - tests/e2e/merchant-reward-presets-flow.ts
  - tests/e2e/merchant-reward-presets.spec.ts
  - tests/e2e/merchant-reward-presets.desktop.spec.ts
  - tests/e2e/merchant-reward-preset-atomic-add-flow.ts
  - tests/e2e/merchant-reward-preset-atomic-add.spec.ts
  - tests/e2e/merchant-reward-preset-atomic-add.desktop.spec.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/merchant/reward-presets.md
  - micro-specs/merchant/card-rewards.md
  - reports/merchant-journey-ux-audit-2026-07-09.md
related_tests:
  - tests/db/reward-preset-atomic-add.test.mjs
  - tests/unit/reward-presets.test.mjs
  - tests/micro-specs/reward-preset-atomic-add.test.mjs
  - tests/micro-specs/reward-presets.test.mjs
  - tests/e2e/merchant-reward-presets-flow.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-merchant-reward-preset-atomic-add"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - manual:local-supabase-reward-preset-atomicity-proof
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for every declared verification gate.
  - Local PostgreSQL proof that a mid-batch reward or ledger failure leaves no reward, product-event, or audit rows from the attempt.
  - Local PostgreSQL proof that retries and same-card concurrency create each preset once with stable display ordering and exact ledgers.
  - ACL and RLS proof that anonymous execution, cross-owner calls, and authenticated direct reward-pool mutation fail while owner RPC reads and writes work.
  - Mobile and desktop browser proof that selection is keyboard-operable, nothing persists before Add, errors retain the selection, and one retry reaches exact database readback.
  - Readback and cleanup proof for every disposable auth user, merchant, card, reward, event, audit, and QR row created by the live harness.
approved_exceptions: []
---

# MS-merchant-reward-preset-atomic-add — Atomic multi-preset reward setup

## 1. Exact Goal and User-Visible Outcomes

A merchant setting up a reward pool can select several suitable reward ideas,
review the projected active count, and press one explicit Add button. The whole
selection then appears together, or the page says that nothing changed and
keeps every choice ready to retry. Existing and custom rewards remain editable,
three active rewards remain the launch minimum rather than a cap, and no preset
is persisted merely by selecting or customising it.

## 2. Blast Radius

May edit only the reward preset catalogue/resolution helper, merchant card
actions, reward-pool client form, the DB-free launch harness state needed for
interaction proof, one additive reward-pool migration, and the focused source,
unit, local-DB, and browser evidence listed in frontmatter.

Out of scope: automatic reward seeding, changes to reward drawing or issuing,
birthday rewards, card cadence or stamp thresholds, changing the three-active
launch rule, imposing a total reward-pool cap, marketing copy outside the launch
Rewards panel, Stripe/billing, poster fulfilment, hosted Supabase writes,
production data cleanup, or silently merging historical duplicate rewards.

## 3. Strict Constraints and Assumptions

- The browser posts only the selected preset ids and the current loyalty-card
  id. The authenticated merchant, business type, preset names, preset terms,
  weight, active state, and display order are resolved or derived on the server.
- The server action is an independently reachable POST boundary: it authenticates
  on every call, validates all ids against the merchant's current catalogue,
  calls one batch RPC exactly once, and returns only UI-safe reward fields and
  house-authored status copy.
- The batch RPC is one PostgreSQL statement and transaction. It validates the
  complete payload before the first insert and acquires a loyalty-card row lock
  before checking existing rewards or assigning display order.
- Preset-name idempotency uses trimmed, lower-cased names with internal
  whitespace collapsed. An existing active or inactive match is returned as
  existing and is never overwritten or reactivated by a preset retry.
- The current catalogues contain at most seven presets. A batch accepts one to
  seven unique entries; the database introduces no total pool-size cap.
- Same-card preset adds, single-item upserts, and deletes share the same row-lock
  order. Direct authenticated INSERT, UPDATE, and DELETE grants on
  `reward_pool_items` are removed so application mutations cannot bypass the
  RPC ledger and launch guards. Authenticated SELECT and service-role
  maintenance remain available under existing RLS.
- All affected definer functions use a fixed search path, retain explicit
  ownership checks, revoke default PUBLIC and `anon` execution, and grant only
  the exact `authenticated` and `service_role` signatures.
- Supabase product events and audit logs are authoritative. PostHog and QR
  auto-provisioning run only after the batch commits and cannot make a failed
  database transaction look successful. An idempotent retry may heal QR
  provisioning after a prior response was interrupted.
- Browser selection is a draft only. It remains selected after validation,
  session, or database failure, clears after a successful authoritative result,
  and is not optimistically rendered as a saved reward.
- Live proof is local-only, uses disposable identities, scopes fault controls to
  the fixture owner/card, uses one Playwright worker, cleans in `finally`, and
  refuses linked or hosted database URLs.

## 4. Decisions Already Made

- Add `addRewardPresetsAction` beside the existing one-reward action. Its form
  accepts repeated `presetId` fields, deduplicates them, rejects any unknown or
  wrong-catalogue id as a whole, resolves valid presets in catalogue order, and
  invokes only `add_reward_pool_presets` for persistence.
- Add `add_reward_pool_presets(p_merchant_id uuid, p_loyalty_card_id uuid,
  p_presets jsonb)`. Each server-derived JSON object contains exactly
  `preset_id`, `reward_name`, and `reward_terms`.
- The RPC returns every requested preset in catalogue order with authoritative
  reward fields, `reward_pool_item_created` or `reward_pool_item_existing`, and
  the final active reward count. New rows use weight one, active true, and the
  next card-scoped display orders.
- Selection tiles are real toggle buttons with `aria-pressed`; a separate
  44-pixel coarse-pointer Edit/Customise control opens the existing editor.
  Customising removes that preset from the bulk selection first. A matching
  pool item opens for edit instead of creating a duplicate draft.
- A sticky mobile selection tray shows the current and projected counts, Clear,
  and one `Add N reward(s)` action. It is hidden while the custom editor is open
  so only one primary mutation is presented.
- Success copy distinguishes all-created, partly-existing, and all-existing
  outcomes. Failure copy says `Rewards not added. Nothing was changed. Your
  choices are still selected — try again.` Session expiry has equally explicit
  no-change guidance.
- Import `LAUNCH_MIN_ACTIVE_REWARDS` as the one threshold source instead of
  retaining the form's hard-coded literal.
- The migration also gives one-item upsert and delete the same card lock,
  rejects normalized-name collisions on one-item create/rename, and hardens the
  exact ACL/table-DML boundary. It does not rewrite historical reward rows.

## 5. Behavioral Requirements (EARS)

- **RA-1 (draft selection):** WHEN a merchant toggles an available preset, THE
  form SHALL update `aria-pressed`, selected count, and projected active count
  without invoking a server action or rendering a saved reward row.
- **RA-2 (custom continuity):** WHEN a merchant customises a selected or existing
  preset, THE form SHALL remove it from bulk selection, open the existing reward
  editor with trusted values, and return focus to the invoking control on cancel.
- **RA-3 (trusted resolution):** WHEN preset ids are submitted, THE action SHALL
  derive the merchant's catalogue server-side, deduplicate valid ids in catalogue
  order, reject any unknown or wrong-catalogue id before persistence, and send no
  browser-authored reward copy or ordering to PostgreSQL.
- **RA-4 (atomic create):** WHEN one to seven valid missing presets are added,
  THE RPC SHALL create every active reward plus one matching product event and
  audit row per reward in one transaction and return authoritative rows in
  catalogue order.
- **RA-5 (atomic failure):** IF any reward, product-event, or audit insertion
  fails, THEN THE RPC SHALL roll back every write from that batch and the form
  SHALL retain the selected ids with explicit no-change recovery copy.
- **RA-6 (idempotent retry):** WHEN a normalized preset name already exists,
  THE RPC SHALL return that authoritative active or inactive row as existing
  without overwriting it, reactivating it, or duplicating its ledgers.
- **RA-7 (concurrency):** WHEN identical or disjoint batches overlap for one
  card, THE database SHALL serialize them on the card, create each normalized
  reward at most once, and assign non-overlapping card-scoped display orders.
- **RA-8 (authorization):** IF the caller is anonymous, not the merchant owner,
  or names a card outside the merchant, THEN the RPC SHALL fail before reward or
  ledger writes. Authenticated callers SHALL NOT mutate `reward_pool_items`
  directly, while owner reads remain governed by RLS.
- **RA-9 (single-item parity):** WHEN a merchant creates, renames, deactivates,
  or deletes one reward, THE existing RPCs SHALL take the same card lock; a
  normalized-name collision SHALL fail with safe duplicate guidance and the
  three-active live-QR guard SHALL remain authoritative.
- **RA-10 (successful continuation):** WHEN the batch commits, THE action SHALL
  attempt QR auto-provisioning once, revalidate merchant launch surfaces, clear
  the selection, merge authoritative rows, announce the added/existing outcome,
  and expose the normal continuation only when the active minimum is met.
- **RA-11 (accessible controls):** WHILE a batch is pending, THE form SHALL
  disable conflicting preset, Clear, customisation, and Add controls, announce
  `Adding N rewards…`, preserve touch targets and focus visibility, and avoid
  horizontal overflow at 375 pixels.
- **RA-12 (safe return):** IF the merchant session is missing or the action
  receives malformed input, THEN it SHALL return house-authored no-change copy
  and never expose SQL, service-role, or provider details.

## 6. Verification Criteria and Task Breakdown

1. Write failing unit/source tests first for catalogue-order id resolution,
   whole-selection rejection, exact one-RPC action shape, trusted server-derived
   payloads, shared launch threshold import, accessibility semantics, safe copy,
   migration lock ordering, and exact ACL/table grants.
2. Add the replay-safe migration and prove directly with local PostgreSQL:
   three-row success plus ledgers, injected mid-batch rollback, retry, active and
   inactive existing matches, malformed payloads, anonymous/cross-owner denial,
   direct-DML denial, same/disjoint concurrency, single-item collision, live-QR
   minimum preservation, exact function ACL/search paths, and migration replay.
3. Add the server action with auth on every request, preset-id-only resolution,
   one RPC call, stable result shaping, post-commit QR healing, revalidation, and
   no raw database error leakage.
4. Replace one-at-a-time preset prefill with keyboard-operable multi-selection,
   separate customisation/edit controls, projected counts, pending/no-change
   feedback, authoritative row merge, selection retention on failure, and the
   mobile-sticky single Add action while preserving the custom reward editor.
5. Extend the DB-free launch harness for empty, two-active, ready, and
   already-present pools. Prove Space/Enter selection, no pre-Add persistence,
   custom/cancel focus, existing-row editing, failure retention, live-region
   copy, and 375-pixel overflow behavior on mobile and desktop.
6. With disposable local Supabase identities, force an owner-scoped mid-batch
   failure, assert zero browser/DB partial state, remove the fault, retry without
   reselecting, and read back the exact rewards/events/audits/QR state before
   `finally` cleanup.
7. Run every declared gate on a clean implementation commit, record both red
   and green evidence, then advance this spec only through the lifecycle command.
