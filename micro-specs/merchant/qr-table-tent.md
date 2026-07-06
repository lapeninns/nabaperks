---
spec_id: MS-merchant-qr-table-tent
status: draft
risk_class: ui-only
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/merchant/**
implementation_surfaces:
  - micro-specs/merchant/qr-table-tent.md
related_tests:
  - not-yet-created
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e
  - pnpm test:a11y
  - pnpm test:visual
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-merchant-qr-table-tent — A5 table tent print family (Night, Editorial, Ticket) with fold + bleed

## 1. Exact Goal and User-Visible Outcomes

TODO: one unambiguous statement of the intended change, described from the
user's perspective (what is true when this ships, not a feature label).

## 2. Blast Radius

TODO: what may be edited, and — explicitly — what is out of scope. Keep the
frontmatter `allowed_blast_radius` / `implementation_surfaces` lists in
agreement with this prose.

## 3. Strict Constraints and Assumptions

TODO: non-negotiables (libraries, schemas, security, error handling) and
the assumptions this change rests on.

## 4. Decisions Already Made

TODO: settled decisions the implementer must not re-litigate or re-infer.

## 5. Behavioral Requirements (EARS)

TODO: one requirement per line; pick the simplest pattern that fits.
- THE <system> SHALL <response>.                        (ubiquitous)
- WHILE <state>, THE <system> SHALL <response>.         (state-driven)
- WHEN <trigger>, THE <system> SHALL <response>.        (event-driven)
- WHERE <feature>, THE <system> SHALL <response>.       (optional)
- IF <condition>, THEN THE <system> SHALL <response>.   (unwanted behaviour)

## 6. Verification Criteria and Task Breakdown

TODO: observable behaviors to verify (not test file names), then small
tasks to implement one at a time. Prove the work with
`governance:run-gates --spec MS-merchant-qr-table-tent --record` and advance the
lifecycle with `governance:advance`.
