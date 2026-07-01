---
spec_id: MS-pwa
status: active
risk_class: ui-only
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-01
allowed_blast_radius:
  - components/pwa/**
  - app/offline/**
  - app/manifest.ts
  - public/sw.js
  - next.config.ts
  - micro-specs/platform/**
  - tests/e2e/pwa*.spec.ts
implementation_surfaces:
  - components/pwa/app-pwa.tsx
  - app/offline/page.tsx
  - app/manifest.ts
  - public/sw.js
  - next.config.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/platform/e2e-harness.md
related_tests:
  - tests/e2e/pwa-offline.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm build
  - pnpm test:e2e -- --grep "PWA offline fallback"
required_playwright_projects:
  - chromium
  - mobile-chromium
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-pwa — Installable PWA, service worker, offline fallback

## Intent

Nabaperks is installable as a PWA. A web manifest plus a service worker make the
app installable and give it an offline fallback; an install prompt invites the
customer to add it to their home screen, and dismissing it is remembered so it
never nags. The service worker is served with the headers it needs to control
the whole origin.

## Scope (in)

- The install prompt + service-worker registration (`components/pwa/app-pwa.tsx`),
  the manifest (`app/manifest.ts`), the service worker (`public/sw.js`), the
  `/offline` route, and the `/sw.js` response headers in `next.config.ts`.

## Scope (out)

- Push-notification subscription/dispatch (owned by [MS-notifications]); the app
  surfaces the SW caches (owned by their own specs). No loyalty/auth change.

## Decisions already made

- The service worker is registered at `/sw.js` with `scope: "/"` and
  `updateViaCache: "none"`.
- `/sw.js` is served `Content-Type: application/javascript`,
  `Cache-Control: no-cache, no-store, must-revalidate`, and
  `Service-Worker-Allowed: /` (`next.config.ts` headers).
- The install prompt dismissal is persisted in
  `localStorage["nabaperks:pwa-install-dismissed:v2"] = "1"`.
- `/offline` is the navigation fallback when the network is unavailable.

## EARS requirements

- **PW-1 (installable):** THE app SHALL expose a web manifest and register a
  service worker so it is installable as a PWA.
- **PW-2 (SW scope/headers):** THE `/sw.js` response SHALL carry
  `Service-Worker-Allowed: /` and no-store cache headers so the worker can
  control the whole origin and always updates.
- **PW-3 (install prompt + dismissal):** WHEN the app is installable and the
  prompt has not been dismissed, THE system SHALL offer the install prompt; WHEN
  the customer dismisses it, THE system SHALL persist the dismissal so it does
  not reappear.
- **PW-4 (offline fallback):** WHILE the network is unavailable, THE system SHALL
  serve `/offline` for navigations the service worker cannot fulfil.

## Verification method

DB-free e2e (`tests/e2e/pwa-offline.desktop.spec.ts`): assert the manifest is
linked and the service worker registers (PW-1); assert `/sw.js` returns the
required headers
(PW-2); set the dismissal key and assert the prompt stays hidden (PW-3); load
`/offline` directly and assert it renders the offline state (PW-4). The dismissal
key is pinned by the harness helper (`tests/e2e/helpers/harness.ts`).

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm governance:check` · `pnpm test` ·
`pnpm build` · `pnpm test:e2e -- --grep "PWA offline fallback"`.
