# Flow-By-Flow Detailed Architecture Analysis

Snapshot: 2026-06-30 current working tree.

This document uses the exact narrative structure requested for every identified
flow: Architecture Type, Main Flow, What Is Good, Pitfalls, and Room To
Improve.

## Flow 1. Home Landing `/`

### Architecture Type

This is a server-rendered public acquisition surface. The browser receives a
marketing page; product claims, SEO metadata, structured data, and Wet Ink
presentation are assembled by App Router components. Strict CSP nonces make the
route request-rendered so Next inline runtime scripts, next-themes, and JSON-LD
can execute without `unsafe-inline`.

### Main Flow

1. The visitor lands on `/`.
2. The page composes public marketing sections, proof blocks, FAQs, and CTA
   routes.
3. SEO helpers emit public structured data and metadata.
4. CTA paths lead to signup, login, pricing, or guide surfaces.

### What Is Good

- Public marketing is separated from authenticated product surfaces.
- Wet Ink components keep the brand language consistent.
- Server rendering keeps the landing page simple and crawlable.
- Public claims can be audited more easily than if they were scattered inside
  interactive client code.

### Pitfalls

- Marketing copy can drift from actual product mechanics if public fact sources
  and route content are edited separately.
- SEO/GEO metadata needs active maintenance when new proof, pricing, or guide
  pages change.
- High-conversion pages can accidentally accumulate unverified claims unless the
  approved-claims source stays authoritative.
- Public sitemap discovery now comes from `PUBLIC_SITE_ROUTES`, but static
  `llms.txt`, robots, manifest, and footer copy still need review on route
  changes.

### Room To Improve

- Centralize all public proof claims, CTA route labels, and structured-data
  inputs in one typed marketing registry.
- Keep route metadata tests for the landing page, sitemap, llms, and public
  claim registry.
- Add a periodic content audit that checks landing promises against actual
  product behavior.

## Flow 2. Pub Loyalty Hub `/loyalty-for-pubs`

### Architecture Type

This is a vertical marketing spoke. It is a server-rendered public route that
reuses shared public facts, guide links, and Wet Ink marketing components.

### Main Flow

1. Visitor opens `/loyalty-for-pubs`.
2. The route renders pub-specific positioning and links to signup, pricing, and
   guide content.
3. SEO helpers and sitemap entries make the route discoverable.
4. CTAs route the visitor toward merchant account creation or supporting
   education pages.

### What Is Good

- The route is focused on one audience instead of mixing all merchant types.
- Server rendering keeps the route crawlable while supporting the nonce-backed
  script policy.
- It can reuse the same design and claim system as the homepage.

### Pitfalls

- Hub, guide, and sitemap route discovery now share typed route facts; footer
  and static copy can still drift if changes bypass the registry contract.
- Audience-specific claims can become stale if product mechanics change.
- The route's value depends heavily on accurate internal linking.

### Room To Improve

- Keep hub links, guide links, sitemap entries, and llms coverage tied to the
  public-route registry.
- Add route-level metadata and canonical checks.
- Keep pub-specific claims in the same approved-facts registry as the homepage.

## Flow 3. Pricing `/pricing`

### Architecture Type

This is a public conversion and decision route. It is marketing content with
transient query-state handling for checkout return messaging. The route no
longer awaits `searchParams`; the Suspense client leaf handles the query state,
while global strict CSP nonces intentionally make app pages dynamic.

### Main Flow

1. Visitor opens `/pricing`.
2. The page displays pricing, plan framing, objections, and CTAs.
3. Optional query params can show checkout-related status messages.
4. CTAs route to signup, login, or billing-related paths depending on context.

### What Is Good

- Pricing is a dedicated route rather than buried in the landing page.
- Query-state feedback lets Stripe returns communicate outcomes without making
  the page source depend on the `searchParams` prop.
- Page-specific metadata, canonical, and Offer/FAQ JSON-LD are now present.
- Public positioning can be audited separately from billing implementation.

### Pitfalls

- Pricing copy can drift from Stripe products and actual billing gates if price,
  pilot, or billing activation rules change without a source-contract update.
- Strict CSP nonces trade static HTML artifacts for browser-safe script
  execution; JSON-LD validation now reads dynamic production HTML when static
  files are absent.

### Room To Improve

- Add a billing/pricing consistency checklist tied to Stripe product changes.
- Keep the pricing JSON-LD checker in the build gate whenever new pricing FAQ or
  plan nodes are added.
- Keep production browser smoke for `/pricing?checkout=success` so the
  nonce-backed Suspense reveal cannot regress into hidden streamed markup.

## Flow 4. About `/about`

### Architecture Type

This is a public trust-building page. It is server-rendered marketing content
that should depend only on approved operator and product facts.

### Main Flow

1. Visitor opens `/about`.
2. The route renders background, credibility, and product context.
3. CTAs route visitors to signup, pricing, or core public pages.

### What Is Good

- It gives the product a human/contextual surface outside sales copy.
- Static server rendering is stable and low-risk.
- It can support trust without touching private customer or merchant state.

### Pitfalls

- About-page proof can become inaccurate if it is not tied to approved facts.
- It may inherit generic root metadata instead of page-specific metadata.
- Copy changes can create compliance risk if claims become too broad.

### Room To Improve

- Keep all operator claims in a reviewed facts registry.
- Add route metadata and canonical coverage.
- Add a lightweight content review checklist for public trust/proof changes.

## Flow 5. Guide: Best Loyalty Ideas For Pubs

### Architecture Type

This is a static SEO/GEO guide spoke. It uses a shared guide layout and content
registry pattern.

### Main Flow

1. Visitor or crawler opens the guide URL.
2. The guide layout renders article content, internal links, and CTA blocks.
3. Sitemap and public route registries expose it to search and answer engines.

### What Is Good

- Guide content is separated from operational app code.
- Shared guide components reduce layout drift.
- It can drive long-tail acquisition without touching private state.

### Pitfalls

- Guide route, sitemap, and llms discovery are now covered by the public-route
  registry contract; footer references can still drift.
- Advice can become inaccurate if reward mechanics or product limitations
  change.
- Guide pages can be published without metadata parity checks.

### Room To Improve

- Keep route inventory tests for all guide pages, sitemap entries, and llms
  entries.
- Add a product-mechanics review when loyalty rules change.

## Flow 6. Guide: Reward Regulars Without An App

### Architecture Type

This is a public educational content flow. It explains the product's no-app
model through static server-rendered guide content.

### Main Flow

1. Visitor opens the guide.
2. The shared guide page renders educational content and calls to action.
3. Internal links move readers to pricing, signup, or related guides.

### What Is Good

- The route supports the product's core no-app positioning.
- Static content is simple to crawl, cache, and review.
- Shared guide components keep the page visually consistent.

### Pitfalls

- No-app claims must stay aligned with actual customer wallet, OTP, and scanner
  flows.
- Search metadata can drift if not generated from route data.
- It can over-promise if push/profile/login behavior becomes required for some
  experiences.

### Room To Improve

- Tie guide claims to the same product fact registry as marketing pages.
- Add metadata/canonical tests.
- Add a no-app product-claim checklist covering QR, OTP, card, reward, and home
  flows.

## Flow 7. Guide: Paper Vs QR Loyalty

### Architecture Type

This is a comparison-content SEO flow. It statically renders a product education
article that must map honestly to current QR and reward mechanics.

### Main Flow

1. Visitor opens the comparison guide.
2. The guide explains tradeoffs between paper and QR loyalty.
3. CTAs route to Nabaperks signup or adjacent educational routes.

### What Is Good

- It connects product architecture to buyer objections.
- It can be maintained separately from the app's private surfaces.
- It reinforces QR as the product's central join/stamp channel.

### Pitfalls

- QR reliability claims can drift from scanner, token, and availability
  behavior.
- Guide claims can become stale when stamp or reward rules change.
- Comparison pages need careful factual grounding to avoid marketing overreach.

### Room To Improve

- Maintain a QR-mechanics source-of-truth section for guide authors.
- Add review checks when QR, scanner, or stamp rules change.
- Add route metadata tests for every guide spoke.

## Flow 8. Legal, Offline, And Meta Surfaces

### Architecture Type

This is a public governance and crawler-control surface. It includes legal pages,
offline fallback, sitemap, robots, manifest, and related metadata.

### Main Flow

1. Crawlers and users request legal/meta routes.
2. Sitemap exposes public indexable routes.
3. Robots disallows authenticated/private route families.
4. Manifest declares app shortcuts and PWA metadata.
5. Offline page provides fallback behavior.

### What Is Good

- Meta surfaces are separated from product routes.
- Robots consumes the shared private route-prefix registry, covering app,
  admin, dev, API, home, card, reward, QR, scan/start, and dynamic merchant
  join route families.
- Manifest shortcuts reflect customer, scan, merchant, and admin entry points.
- Stateful customer, QR, reward, and dynamic merchant route pages/layouts export
  shared `noindex,nofollow` metadata.

### Pitfalls

- The private route registry must be kept current when new stateful route
  families are added.
- Legal pages can inherit generic metadata if not explicitly defined.
- Public legal copy still needs human legal review before full launch.

### Room To Improve

- Add canonical metadata review when a new public route is intentionally
  indexable.
- Keep the crawler-policy source-contract test current for private and public
  route families.
- Add legal-review status notes for privacy, terms, and merchant-specific terms.

## Flow 9. Merchant Signup `/signup`

### Architecture Type

This is a server-action-driven Supabase Auth onboarding entry. The browser owns
form input only; identity creation and email verification are server/provider
owned.

### Main Flow

1. Merchant opens `/signup`.
2. Auth form submits signup details to a server action.
3. The action creates a Supabase Auth user and verification path.
4. A custom merchant alias code maps product-friendly verification to provider
   token behavior.
5. Successful verification redirects toward the merchant app/onboarding path.

### What Is Good

- Signup is server-side and not client-owned.
- Supabase Auth owns primary identity.
- Redirects can be constrained through safe next-path handling.

### Pitfalls

- Alias code rows and provider tokens are sensitive and need cleanup.
- Expired but unconsumed aliases can create uniqueness/code-space issues.
- Signup behavior has high trust impact but lacks strong behavioral coverage.

### Room To Improve

- Add alias cleanup for expired rows and reduce sensitive token retention.
- Add tests for duplicate alias, expired alias, wrong code, consumed code, and
  replay.
- Keep signup redirect policy shared with login and confirmation.

## Flow 10. Merchant Login `/login`

### Architecture Type

This is a server-action authenticated entry flow. The browser submits
credentials; Supabase Auth and the server decide session state.

### Main Flow

1. Merchant opens `/login`.
2. Auth form submits email/password to `signInAction`.
3. Server action calls Supabase Auth.
4. On success, user is redirected to a safe merchant destination.
5. `/app/layout.tsx` re-checks the session before rendering the console.

### What Is Good

- Login does not rely on browser-owned session state.
- Protected routes re-gate after login.
- Safe-next behavior limits open redirect risk.

### Pitfalls

- Login redirect handling can drift from confirmation and layout redirects.
- Provider errors are intentionally hidden, which is good for safety but can
  reduce support visibility.
- Missing route/action tests make regressions easy.

### Room To Improve

- Share one merchant safe-redirect helper across login, confirmation, and route
  gates.
- Add tests for invalid credentials, blocked next paths, external URLs, and
  successful redirects.
- Add safe support logging that does not leak credentials.

## Flow 11. Password Reset `/reset-password`

### Architecture Type

This is a provider-backed recovery flow with a custom product alias layer. The
server owns reset verification and password mutation.

### Main Flow

1. Merchant opens `/reset-password`.
2. They request a reset email/code.
3. Supabase recovery token is bridged to the product alias code.
4. Merchant submits alias code and new password.
5. Server verifies recovery type and updates the password.

### What Is Good

- Password reset is delegated to Supabase Auth instead of custom password
  storage.
- Recovery mutation happens server-side.
- Alias code improves product usability.

### Pitfalls

- Alias retention risk is the same as signup.
- Recovery flows are replay-sensitive and need strong consumed/expired states.
- UX can hide provider details while still needing support observability.

### Room To Improve

- Add tests for expired, consumed, wrong, and replayed recovery codes.
- Add scheduled cleanup for recovery alias rows.
- Centralize recovery error mapping so UX stays safe and support logs stay
  useful.

## Flow 12. Merchant Sign-Out

### Architecture Type

This is a server-session teardown flow embedded into merchant shells. The
browser only submits the sign-out form.

### Main Flow

1. Merchant clicks log out in the merchant shell.
2. Form posts to `signOutAction`.
3. Server clears the Supabase session.
4. User returns to a public/auth route.

### What Is Good

- Sign-out is part of the shell contract.
- Both setup and full merchant shell variants expose logout.
- Server-side session teardown is authoritative.

### Pitfalls

- Future shell variants can accidentally omit sign-out.
- Sign-out success is rarely tested because it is considered simple.
- Concurrent tabs can still show stale client UI until navigation refreshes.

### Room To Improve

- Add shell smoke tests for setup/full variants.
- Add a route test that protected routes redirect after sign-out.
- Keep sign-out action centralized rather than per-page.

## Flow 13. Auth Confirmation `/auth/confirm`

### Architecture Type

This is a provider callback route. Supabase verification decides the auth state;
the app controls safe redirect behavior after verification.

### Main Flow

1. User opens an auth confirmation link.
2. Route handler exchanges/verifies Supabase code or token information.
3. It resolves a safe next destination.
4. Success redirects to the destination; failure redirects to login with an
   error state.

### What Is Good

- Confirmation is handled server-side.
- Failure redirects hide provider detail from the user.
- It gives a single place for auth link completion behavior.

### Pitfalls

- Redirect sanitization can drift from merchant login's safe-next rules.
- Auth callback routes can be abused for open redirects if not consistently
  constrained.
- Confirmation coverage is often absent because provider flows are hard to test.

### Room To Improve

- Use one shared same-origin and blocked-path redirect helper.
- Add tests for successful confirmation, invalid token, external next, auth-path
  next, and malformed URLs.
- Log provider failures safely for support.

## Flow 14. Merchant Onboarding `/app/onboarding`

### Architecture Type

This is a server-orchestrated merchant bootstrap flow. The browser provides
venue details; server actions and Supabase RPCs create merchant and location
state.

### Main Flow

1. Authenticated merchant opens `/app/onboarding`.
2. Page checks current user and merchant/location status.
3. Form submits business and venue information.
4. Server action creates or reuses merchant and primary location.
5. Venue address/geofence data is persisted.
6. Successful onboarding redirects into `/app/launch?tab=card`.

### What Is Good

- Onboarding is behind merchant auth.
- Merchant and location creation are server-side.
- The flow directly feeds the launch readiness graph.

### Pitfalls

- Merchant/location creation can succeed while later venue persistence fails.
- Completion can be based on record existence rather than full venue readiness.
- Primary-location assumptions are embedded early.

### Room To Improve

- Move full onboarding write into one transactional RPC.
- Require fully populated venue fields for completion.
- Add recovery handling for partial onboarding writes.
- Add tests for new merchant, existing merchant, partial location, invalid
  address, and redirect behavior.

## Flow 15. Start Resolver `/start`

### Architecture Type

This is a convenience routing dispatcher. It should never be the only auth
boundary; destination routes re-gate themselves.

### Main Flow

1. User opens `/start` from manifest shortcut or CTA.
2. Route checks merchant/admin/customer session hints.
3. Admins route to `/admin`, merchants to `/app`, customers to `/home`.
4. The destination layout performs authoritative access checks.

### What Is Good

- It simplifies app shortcut behavior.
- It keeps user-type routing in one public entry point.
- It does not replace destination gates.

### Pitfalls

- It can be mistaken as an authorization boundary; anonymous destination
  re-gating is now covered by Playwright smoke.
- Session precedence can surprise users with multiple identities.
- Manifest shortcut behavior depends on this route staying stable.

### Room To Improve

- Document precedence between admin, merchant, and customer sessions.
- Keep the `/start`, `/app`, `/home`, and `/admin` destination-gate smoke tests
  in sync with any future launch target.
- Keep `/start` logic minimal and side-effect free.

## Flow 16. Launch Checklist `/app/launch`

### Architecture Type

This is a server-orchestrated setup state machine. The browser does not own
launch readiness. It only carries tab/query state. Real state comes from
Supabase, Stripe billing status, QR records, active loyalty card, reward pool
count, and merchant location.

### Main Flow

1. `/app/launch` requires a merchant session.
2. If no merchant exists, the user is redirected to `/app/onboarding`.
3. The page loads QR/setup state and billing readiness in parallel.
4. `buildLaunchReadiness` turns raw records into the launch checklist: venue,
   card, rewards, QR, billing.
5. QR state is read into readiness; creation or reactivation stays behind
   explicit QR actions or post-save reward mutations.
6. The page resolves the active tab from `?tab=...`, otherwise chooses the next
   incomplete step.
7. Each tab delegates to a focused panel: venue, card, rewards, QR, billing.
8. Mutations happen through server actions, then redirect back to the launch
   route.

### What Is Good

- Server state is authoritative.
- Billing gates fail closed, which is safer than accidentally launching a
  merchant.
- QR creation is intended to be idempotent through RPCs.
- Setup reads are mostly centralized through readiness helpers.
- The UI is shareable/bookmarkable because tab state lives in the URL.

### Pitfalls

- `/app/launch` and `/app/qr` must stay read-only GET renders.
- The readiness graph is spread across page logic, readiness helpers, QR
  provisioning, and panel continuation rules.
- The three-active-rewards rule appears as behavior in multiple places.
- Major server actions and QR provisioning paths need stronger coverage.
- Query params like `saved`, `seeded`, `qr`, `checkout`, and `portal` are
  untyped UI protocol state.

### Room To Improve

- Extract `getLaunchPageModel()` returning setup, billing, readiness, active
  tab, continuation, and banners.
- Move query parsing into a typed parser.
- Centralize launch thresholds like minimum active rewards.
- Keep QR creation/reactivation behind explicit QR actions or post-mutation
  provisioning and preserve source-contract coverage for that boundary.
- Add tests around readiness, billing gates, QR provisioning, and tab
  continuation.

## Flow 17. Venue Setup

### Architecture Type

This is a server-side merchant location configuration flow. Browser form input
is untrusted; saved venue/location data drives launch readiness and public QR
availability.

### Main Flow

1. Merchant opens the venue tab in setup.
2. The panel renders current primary location fields.
3. Merchant submits location/address/geofence data.
4. Server action validates and writes venue location state.
5. Launch readiness is recalculated on the next render.

### What Is Good

- Venue data is server-owned.
- Venue readiness is part of the same launch checklist as card/reward/QR/billing.
- Location fields can feed later geofence and public availability rules.

### Pitfalls

- Single primary-location assumptions are embedded in launch readiness.
- Incomplete venue data can still look like onboarding is done if completion is
  based on row existence.
- Venue profile/account edits and launch venue setup can be conceptually close
  but separate.

### Room To Improve

- Make primary-location policy explicit.
- Make venue readiness require complete address/geofence fields.
- Add tests for missing address, missing coordinates, invalid radius, and
  successful save.
- Prepare a keyed location model before multi-location support.

## Flow 18. Loyalty Card Setup

### Architecture Type

This is a server-action domain write flow. The merchant form proposes card
configuration; Supabase RPCs persist active loyalty-card state.

### Main Flow

1. Merchant opens the card tab.
2. Form submits card name, stamps required, reward terms, and active state.
3. Server action validates fields.
4. Action calls the loyalty card RPC.
5. If a card is created, default reward pool items can be seeded.
6. Merchant is redirected to the next setup tab.

### What Is Good

- Validation happens server-side.
- Card writes are scoped to the current merchant.
- New-card creation can seed useful defaults.
- Redirects keep the setup journey moving.

### Pitfalls

- Card save, default seeding, and redirect decisions are coupled in one action,
  with source-contract coverage for the current coupling.
- Reward terms and mystery-reward semantics can drift from customer-facing copy.
- Live RPC execution belongs in the DB/staging tier.

### Room To Improve

- Keep source-contract coverage for validation, RPC parameters, default reward
  seeding, analytics event selection, and redirect targets.
- Make mystery-reward terms a first-class contract shared with customer terms.
- Keep redirect target decisions in a small helper that can be tested.

## Flow 19. Reward Pool Setup

### Architecture Type

This is a merchant-owned reward configuration flow with server-side validation
and Supabase RPC writes. It directly affects launch readiness and reward
assignment.

### Main Flow

1. Merchant opens the rewards tab.
2. Existing reward pool items are rendered.
3. Merchant creates, updates, activates, deactivates, or deletes items.
4. Server actions validate inputs and call reward pool RPCs.
5. If enough active rewards exist, QR provisioning can be triggered.
6. Launch readiness updates after redirect/revalidation.

### What Is Good

- Reward mutations are server-side and merchant-scoped.
- Active/inactive states let merchants prepare rewards without launching all.
- Reward readiness is part of launch gating.

### Pitfalls

- Shared app/SQL policy and live-DB rollback coverage now prove the active
  reward minimum, QR threshold creation, active-QR below-minimum refusal,
  disabled QR re-enable, add/update, delete, and archive behavior.
- Reward pool changes still affect customer terms, QR launch, and future reward
  assignment, so target/staging replay matters before pilot use.

### Room To Improve

- Re-run the reward pool lifecycle proof against target/staging once migrations
  and seed/session parity are available.
- Add admin/support visibility for reward pool changes if operators need it.

## Flow 20. Billing Activation

### Architecture Type

This is an external-provider activation flow. Stripe checkout/portal are the
browser-facing surfaces, but webhook-derived billing state owns readiness.

### Main Flow

1. Merchant opens billing from launch or account.
2. Server action starts Stripe checkout or opens customer portal.
3. Merchant completes or cancels flow at Stripe.
4. Return query params show transient UI copy.
5. Stripe webhook updates billing status.
6. Launch readiness uses stored billing status, not query params, as proof.

### What Is Good

- Billing state is not trusted from the browser.
- Launch can fail closed when billing is required and unreadable.
- Checkout and portal logic is behind server actions.

### Pitfalls

- Query params like `checkout` and `portal` can be mistaken for authoritative
  billing state.
- Stripe webhook replay/failure behavior is critical to correctness.
- Billing copy appears in multiple merchant surfaces.

### Room To Improve

- Keep billing readiness tied only to webhook-synced state.
- Preserve readiness tests for active, trialing, trial alias, past_due,
  cancelled, missing, and requires_billing=false.
- Add webhook retry/failure tests.
- Centralize billing status copy and readiness mapping.

## Flow 21. QR Provisioning

### Architecture Type

This is an idempotent server provisioning flow. QR creation or activation is
allowed only after venue, card, and reward readiness are true.

### Main Flow

1. Setup or QR page reads current merchant setup state without mutating QR
   records.
2. Explicit QR actions and post-save reward mutations check whether card,
   reward pool, venue, and QR state are eligible.
3. If QR is missing, the explicit path calls the create-or-get join QR RPC.
4. If QR exists but is inactive, the explicit path calls the QR activation RPC.
5. UI shows QR status and continuation options.

### What Is Good

- QR state is server-owned.
- Provisioning is intended to be idempotent.
- QR creation is tied to setup readiness.
- Existing inactive QR codes can be re-enabled instead of duplicated.

### Pitfalls

- App policy and SQL policy can disagree on reward-count thresholds.
- QR creation/reactivation must remain outside GET render.
- QR state affects public customer acquisition immediately.

### Room To Improve

- Align app and SQL provisioning rules.
- Keep source-contract coverage that proves launch/QR loaders stay read-only.
- Add logs/metrics for create, activate, ineligible, and RPC failure.
- Preserve QR eligibility tests for missing card, too few rewards, missing
  venue, inactive QR, and existing active QR.

## Flow 22. QR Image Rendering

### Architecture Type

This is an authenticated asset-generation route. The image route renders QR
assets from server-owned QR records and merchant ownership context.

### Main Flow

1. Merchant requests QR image by QR code id.
2. Route resolves current merchant and QR record.
3. Ownership and active/context checks decide whether image can be rendered.
4. Route generates or returns a QR image payload.

### What Is Good

- QR assets are not just static public files.
- Ownership can be enforced server-side.
- QR image generation stays close to QR domain data.

### Pitfalls

- Ownership, active-card, join-destination, and active-QR checks now sit in the
  shared image/poster context loader.
- Local browser coverage now includes a seeded authenticated merchant session,
  a valid owned active join QR, wrong-merchant QR, inactive QR, non-join QR, and
  missing QR id.

### Room To Improve

- Ensure cache headers match QR mutability.
- Add explicit error images or status codes for unavailable QR states.
- Re-run the authenticated QR image route fixture against target/staging once
  hosted migrations and seed/session parity are available.

## Flow 23. Poster/Print Templates

### Architecture Type

This is a merchant-authenticated print asset flow. The browser renders poster
templates, but template choice and QR asset ownership are server-controlled.

### Main Flow

1. Merchant opens `/app/qr/poster/[template]`.
2. Route verifies merchant access and template id.
3. Poster renders venue/QR content with print-friendly chrome.
4. Merchant prints or downloads from the browser.

### What Is Good

- Poster preview uses real product QR context.
- Template route keeps poster variants addressable.
- Merchant shell can hide mobile chrome for focused print surfaces.

### Pitfalls

- Poster copy and tests can drift from actual template content.
- Template routes can be hard to visually verify across paper sizes.
- Print styles can regress without screenshot/PDF checks.

### Room To Improve

- Add template id inventory tests.
- Add visual/PDF snapshot coverage for all poster templates.
- Keep poster copy in a template contract instead of scattered literals.
- Test invalid template id and unauthenticated access.

## Flow 24. Merchant Dashboard `/app`

### Architecture Type

This is an authenticated merchant readback dashboard. It summarizes server-owned
metrics, readiness, members, and recent activity.

### Main Flow

1. Merchant opens `/app`.
2. Layout verifies merchant auth.
3. Dashboard loader reads merchant data, series, customers, activity, and
   readiness/billing notices.
4. UI renders summary cards and compact operational readbacks.

### What Is Good

- Dashboard is behind merchant auth.
- It reuses server loaders rather than client-calculated state.
- It gives merchants operational feedback after setup.

### Pitfalls

- Dashboard readiness/billing copy can drift from launch readiness.
- Summary metrics can hide data freshness or truncation.
- Multiple loaders increase latency unless coordinated carefully.

### Room To Improve

- Reuse one readiness contract across dashboard and launch.
- Add dashboard tests for not onboarded, setup incomplete, billing gated, and
  live merchant states.
- Add data freshness/truncation notes where useful.

## Flow 25. Merchant Account/Profile

### Architecture Type

This is an authenticated account hub. Profile and billing views share one route
with tab/query state while compatibility routes redirect into it.

### Main Flow

1. Merchant opens `/app/account` or a compatibility route.
2. Query param chooses profile or billing tab.
3. Profile tab loads merchant profile details.
4. Billing tab loads billing panel/status.
5. Server actions update profile or open Stripe flows.

### What Is Good

- Account and billing are centralized.
- Compatibility redirects preserve old route returns.
- Profile and billing remain merchant-authenticated.

### Pitfalls

- Account profile and venue setup can be confused.
- Redirect-only routes now have source-contract coverage, anonymous route-gate
  browser smoke, and seeded merchant post-login smoke for profile, settings,
  billing, and billing-return compatibility paths.
- Account tab and billing return query parsing now have a typed helper with
  duplicate-param normalization.

### Room To Improve

- Keep account-tab parser tests current when adding Account hub tabs or
  Stripe-return outcome flags.
- Re-run the seeded merchant compatibility redirect smoke on target/staging once
  migrations and session seed parity are available.
- Clarify labels between business account profile and venue launch setup.

## Flow 26. Customer/Member Readback `/app/customers`

### Architecture Type

This is an authenticated merchant read model. The server scopes member rows to
the current merchant and sends masked customer readback DTOs to the client.

### Main Flow

1. Merchant opens `/app/customers`.
2. Page resolves current merchant.
3. Server reads masked member rows and total member count.
4. Client table handles search, filtering, highlight state, and display.

### What Is Good

- Raw member data is intended to be masked before client display.
- Total count is fetched separately from capped rows.
- Highlight query state supports support/operational linking.

### Pitfalls

- The previous Scan CTA linked a reward event id into a route that expects a
  reward scan token; this is now removed in source.
- Client-side search is only as safe as the DTO fields sent to the browser.
- Masking must stay server-side and consistent.

### Room To Improve

- Add integration proof for the scanner-based reward collection path.
- Keep DTO tests proving raw email/phone, customer objects, and reward internals
  do not reach the client table.
- Add member table tests for capped rows, total count, highlight, and empty
  state.

## Flow 27. Merchant Activity `/app/activity`

### Architecture Type

This is an authenticated merchant event readback. Product events are read
server-side, scoped by merchant id, and transformed into a merchant activity
feed.

### Main Flow

1. Merchant opens `/app/activity`.
2. Page resolves current merchant.
3. Server loads summary and enriched product events.
4. Route query/filter state narrows the activity view.
5. UI renders recent operational events.

### What Is Good

- Activity is scoped to the merchant.
- Feed entries are transformed rather than dumping raw product events.
- Client search text indexes only masked labels plus an explicit allow-list of
  non-PII metadata keys.
- Summary and feed can support operational awareness.

### Pitfalls

- Service-role reads rely on caller discipline and merchant id scoping.
- Latest-only feeds can hide older support-relevant events.

### Room To Improve

- Wrap merchant-scoped service-role reads in a helper or RPC.
- Keep the metadata search allow-list in sync with rendered non-PII fields.
- Add filters/search by event type, customer, reward, and date range if support
  needs it.

## Flow 28. Merchant Reward Scanner `/app/scan`

### Architecture Type

This is a client-camera routing flow inside the authenticated merchant shell.
The browser scans QR text, but server routes validate and collect rewards.

### Main Flow

1. Merchant opens `/app/scan`.
2. Browser asks for camera access.
3. Scanner decodes QR content.
4. Client normalizes valid same-origin reward destinations.
5. Client routes to `/app/rewards/scan/<token>`.

### What Is Good

- Camera concerns stay client-side.
- Invalid QR content and same-origin `/r/<token>` payloads are covered by pure
  normalization tests.
- Denied-camera and no-camera states are covered in the DB-free Playwright
  harness.
- Reward collection itself remains server-side.

### Pitfalls

- Busy-camera and physical-device scanner cleanup remain runtime-specific.
- Same-origin URL normalization must stay strict.
- Repeated decode events can cause duplicate navigation if not latched.

### Room To Improve

- Add live-device/manual QA for busy camera, physical valid reward QR scans, and
  cleanup after navigation.
- Preserve unit coverage for valid same-origin, invalid, cross-origin, and
  repeated decode normalization.
- Keep collection mutation out of the scanner component.

## Flow 29. Reward Collection `/r/[token]` To `/app/rewards/scan/[scanToken]`

### Architecture Type

This is a token-based merchant collection flow. The customer holds a
short-lived bearer scan token; the merchant must be authenticated and authorized
to collect it.

### Main Flow

1. Customer reward page generates a reward collection QR.
2. QR points to `/r/<scanToken>`.
3. `/r` validates token shape and redirects to merchant scan route.
4. Merchant scan page requires merchant auth.
5. Server loads reward scan context through RPC.
6. Merchant confirms collection.
7. Server action calls collection RPC.
8. Reward is redeemed and the next cycle opens.

### What Is Good

- Merchant auth is required before collection.
- SQL/RPC can lock token state and prevent replay.
- Server redeemed state is authoritative; `?collected=1` is only copy.
- The flow cleanly separates customer reward display from merchant collection.

### Pitfalls

- Route segment now uses `[scanToken]`; earlier `[rewardId]` naming was a
  token/id confusion risk.
- Member readback no longer links reward event ids into this token route.
- DB coverage now proves expired, replayed, unauthorized, blocked, and
  already-redeemed token states; local live-DB Playwright proves a minted `/r`
  token reaches the merchant scan page/action and lands in server redeemed state.

### Room To Improve

- Re-run mint, readback, collect, replay, expired, unauthorized, blocked, and
  redeemed states against target/staging before release.
- Add monitoring for failed collection reasons.

## Flow 30. Public Merchant Page `/m/[merchantSlug]`

### Architecture Type

This is a public merchant-specific loyalty preview. It reads public merchant
and loyalty-card state from the server and renders a no-app join entry.

### Main Flow

1. Customer opens `/m/<merchantSlug>`.
2. Server resolves merchant/card availability.
3. Page renders loyalty preview and terms access.
4. CTA routes to `/m/<merchantSlug>/join`.

### What Is Good

- Public route does not expose private merchant console data.
- Availability can hide unavailable loyalty cards.
- It gives customers a non-app entry point.

### Pitfalls

- No-QR CTA copy is now "Join rewards"; scan-qualified stamp copy must remain
  tied to real QR context.
- Preview must not imply a scan-qualified stamp without QR evidence.
- Merchant terms/legal copy needs review and is now noindexed until that policy
  changes.

### Room To Improve

- Add QR-aware CTA behavior only when a real QR context exists.
- Test unavailable merchant/card behavior and keep public metadata/noindex policy
  covered as review status changes.

## Flow 31. Merchant Terms `/merchant/[merchantSlug]/terms`

### Architecture Type

This is a public legal/terms readback for a merchant loyalty card. It uses
server-resolved merchant/card context and renders fallback unavailable state.

### Main Flow

1. Customer opens merchant terms route.
2. Server resolves merchant join context.
3. If available, page renders reward, earning, redemption, exclusions, fraud,
   and contact terms.
4. If unavailable, page renders safe fallback copy.

### What Is Good

- Terms are tied to actual merchant/card data.
- Unavailable state avoids leaking detailed failures.
- Customers can review terms before joining.

### Pitfalls

- Legal and data-protection copy requires human review.
- Terms can drift from actual stamp/reward/RPC behavior.
- Route metadata/indexing policy is explicit: review-required merchant terms are
  `noindex,nofollow`.

### Room To Improve

- Add a legal-review status and owner for terms copy.
- Generate terms from shared loyalty mechanics where possible.
- Add tests for unavailable merchant, missing card, and valid terms.

## Flow 32. Public QR Router `/q/[qrId]`

### Architecture Type

This is a public QR resolution and redirect flow. The QR id is untrusted input;
server state decides whether to route to join or stamp.

### Main Flow

1. Customer scans venue QR and opens `/q/<qrId>`.
2. Route resolves QR, merchant, card, billing, and availability.
3. Route rate-limits and records scan event where appropriate.
4. Existing member redirects to card stamp flow.
5. New customer redirects to merchant join flow with QR context.

### What Is Good

- QR resolution is server-side.
- Existing versus new customer branching is server-derived.
- Inactive/unavailable QR states can be blocked centrally.
- Source-contract coverage now pins the public route to server QR resolution,
  rate-limit identity, unavailable/rate-limited UI states, membership-aware
  branching, and encoded QR query values in both redirect targets.
- Playwright coverage now drives `/q/not-a-real-qr` on mobile and desktop,
  proving the unavailable state renders with the expected CTAs, no CSP console
  errors, no page errors, and no horizontal overflow.

### Pitfalls

- Public QR traffic can be noisy or bot-driven.
- QR availability must stay aligned with launch and billing readiness.
- Rate-limit behavior needs careful tuning for shared venue networks.

### Room To Improve

- Add live DB/browser tests for inactive QR, unavailable merchant,
  billing-blocked, existing member, new customer, and rate-limited paths.
- Add observability for scan resolution outcomes.
- Keep QR availability policy centralized.

## Flow 33. Customer Join, OTP, Membership

### Architecture Type

This is a server-owned customer identity and membership creation flow. The
browser guides OTP and terms UI; server actions and RPCs own identity,
membership, consent, and first-stamp effects.

### Main Flow

1. Customer opens `/m/<slug>/join`, usually with `?qr=...`.
2. Server loads join context.
3. Customer submits phone identity.
4. OTP is requested and verified.
5. Customer accepts terms.
6. Server creates or reuses membership.
7. If QR-qualified, first stamp can be issued.
8. Customer is redirected to card/stamp experience.

### What Is Good

- Phone ownership is verified before account/wallet state.
- Membership creation is server-side.
- QR context controls first-stamp eligibility.
- Existing membership can skip redundant join steps.
- Join server-action redirects encode QR form state before carrying it back into
  query strings.

### Pitfalls

- OTP anti-enumeration can produce UX dead ends if unknown-phone behavior is not
  clear.
- QR context must not be forgeable by query param alone.
- Terms acceptance, profile, consent, and membership writes need transactional
  clarity.

### Room To Improve

- Add full QR-to-join E2E coverage.
- Add tests for unknown phone, wrong OTP, expired OTP, missing terms, missing QR,
  existing member, and first-stamp eligibility.
- Keep join step/query parsing typed as the flow expands.

## Flow 34. Customer Scanner `/scan`

### Architecture Type

This is a public/customer camera routing flow. The browser scans QR content;
server routes decide QR validity and downstream effects.

### Main Flow

1. Customer opens `/scan`.
2. Route renders scanner in customer shell if logged in or public shell if not.
3. Browser camera scans a venue QR.
4. Client routes to the normalized QR destination.
5. Public QR router or customer flow handles the server-owned logic.

### What Is Good

- Scanner works for anonymous and logged-in customers.
- Camera state stays client-side.
- Camera-unavailable retry copy is covered in Playwright for the public scanner.
- Same-origin `/q/<qrId>` normalization and invalid payload rejection are covered
  by pure unit tests.
- Server QR resolver remains authoritative.

### Pitfalls

- Busy-camera, physical QR scan, and navigation cleanup need real-device QA.
- Invalid QR handling can frustrate users if copy is vague.
- Scanner route does not prove QR authorization by itself.

### Room To Improve

- Add live-device/manual QA for busy camera, physical valid QR scans, cleanup
  after navigation, and logged-in versus anonymous shells.
- Preserve scanner normalization tests for valid same-origin, invalid, and
  cross-origin payloads.
- Add accessible status announcements for scan states.

## Flow 35. Customer Card `/card/[membershipId]`

### Architecture Type

This is a server-loaded customer loyalty card view. URL membership id is input;
server ownership and availability checks decide what experience is rendered.

### Main Flow

1. Customer opens card URL.
2. Server loads card experience context.
3. Pure derivation maps context to an experience state.
4. Shared customer card component renders progress, reward, or unavailable
   state.

### What Is Good

- Rendering is downstream from server context.
- Shared experience derivation keeps UI states consistent.
- Browser does not own stamp/reward progress.
- Source-contract coverage proves membership ownership is checked before loading
  card, reward, or billing detail.
- Unit coverage now pins unavailable, no-active-reward, reward-ready, and
  full-card recovery derivation branches.

### Pitfalls

- Experience derivation is still broad and should keep fixture coverage as new
  card states are added.
- Query params like `stamp`, `reward`, `geo`, and `welcome` are UI protocol
  state.

### Room To Improve

- Type card query params and ignore untrusted values safely.
- Keep ownership and card-state regression coverage current.

## Flow 36. Self-Service Stamp

### Architecture Type

This is a server-authoritative stamp issuance flow. QR context and RPC rules
decide whether a stamp can be issued.

### Main Flow

1. Customer arrives at `/card/<membershipId>/stamp?qr=...`.
2. Server loads stamp context.
3. If a reward is already ready, route redirects to reward page.
4. Otherwise UI renders stamp experience.
5. Server action issues stamp through RPC when eligible.
6. Card/reward state updates from server state.

### What Is Good

- Stamping is not client-calculated.
- Reward-ready state redirects cleanly.
- RPC can enforce duplicate-day, QR, billing, and fraud rules.
- Source-contract coverage proves QR context is resolved before the stamp RPC,
  inactive/unavailable QR rows are rejected, wrong-membership QR rows cannot
  stamp another card, and post-stamp side effects only run after RPC success.
- Pure derivation coverage pins missing QR, invalid QR, stamp-confirm,
  already-stamped, waiting-reward, ready-reward, and full-card-without-reward
  states.
- Live-DB tests cover duplicate UK day refusal, full-card refusal, geofence soft
  flags, billing fail-close, reward-pool guard, organic reward unlock,
  redemption, and cycle reset.

### Pitfalls

- Eligibility spans QR, membership, UK date, geofence, billing, and reward state.
- Physical QR scan reliability remains browser/device/runtime QA, not a source
  contract.
- Query QR id must keep being treated as an input to server validation, not
  proof by itself.

### Room To Improve

- Keep QR/date/geofence/billing regression coverage current as policy changes.
- Add live-device/manual QA for valid printed venue QR scans before pilot.
- Add clear customer copy for blocked stamp reasons.
- Keep date/geofence policy centralized.

## Flow 37. Reward Detail/Profile Gate

### Architecture Type

This is a server-loaded reward state flow with customer profile completion
gating. The server decides reward state; browser forms only submit profile or
verification updates.

### Main Flow

1. Customer opens `/reward/<rewardId>`.
2. Server loads reward context.
3. Experience derivation decides waiting, ready, redeemed, blocked, or profile
   gate state.
4. Customer may save/verify profile details.
5. Ready reward can show collection QR.

### What Is Good

- Reward state is server-owned.
- Profile gate can ensure usable contact/customer information before collection.
- Shared customer experience component keeps reward/card UI consistent.
- Source-contract coverage pins server-derived ownership, availability,
  redeemability, redeemed proof, and profile-gate timing.
- Unit fixtures now cover waiting, ready, redeemed proof, blocked/expired, and
  access-failure reward states.

### Pitfalls

- Experience derivation complexity is high.
- Profile/email verification actions need clear ownership and replay rules.
- Reward state copy must align with merchant collection behavior.

### Room To Improve

- Add profile gate tests for save, verify, resend, clear, invalid email, and
  already verified.
- Split pure derivation if it stays too large to review safely.
- Keep reward-state fixture coverage current when new reward branches are added.

## Flow 38. Reward QR Image

### Architecture Type

This is a short-lived token minting and image-rendering flow. It turns a
server-authorized reward into a merchant-scannable QR bearer token.

### Main Flow

1. Customer reward page requests `/reward/<rewardId>/qr.png`.
2. Route checks customer/reward ownership and eligibility.
3. Route mints or resolves a short-lived reward scan token.
4. Route renders QR image pointing to `/r/<token>`.
5. Merchant later scans token to collect the reward.

### What Is Good

- Collection QR is not a permanent reward id.
- Token expiry limits replay window.
- Server checks can block redeemed, expired, not-ready, or unauthorized rewards.

### Pitfalls

- QR refresh churn is bounded by safe reuse of unconsumed tokens with enough
  remaining lifetime, plus expired-token cleanup.
- Token/image routes need strong cache-control.

### Room To Improve

- Local tests now cover route ready/redeemable gates, private no-store PNG
  headers, wrong-customer minting, redeemed/cancelled/not-ready states,
  next-day gating, billing-blocked availability, incomplete profile, expired
  scan-token collection, and cross-merchant collection.
- Re-run the reward-token DB tier against target Supabase after applying the
  remediation migration batch.
- Add metrics for token creation and collection conversion.

## Flow 39. Reward Status Polling

### Architecture Type

This is a read-only live-status route. The browser polls for server reward
state, but server state decides whether collection happened.

### Main Flow

1. Reward page starts visible-tab polling.
2. Browser requests `/reward/<rewardId>/status`.
3. Route checks current reward/customer state.
4. Response tells the UI whether reward is redeemed/changed.
5. UI refreshes or updates copy after collection.

### What Is Good

- Status endpoint is read-only.
- Server redeemed state remains authoritative.
- Hidden-tab polling is avoided by the client.
- Route coverage pins no-store responses and non-enumerating unauthorized/not-found
  behavior.

### Pitfalls

- 1.5s visible-tab polling can add load if many users wait on reward pages.
- Polling can mask absence of real-time events.

### Room To Improve

- Keep the route and client source-contract coverage current.
- Consider push/SSE later if live reward collection volume grows.

## Flow 40. Customer Login, Sign-Out, Session Reset

### Architecture Type

This is a phone-OTP customer wallet auth flow. The browser submits phone/code;
server sessions and signed httpOnly cookies own logged-in state.

### Main Flow

1. Customer opens `/home/login`.
2. Customer requests phone OTP.
3. Server records pending verification and sends code.
4. Customer verifies code.
5. Server creates customer session cookie.
6. `/home` routes require that session.
7. Sign-out/reset clears stale session state.

### What Is Good

- Customer auth is no-password and phone-oriented.
- Session cookie is httpOnly and server-verified.
- Stale session reset route can recover broken state.

### Pitfalls

- Anti-enumeration behavior can confuse unknown-phone users, but the form now
  renders wrong-code and no-card verify feedback from the verify action state.
- Service-role session reads must stay scoped.
- OTP resend/replay/expiry need coverage.

### Room To Improve

- Add tests for known phone, expired code, resend, sign-out, and stale reset.
- Keep the non-enumerating no-card copy verified in the opt-in browser flow.
- Centralize customer auth/session helpers.

## Flow 41. Customer Dashboard `/home`

### Architecture Type

This is an authenticated customer wallet dashboard. Server loaders assemble
cards, rewards, and activity for the current customer.

### Main Flow

1. Customer opens `/home`.
2. Authenticated layout verifies customer session.
3. Server loads customer cards, rewards, top redeemable item, and activity.
4. UI renders wallet summary and navigation to rewards/profile/activity.

### What Is Good

- Dashboard state is server-owned.
- It gives customers one place to view loyalty cards and rewards.
- Top reward logic can prioritize useful action.

### Pitfalls

- Service-role reads rely on current-customer scoping.
- Reward grouping can hide expired or waiting states if not rendered
  consistently; local browser fixture proof now covers the waiting and
  redeemable dashboard branches.
- Dashboard metrics can drift from card/reward pages; the local fixture now
  asserts no-card, one-card, ready, waiting, and redeemed readback states.

### Room To Improve

- Keep the local fixture in the customer-flow gate and add a multi-card ordering
  case if the wallet starts surfacing cross-venue prioritization.
- Share reward grouping logic with rewards library.
- Replay the dashboard browser proof against staging/provider seed data before
  release.

## Flow 42. Customer Profile, Consent, Push Settings

### Architecture Type

This is an authenticated customer preference and profile flow. The browser owns
form input and service-worker subscription data; server state owns profile,
verification, consent, and push eligibility.

### Main Flow

1. Customer opens `/home/profile`.
2. Server loads current profile, consent, and push preference state.
3. Customer updates profile or marketing consent.
4. Browser may register push subscription.
5. Server persists preference/subscription state.

### What Is Good

- Consent and preferences are server-side records.
- Push subscription is tied to customer session.
- Profile actions are separate from card/reward mutations.

### Pitfalls

- Browser push state can diverge from server subscription state.
- Push marketing eligibility is high-trust; enqueue, announcement batching, and
  delivery now share the same latest push-consent helper.
- Push lifecycle route source-contract coverage now locks refresh/unsubscribe,
  preference writes, prompt tracking, current-customer scope, no-store responses,
  and fixed lifecycle reasons.

### Room To Improve

- Keep the shared push-marketing consent helper covered as new marketing event
  types are added.
- Add browser/service-worker tests for opt-in, opt-out, refresh, unsubscribe,
  disabled subscription, and stale session.
- Keep profile verification actions fixture-tested.

## Flow 43. Customer Rewards Library `/home/rewards`

### Architecture Type

This is an authenticated reward readback flow. Server loaders group rewards for
the current customer and UI renders the wallet's reward inventory.

### Main Flow

1. Customer opens `/home/rewards`.
2. Layout verifies customer session.
3. Server loads customer reward rows.
4. Rewards are grouped into relevant display buckets.
5. UI links to reward detail or card context.

### What Is Good

- Rewards are scoped to current customer.
- Wallet view gives customers a central inventory.
- Server grouping can keep reward state consistent.

### Pitfalls

- Expired rewards were a historical omission risk, but they now render in a
  history section and count toward non-empty state.
- Local browser coverage now signs a real customer-session cookie, seeds
  redeemable, upcoming, redeemed, and expired reward rows, and proves all mixed
  buckets render through `/home/rewards`.
- Reward grouping must stay aligned with reward detail states.

### Room To Improve

- Keep the mixed-state browser fixture in the customer-flow gate.
- Re-run the same proof against staging once target session and seed parity are
  available.
- Reuse grouping logic with dashboard and activity where possible.

## Flow 44. Customer Activity `/home/activity`

### Architecture Type

This is an authenticated customer event readback. Server-side reads scope
activity rows to the current customer.

### Main Flow

1. Customer opens `/home/activity`.
2. Layout verifies customer session.
3. Server loads customer-owned activity rows.
4. UI renders chronological loyalty activity.

### What Is Good

- Activity is separated from merchant/admin readbacks.
- Server scoping can prevent cross-customer leakage.
- It supports customer trust and self-service support.

### Pitfalls

- Service-role reads must never accept customer id from URL/request input.
- Product-event metadata can grow, but customer activity now parses only
  customer-safe label fields before DTO display.
- Empty/partial activity states can confuse customers, so local browser
  coverage now proves both a populated customer and an event-free customer
  through `/home/activity`.

### Room To Improve

- Keep source contracts covering current-customer scoping and metadata
  allow-listing.
- Keep populated/empty browser readback proof in the customer-flow gate.
- Add support-friendly labels for future event types through the activity core.

## Flow 45. Auth Email/SMS Hooks

### Architecture Type

This is a signed provider-webhook dispatch flow. Supabase sends auth hook
events; the app verifies signatures and dispatches messages through Resend or
Twilio.

### Main Flow

1. Supabase calls email or SMS hook route.
2. Route verifies Standard Webhooks signature.
3. Route parses auth event payload.
4. Email path can map provider token to merchant alias code.
5. Provider message is sent through Resend or Twilio.

### What Is Good

- Hooks require provider signature verification.
- Message delivery logic is server-only.
- Alias code improves merchant UX.

### Pitfalls

- Provider failure handling and retries need clarity.
- Alias retention risk applies here.
- Webhook routes are security-sensitive and easy to under-test.

### Room To Improve

- Add signature acceptance/rejection tests.
- Add provider failure and malformed payload tests.
- Add alias cleanup and logging.
- Keep email/SMS templates in reviewed templates.

## Flow 46. Push Subscription Lifecycle

### Architecture Type

This is a browser integration plus server preference flow. Browser owns the Web
Push subscription object; server owns customer identity, consent, preferences,
and subscription records.

### Main Flow

1. Browser requests public VAPID key.
2. Customer grants or denies browser push permission.
3. Browser sends subscription to server.
4. Server validates subscription and current customer.
5. Routes refresh, unsubscribe, disable, update preferences, or record prompt
   viewed state.

### What Is Good

- Most push routes are customer-session gated.
- Subscription state is stored server-side.
- Public key route is the only intentionally public push route.
- Push subscription input parsing is now a pure module with unit coverage for
  malformed shapes, short keys, disallowed hosts, non-HTTPS endpoints,
  userinfo/hash rejection, endpoint trimming, Windows push hosts, and browser
  permission-state normalization.
- Source-contract coverage locks every push lifecycle route to
  `getCurrentCustomer()`, no-store JSON responses, per-customer rate-limit
  keys, fixed lifecycle reasons, and current-customer service-role calls.
- The live-DB tier proves duplicate endpoint registration reuses one
  subscription row and disable records the lifecycle reason.

### Pitfalls

- Browser permission, service worker, consent, and server subscription state can
  diverge.
- Marketing consent eligibility is centralized across enqueue and delivery, and
  subscription parser/route/duplicate edge cases now have local coverage.
- Browser/service-worker behavior and real Web Push delivery still need target
  proof.

### Room To Improve

- Add browser/service-worker tests for subscribe, refresh, unsubscribe, disable,
  permission denied, no session, and stale session.
- Add telemetry for browser permission and server subscription mismatch.

## Flow 47. Notification Readback

### Architecture Type

This is an authenticated customer notification read model. Server-side reads
return only current-customer notification events and deliveries.

### Main Flow

1. Customer route requests notification readback.
2. Server verifies customer session.
3. Server reads notification rows scoped to current customer.
4. Response returns readback DTOs to UI/client code.

### What Is Good

- Readback is customer-session gated.
- It separates notification history from push delivery mechanics.
- Server scoping can prevent cross-customer leakage.
- Delivery rows are now read through the actual `notification_event_id` ledger
  column, matching the append-only delivery table and worker queries.

### Pitfalls

- Service-role readback must continue deriving customer id only from the
  current session.
- Delivery/event rows include provider/internal detail server-side, but customer
  output is now shaped into explicit issue codes before DTO return.
- The readback route contract and another-customer DB exclusion are now covered
  locally; target-provider delivery proof remains separate.

### Room To Improve

- Keep no-session and another-customer exclusion coverage in the required gate
  set.
- Keep notification DTOs explicit and extend the issue-code taxonomy only
  through focused readback-core coverage.
- Add pagination if notification history grows.

## Flow 48. Venue Announcements

### Architecture Type

This is a merchant-triggered notification enqueue flow. Merchant browser
submits announcement content; server filters eligible members and queues
notification events.

### Main Flow

1. Merchant submits venue announcement.
2. Route verifies merchant session and rate limit.
3. Payload is validated.
4. Server filters memberships by preference, consent, and active subscriptions.
5. Notification events are queued for delivery worker.

### What Is Good

- Announcement sending is merchant-session gated.
- Server filters recipients instead of trusting client selection.
- Queueing separates merchant action from provider delivery.
- Text normalization, dedupe-key generation, and the combined preference,
  subscription, and latest push-consent audience rule are covered in a pure
  unit tier.
- Announcement text moderation now fails closed for links, contact details,
  and payment/credential-collection phrasing before events are queued.

### Pitfalls

- Consent filtering now uses the shared latest push-consent rule, and route
  source-contract tests pin merchant-derived scope and rate-limit wiring.
- Recipient counts and provider failure reasons still need operator visibility.
- If announcements become broadly self-serve, add a human review/appeals path
  on top of the current automated high-risk content filter.

### Room To Improve

- Run target Web Push/provider smoke for venue-announcement delivery.
- Add operator-facing readback for queued/sent/skipped/failure counts.
- Extend moderation review tooling if merchant-authored announcements expand
  beyond pilot-safe copy.

## Flow 49. Notification Cron

### Architecture Type

This is a scheduled background worker flow. Vercel cron calls a bearer-protected
route that claims and delivers due notification events.

### Main Flow

1. Vercel cron calls notification route with secret.
2. Route verifies bearer token.
3. Worker loads due queued notification events.
4. Worker sends Web Push to eligible subscriptions.
5. Delivery rows and event status are updated.

### What Is Good

- Cron is secret-protected.
- Delivery work is separated from user request paths.
- Provider results can be recorded for support/audit.

### Pitfalls

- Queue claiming is now atomic through a locked DB RPC.
- Retryable failures now use bounded backoff and append-only attempt tracking.
- Event/delivery update errors are checked instead of silently swallowed.

### Room To Improve

- Apply the claim migration in target Supabase and add concurrency/provider
  smoke tests.

## Flow 50. Stripe Webhook

### Architecture Type

This is an external billing event ingestion flow. Stripe signs events; the app
verifies, deduplicates, records, and applies billing state changes.

### Main Flow

1. Stripe posts webhook to `/api/stripe/webhook`.
2. Route verifies Stripe signature.
3. Event is recorded/deduplicated.
4. Handler updates billing/customer/subscription state.
5. Merchant launch/account reads updated billing state later.

### What Is Good

- Browser return params do not own billing readiness.
- Stripe signature verification protects event ingestion.
- Webhook-derived state drives launch readiness.

### Pitfalls

- Duplicate-event short-circuit can block recovery if first handling inserted
  event but failed processing.
- Billing state changes are high impact for launch and customer eligibility.
- Webhook failure/replay behavior is hard to see without tests.

### Room To Improve

- Distinguish processed duplicates from failed/unprocessed claims.
- Allow locked retry for `failed_at` not null and `processed_at` null.
- Add tests for valid signature, invalid signature, duplicate processed event,
  failed retry, and out-of-order subscription events.

## Flow 51. Health Endpoint

### Architecture Type

This is an operational liveness/readiness endpoint. It should be clear whether
it proves only process health or dependency readiness.

### Main Flow

1. Monitoring or operator calls `/api/health`.
2. Route returns a simple health response.
3. Monitoring interprets response according to documented semantics.

### What Is Good

- A dedicated health route exists.
- It can support deployment/platform checks.
- It avoids tying health checks to user-facing pages.

### Pitfalls

- Health now reports `scope: "liveness"` to avoid being mistaken for full
  readiness.
- Dependency checks can make liveness flaky if mixed with readiness.
- Monitoring semantics need documentation.

### Room To Improve

- Document liveness versus readiness.
- Add optional dependency readiness checks only if operations need them.
- Add tests for response shape and cache headers.

## Flow 52. Admin Access Gate

### Architecture Type

This is a privileged route-layout gate. The admin layout owns access decisions
before rendering admin pages.

### Main Flow

1. User opens `/admin` route.
2. Layout checks auth, admin status, active state, and MFA requirement.
3. Anonymous users redirect to merchant login with next path.
4. Unauthorized users see access-denied state.
5. Authorized admins get `AdminShell`.

### What Is Good

- Admin gate is centralized in layout.
- MFA/admin-active checks are explicit.
- Child pages inherit the access shell.

### Pitfalls

- Service-role admin read helpers rely on route layout convention.
- A future caller outside `/admin` could reuse privileged helpers unsafely.
- Anonymous admin route gate behavior now has route-level Playwright coverage.

### Room To Improve

- Add `requireAdminRead()` or guarded admin repository for all service-role
  readbacks.
- Add tests for non-admin, inactive, no-MFA, and valid admin states when an
  admin-capable test session is available.
- Document admin gate assumptions in admin data modules.

## Flow 53. Admin Overview/Funnel

### Architecture Type

This is a privileged aggregate readback flow. Admins see service-role summary
metrics and funnel data.

### Main Flow

1. Admin opens `/admin`.
2. Layout verifies admin access.
3. Server loads overview/funnel data.
4. UI renders operational summary panels.

### What Is Good

- Overview is server-rendered and privileged.
- It gives support/operators a single starting point.
- Source labels can explain where data comes from.

### Pitfalls

- Summary metrics can hide exact records needed for debugging.
- Service-role reads must stay guarded.
- Latest-only views can create false confidence.

### Room To Improve

- Add drill-down links to merchant/customer/reward records.
- Add filters/time ranges as data grows.
- Add tests for admin access and summary DTO shape.

## Flow 54. Admin Merchant/QR Operations

### Architecture Type

This is a privileged merchant and QR support flow. Admin readbacks use
service-role access; QR mutations go through admin-gated server actions and RPCs.

### Main Flow

1. Admin opens `/admin/merchants`.
2. Page reads merchant accounts and QR records.
3. Admin can toggle QR active state or regenerate QR code.
4. Server action checks admin authorization.
5. SQL RPC validates and audits the mutation.

### What Is Good

- High-impact QR actions go through server actions and RPCs.
- Admin actions require authorization, not only UI visibility.
- QR/merchant readback helps support live setup issues.

### Pitfalls

- QR actions affect public customer acquisition immediately.
- Actions need double-submit/idempotency protection.
- Admin readback can expose more PII/operational data than necessary.

### Room To Improve

- Add confirmation and idempotency keys for QR regeneration/toggle.
- Add action tests for unauthorized, invalid id, missing reason if required,
  success, and audit writes.
- Return masked/minimal DTOs by default.

## Flow 55. Admin Customer/Reward Interventions

### Architecture Type

This is a privileged support mutation flow. Admins can adjust stamps or cancel
rewards through reasoned, audited server actions and SQL RPCs.

### Main Flow

1. Admin opens `/admin/customers`.
2. Page reads customer, membership, reward, and support context.
3. Admin submits adjustment/cancellation action.
4. Server checks admin authorization and required fields.
5. RPC performs domain mutation and audit write.

### What Is Good

- Mutations are not direct client writes.
- SQL can enforce internal-admin status and audit context.
- Reason capture supports support accountability.

### Pitfalls

- Stamp/reward interventions are high-impact and can change customer trust.
- Missing idempotency/double-submit protection can duplicate actions.
- UI needs clear confirmation for destructive changes.

### Room To Improve

- Add idempotency keys and disabled/pending submit states.
- Add structured reason taxonomy.
- Add tests for unauthorized, invalid id, missing reason, success, replay, and
  audit evidence.

## Flow 56. Admin Privacy/Consent/Data Requests

### Architecture Type

This is a privileged privacy operations flow. Admins read privacy-related data
and record consent opt-outs or data request actions through audited server
actions.

### Main Flow

1. Admin opens `/admin/privacy`.
2. Page reads privacy, consent, and customer context.
3. Admin records opt-out or data request.
4. Server checks admin authorization.
5. RPC/action records the privacy operation.

### What Is Good

- Privacy operations are separated from general customer pages.
- Actions can be audited.
- Consent state is operationally visible.

### Pitfalls

- PII handling is split between data reads and UI rendering.
- Privacy workflows require legal/process review beyond code.
- Admin notes/actions need structured context.

### Room To Improve

- Return masked DTOs from admin data helpers.
- Add tests for opt-out, data request logging, unauthorized access, and audit
  rows.
- Add process status fields for data requests if operationally needed.

## Flow 57. Admin Fraud Signals

### Architecture Type

This is a privileged security/fraud readback flow. It reads fraud flags and
redemption failure events for admin review.

### Main Flow

1. Admin opens `/admin/fraud`.
2. Server reads fraud flags and redemption failures.
3. UI renders masked customer/merchant context and event status.
4. Admin uses signals for investigation.

### What Is Good

- Fraud signals are separated from normal merchant/customer UI.
- Readbacks can mask customer context.
- Redemption failures are visible for support.

### Pitfalls

- Product event metadata can expose raw/internal data if displayed broadly.
- Latest-only views may miss investigation context.
- Fraud readbacks need strict admin-only access.

### Room To Improve

- Allow-list fraud/event display fields.
- Add filters by merchant, customer, severity, status, date, and event type.
- Add tests for masked DTOs and admin gate.

## Flow 58. Admin Audit Logs

### Architecture Type

This is a privileged evidence readback flow. Admins view audit records for
support, compliance, and operational review.

### Main Flow

1. Admin opens `/admin/audit`.
2. Server reads audit log rows.
3. UI renders action, actor, target, and timing context.
4. Admin uses logs to trace interventions or system events.

### What Is Good

- Audit logs are visible as a first-class admin surface.
- It supports accountability for support actions.
- Server rendering keeps data behind admin gate.

### Pitfalls

- Latest-only audit views are weak for real investigations.
- Audit logs are useful only if all high-impact actions write them consistently.
- Raw target data can expose PII if not shaped.

### Room To Improve

- Add filters by actor, merchant, target id, action, and date range.
- Add consistency tests that admin actions create audit rows.
- Mask or structure target metadata before rendering.

## Flow 59. Admin Billing

### Architecture Type

This is a privileged billing readback flow. Admins view merchant billing state
derived from Stripe/webhook-synced records.

### Main Flow

1. Admin opens `/admin/billing`.
2. Server reads billing customer/subscription rows.
3. UI renders merchant, status, and subscription context.
4. Admin uses readback for support or pilot monitoring.

### What Is Good

- Billing support is separated from merchant self-service billing.
- Readback is server-rendered behind admin gate.
- It helps diagnose launch gating and Stripe status issues.
- Admin DTOs mask Stripe customer/subscription ids and format billing status
  before page rendering.

### Pitfalls

- Raw Stripe ids remain privileged server-only values.
- Billing readback can drift from merchant-facing status copy.
- Latest-only records may not tell webhook history.

### Room To Improve

- Link billing readback to webhook/audit history.
- Keep provider/live reconciliation proof separate from local UI masking tests.

## Flow 60. Admin Pilot Report/Notes

### Architecture Type

This is a privileged pilot operations flow. It combines pilot readback with
admin note logging.

### Main Flow

1. Admin opens `/admin/pilot`.
2. Server reads pilot report data.
3. Admin can log notes.
4. Server action checks admin authorization and persists note.

### What Is Good

- Pilot evidence has a dedicated admin surface.
- Notes can preserve support/operator context.
- Server actions can audit note creation.

### Pitfalls

- Freeform notes can become unofficial source of truth.
- Notes without structured links are hard to search or act on.
- Pilot reports can drift from actual product readiness gates.

### Room To Improve

- Add structured note categories and linked merchant/customer/reward ids.
- Add filters/search for notes.
- Add tests for note authorization, validation, and persistence.

## Flow 61. Design System Playground `/dev/design-system`

### Architecture Type

This is a development-only visual catalog. It renders Wet Ink tokens and shared
components for design review.

### Main Flow

1. Developer opens `/dev/design-system`.
2. Page renders design tokens, components, and sample states.
3. Developer visually checks brand consistency.

### What Is Good

- Design system is inspectable in the actual app.
- It helps keep Wet Ink components coherent.
- It supports screenshot-based review.

### Pitfalls

- Robots/noindex is not enough if the route renders in production.
- A dev route can leak unfinished internal UI.
- It does not prove real data/auth behavior.

### Room To Improve

- Keep the central `/dev` production `notFound()` block and route inventory
  test current as dev pages are added.
- Add visual snapshots for key token/component states.

## Flow 62. Merchant App Harness Pages `/dev/app-harness/*`

### Architecture Type

This is a deterministic fixture-based visual QA surface. It mounts real merchant
presentational shells and pages without real Supabase loaders.

### Main Flow

1. Developer opens a harness route.
2. Fixture data supplies deterministic merchant state.
3. Real shell/presentational components render.
4. Screenshots or manual checks validate layout and states.

### What Is Good

- Harnesses make responsive merchant UI easy to inspect.
- Fixtures avoid relying on seeded database state.
- Real shell components catch layout regressions.

### Pitfalls

- Harnesses do not prove auth, RLS, loaders, or Stripe. The QR harness now has
  deterministic dev-only image bytes for browser visual proof while production
  QR image access remains ownership-gated.
- Interactive forms may still point at real server actions.
- Fixture states can drift from real loader DTOs.

### Room To Improve

- Make harness actions inert or visibly disabled where possible.
- Pair visual harnesses with server integration tests.
- Add fixture-shape checks against real DTO types.
- Add screenshots across mobile/tablet/desktop widths.

## Flow 63. Poster Preview Harness `/dev/poster-preview`

### Architecture Type

This is a development-only poster rendering harness. It uses real poster
components with deterministic sample QR/venue data.

### Main Flow

1. Developer opens `/dev/poster-preview`.
2. Harness renders poster variants with sample venue and QR values.
3. Developer or visual tests inspect poster layout.

### What Is Good

- Poster design can be checked without merchant setup.
- It uses real poster components.
- It supports visual QA before print-route testing.

### Pitfalls

- Harness sample copy can drift from live template copy.
- Existing string tests can become stale.
- Harness does not prove authenticated poster route ownership.

### Room To Improve

- Tie tests to current poster template ids and component contract.
- Add visual checks for every template.
- Keep sample data clearly marked as fixture-only.

## Flow 64. Dev Viewport/Screenshot-Width Wrapper

### Architecture Type

This is a development-only viewport control flow. It wraps dev routes in a
fixed-width frame based on query params to support repeatable screenshots.

### Main Flow

1. Developer opens a `/dev` route with optional `?w=<px>`.
2. Dev layout parses and clamps the requested width.
3. Child page renders inside fixed-width wrapper.
4. Screenshot tooling captures predictable breakpoint states.

### What Is Good

- It makes responsive QA repeatable.
- Width clamping prevents extreme broken harness states.
- It works across multiple dev surfaces.

### Pitfalls

- It only helps if visual QA actually covers meaningful widths.
- It can hide full-browser layout issues outside the framed area.
- Production exposure must be blocked with the rest of `/dev`.

### Room To Improve

- Add Playwright coverage for 320, 375, 768, 1024, and 1440 widths.
- Include sidebar collapsed/expanded and reward scan collected states.
- Keep viewport wrapper documented as visual QA aid, not product behavior proof.
