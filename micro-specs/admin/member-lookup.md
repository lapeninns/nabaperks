---
spec_id: MS-admin-member-lookup
status: implemented
risk_class: customer-pii
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-02
allowed_blast_radius:
  - lib/admin/**
  - lib/analytics/**
  - app/admin/**
  - components/admin/**
  - micro-specs/admin/**
  - tests/e2e/**
  - tests/micro-specs/**
  - tests/unit/**
implementation_surfaces:
  - lib/admin/data.ts
  - app/admin/customers/**
  - app/admin/privacy/**
  - components/admin/**
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/platform/ux-production-polish.md
related_tests:
  - tests/e2e/admin-route-gates.spec.ts
  - tests/e2e/admin-lookup.spec.ts
  - tests/micro-specs/admin-member-lookup.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:e2e -- --grep "@admin-lookup|admin route gates"
required_playwright_projects:
  - chromium
evidence_required:
  - Command output for the declared verification gates.
  - Evidence that no additional customer personal data is exposed beyond the existing masked display (source diff review note in the fix report).
approved_exceptions: []
---

# MS-admin-member-lookup — admin console member search and pagination

## 1. Exact goal and user-visible outcomes

The audit's P0-2: the admin console cannot find the people it supports. Every
admin list hard-caps at `.limit(100)` newest-first with no search, filter, or
pagination (`lib/admin/data.ts:58-90`), so at the product's own claimed scale
(1,842 members) ~94% of members are unreachable — which also blocks the GDPR
privacy workflow from finding a requester.

After this spec: an internal admin can find any member by venue and/or a
masked-contact fragment, page through results beyond the first 100, adjust
stamps for that member, and locate a data-request subject in the privacy
workflow — without raw-PII exposure beyond today's masked display.

## 2. Blast radius: in scope and out of scope

In scope: `lib/admin/data.ts` read-path queries (search parameters, pagination,
counts), the admin customers and privacy pages' lookup UI, shared admin
components for search/pagination, and tests.

Out of scope (must not change): admin auth/MFA gating, RLS policies, service
role usage patterns, any mutation/action semantics (stamp adjustment, GDPR
logging stay as-is), customer-facing surfaces, migrations, and PII masking
rules (masking must remain server-side and unchanged).

## 3. Strict constraints and assumptions

- Server-side filtering/pagination via the existing Supabase server client;
  no client-side fetch-all workarounds; browser storage stays cache-only.
- Search input is validated/escaped server-side before query interpolation.
- Responses expose only fields the current UI already renders (masked
  contact); no new raw phone/email fields cross the wire.
- Query params drive the lookup state so results are linkable; no new
  dependencies.
- Wet Ink presentation per `MS-platform-ux-production-polish` conventions.

## 4. Decisions already made

- Admin console remains internal, Supabase-auth + MFA gated; defence-in-depth
  boundaries stay untouched.
- `DataTable` + `AdminRecordCard` remain the rendering contract for results.
- The 100-row window is replaced by explicit pagination, not by a larger cap.

## 5. Behavioural requirements (EARS)

- R1. WHEN an admin submits a member search by venue name or masked-contact
  fragment, THE admin customers view SHALL return matching memberships via
  server-side filtering, including records beyond the first 100.
- R2. THE admin customers and privacy list views SHALL paginate such that any
  record is reachable; no list silently truncates at a fixed cap.
- R3. THE lookup SHALL NOT expose more customer personal data than the
  current masked display already shows.
- R4. IF a lookup query fails server-side, THEN THE view SHALL render an
  inline themed error state without replacing the console shell.
- R5. THE existing admin auth gate SHALL remain: an unauthenticated request to
  any admin lookup URL (including with search/page params) SHALL redirect to
  the admin login.
- R6. WHEN the privacy workflow needs a data-request subject, THE same lookup
  capability SHALL be available on the privacy surface.

## 6. Verification criteria and task breakdown

- Red first where the harness exists: node micro-spec/unit tests for the
  query-shape helpers (search normalisation, pagination window), then the
  DB-free Playwright `@admin-lookup` spec asserting R5 (auth gate preserved
  with lookup params).
- Live-session manual QA (magic-link admin session per repo runbook): search a
  member beyond row 100, adjust stamps, observe pending/success/inline error.
  If no admin credential/fixture is available, the corresponding ledger rows
  are marked `BLOCKED` with the missing credential named.
- Gates: the declared `verification_gates` list.
