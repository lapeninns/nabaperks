# Refactor guardrails

Phase 0 record for the maintainability refactor. This file pins the baselines
the refactor must not regress, inventories the characterisation tests that
protect each domain, and classifies the contract suite so source-regex
assertions are replaced deliberately, phase by phase, rather than ad hoc.

Baselines were recorded on `main` at commit `87b2d5df` (20 July 2026).

## Baselines

### Coverage (`pnpm test:coverage`, scope `lib/**`)

| Metric    | Baseline | Enforced floor |
| --------- | -------- | -------------- |
| Lines     | 88.62%   | 80%            |
| Branches  | 82.30%   | 70%            |
| Functions | 87.05%   | 80%            |

Known low-coverage islands (all served by DB/webhook/e2e proof instead of unit
proof): `lib/stripe/billing.ts` (29% lines), `lib/security/rate-limit.ts`
(24% lines), `lib/stripe/checkout.ts` (72% lines).

### Duplication (`pnpm duplicates:check`, threshold 4%)

- 35 clones across `app`, `components`, `lib`
- 617 duplicated lines (0.79%), 3,103 duplicated tokens (0.92%)

### Complexity and size budgets (`eslint.config.mjs`)

- Enforced ceilings: complexity 40, 1,000 lines per file (blank lines and
  comments excluded).
- One documented exception: `lib/merchant/activity-display.ts` at complexity
  100 (removed in Phase 2).

Hotspots measured at the _target_ budgets (complexity 20, 600 effective
lines), which the refactor ratchets towards:

- 21 functions above complexity 20. Worst offenders:
  `toActivityDisplayRow` (92, `lib/merchant/activity-display.ts`),
  `RewardPoolForm` (36, `components/merchant/reward-pool-form.tsx`),
  `CardProgressPanel` (35, `components/customer/customer-card-experience.tsx`),
  `BillingPanelView` (31, `components/merchant/account/billing-panel-view.tsx`),
  `joinRewardsAction` (29, `app/m/[merchantSlug]/join/actions.ts`),
  `CustomerLoginForm` (28, `components/customer/customer-login-form.tsx`).
- 7 files above 600 effective lines: `lib/merchant/activity-display.ts` (907),
  `app/dev/design-system/page.tsx` (911, development-only fixture),
  `components/merchant/reward-pool-form.tsx` (818), `lib/stripe/checkout.ts`
  (812), `app/(auth)/actions.ts` (754), `lib/notifications/delivery-worker.ts`
  (608), `components/merchant/customer-readback-table.tsx` (602).

### Dead code (`pnpm deadcode:check`)

- Unused files: 1 (`components/merchant/qr-poster/poster-wordmark.tsx`,
  removed in Phase 0; the Knip `files` rule now fails CI).
- Unused exports: 188 at warn level. These are removed per domain as each
  phase touches them, never in bulk.

## Characterisation-test inventory

Behavioural tests that pin current outputs for the domains the refactor will
move. Each phase must keep its column green before and after extraction.

| Domain                  | Behavioural coverage                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity translation    | `tests/unit/activity-display.test.mjs` (explicit characterisation suite), `tests/unit/customer-activity.test.mjs`                                                                                                               |
| Merchant authentication | `tests/unit/merchant-auth-action-state.test.mjs`, `tests/unit/merchant-email-otp-provider.test.mjs`, `tests/unit/merchant-otp-resend.test.mjs`, `tests/db/passwordless-access-token-hook.test.mjs`, and the auth DB suites      |
| Reward-pool state       | `tests/unit/reward-presets.test.mjs`, `tests/unit/primary-reward.test.mjs`, DB invariants in `tests/db`                                                                                                                         |
| Stripe checkout         | `tests/unit/billing-checkout-core.test.mjs`, `tests/unit/billing-stripe-orchestration.test.mjs`, `tests/unit/billing-checkout-return.test.mjs`, `tests/unit/stripe-webhook-events.test.mjs`                                     |
| Notification delivery   | `tests/unit/notification-drain-plan.test.mjs`, `tests/unit/notification-quiet-hours.test.mjs`, `tests/unit/notification-frequency-cap.test.mjs`, `tests/unit/notification-readback.test.mjs`, `tests/db/notifications.test.mjs` |
| Signed webhook envelope | `tests/unit/standard-webhook.test.mjs` (added in Phase 0), `tests/e2e/auth-hook-routes.desktop.spec.ts`                                                                                                                         |
| Push subscription input | `tests/unit/push-subscription-input.test.mjs`                                                                                                                                                                                   |

## Contract-test classification

`tests/contracts` mixes two kinds of assertions. The rubric:

- **Repository/configuration invariant (retain).** Asserts wiring that has no
  behavioural substitute: package scripts, CI lanes, env contracts, migration
  immutability, route/file existence, catalogue completeness, security
  posture that spans files. These stay regex-based.
- **Domain source-regex (replace during the owning phase).** Asserts the
  internal shape of one domain's source (function names, private helpers,
  literal code). Each is replaced with behavioural tests when its domain is
  refactored — not before, so the guard never lapses.

| Contract area                                                                                                                                                                                                  | Classification                 | Owning phase |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------ |
| `agent-readiness-level5`, `next-config-root`, `production-release-controls`, `provider-readiness-smoke`, `dev-route-production-guard`, `public-indexing-policy`, `fresh-db-seed-parity`, `api-health-contract` | Repository/configuration       | retain       |
| `legal-*`, `marketing-*`, `seo-*`, `poster-*`, `tent-*`, `qr-a4-poster-templates` (catalogue and copy invariants)                                                                                              | Repository/configuration       | retain       |
| `db-*` migration assertions (applied migrations are immutable)                                                                                                                                                 | Repository/configuration       | retain       |
| `auth-hooks`, `auth-recovery-ux`, `auth-honest-signup-otp-messaging`, `auth-otp-alias-token-encryption`                                                                                                        | Domain source-regex (auth)     | Phase 1/3    |
| `notification-queue-claims`, `notification-venue-announcements`, `notifications-drain-throughput`                                                                                                              | Domain source-regex (notify)   | Phase 1/5    |
| `billing-*`, `launch-billing-local-stripe`, `merchant-billing-telemetry`                                                                                                                                       | Domain source-regex (billing)  | Phase 5      |
| `merchant-activity-service-role`, `customer-activity-readback`                                                                                                                                                 | Domain source-regex (activity) | Phase 2      |
| `customer-join-*`, `customer-stamp-*`, `customer-reward-*`, `customer-phone-identity-safety`                                                                                                                   | Domain source-regex (customer) | Phase 6      |
| `reward-presets`, `reward-preset-atomic-add`, `reward-invite-attach-fail-closed`                                                                                                                               | Domain source-regex (rewards)  | Phase 4      |

Replacement rule: when a phase moves code that a domain source-regex pins, the
same change set must (1) keep the invariant the regex encoded, restated
against the new seam, and (2) add or point to a behavioural test that proves
the invariant end to end. A regex is deleted only when both hold.

## Phase 0 decisions

- `components/merchant/qr-poster/poster-wordmark.tsx` (unused React wordmark)
  removed together with its only dependency, the `POSTER_BRAND_WORDMARK`
  constant. The PDF wordmark segments (`POSTER_BRAND_WORDMARK_PDF`) remain.
- Knip `files` rule raised from `warn` to `error`, so an unused production
  file now fails `pnpm deadcode:check` in the CI quality lane.
- Unused _exports_ stay at warn level for now; they are removed per domain as
  the owning phase refactors each module.
