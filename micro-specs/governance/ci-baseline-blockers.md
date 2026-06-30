---
spec_id: MS-governance-ci-baseline-blockers
status: active
risk_class: ui-only
owner: codex
last_reviewed: 2026-06-30
allowed_blast_radius:
  - components/ui/sidebar.tsx
  - eslint.config.mjs
  - micro-specs/governance/ci-baseline-blockers.md
  - tests/micro-specs/merchant-sidebar-state.test.mjs
  - tests/micro-specs/qr-a4-poster-templates.test.mjs
implementation_surfaces:
  - components/ui/sidebar.tsx
  - eslint.config.mjs
  - tests/micro-specs/merchant-sidebar-state.test.mjs
  - tests/micro-specs/qr-a4-poster-templates.test.mjs
related_docs:
  - AGENTS.md
  - micro-specs/README.md
related_tests:
  - tests/e2e/governance-smoke.spec.ts
  - tests/micro-specs/merchant-sidebar-state.test.mjs
  - tests/micro-specs/qr-a4-poster-templates.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:e2e
  - pnpm build
required_playwright_projects:
  - chromium
  - mobile-chromium
evidence_required:
  - Lint output proving generated design-source mirrors no longer block runtime lint.
  - Node Micro-Spec output proving sidebar uncontrolled default reset remains covered.
  - Playwright smoke output proving the public browser harness still runs after the shared UI fix.
approved_exceptions: []
---

# MS-governance-ci-baseline-blockers

## Intent

Remove pre-existing CI blockers that prevent the governance gate runner from
proving the active framework end to end.

## Scope

In scope:

- ESLint ignore coverage for generated `.design-sync/**` mirrors.
- The shared sidebar provider state-sync pattern flagged by React Hooks lint.
- The node Micro-Spec assertion that protects the sidebar uncontrolled reset
  behavior.
- The stale QR poster Micro-Spec assertion that still pointed at retired copy
  and the old non-registry launch panel.

Out of scope:

- Merchant navigation redesign, route behavior changes, auth/session behavior,
  Supabase schema, billing, and design-system token changes.

## EARS Requirements

- THE lint configuration SHALL exclude generated `.design-sync/**` mirrors from
  runtime lint gates.
- WHEN `SidebarProvider` receives a new uncontrolled `defaultOpen`, THE provider
  SHALL reset the uncontrolled state without calling `setState` synchronously
  inside an effect.
- THE sidebar Micro-Spec test SHALL continue to protect cookie-backed default
  reset behavior.
- THE QR poster Micro-Spec test SHALL protect the current template registry,
  live launch panel links, protected QR context, and A4 print surfaces.

## Verification

Required gates:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm governance:check`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
