---
spec_id: MS-OBSERVABILITY-COMPLIANCE-CUSTOMER-CONTACT-IMMUTABILITY
status: active
risk_class: auth-session
owner: factory-droid
last_reviewed: 2026-06-17
allowed_blast_radius:
  - app/home/**
  - app/reward/**
  - components/customer/profile-*.tsx
  - lib/customer/profile*.ts
  - lib/customer/experience/**
  - micro-specs/07-observability-compliance/04-customer-contact-immutability.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - scripts/run-supabase-sql.mjs
  - scripts/verify-security.mjs
  - scripts/verify-supabase-schema.mjs
  - supabase/migrations/**
  - supabase/tests/**
  - tests/micro-specs/**
implementation_surfaces:
  - app/home/**
  - app/reward/**
  - components/customer/profile-*.tsx
  - lib/customer/profile*.ts
  - lib/customer/experience/**
  - scripts/run-supabase-sql.mjs
  - scripts/verify-security.mjs
  - scripts/verify-supabase-schema.mjs
  - supabase/migrations/**
  - supabase/tests/**
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
  - DESIGN.md
related_tests:
  - tests/micro-specs/home-profile.test.ts
  - tests/micro-specs/reward-profile-gate.test.ts
  - tests/micro-specs/reward-profile-actions.test.ts
  - tests/micro-specs/customer-contact-immutability.test.ts
  - supabase/tests/customer_contact_immutability.sql
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm db:verify
  - pnpm security:verify
  - pnpm build
approved_exceptions: []
---

# Micro-Spec: Customer Contact Immutability

## Governance Status Evidence

- Lifecycle status: `active` because this slice implements a selected contact-lock policy and has a database migration backstop.
- Stale/superseded handling: no prior active spec replaces this contact immutability rule.
- Evidence posture: unit tests cover server actions, profile view models, and reward-gate rendering; SQL tests cover direct database mutation attempts.

## Exact Goal and User-Visible Outcomes

Customers can still edit profile details such as name and date of birth. Once a phone number or email address has been verified, customer self-service cannot change or clear that contact anchor. Unverified pending email remains editable so customers can correct typos, verify it, resend the code, or continue without email.

## Blast Radius

In scope:

- `/home/profile` customer profile save, verification, resend, and clear-email actions.
- Reward profile-gate save, verification, resend, and clear-email actions.
- Customer profile and reward-gate view models.
- Customer-facing profile and reward-gate contact UI.
- Database guard on `public.customers` verified contact anchor fields.

Out of scope:

- Merchant profile contact editing.
- Admin/support verified contact replacement.
- Customer phone replacement flow.
- Marketing consent changes unrelated to contact immutability.

## Strict Constraints and Assumptions

- Chosen policy: verified contact details are locked for customer self-service.
- Chosen enforcement: application checks plus a Postgres `before update` trigger.
- Phone remains the customer identity anchor and is already verified through the customer session flow.
- A verified email must not be replaced through stale or tampered pending-email verification state.
- Unverified pending email remains optional and removable.

## Behavioral Requirements

- **MS-OBSERVABILITY-COMPLIANCE-CUSTOMER-CONTACT-IMMUTABILITY-001** WHEN a customer has a verified phone, THE customer self-service surfaces SHALL keep phone read-only and SHALL NOT submit a phone replacement.
- **MS-OBSERVABILITY-COMPLIANCE-CUSTOMER-CONTACT-IMMUTABILITY-002** WHEN a customer has a verified email, THE home profile and reward profile gate SHALL show that email as verified/read-only and SHALL NOT render an editable `email` field.
- **MS-OBSERVABILITY-COMPLIANCE-CUSTOMER-CONTACT-IMMUTABILITY-003** WHEN a self-service profile update submits a different or blank email for a customer with an existing verified email, THE system SHALL preserve the verified email, save non-contact profile fields, and SHALL NOT send a new verification code.
- **MS-OBSERVABILITY-COMPLIANCE-CUSTOMER-CONTACT-IMMUTABILITY-004** WHEN a customer email is unverified, THE system SHALL allow adding, changing, resending, verifying, and clearing that pending email.
- **MS-OBSERVABILITY-COMPLIANCE-CUSTOMER-CONTACT-IMMUTABILITY-005** WHEN a direct database update attempts to change verified email or verified phone anchor fields, THE database SHALL reject the update while allowing non-contact profile updates.

## Verification Criteria

Acceptance criteria:

- Verified phone remains visible and read-only on customer self-service surfaces.
- Verified email remains visible and read-only on customer self-service surfaces.
- Tampered profile form submissions cannot replace or clear verified email.
- Stale pending email verification cannot replace an already verified email.
- Direct SQL mutation attempts against verified contact anchors fail.

Manual QA:

- Open `/home/profile` for a customer with verified phone and email and confirm phone/email are read-only while name/DOB still save.
- Open reward profile gate for the same customer and confirm no editable email input is rendered.
- Open the unverified-email state and confirm resend, verify, and continue-without-email remain available.

Task breakdown:

- Add contact-lock profile contract fields and tests.
- Update profile/reward actions to preserve locked contact anchors.
- Update customer UI to render verified contact as read-only.
- Add idempotent Postgres trigger and SQL verification.
