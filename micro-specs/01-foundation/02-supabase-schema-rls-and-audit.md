---
spec_id: MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT
status: active
risk_class: migrations
owner: factory-droid
last_reviewed: 2026-06-15
allowed_blast_radius:
  - lib/**/*.ts
  - lib/supabase/**
  - micro-specs/01-foundation/02-supabase-schema-rls-and-audit.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - supabase/migrations/**
  - supabase/tests/**
implementation_surfaces:
  - supabase/migrations/**
  - supabase/tests/**
  - lib/supabase/**
  - lib/**/*.ts
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/foundation.test.ts
  - manual:billing/admin micro-spec Vitest evidence in retained legacy filename
  - tests/micro-specs/customer.test.ts
  - supabase/tests/tenant_isolation.sql
  - supabase/tests/reward_redemption_cycles.sql
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm db:verify
  - pnpm security:verify
approved_exceptions: []
---

# Micro-Spec: Supabase Schema, RLS, and Audit Backbone

## Governance Status Evidence

- Lifecycle status: `active` after review against `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, and related tests on 2026-06-15.
- Stale/superseded handling: this spec remains current intent; no replacement spec is linked.
- Evidence posture: related tests and verification gates are listed in metadata and traceability for implementation handoff.

## Exact Goal and User-Visible Outcomes

The database can safely store Nabaperks's MVP merchants, locations, QR context, loyalty cards, QR codes, customers, memberships, stamp events, reward events, consent records, billing state, product events, and audit logs.

Merchants, customers, admins, and trusted server code only see or mutate the data their role permits.

## Blast Radius

In scope:

- Supabase migrations and seed data.
- Database types generated from Supabase, if the repo uses generated types.
- Server-side data access helpers.
- RLS policies for merchant, customer, admin, billing, event, and audit tables.
- Test fixtures for tenant isolation and audit/event readback.

Out of scope:

- Full UI implementation.
- Stripe webhook logic beyond schema support.
- Multi-location product UX beyond a single MVP location.
- SMS/WhatsApp notification schemas unless needed for future-safe consent channel values.

## Strict Constraints and Assumptions

- RLS is a core MVP requirement.
- All tenant-owned tables must include tenant isolation paths.
- Service-role access is only allowed in trusted server functions.
- Audit logs must avoid storing sensitive secrets and unnecessary personal data.
- Product event tables are the reporting source of truth.
- Database changes must be reversible or documented with clear migration ordering.

## Decisions Already Made

Core entities:

- `merchants`
- `merchant_locations`
- `fraud_flags`
- `loyalty_cards`
- `qr_codes`
- `customers`
- `customer_memberships`
- `stamp_events`
- `reward_events`
- `consent_records`
- `billing_customers`
- `audit_logs`
- `product_events`

Roles:

- Merchant owner
- Customer
- Internal admin
- System

## Behavioral Requirements

- **MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-001** WHEN a merchant owner queries merchant data, THE database SHALL return only records for that merchant.
- **MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-002** WHEN a customer views loyalty data, THE database SHALL return only their own customer profile, memberships, stamps, and rewards.
- **MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-003** WHEN an internal admin performs a support action, THE system SHALL write an audit log.
- **MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-004** WHEN a billing, stamp, reward, consent, QR, or admin mutation succeeds, THE system SHALL write the appropriate audit or product event.
- **MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT-005** WHEN unauthenticated users access protected tables directly, THE database SHALL deny access.

## Verification Criteria

Acceptance criteria:

- All MVP tables exist with primary keys, tenant/customer references, timestamps, and required status fields.
- RLS is enabled on all tenant, customer, billing, consent, event, and audit tables.
- Tenant isolation tests cover at least two merchants and two customers.
- Admin and system/service-role paths are explicitly separated from client access.

Manual QA:

- Use two merchant accounts and confirm each cannot see the other's data.
- Use two customer identities and confirm each cannot see the other's cards.
- Perform a sample admin adjustment and confirm an audit log appears.

Task breakdown:

- Define schema migrations.
- Define role helper functions or policy predicates.
- Add RLS policies.
- Add seed/test fixtures.
- Verify read/write isolation and audit readback.
