---
spec_id: MS-customer-redemption-second-factor
status: implemented
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/customer/redemption-second-factor.md
  - micro-specs/evidence/MS-customer-redemption-second-factor.json
  - lib/customer/profile-completion.ts
  - lib/customer/reward-email-assurance.ts
  - lib/customer/email-verification.ts
  - lib/customer/experience/load-profile-gate.ts
  - lib/customer/experience/load-reward.ts
  - lib/customer/experience/load-stamp.ts
  - components/customer/profile-gate-forms.tsx
  - app/reward/[rewardId]/actions.ts
  - app/reward/[rewardId]/qr.png/route.ts
  - app/dev/home-harness/redemption-second-factor/page.tsx
  - supabase/migrations/20260713130000_reward_redemption_verified_email.sql
  - tests/unit/customer-profile-completion.test.mjs
  - tests/micro-specs/customer-redemption-second-factor.test.mjs
  - tests/micro-specs/dev-route-production-guard.test.mjs
  - tests/db/customer-redemption-second-factor.test.mjs
  - tests/db/helpers/reward-email-assurance.mjs
  - tests/db/architecture-moat.test.mjs
  - tests/db/customer-lifecycle.test.mjs
  - tests/db/customer-profile.test.mjs
  - tests/db/integrity-hardening.test.mjs
  - tests/db/issued-rewards-gate-parity.test.mjs
  - tests/db/issued-rewards-redemption.test.mjs
  - tests/db/reward-redemption-edges.test.mjs
  - tests/db/reward-scan-single-use.test.mjs
  - tests/e2e/helpers/reward-collection-live-db.ts
  - tests/micro-specs/customer-reward-detail-contract.test.mjs
  - tests/e2e/customer-redemption-second-factor/visual.spec.ts
implementation_surfaces:
  - lib/customer/profile-completion.ts
  - lib/customer/reward-email-assurance.ts
  - lib/customer/email-verification.ts
  - lib/customer/experience/load-profile-gate.ts
  - lib/customer/experience/load-reward.ts
  - lib/customer/experience/load-stamp.ts
  - components/customer/profile-gate-forms.tsx
  - app/reward/[rewardId]/actions.ts
  - app/reward/[rewardId]/qr.png/route.ts
  - app/dev/home-harness/redemption-second-factor/page.tsx
  - supabase/migrations/20260713130000_reward_redemption_verified_email.sql
  - tests/unit/customer-profile-completion.test.mjs
  - tests/micro-specs/customer-redemption-second-factor.test.mjs
  - tests/micro-specs/dev-route-production-guard.test.mjs
  - tests/db/customer-redemption-second-factor.test.mjs
  - tests/db/helpers/reward-email-assurance.mjs
  - tests/db/architecture-moat.test.mjs
  - tests/db/customer-lifecycle.test.mjs
  - tests/db/customer-profile.test.mjs
  - tests/db/integrity-hardening.test.mjs
  - tests/db/issued-rewards-gate-parity.test.mjs
  - tests/db/issued-rewards-redemption.test.mjs
  - tests/db/reward-redemption-edges.test.mjs
  - tests/db/reward-scan-single-use.test.mjs
  - tests/e2e/helpers/reward-collection-live-db.ts
  - tests/micro-specs/customer-reward-detail-contract.test.mjs
  - tests/e2e/customer-redemption-second-factor/visual.spec.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/redeem.md
related_tests:
  - tests/unit/customer-profile-completion.test.mjs
  - tests/micro-specs/customer-redemption-second-factor.test.mjs
  - tests/micro-specs/dev-route-production-guard.test.mjs
  - tests/db/customer-redemption-second-factor.test.mjs
  - tests/db/helpers/reward-email-assurance.mjs
  - tests/micro-specs/customer-reward-detail-contract.test.mjs
  - tests/e2e/customer-redemption-second-factor/visual.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-customer-redemption-second-factor"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Database proof that unverified customers cannot mint or redeem a reward token and verified customers can.
  - Browser proof that the collection QR stays hidden until the independent email code is confirmed.
approved_exceptions:
  - "evidence-waiver: the end-to-end customer join programme shares one reviewed working tree across its nine mutually dependent specs and will ship atomically (expires: 2026-07-17)"
---

# MS-customer-redemption-second-factor — Verified second factor for reward collection

## 1. Exact Goal and User-Visible Outcomes

A customer may join and collect stamps with verified phone ownership, but each reward leaves the system only after a fresh code proves current control of the independently verified email. Existing verified email remains locked, so possession of a later-recycled phone number alone cannot collect that account's reward.

## 2. Blast Radius

This spec owns the reward-time profile-completion rule, the email step copy, the QR route guard, database value-transfer triggers, and focused proof listed in frontmatter. It does not change join, stamping, phone OTP, merchant reward scanning, reward eligibility, age policy, or account-recovery adjudication for legacy accounts that never bound a verified email.

## 3. Strict Constraints and Assumptions

- Phone remains sufficient for low-risk join, card, and stamp access.
- Email is required only when a reward is ready for collection.
- The browser is not authority: both reward-token creation and the final redeemed transition must fail closed in Postgres.
- Existing verified email remains immutable under the current contact-lock policy.
- Already redeemed historical rewards remain readable and are not rewritten.
- The change is forward mitigation. A legacy account without a previously verified email still requires a future recovery-policy decision if the phone is suspected recycled.

## 4. Decisions Already Made

- Use the existing Resend-backed email-code flow rather than adding a password or another SMS.
- Remove the “continue without email” escape from reward collection.
- Keep name, adult date of birth, and verified email in one profile gate.
- Database failures expose calm product copy; logs and tests must not print contact values.

## 5. Behavioral Requirements (EARS)

- WHEN a ready reward belongs to a customer without verified email, THE system SHALL show the email field or email-code step and SHALL NOT expose the collection QR.
- WHEN name, adult date of birth, and a verified email are present, THE system SHALL still require fresh reward-specific email assurance before exposing collection.
- IF reward token insertion is attempted for an unverified-email customer, THEN Postgres SHALL reject it.
- IF a reward status transition to redeemed is attempted for an unverified-email customer, THEN Postgres SHALL reject it.
- WHEN a verified email already exists, THE system SHALL keep it locked and require a new code sent to that address for the current reward rather than accepting historical verification or a replacement from the phone session.
- WHEN a reward is already redeemed, THE system SHALL preserve its historical proof without applying the new gate retroactively.

## 6. Verification Criteria and Task Breakdown

1. Make pure profile completion require verified email and prove missing, pending, verified, and locked states.
2. Make the reward form require an email and remove the bypass action from the collection screen.
3. Guard the reward QR route before token creation.
4. Add forward-only triggers that reject unverified token creation and redemption while preserving completed history.
5. Prove the two database rejection boundaries and successful verified path against local Supabase.
6. Drive the ready reward through details, email code, and QR reveal in Chromium and mobile Safari.
7. Record every gate and advance only when the independent factor is enforced at UI and database boundaries.
