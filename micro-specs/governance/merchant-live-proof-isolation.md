---
spec_id: MS-governance-merchant-live-proof-isolation
status: implemented
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/governance/merchant-live-proof-isolation.md
  - micro-specs/evidence/MS-governance-merchant-live-proof-isolation.json
  - tests/e2e/helpers/merchant-reward-preset-live-db.ts
  - tests/e2e/merchant-reward-preset-atomic-add-flow.ts
  - tests/micro-specs/merchant-live-proof-isolation.test.mjs
implementation_surfaces:
  - micro-specs/governance/merchant-live-proof-isolation.md
  - micro-specs/evidence/MS-governance-merchant-live-proof-isolation.json
  - tests/e2e/helpers/merchant-reward-preset-live-db.ts
  - tests/e2e/merchant-reward-preset-atomic-add-flow.ts
  - tests/micro-specs/merchant-live-proof-isolation.test.mjs
related_tests:
  - tests/e2e/merchant-reward-preset-atomic-add-flow.ts
  - tests/micro-specs/merchant-live-proof-isolation.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - Chromium local-Supabase proof that an independent launch milestone does not invalidate reward rollback and that retry still commits exactly three reward events plus one QR event.
approved_exceptions: []
---

# MS-governance-merchant-live-proof-isolation — Isolate merchant live proof event counts

## 1. Exact Goal and User-Visible Outcomes

The real-browser reward-preset rollback proof remains accurate when unrelated
merchant telemetry runs on the same page. Operators can trust that a failed
atomic reward batch wrote no reward or QR events, while independent launch
analytics neither create a false failure nor get silently ignored by product
code. The same proof follows the ready QR link to the canonical QR tab in the
merchant launch workspace.

## 2. Blast Radius

In scope: the reward-preset live-database readback assertion, the proof's
canonical ready-QR destination, one focused source contract, this Micro-Spec,
and its evidence ledger.

Out of scope: application code, database migrations or RPCs, event writers,
launch instrumentation, reward mutation behavior, fixtures, browser UI, and
provider configuration.

## 3. Strict Constraints and Assumptions

- The live proof must count only events owned by the atomic reward-preset
  operation: its batch-created reward events and the join-QR creation event.
- `merchant_launch_entered` and every other independent event remain valid
  product facts and must not be deleted, suppressed, or folded into the reward
  transaction.
- Existing detailed assertions for reward rows, audits, QR rows, preset ids,
  display order, and exact successful retry behavior remain unchanged.
- The ready QR action is part of the consolidated launch workspace and its
  canonical destination is `/app/launch?tab=qr`; `/app/qr` is legacy proof
  drift, not a product requirement.
- The fix is query scoping only. Production behavior and schema are immutable.
- The destructive browser proof remains explicitly local-only, opt-in, and
  single-worker.

## 4. Decisions Already Made

- `productEventCount` in this fixture means the combined operation-owned
  reward-preset and QR event count, not every event for the merchant.
- The dedicated `rewardProductEventCount` and `qrProductEventCount` fields
  remain as independent cross-checks.
- Rollback expects zero operation-owned events; successful retry expects four:
  three `reward_pool_item_created` events from `reward_preset_batch` for the
  fixture card plus one `qr_created` event.
- The live Chromium rerun is evidence for the fix; the normal Node gates keep
  the query and canonical-route contracts from regressing.

## 5. Behavioral Requirements (EARS)

- **LP-1:** WHEN reward-preset live state is read, THE proof SHALL count only
  fixture-card `reward_preset_batch` creation events and merchant join-QR
  creation events in its combined product-event total.
- **LP-2:** IF an unrelated activation or analytics event exists for the same
  merchant, THEN THE rollback proof SHALL ignore it without deleting or
  modifying that event.
- **LP-3:** WHEN the injected second reward audit fails, THE proof SHALL observe
  zero reward rows, reward audits, QR rows, and operation-owned product events.
- **LP-4:** WHEN the unchanged selection retries successfully, THE proof SHALL
  observe exactly three ordered rewards, three matching reward events and
  audits, one active linked QR, and one matching QR event.
- **LP-5:** WHEN the successful retry's ready QR action is followed, THE proof
  SHALL require the canonical `/app/launch?tab=qr` destination and verify the
  QR surface there.
- **LP-6:** THE fix SHALL NOT modify any production file, database object,
  browser behavior, or merchant data outside disposable local fixtures.

## 6. Verification Criteria and Task Breakdown

1. First fail a focused source contract against the merchant-wide event count.
2. Fail the same source contract against the proof's legacy standalone QR
   destination.
3. Narrow the combined event count to the two operation-owned event families,
   preserve all dedicated readback assertions, and require the canonical QR
   tab destination.
4. Rerun the previously failed local Chromium rollback-and-retry proof with all
   local-only guards enabled; require full cleanup.
5. Run the declared Node gates from a clean implementation commit and record
   the evidence ledger at the lifecycle boundary.
