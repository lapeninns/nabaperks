---
name: qa-web
description: >
  QA tests for the Nabaperks Next.js web app, covering customer QR loyalty,
  merchant console, admin console, public pages, and API health behavior.
---

# QA Web

This sub-skill performs functional browser QA for the single Next.js App Router application in this repo.

## App Profile

- Framework: Next.js 16 App Router, React 19, TypeScript.
- Default URL: `http://localhost:3000`.
- Package manager: `pnpm`.
- Dev server: `pnpm dev`.
- Local DB: disposable Supabase stack seeded by `pnpm db:setup`.
- Customer OTP in local QA: `CUSTOMER_DEV_OTP_CODE=424242`.
- Main seeded merchant: `old-crown-girton`.
- Main seeded QR: `old-crown-girton-qr`.
- Demo customer phone: `07467586751`.

## Testing Target

### Local-only runs

QA is run from a local Droid session against the checked-out branch. No GitHub Actions workflow, Factory API key, preview deployment, staging environment, or production environment is required.

1. Confirm the local Supabase stack has been started and seeded.
2. If no server is running, start the dev server with:
   - `CUSTOMER_DEV_OTP_CODE=424242 CUSTOMER_FLOW_DEV_HARNESS_ENABLED=true pnpm dev`
3. Poll `http://localhost:3000/api/health` until it returns a healthy HTTP response.
4. Use `http://localhost:3000` as the browser base URL.

Never fall back to dev, staging, preview, or production when testing branch code. If local startup is unavailable, report all web tests as BLOCKED.

## Authentication Method

### Guest

No credentials are needed. Use this persona for public pages, QR entry, login gates, and negative auth checks.

### Customer

- Use phone `07467586751` for the seeded customer flow.
- Use OTP from `CUSTOMER_DEV_OTP_CODE`, expected to be `424242` in local QA.
- Use `pnpm customer-flow:reset` before customer-flow tests if state needs a clean starting point.

### Merchant

- Seeded email: `mia@old-crown-girton.test`.
- Password source: `QA_SEEDED_PASSWORD`.
- If `QA_SEEDED_PASSWORD` is missing, report merchant-auth flows as BLOCKED and continue other flows.

### Admin

- Seeded email: `admin@nabaperks.test`.
- Password source: `QA_SEEDED_PASSWORD`.
- Production admin MFA is always required. Do not attempt admin mutation QA in production.
- If `QA_SEEDED_PASSWORD` is missing, report admin-auth flows as BLOCKED and continue other flows.

## Evidence Rules

- Use agent-browser snapshots as primary evidence.
- Save screenshots in `qa-results/$RUN_ID/`.
- Reference screenshot filenames in the report, do not embed image markdown.
- Include a concise snapshot for each meaningful state change.

## Menu of Available Test Flows

The orchestrator must choose only flows relevant to the current diff. This is not a checklist.

### Public and marketing surfaces

Use when files under `app/page.tsx`, `app/pricing`, `app/start`, `app/privacy`, `app/terms`, public layout, brand components, or marketing copy change.

1. Open `/`, `/pricing`, and `/start`.
2. Verify each surface renders without auth and exposes the expected primary action.
3. Verify legal links route to `/privacy` and `/terms`.
4. Negative test: open `/app` as guest and verify the user is redirected or shown the merchant auth gate.

Success: the relevant public page reaches its intended action or legal surface without console-visible blocking errors.

### Customer QR join and OTP

Use when files under `app/q`, `app/m`, customer auth/session/join libraries, OTP UI, or customer copy change.

1. Reset the seeded demo customer if a clean journey is required: `pnpm customer-flow:reset`.
2. Open `/q/old-crown-girton-qr`.
3. Verify the page leads with the value-first join or returning-member state.
4. Continue to `/m/old-crown-girton/join?qr=old-crown-girton-qr`.
5. Enter phone `07467586751`.
6. Enter OTP `424242`.
7. Accept required terms.
8. Verify the card or stamp-confirm route appears.
9. Negative test: attempt an invalid OTP or missing terms path and verify the user remains blocked with a helpful message.

Success: the verified customer reaches the card or stamp-confirm surface with QR context preserved.

### Customer stamp and reward lifecycle

Use when files under `app/card`, `app/reward`, loyalty components, stamping/reward libraries, or RPC-facing actions change.

1. Ensure the seeded customer has a membership, using the join flow or customer-flow helper.
2. Open `/q/old-crown-girton-qr` as the returning customer.
3. Verify the stamp-confirm surface appears.
4. Trigger the self-service stamp action.
5. Verify the card shows updated stamp progress.
6. Advance seeded state if needed with `pnpm customer-flow:advance`.
7. Verify the reward waiting state, ready state, and QR handoff route when relevant.
8. Negative test: attempt duplicate same-day stamping and verify the app blocks the duplicate without losing card state.

Success: stamp/reward state reaches the expected customer surface and does not expose raw phone data.

### Customer home surfaces

Use when files under `app/home`, customer profile, marketing consent, activity, reward list, or customer session reset change.

1. Authenticate through customer OTP or use the seeded customer session path.
2. Open `/home`, `/home/activity`, `/home/profile`, and `/home/rewards`.
3. Verify each route renders the expected customer-owned data.
4. Verify profile/marketing consent controls only affect the customer profile.
5. Negative test: clear the session with `/home/session/reset` and verify protected home routes require login again.

Success: customer home routes render and enforce customer-session ownership.

### Merchant auth and console

Use when files under `app/(auth)`, `app/app`, merchant components, merchant profile, launch, card, QR, customers, activity, or billing change.

1. Log in at `/login` or `/signup` using `mia@old-crown-girton.test` and the value of `QA_SEEDED_PASSWORD`.
2. Open `/app`.
3. Verify the merchant dashboard renders for Old Crown Girton.
4. Visit `/app/launch`, `/app/settings`, `/app/customers`, `/app/activity`, `/app/account`, `/app/profile`, and relevant QR/card routes based on the diff.
5. For launch/card/QR diffs, make a minimal safe edit only on local seeded data and verify the save confirmation or updated surface.
6. Negative test: open `/admin` as the merchant and verify access is denied or redirected.

Success: the merchant reaches the expected console surface and cannot access admin-only areas.

### Merchant reward scan

Use when files under `app/app/rewards/scan`, reward scan token, merchant collection, or reward status route change.

1. Prepare a seeded ready reward with `pnpm customer-flow:make-redeemable`.
2. Open the customer reward page and capture the reward handoff state.
3. Open the merchant scan URL or `/app/rewards/scan/[rewardId]` as the merchant.
4. Confirm collection only once.
5. Negative test: reload or repeat the collection attempt and verify the reward cannot be consumed twice.

Success: the merchant can confirm a valid reward once and repeated use is blocked.

### Admin support dashboards

Use when files under `app/admin`, `components/admin`, `lib/admin`, audit/fraud/billing/privacy/pilot support, or admin actions change.

1. Log in as `admin@nabaperks.test` using `QA_SEEDED_PASSWORD`.
2. Open `/admin`.
3. Visit the changed admin surface, for example `/admin/customers`, `/admin/merchants`, `/admin/fraud`, `/admin/billing`, `/admin/audit`, `/admin/privacy`, or `/admin/pilot`.
4. Verify tables and responsive record cards show expected seeded data.
5. For support-action diffs, perform only local seeded-data actions and verify audit-friendly confirmation.
6. Negative test: verify guest and merchant personas cannot reach the same admin URL.

Success: admin pages render seeded operational data and enforce admin-only access.

### API and cron route smoke

Use when files under `app/api`, `lib/notifications`, `lib/stripe`, `lib/qr`, `lib/security`, or route handlers change.

1. Call `/api/health` and verify it returns healthy JSON.
2. For public GET handlers like reward status or QR image, use seeded IDs and verify the response type/status.
3. For protected crons or webhooks, do not send real third-party payloads unless the diff requires it and local secrets are present.
4. Negative test: call protected routes without required secret/signature and verify rejection.

Success: changed route handlers respond correctly for local seeded happy paths and reject unauthenticated or unsigned requests.

### Dev harness and design system

Use when files under `app/dev`, `components/brand`, `components/customer`, `components/loyalty`, `components/motion`, `app/globals.css`, or design tokens change.

1. Ensure `CUSTOMER_FLOW_DEV_HARNESS_ENABLED=true`.
2. Open `/dev/design-system`.
3. Open `/dev/customer-flow` and relevant preview states.
4. Verify mobile-width surfaces maintain readable layout and tap targets.
5. Negative test: disable the harness if possible or open a production-like target and verify dev-only routes are unavailable.

Success: the changed component or harness renders the relevant state without breaking Wet Ink conventions.

## Error Handling

- If auth credentials are missing, mark only auth-dependent flows as BLOCKED.
- If Supabase is not running, mark DB-dependent flows as BLOCKED and include `supabase start && pnpm db:setup`.
- If the dev server fails to start, mark all web flows as BLOCKED and include the startup error.
- If a seeded ID is missing, use `pnpm db:setup` or `pnpm customer-flow:reset` before retrying once.
- If a third-party key is absent, use the documented local placeholder or fallback path. Do not trigger real SMS, email, or Stripe billing in QA.

## Known Failure Modes

1. **Missing seeded password.** Merchant and admin login require `QA_SEEDED_PASSWORD`. If it is not present, report merchant/admin auth flows as BLOCKED.
2. **Customer state already advanced.** The demo phone may already have stamps or a reward. Use `pnpm customer-flow:reset` before first-join tests.
3. **Local Supabase not seeded.** Routes that depend on `old-crown-girton-qr` or `old-crown-girton` fail until `supabase start && pnpm db:setup` has completed.
4. **Google Places key absent.** Venue autocomplete should fall back to manual venue entry when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is blank.
5. **Production admin MFA.** Admin console testing against production is read-only and may be blocked by MFA. Do not bypass MFA.
