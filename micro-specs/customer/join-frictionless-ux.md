---
spec_id: MS-customer-join-frictionless-ux
status: implemented
risk_class: ui-only
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/customer/join-frictionless-ux.md
  - micro-specs/evidence/MS-customer-join-frictionless-ux.json
  - reports/join-flow-analysis-2026-07-10.md
  - app/m/[merchantSlug]/page.tsx
  - app/m/[merchantSlug]/join/page.tsx
  - app/m/[merchantSlug]/join/actions.ts
  - app/card/[membershipId]/stamp/page.tsx
  - app/q/[qrId]/page.tsx
  - components/customer/join-wizard.tsx
  - components/customer/join-forms.tsx
  - components/customer/join-otp-form.tsx
  - components/customer/join-welcome-step.tsx
  - components/customer/customer-card-experience.tsx
  - lib/navigation/customer-join-intent.ts
  - lib/customer/experience/copy.ts
  - lib/customer/experience/derive.ts
  - lib/customer/experience/load-stamp.ts
  - lib/customer/experience/load-join.ts
  - lib/customer/experience/types.ts
  - lib/customer/returning-qr-redirect.ts
  - tests/unit/customer-experience-join.test.mjs
  - tests/unit/customer-join-intent.test.mjs
  - tests/micro-specs/customer-join-frictionless-ux.test.mjs
  - tests/micro-specs/customer-loyalty-preview.test.mjs
  - tests/micro-specs/customer-error-boundaries.test.mjs
  - tests/micro-specs/customer-join-contract.test.mjs
  - tests/micro-specs/public-qr-router-contract.test.mjs
  - tests/e2e/customer-join-direct-live-db.spec.ts
  - tests/e2e/customer-referral-attribution.spec.ts
  - tests/e2e/customer-join-existing-member-live-db.spec.ts
  - tests/e2e/customer-join-terms-live-db.spec.ts
  - tests/e2e/helpers/customer-join-live-db.ts
  - tests/e2e/helpers/public-qr-router-live-db.ts
implementation_surfaces:
  - reports/join-flow-analysis-2026-07-10.md
  - app/m/[merchantSlug]/page.tsx
  - app/m/[merchantSlug]/join/page.tsx
  - app/m/[merchantSlug]/join/actions.ts
  - app/card/[membershipId]/stamp/page.tsx
  - app/q/[qrId]/page.tsx
  - components/customer/join-wizard.tsx
  - components/customer/join-forms.tsx
  - components/customer/join-otp-form.tsx
  - components/customer/join-welcome-step.tsx
  - components/customer/customer-card-experience.tsx
  - lib/navigation/customer-join-intent.ts
  - lib/customer/experience/copy.ts
  - lib/customer/experience/derive.ts
  - lib/customer/experience/load-stamp.ts
  - lib/customer/experience/load-join.ts
  - lib/customer/experience/types.ts
  - lib/customer/returning-qr-redirect.ts
  - tests/unit/customer-experience-join.test.mjs
  - tests/unit/customer-join-intent.test.mjs
  - tests/micro-specs/customer-join-frictionless-ux.test.mjs
  - tests/micro-specs/customer-loyalty-preview.test.mjs
  - tests/micro-specs/customer-error-boundaries.test.mjs
  - tests/micro-specs/customer-join-contract.test.mjs
  - tests/micro-specs/public-qr-router-contract.test.mjs
  - tests/e2e/customer-join-direct-live-db.spec.ts
  - tests/e2e/customer-referral-attribution.spec.ts
  - tests/e2e/customer-join-existing-member-live-db.spec.ts
  - tests/e2e/customer-join-terms-live-db.spec.ts
  - tests/e2e/helpers/customer-join-live-db.ts
  - tests/e2e/helpers/public-qr-router-live-db.ts
related_docs:
  - DESIGN.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/join.md
  - micro-specs/referral/attribution.md
related_tests:
  - tests/unit/customer-experience-join.test.mjs
  - tests/unit/customer-join-intent.test.mjs
  - tests/micro-specs/customer-join-frictionless-ux.test.mjs
  - tests/micro-specs/customer-loyalty-preview.test.mjs
  - tests/micro-specs/customer-error-boundaries.test.mjs
  - tests/micro-specs/customer-join-contract.test.mjs
  - tests/micro-specs/public-qr-router-contract.test.mjs
  - tests/e2e/customer-join-direct-live-db.spec.ts
  - tests/e2e/customer-referral-attribution.spec.ts
  - tests/e2e/customer-join-existing-member-live-db.spec.ts
  - tests/e2e/customer-join-terms-live-db.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-customer-join-frictionless-ux"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari --grep "@MS-customer-join-frictionless-ux"
  - pnpm test:visual -- --project=chromium --project=mobile-safari --grep "@MS-customer-join-frictionless-ux"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for every declared gate.
  - Mobile screenshots and browser traces for QR, direct, referral, composite, returning, and pending-first-stamp states at 375px.
  - Keyboard, live-region, reduced-motion, and no-horizontal-overflow evidence for the changed join forms.
approved_exceptions:
  - "evidence-waiver: the end-to-end customer join programme shares one reviewed working tree across its nine mutually dependent specs and will ship atomically (expires: 2026-07-17)"
---

# MS-customer-join-frictionless-ux — Frictionless and honest customer join UX

## 1. Exact Goal and User-Visible Outcomes

Every customer sees a short Wet Ink join journey that truthfully describes what will happen. QR joins promise and deliver a first stamp; direct and referral joins save a zero-stamp card and clearly ask for a venue scan; composite QR/referral intent survives every navigation; returning customers always choose the same explicit stamp action after identity verification; pending and waiting states remain durable, calm, and actionable.

## 2. Blast Radius

This spec owns the join state/copy contract, composable URL intent, join screens, card recovery presentation, returning-member redirect destination, QR browser-fixture repair, and focused tests listed in frontmatter. It does not change Wet Ink tokens or base primitives, OTP/provider policy, database recovery semantics, referral award rules, normal stamp/reward algorithms, or merchant/admin interfaces.

## 3. Strict Constraints and Assumptions

- Preserve `DESIGN.md`, existing customer shells, receipt/card visuals, shadcn primitives, hard ink borders, warm paper, and stamp-led motion.
- Query params are navigation hints only; they may not become authority or arbitrary display copy.
- Use one typed `JoinIntent` URL builder for QR, referral, composite, and step continuity.
- QR and referral are independent facts, not mutually exclusive modes.
- No success tone or stamp celebration renders unless server state confirms a stamp.
- Returning QR scans do not mutate loyalty state during route loading; after OTP they land on the same explicit stamp confirmation used by an already-authenticated customer.
- Accessibility includes 44px targets, native one-time-code semantics, fieldset legend, invalid-control focus, correct alert/status roles, reduced motion, and 320/375px fit.

## 4. Decisions Already Made

- The existing Wet Ink design is retained; this is a state-contract redesign, not a new visual system.
- QR flow progress is welcome 1/3, phone/verification 2/3, terms 3/3. Direct/referral flow is phone 1/3, OTP 2/3, terms 3/3.
- QR terms use “Collect your first stamp” and “Get my first stamp.” Direct/referral terms use “Save your loyalty card” and “Save my card.”
- The neutral OTP submit label is “Check code.”
- Direct/referral completion instructs the customer to scan the printed venue QR for the first stamp.
- Full-card waiting reward is a distinct experience with the actual UK business date and no stamp control.
- URL `blocked` values are typed codes mapped to product copy; arbitrary query text is never rendered.

## 5. Behavioral Requirements (EARS)

- WHEN a customer joins with valid QR proof, THE terms screen SHALL preview one stamp, promise the first stamp, and use the first-stamp CTA.
- WHEN a customer joins without QR proof, THE terms screen SHALL preview zero stamps, describe saving the card, and explain that the first stamp requires a venue scan.
- WHEN QR and referral values are both present, THE system SHALL preserve both through welcome, back, phone, resend, OTP, terms, completion, and error recovery navigation.
- WHEN a direct or referral customer first sees the phone screen, THE progress indicator SHALL begin at step 1 rather than step 2.
- WHEN an existing member verifies after scanning a QR, THE system SHALL send them to the same explicit stamp confirmation as an already-authenticated scanner and SHALL NOT issue a stamp from the OTP action.
- WHEN durable first-stamp recovery exists, THE card SHALL render the server-derived reason and one safe resolution action without a success celebration.
- WHEN a completed card has a waiting reward, THE system SHALL render the actual redeemable date, no stamp control, and one reward-details action.
- IF a caller forges a blocked or recovery query value, THEN THE system SHALL render only generic allowlisted product copy.
- WHEN loyalty terms are missing, THE form SHALL focus and announce the required checkbox error while preserving the optional marketing choice.
- THE changed flow SHALL remain usable by keyboard, screen reader, reduced-motion users, and 320px/375px mobile viewports without horizontal overflow.

## 6. Verification Criteria and Task Breakdown

1. Add failing pure tests for the join-state matrix, conditional copy, typed blocked reasons, and one composable URL builder.
2. Repair the launchable QR fixture by inserting three active reward items before active QR creation; never weaken the database trigger.
3. Implement the QR/direct/referral/composite screens and progress states by composing existing Wet Ink components.
4. Standardise returning-member routing on explicit stamp confirmation and add the distinct full-card waiting-reward experience.
5. Drive QR, direct, referral, composite, returning, and pending states in Chromium and mobile Safari; verify database outcomes where the journey mutates state.
6. Run accessibility and visual gates, review mobile screenshots at 320px and 375px, record all gates, and advance only when customer copy matches authoritative outcomes.
