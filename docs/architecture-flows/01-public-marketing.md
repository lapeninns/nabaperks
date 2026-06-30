# Public Marketing, Legal, And Meta Flows

Flows covered: 1-8.

## Axis Architecture

The public surface is mostly server-rendered App Router content. Marketing
pages compose Wet Ink sections and shared SEO helpers. Public facts and
indexable route metadata now share typed marketing registries; `sitemap.ts`
consumes `PUBLIC_SITE_ROUTES`, and `public/llms.txt` is covered by the same
source-contract and served-route proof. Private/stateful route metadata now
shares `PRIVATE_ROUTE_METADATA`, and `robots.ts` consumes the same private
prefix registry. Manifest, footer links, and static copy still need deliberate
review when public routes change. Strict CSP nonces now make app pages
request-rendered so Next inline runtime scripts, next-themes, and JSON-LD can
execute without `unsafe-inline`.
Merchant-specific public terms also read merchant and loyalty-card context from
Supabase through customer join helpers.

## Flow Analysis

| ID  | Flow                                  | Architecture                                                                                                                                                                                                                                                                             | Pitfalls                                                                                                                                                                                                       | Improvements                                                                                                                                 |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Home landing `/`                      | Request-rendered marketing entry using shared marketing layout, landing components, QR visual generation, structured-data helpers, and nonce-backed scripts.                                                                                                                             | High conversion page shares route/fact dependencies with other public files; claims can drift if public proof registries and copy are edited separately.                                                       | Keep all public claims in a typed source registry; add a landing metadata/JSON-LD regression test.                                           |
| 2   | Pub loyalty hub `/loyalty-for-pubs`   | Vertical acquisition page that reuses public facts, guide links, SEO helpers, and the shared public route registry for sitemap discovery.                                                                                                                                                | Footer/static copy can still drift if public-route changes skip the registry contract.                                                                                                                         | Keep public-route registry tests and served sitemap/llms proof in the release gate.                                                          |
| 3   | Pricing `/pricing`                    | Request-rendered public pricing page with page-specific metadata, canonical, nonce-backed Offer/FAQ JSON-LD, and a Suspense-wrapped client leaf for transient checkout return alerts. The page no longer awaits `searchParams`; global CSP nonces are the reason it renders dynamically. | Pricing copy can still drift from Stripe products and billing gates if product changes are made outside the approved facts/billing checklist.                                                                  | Keep pricing copy tied to approved product facts and add a billing/pricing consistency checklist whenever Stripe products change.            |
| 4   | About `/about`                        | Public proof/context page under the marketing layout.                                                                                                                                                                                                                                    | Public proof must stay grounded in real operator facts; no technical guard prevents invented or stale claims.                                                                                                  | Keep proof facts in the same approved source registry as landing claims.                                                                     |
| 5   | Guide: best loyalty ideas             | Guide spoke using shared guide layout/content conventions, route constants, nonce-backed structured data, and public discovery coverage.                                                                                                                                                 | Guide page copy can still drift from product mechanics if loyalty rules change.                                                                                                                                | Keep product-mechanics review tied to guide updates.                                                                                         |
| 6   | Guide: reward regulars without an app | Guide spoke focused on no-app loyalty positioning and covered by the public route registry contract.                                                                                                                                                                                     | Same product-mechanics drift risk as other guide spokes.                                                                                                                                                       | Keep the guide-route inventory test failing when a guide route is missing from sitemap or llms.                                              |
| 7   | Guide: paper vs QR loyalty            | Comparison guide.                                                                                                                                                                                                                                                                        | Can drift from actual product mechanics if QR/reward rules change.                                                                                                                                             | Add product-mechanics references or checklist review when loyalty mechanics change.                                                          |
| 8   | Legal/offline/meta                    | `/privacy`, `/terms`, `/offline`, `sitemap.ts`, `robots.ts`, `manifest.ts`, and related public/private metadata.                                                                                                                                                                         | Merchant-specific legal terms and stateful customer/QR/reward/dynamic merchant routes now share explicit `noindex,nofollow` metadata plus a robots disallow registry. Legal copy itself still requires review. | Keep the private-prefix registry current whenever new stateful route families are added; add canonical review when new public routes launch. |

## Trust Boundaries

- Public pages should expose only approved marketing facts.
- Dynamic public terms must not leak unavailable merchant/card details.
- Search/AI crawler access should be deliberate. Public acquisition can be
  indexable; authenticated, stateful, and customer-specific routes should not be
  accidentally indexable.

## Verification Gaps

- Metadata and canonical coverage for newly launched public pages.
- Footer, robots, manifest, and static llms copy review when public routes
  change.
- Private-prefix registry review when adding new authenticated, customer,
  QR/reward-token, or dynamic merchant join routes.
- Public legal copy review before external launch.

## Priority

P1 before SEO/GEO push or public launch. P2 if the surface remains pilot-only.
