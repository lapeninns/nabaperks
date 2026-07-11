---
spec_id: MS-cross-product-visual-proof-alignment
status: closed
risk_class: ui-only
owner: codex
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/quality/cross-product-visual-proof-alignment.md
  - micro-specs/evidence/MS-cross-product-visual-proof-alignment.json
  - tests/e2e/visual.spec.ts
  - tests/e2e/visual.spec.ts-snapshots/**
implementation_surfaces:
  - micro-specs/quality/cross-product-visual-proof-alignment.md
  - micro-specs/evidence/MS-cross-product-visual-proof-alignment.json
  - tests/e2e/visual.spec.ts
  - tests/e2e/visual.spec.ts-snapshots/**
related_tests:
  - tests/e2e/visual.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@visual"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - manual:design-review
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Full first-run visual output identifying exactly 12 failing platform images while 26 images pass.
  - Two-repeat focused output and hashes proving stable geometry and deterministic rendering within the configured pixel threshold.
  - Independent dual-review approval of the current marketing, signup, dashboard, QR, onboarding, and empty-dashboard actuals, including a loaded dashboard QR image.
  - Source-history evidence tying all accepted differences to intentional commits a99c3e05 and 27e11ce5.
  - A complete post-update Chromium/mobile-Safari visual pass on macOS and Linux, plus independent inspection of every changed Linux image.
approved_exceptions:
  - "evidence-waiver: the three mutually dependent audit-proof waves share one reviewed working tree and will ship atomically (expires: 2026-07-18)"
---

# MS-cross-product-visual-proof-alignment — Align cross-product visual proof with intentional current UI

## Why It Exists

Variable optical-size typography, the single customer-facing venue name, and
the venue-specific dashboard QR ticket were intentional product changes that
left cross-product screenshots stale. The capture harness also allowed a
development overlay, navigation-time readiness races, and an unloaded QR to
contaminate proof. This record keeps the current Wet Ink experience and the
platform-specific baselines that accurately protect it.

## Invariants

- Marketing, signup, onboarding, dashboard, and QR captures preserve the current
  product source; snapshot proof never drives a rollback of intentional UI.
- Every capture hides the Next development portal, disables motion, waits for
  the final document, loaded fonts, design tokens, and decoded dashboard QRs.
- Readiness retries only across a development navigation and remains bounded to
  15 seconds.
- The 12 selected macOS images and 21 Linux CI images are independently rendered
  on their own platforms.
- A gated live-database visual remains skipped unless its explicit safe local
  opt-in is present.
- Product copy, tokens, state, persistence, provider, analytics, and database
  behavior remain outside this proof-only correction.

## Code Pointers

- `tests/e2e/visual.spec.ts`
- `tests/e2e/visual.spec.ts-snapshots/harness-dashboard-chromium.png`
- `tests/e2e/visual.spec.ts-snapshots/harness-dashboard-chromium-linux.png`
- `micro-specs/evidence/MS-cross-product-visual-proof-alignment.json`

## Dead Ends

- Reverting the variable font, QR ticket, or single-name onboarding flow was
  rejected because history and independent review proved them intentional.
- Broadly accepting every snapshot update was rejected; macOS changes remained
  limited to the audited failures, while Linux changes came from its own full
  platform run and review.
- A loose global comparison ratio was rejected for QR-sensitive and selected
  marketing surfaces.
- Copying images between operating systems was rejected because font metrics and
  rasterisation differ legitimately.
