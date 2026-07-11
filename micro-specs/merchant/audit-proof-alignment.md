---
spec_id: MS-merchant-audit-proof-alignment
status: closed
risk_class: ui-only
owner: codex
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/merchant/audit-proof-alignment.md
  - micro-specs/evidence/MS-merchant-audit-proof-alignment.json
  - tests/e2e/merchant-launch-follow-through-flow.ts
  - tests/e2e/merchant-launch-follow-through.spec.ts-snapshots/**
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/**
implementation_surfaces:
  - micro-specs/merchant/audit-proof-alignment.md
  - micro-specs/evidence/MS-merchant-audit-proof-alignment.json
  - tests/e2e/merchant-launch-follow-through-flow.ts
  - tests/e2e/merchant-launch-follow-through.spec.ts-snapshots/**
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/**
related_tests:
  - tests/e2e/merchant-launch-follow-through.spec.ts
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-merchant-ux-launch-follow-through"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - manual:design-review
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Targeted mobile and desktop browser output proving the explicit full-screen control is selected without changing valid QR semantics.
  - Repeatable mobile and desktop screenshot output proving the four strict local baselines and four Linux CI counterparts are intentional, decoded, and independently reviewed.
  - Full axe and visual-suite output for Chromium and mobile Safari.
  - Manual design review confirming the venue-name and LIVE QR card, tappable QR treatment, poster action, receipt edge, variable font, and mono-id metrics remain intentional Wet Ink UI.
approved_exceptions:
  - "evidence-waiver: the three mutually dependent audit-proof waves share one reviewed working tree and will ship atomically (expires: 2026-07-18)"
---

# MS-merchant-audit-proof-alignment — Align merchant audit browser proof with intentional Wet Ink UI

## Why It Exists

The merchant dashboard and launch QR evolved intentionally after their original
screenshots: the counter card gained the venue name, LIVE state, tappable QR,
poster action, receipt edge, and current variable-font metrics. The old browser
proof then failed on a fuzzy accessible-name selector and tolerated QR/image
drift. This record preserves the product decision and the stricter proof that
now represents it.

## Invariants

- The tappable venue QR and the explicit `Show full screen` button remain two
  valid, separately named dialog triggers.
- Browser proof selects the explicit control by exact accessible name.
- Merchant screenshots wait for loaded fonts and decoded QR images and compare
  affected surfaces at a 0.001 pixel ratio.
- The four macOS baselines and four Linux CI counterparts come from their own
  Playwright platforms and retain the approved Wet Ink hierarchy.
- No product persistence, API, billing, analytics, notification, or database
  behavior changes as part of this proof alignment.

## Code Pointers

- `tests/e2e/merchant-launch-follow-through-flow.ts`
- `tests/e2e/merchant-launch-follow-through.spec.ts-snapshots/dashboard-incomplete-follow-through-mobile-safari.png`
- `tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/dashboard-incomplete-follow-through-chromium.png`
- `tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/launch-qr-follow-through-chromium.png`
- `micro-specs/evidence/MS-merchant-audit-proof-alignment.json`

## Dead Ends

- Renaming or removing either valid QR control would have damaged accessibility
  semantics to accommodate a fuzzy test.
- Restoring the obsolete generic QR card would have reversed intentional
  product work.
- Keeping a 4% screenshot tolerance could hide an unloaded QR, so decoded-image
  readiness and the stricter threshold are retained.
- Copying macOS images into the Linux namespace was rejected; every CI image is
  rendered and reviewed on Linux.
