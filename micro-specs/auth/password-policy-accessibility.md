---
spec_id: MS-auth-password-policy-accessibility
status: draft
risk_class: auth-session
owner: codex
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/auth/password-policy-accessibility.md
  - micro-specs/evidence/MS-auth-password-policy-accessibility.json
  - micro-specs/merchant/auth.md
  - micro-specs/auth/recovery-ux.md
  - supabase/config.toml
  - lib/auth/password.ts
  - components/auth/password-requirements.tsx
  - components/auth/signup-details-form.tsx
  - components/auth/reset-password-form.tsx
  - components/brand/logo.tsx
  - components/layout/marketing-layout.tsx
  - tests/unit/password.test.mjs
  - tests/micro-specs/auth-password-policy-accessibility.test.mjs
  - tests/e2e/auth-password-policy-flow.ts
  - tests/e2e/auth-password-policy.spec.ts
  - tests/e2e/auth-password-policy.desktop.spec.ts
  - tests/e2e/helpers/auth-password-policy-live-db.ts
  - tests/e2e/helpers/merchant-auth-recovery-live-db.ts
  - tests/e2e/visual.spec.ts-snapshots/auth-*.png
implementation_surfaces:
  - micro-specs/auth/password-policy-accessibility.md
  - micro-specs/evidence/MS-auth-password-policy-accessibility.json
  - micro-specs/merchant/auth.md
  - micro-specs/auth/recovery-ux.md
  - supabase/config.toml
  - lib/auth/password.ts
  - components/auth/password-requirements.tsx
  - components/auth/signup-details-form.tsx
  - components/auth/reset-password-form.tsx
  - components/brand/logo.tsx
  - components/layout/marketing-layout.tsx
  - tests/unit/password.test.mjs
  - tests/micro-specs/auth-password-policy-accessibility.test.mjs
  - tests/e2e/auth-password-policy-flow.ts
  - tests/e2e/auth-password-policy.spec.ts
  - tests/e2e/auth-password-policy.desktop.spec.ts
  - tests/e2e/helpers/auth-password-policy-live-db.ts
  - tests/e2e/helpers/merchant-auth-recovery-live-db.ts
  - tests/e2e/visual.spec.ts-snapshots/auth-*.png
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - reports/merchant-journey-ux-audit-2026-07-09.md
  - supabase/config.toml
related_tests:
  - tests/unit/password.test.mjs
  - tests/micro-specs/auth-password-policy-accessibility.test.mjs
  - tests/e2e/auth-password-policy.spec.ts
  - tests/e2e/auth-password-policy.desktop.spec.ts
  - tests/e2e/a11y.spec.ts
  - tests/e2e/visual.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-auth-password-policy-accessibility"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - manual:read-only-hosted-supabase-auth-policy-check
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for every declared verification gate.
  - Source and unit proof that app validation and local Supabase both require 8 or more characters, at least one letter, and at least one digit, while uppercase and symbols remain optional.
  - Real public local Supabase signup proof that a lowercase-plus-digit password succeeds and short, letterless, and digitless passwords fail before delivery.
  - Real local recovery/update proof that the same lowercase-plus-digit password can become the account password and can establish a new session.
  - Mobile browser proof at exactly 375x812 and desktop proof at exactly 1280x800 for persistent rule copy, input association, contextual live status, visible keyboard focus, one focused-layout home link, and no horizontal overflow.
  - Axe and visual-regression evidence for focused signup and reset states.
  - Read-only hosted Supabase Auth configuration readback recording only the minimum length and required-character policy; no secret values or hosted mutation.
approved_exceptions: []
---

# MS-auth-password-policy-accessibility — Password policy alignment and focused auth accessibility

## 1. Exact Goal and User-Visible Outcomes

A merchant can create or reset a password using one clear rule everywhere:
eight or more characters with at least one letter and one number. The three
requirements are permanently visible, programmatically associated with the
password field, and announced with meaningful progress. Focused auth pages
retain one home link in the header while their footer wordmark is static, so
keyboard and screen-reader users do not encounter a duplicate home control.

## 2. Blast Radius

May edit only the local Supabase password setting, its shared app validator and
requirements UI, the two password-field callers, the reusable logo's static
rendering seam, the focused marketing footer, the two predecessor Micro-Spec
sentences superseded by this work, and the focused unit, source-contract,
provider, browser, accessibility, and visual proof listed in frontmatter.

Out of scope: changing OTP generation or delivery, auth sessions, rate limits,
email providers, redirect handling, database schema or RLS, password-manager
behaviour, customer phone authentication, adding a password-strength score,
forcing existing users to rotate passwords, or mutating hosted Supabase
configuration. Terms and Privacy remain intentional links in the focused
footer.

## 3. Strict Constraints and Assumptions

- Supabase Auth remains the authority. `validatePassword` is an early app guard
  that must mirror—not exceed or weaken—the provider policy.
- The policy is exactly minimum length `8` plus `letters_digits`. A letter may
  be upper- or lowercase; uppercase and symbols are optional. Examples used in
  proof are non-secret disposable fixtures.
- The password input must reference the persistent requirements container with
  `aria-describedby`. Hover, title text, colour, icons, or an axe-only pass do
  not count as the requirements contract.
- Live feedback must be contextual and atomic, for example `Password meets 2
of 3 rules` or `Password meets all 3 rules`; a bare fraction is insufficient.
- Focused `/signup`, `/signup/verify`, `/login`, and `/reset-password` layouts
  must expose exactly one link whose accessible name identifies Nabaperks home.
  The legal links are not exits from this requirement.
- Local provider proof must run only against disposable local Supabase, with
  one Playwright worker and exact cleanup of any created auth users, sessions,
  aliases, and rate-limit buckets. It must refuse hosted URLs.
- Changing `supabase/config.toml` is not runtime proof until local Auth is
  restarted and acceptance/rejection is observed through the public provider
  path.
- Hosted verification is read-only. If configuration cannot be read or is not
  minimum `8` plus letters-and-digits, implementation may be locally complete
  but the production-readiness verdict remains `NOT READY`.

## 4. Decisions Already Made

- Use three visible rules: `8 or more characters`, `At least one letter`, and
  `At least one number`.
- Remove the symbol allow-list, lowercase-only rule, uppercase-only rule, and
  hover tooltips from the app validator and requirements component.
- Keep the existing signup and reset server actions; both already call the
  shared validator before Supabase and must continue to rely on Supabase for
  authoritative acceptance.
- Extend `Logo` with an opt-in static/non-link rendering mode. Linked behaviour
  remains the default; only the focused footer uses the static mode. The normal
  marketing footer remains linked.
- This Micro-Spec supersedes only `MS-merchant-auth`'s statement that Supabase
  Auth config is out of scope and clarifies MA-2 as rejecting a password that
  lacks at least one letter or lacks at least one digit. It also supersedes
  `MS-auth-recovery-ux`'s password-policy-invariance sentence. All other
  contracts in those specs remain in force.
- Focused browser acceptance uses explicit 375x812 and 1280x800 viewports;
  global device defaults are not a substitute.

## 5. Behavioral Requirements (EARS)

- **AP-1:** THE local Supabase provider and shared app validator SHALL accept a
  password of at least eight characters containing at least one ASCII letter
  and at least one digit without requiring uppercase or a symbol.
- **AP-2:** IF a password is shorter than eight characters, lacks a letter, or
  lacks a digit, THEN THE app validator and local public provider SHALL reject
  it without creating an auth user.
- **AP-3:** WHILE a signup or reset password is edited, THE page SHALL display
  all three rules as persistent readable text and SHALL expose each rule's met
  state without relying only on colour or an icon.
- **AP-4:** WHEN rule progress changes, THE page SHALL announce a contextual,
  atomic three-rule status and SHALL keep the requirements associated with the
  password input through `aria-describedby`.
- **AP-5:** WHERE `MarketingLayout` is focused, THE header SHALL retain the only
  Nabaperks home link and THE focused footer SHALL render a non-interactive
  wordmark while keeping Terms and Privacy operable.
- **AP-6:** WHEN a lowercase-plus-digit password is submitted through the real
  public local signup path, THE provider SHALL accept it and route the browser
  to verification; cleanup SHALL remove the disposable user afterwards.
- **AP-7:** WHEN the same policy-compliant shape is set through the real local
  recovery path, THE provider SHALL persist it and permit a fresh password
  session after the recovery session is closed.
- **AP-8:** IF a focused auth page is used at 375x812 or 1280x800, THEN rules,
  footer, focus treatment, and actions SHALL remain readable and free of
  horizontal overflow.
- **AP-9:** THE hosted-policy inspection SHALL perform no mutation and SHALL
  disclose only the hosted minimum length, character-policy value, and a
  `READY` or `NOT READY` comparison with this contract.

## 6. Verification Criteria and Task Breakdown

1. Add failing unit and source-contract tests for the exact three-rule policy,
   validator/config parity, password-input description, contextual live text,
   the static focused-footer logo, and the predecessor-spec clarifications.
2. Add failing focused Playwright tests at 375x812 and 1280x800 for visible rule
   copy, live progress, keyboard focus, exactly one home link, overflow, axe,
   and the public local-provider acceptance/rejection matrix. The live cases
   must skip with an explicit reason unless local-only opt-in and credentials
   are present.
3. Change local Supabase config and the shared validator, then implement the
   persistent three-rule component and associate it with signup/reset inputs.
4. Add the static `Logo` seam, use it only in the focused footer, and record the
   narrow supersession notes in the two predecessor Micro-Specs.
5. Restart local Supabase Auth, run the focused live provider proof with one
   worker, update only changed auth visual baselines, and inspect both exact
   viewport screenshots.
6. Run every declared gate sequentially, record the evidence ledger, and use
   `governance:advance` for lifecycle changes. Re-prove every implemented spec
   whose evidence becomes stale before declaring the lane complete.
7. Read hosted Supabase Auth configuration without mutation. Record only the
   minimum and character policy; keep the final goal `NOT READY` if the check
   is unavailable or mismatched.
