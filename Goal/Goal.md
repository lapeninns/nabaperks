You are working in:
`/Users/amankumarshrestha/LapenInns Project/Nabaperks`

Implement the combined customer edge-case gaps from both audit artifacts:

- `Goal/customer-edge-case-audit.md`
- `Goal/customer-edge-case-audit-claude.md`

First read `AGENTS.md`, `micro-specs/README.md`, `micro-specs/GLOBAL_CONTEXT.md`, `Instructions_tdd.md`, and both audit files. Follow the repo’s binding TDD workflow: every in-scope behaviour gets a failing test first, then implementation, then refactor under green. Do not weaken or delete tests. Do not use `as any`, `@ts-ignore`, or `@ts-expect-error`.

Goal: fix all overlapping and unique gaps from both audits across customer QR -> join -> OTP -> stamp -> card -> reward -> merchant scan -> home. Preserve the product direction: merchant-scanned reward redemption, no customer tap-to-redeem, phone-first customer identity, geolocation soft-fails, and server/RPC source of truth.

Implement the combined backlog:

1. Consolidate stamp/RPC error mapping.
   - Replace the production-only duplicate `blockedReason()` with one shared typed classifier used by actions/loaders/tests.
   - Add safe customer mappings for `Rate limit exceeded`, `At least 3 active reward pool items are required before unlocking a reward`, `Verified customer required`, membership not found, ownership mismatch, billing unavailable, reward-ready-first, and already-stamped.
   - Ensure `selfStampAction` and the returning-QR OTP auto-stamp path never throw raw RPC errors into a full-page “card unavailable” boundary.
   - Return calm inline copy for rate limits and reward-pool misconfiguration.

2. Align billing policy across all customer surfaces.
   - Treat `billing_customers.status = cancelled` consistently with the RPC policy wherever the customer can see or act: QR/join, card, stamp, reward, home, and merchant-scan redemption.
   - Keep `trialing`, `active`, and `past_due` allowed if that is the intended policy, but lock it with explicit matrix tests.
   - Keep `merchants.status` handling separate from `billing_customers.status`.

3. Fix full-card-without-unlocked-reward inconsistency.
   - If active-cycle stamp count is >= required but no unlocked reward row exists, do not invite another stamp.
   - Show a safe recovery/unavailable state and make the condition operator-diagnosable through existing logging/audit patterns.

4. Improve waiting-reward handling.
   - Add explicit home status/copy for waiting rewards.
   - Cover returning-member OTP branches for reward-ready and reward-waiting.
   - Avoid copy that promises “tomorrow” when `next_uk_business_date` may skip weekends; render the actual date or use “next opening day”.

5. Fix QR and join edge copy.
   - Give QR scan rate limits distinct retry-later copy instead of the same dead-QR panel.
   - Surface `first_stamp_issued=false` after join so the customer is not led to believe a first stamp landed when the RPC blocked it.

6. Clean dead/drifting states.
   - Remove or wire unused `StampBlockReason` variants such as `invalid_qr`, `expired_qr`, and `wrong_merchant`.
   - Deduplicate `unavailableMessage` between card/reward logic.
   - Reconcile docs/spec drift: merchant-scanned reward collection, minimum 3 active reward pool items, `/home` vs wallet naming, and any route docs affected by code changes.

7. Expand tests.
   Add focused tests for:
   - Stamp rate limit -> calm inline copy.
   - Reward pool < 3 on final stamp -> calm inline copy and no raw error boundary.
   - Billing matrix across `trialing`, `active`, `past_due`, `cancelled`, `suspended`.
   - Cancelled billing on stamp, join, reward, home, and merchant scan.
   - Waiting reward home status.
   - Returning OTP reward-ready, reward-waiting, and auto-stamp throw handling.
   - Full count with no reward row.
   - Wrong-customer and not-found customer stamp/reward routes.
   - Geo soft-fail for stamp and reward redemption remains non-blocking.
   - Same-UK-day re-stamp after redemption cycle reset, if not already covered.

Verification required before final response:

- Run the focused customer Vitest suite from both audits, including all 10 files listed in `customer-edge-case-audit-claude.md`.
- Run relevant SQL tests for profile gate and reward redemption cycles.
- Run lint/type/build checks used by this repo.
- Drive the matching customer surface manually, preferably via the dev customer-flow preview and/or Playwright, covering reward-ready, reward-waiting, cancelled billing, rate-limit/pool-error copy, full-card-no-reward recovery, and home waiting-reward status.
- If the known venue-settings/geocoding test failure still exists, state whether it remains pre-existing or was fixed as part of the work.

Deliverables:

- Production code, tests, and docs/spec updates needed to close the gaps.
- A concise final summary listing changed areas, verification commands/results, manual QA evidence, and any residual blockers.
- Do not commit or push unless explicitly asked.
