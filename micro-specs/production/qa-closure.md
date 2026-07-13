---
spec_id: MS-production-qa-closure
status: verified
risk_class: ui-only
owner: codex
last_reviewed: 2026-07-13
allowed_blast_radius:
  - micro-specs/production/**
  - app/layout.tsx
  - components/dev-tools/**
  - playwright.config.ts
  - tests/e2e/**
  - tests/micro-specs/architecture-audit-hardening.test.mjs
  - .github/workflows/nightly.yml
  - micro-specs/production/qa-closure.md
implementation_surfaces:
  - app/layout.tsx
  - components/dev-tools/**
  - playwright.config.ts
  - tests/e2e/**
  - tests/micro-specs/architecture-audit-hardening.test.mjs
  - .github/workflows/nightly.yml
  - micro-specs/production/qa-closure.md
related_tests:
  - tests/micro-specs/architecture-audit-hardening.test.mjs
  - tests/e2e/analytics-funnel-privacy.desktop.spec.ts
  - tests/e2e/merchant-birthday-config.spec.ts
  - tests/e2e/merchant-launch-header.desktop.spec.ts
  - tests/e2e/merchant-shell-softnav.desktop.spec.ts
  - tests/e2e/merchant-venue-search-csp.desktop.spec.ts
  - tests/e2e/production-qa.desktop.spec.ts
  - tests/e2e/visual.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm governance:check
  - pnpm test:e2e -- --project=chromium --grep "@MS-production-qa-closure"
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --project=desktop-firefox --project=desktop-safari --grep-invert @visual
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
required_playwright_projects:
  - chromium
  - mobile-safari
  - desktop-firefox
  - desktop-safari
evidence_required:
  - Command output for every declared verification gate.
  - Before-and-after browser output proving the development-only script no longer emits a hydration mismatch in the deterministic harness.
  - Visual review of the changed Chromium and mobile Safari QR baselines.
  - Full non-visual Chromium, mobile Safari, Firefox, and WebKit output.
approved_exceptions:
  - "broad-browser-gate: production readiness requires the complete DB-free behavioral suite across every supported browser (expires: 2026-07-19)"
---

# MS-production-qa-closure — Close production browser and visual QA gaps

## 1. Exact Goal and User-Visible Outcomes

The release candidate has deterministic browser proof: the approved QR poster
experience matches its visual baselines, all supported browser engines exercise
the full DB-free behavioral suite, and development-only inspection tools do not
pollute that proof with React hydration errors.

## 2. Blast Radius

The root layout's development-only scripts, Playwright project configuration,
nightly browser workflow, production QA tests, the two legitimately changed QR
screenshots, and this record may change. Product behavior, database state,
provider delivery, billing, production secrets, and unrelated visual baselines
are out of scope.

## 3. Strict Constraints and Assumptions

- Keep both developer inspection tools available outside the deterministic
  Playwright harness; neither tool may enter a production bundle.
- Do not weaken CSP, screenshot thresholds, accessibility checks, or browser
  assertions to obtain green output.
- Visual acceptance is limited to the current QR redesign already present in
  product source. No screenshot may be copied across operating systems.
- DB-dependent and live-provider tests remain separately gated; cross-browser
  proof in this spec is explicitly the DB-free tier.

## 4. Decisions Already Made

- Chromium and mobile Safari remain the release-blocking visual platforms.
- Chromium, mobile Safari, Firefox, and WebKit all remain release-blocking for
  non-visual browser behavior.
- The current shorter QR page is intentional: it replaces the old multi-card
  poster list with the launch hierarchy, selector, and real poster preview.
- The nightly job must not manufacture unreviewed Firefox/WebKit screenshots.

## 5. Behavioral Requirements (EARS)

- **QA-1:** WHILE the Playwright harness is active, THE root layout SHALL omit
  development-only third-party inspection scripts.
- **QA-2:** WHEN a harness route hydrates, THE browser proof SHALL contain no
  hydration mismatch or uncaught page error.
- **QA-3:** THE nightly cross-browser job SHALL run non-visual DB-free behavior
  in Chromium, mobile Safari, Firefox, and WebKit.
- **QA-4:** THE visual gate SHALL compare the QR redesign only against reviewed
  Chromium and mobile Safari baselines for the current operating system.
- **QA-5:** IF any non-visual browser, accessibility, or approved visual check
  fails, THEN THE release gate SHALL fail.

## 6. Verification Criteria and Task Breakdown

1. Reproduce the two stale QR baselines and the hydration warning.
2. Exclude development-only scripts from the deterministic harness and add a
   focused browser regression check.
3. Make nightly cross-browser proof behavioral-only while preserving the
   dedicated visual job.
4. Review and update only the intentional Chromium/mobile-Safari QR images.
5. Run every recorded gate, then advance the lifecycle through verification.
