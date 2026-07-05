---
spec_id: MS-merchant-qr-poster
status: implemented
risk_class: ui-only
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/app/qr/**
  - components/merchant/launch/qr-panel.tsx
  - lib/merchant/qr-nav.ts
  - lib/qr/poster-templates.ts
  - micro-specs/merchant/**
  - tests/e2e/merchant-qr-poster*.spec.ts
implementation_surfaces:
  - app/app/qr/page.tsx
  - app/app/qr/actions.ts
  - app/app/qr/poster/[template]/page.tsx
  - lib/merchant/qr-nav.ts
  - lib/qr/poster-templates.ts
  - components/merchant/launch/qr-panel.tsx
related_docs:
  - DESIGN.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/merchant/launch.md
related_tests:
  - tests/micro-specs/qr-a4-poster-templates.test.mjs
  - app/dev/app-harness/qr/page.tsx
  - app/dev/poster-preview/page.tsx
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:e2e
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-merchant-qr-poster — Till-poster family, A4 print, QR activation, origin-aware return

## Intent

`/app/qr` lets a merchant activate their join QR and print a till poster. The
poster family is five Wet Ink A4 templates that all carry a scan-to-join QR and
**mystery-reward** copy — they read only business, location, and stamp count and
never name the specific reward or invent social proof. Activating the QR flips
it live; the QR server actions return the merchant to whichever shell they came
from (setup or console) rather than a hardcoded destination.

## Scope (in)

- `/app/qr` (the QR panel + activation) and `/app/qr/poster/[template]` (the
  printable A4 poster) for all five templates.
- The QR activation/deactivation server action(s) in `app/app/qr/actions.ts`
  (toggling `qr_codes.is_active`).
- The origin-aware `returnTo` mechanism (`lib/merchant/qr-nav.ts`): a hidden
  `returnTo` field + an allowlist that decides the post-action redirect.
- The poster copy contract (`lib/qr/poster-templates.ts`): mystery-reward only.

## Scope (out)

- Launch-readiness gating that consumes QR-active state (owned by
  [MS-merchant-launch]); the customer scan/join the QR resolves to (owned by
  [MS-customer-join]); the separate admin `setQrActiveAction`. No loyalty/RLS
  semantics change.

## Decisions already made

- Five templates: the copy-driven trio (editorial / bold / ticket via
  `getPosterCopy`) plus two self-contained concept posters (northstar
  "Night card", thermal "Receipt").
- Poster copy is **mystery-reward**: it never names the reward and uses no fake
  social proof; it reads only business name, location, and stamps-required.
- QR actions redirect via a hidden `returnTo` validated against an allowlist
  (`lib/merchant/qr-nav.ts`) — toggling the QR from `/app/qr` returns to
  `/app/qr`, and from the launch shell returns to launch; the destination is
  never hardcoded to `/app/launch?tab=qr`.
- The merchant shell drops the sidebar on setup paths (`variant="setup"` for
  `/app/onboarding*` and `/app/launch*`); the poster route hides mobile chrome.

## EARS requirements

- **QP-1 (templates render):** THE system SHALL render each of the five poster
  templates at `/app/qr/poster/[template]` as an A4 sheet carrying a scan-to-join
  QR.
- **QP-2 (mystery reward):** THE poster copy SHALL NOT name the specific reward
  and SHALL NOT present invented social proof; it SHALL read only business,
  location, and stamps-required.
- **QP-3 (activate):** WHEN a merchant activates the join QR, THE system SHALL set
  `qr_codes.is_active = true` for their QR.
- **QP-4 (origin-aware return):** WHEN a QR server action completes, THE system
  SHALL redirect to the originating shell taken from a `returnTo` validated
  against the allowlist, never a hardcoded launch destination.
- **QP-5 (return safety):** IF a `returnTo` is missing or not allowlisted, THEN
  THE system SHALL fall back to a safe default rather than honour an arbitrary
  target.
- **QP-6 (print fidelity):** WHEN a poster is printed, THE A4 sheet SHALL fill
  the page with the chrome and action bar hidden.

## Verification method

DB-free tier: `/dev/app-harness/qr` and `/dev/poster-preview` render the panel +
all five templates; `tests/e2e/merchant-qr-poster.spec.ts` asserts the templates
render with the scan-to-join QR and mystery-reward copy, with no horizontal
overflow at the eight breakpoints. Copy/dimension contract is guarded by
`tests/micro-specs/qr-a4-poster-templates.test.mjs`. The `returnTo` allowlist is
pure logic in `lib/merchant/qr-nav.ts`.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm test:e2e`.
