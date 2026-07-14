# Dev, QA, And Design Harness Flows

Flows covered: 61-64.

## Axis Architecture

The dev/QA surface sits under `/dev` and supports design-system review,
merchant shell screenshots, app-state fixtures, poster preview, and viewport
wrapper testing. These routes are not product features, but they are important
because they are the evidence surfaces for visual QA and route-state review.

## Flow Analysis

| ID | Flow | Architecture | Pitfalls | Improvements |
| --- | --- | --- | --- | --- |
| 61 | Design system playground `/dev/design-system` | Static Wet Ink catalog tied to design tokens and shared components. | Parent `/dev` layout now returns `notFound()` in production, covering the design-system route and sibling harnesses; the route inventory is now tested and `/dev/design-system` has production 404 smoke proof. | Keep the route inventory test current when more dev routes are introduced. |
| 62 | Merchant app harness pages `/dev/app-harness/*` | DB-free deterministic fixtures mount real merchant presentational bodies and `MerchantAppShell`. | Harness proves presentation, not auth, RLS, loaders, or Stripe; the QR harness now renders deterministic dev-only image bytes while production QR image access remains owned/context-gated. Form actions can still point at real actions. | Keep harness inert where possible and pair it with server-route integration tests. |
| 63 | Poster preview harness `/dev/poster-preview` | Renders real poster component with hardcoded venue defaults and generated QR data. | Poster contract tests now assert current template ids and poster contract. | Add visual screenshots for all templates before print/export changes. |
| 64 | Dev viewport/screenshot-width wrapper | `/dev/layout.tsx` parses `?w=<px>` and wraps children in a fixed-width frame for breakpoint screenshots. | Wrapper can be trusted only if visual QA consistently runs meaningful widths. | Add Playwright screenshots for 320, 375, 768, 1024, 1440 and collapsed/sidebar variants. |

## Trust Boundaries

- Dev routes must not be public production surfaces.
- Fixture harnesses must not mutate real production data during exploratory QA.
- Visual harness evidence does not prove server loader, auth, RLS, or provider
  behavior.

## Verification Gaps

- Browser visual coverage across key `/dev/**` routes, poster templates, and
  breakpoint widths.
- Harness action inertness or harmless failure checks.

## Priority

Production guard and stale poster-test risks are remediated in source, with
production 404 smoke proof for `/dev/design-system`; the QR harness image is
now browser-proved without weakening production QR ownership. Remaining P2 work
is broader visual harness coverage across breakpoints and poster variants.
