# P0 Playwright outlines

Browser proof for three fail-closed surfaces that were still unit- or
contract-owned: cron/webhook HTTP gates, the merchant cancellation interview,
and customer wallet access recovery. Specs follow the existing suite
(`cron-route-auth.spec.ts`, `merchant-billing-recovery.spec.ts`,
`customer-login-flow.ts`, `helpers/harness.ts`). Production floors and skip
ceilings stay unchanged. These outlines do not authorise production database,
merge, approval, or release actions.

## Shared constraints

- Match existing Playwright style: `APIRequestContext` with `maxRedirects: 0`
  for HTTP gates; `dismissPwaInstall`, harness helpers, and
  `expectNoAxeViolations` for UI.
- British English only when asserting existing UI copy.
- Prefer the smallest correct change. DB-free e2e remains the default CI plane;
  `@customer-flow` stays opt-in via `CUSTOMER_FLOW_E2E=1`.
- Processor, lease, RLS, and Stripe mutation proof stay in unit/DB suites.

## PR1 — cron + Stripe webhook fail-closed

**Branch intent:** extend the existing cron bearer matrix and add an HTTP-only
Stripe webhook spec. No product behaviour change.

### Files

- `tests/e2e/cron-route-auth.spec.ts` — add `/api/cron/billing-trial-sync` to
  `CRON_ROUTES` so inherited deny cases cover it. The route already uses
  `isAuthorizedCronRequest` and returns `401` `{ error: "unauthorized" }`.
- `tests/e2e/stripe-webhook-route-auth.spec.ts` — new fail-closed HTTP spec.
- `docs/qa/p0-playwright-outlines.md` — this document.

### Cases

1. Every listed cron route, including billing-trial-sync, rejects no bearer, a
   wrong bearer, and a non-Bearer scheme carrying the secret (`401`).
2. `POST /api/stripe/webhook` without `stripe-signature` → `400`.
3. `POST` with a junk signature and a small body → `400`.
4. `POST` with a signature and `Content-Length` `1048577` → `413` before
   Stripe verification (not `400` invalid signature).
5. Comment in the webhook spec that unit tests own processor/lease
   (`tests/unit/stripe-webhook-events.test.mjs`).

### Acceptance

- Inherited cron deny cases include billing-trial-sync without duplicating
  helper logic.
- Webhook spec uses `APIRequestContext` and `maxRedirects: 0`.
- Default DB-free e2e CI can run both specs. No production secret, skip-ceiling,
  or floor changes.

### Ready-to-paste PR body

```md
## Summary

- Extend cron route-auth so `/api/cron/billing-trial-sync` inherits the existing
  bearer deny cases.
- Add HTTP-boundary Playwright proof that `POST /api/stripe/webhook` fails
  closed without a signature, with a junk signature, and on an oversized
  Content-Length before verification.
- Record the P0 Playwright outlines for PR1–PR3.

Processor, lease, and claim behaviour stay in
`tests/unit/stripe-webhook-events.test.mjs`.

## Verification

- [ ] `pnpm typecheck`
- [ ] Playwright: `tests/e2e/cron-route-auth.spec.ts`
- [ ] Playwright: `tests/e2e/stripe-webhook-route-auth.spec.ts`

## Design System

- [ ] `DESIGN.md`, `app/globals.css`, and shared components remain aligned when UI changes.
- [ ] Copy stays plain British English with no emoji or exclamation marks.
```

## PR2 — merchant cancel interview harness

**Branch intent:** make `/app/account/cancel` reachable on the DB-free harness
and prove the interview UI without contacting Stripe.

### Files

- `lib/merchant/billing-cancellable.ts` — shared production rule: cancellable
  when `stripe_subscription_id` is present and `status` is
  `trialing` | `active` | `past_due`.
- `app/app/account/cancel/page.tsx` — use that helper.
- `components/merchant/account/cancellation-interview-form.tsx` — accept an
  optional injected action so the harness can stay DB-free (same pattern as
  `BillingCheckoutForm`).
- `app/dev/app-harness/account/cancel/page.tsx` plus harness client.
- `tests/e2e/helpers/harness.ts` — `HARNESS_ROUTES.cancel`.
- `tests/e2e/merchant-cancel-interview.spec.ts`.
- `tests/contracts/dev-route-production-guard.test.mjs` — inventory the new
  page.

No desktop twin unless layout proof needs it; the interview is a single stacked
form already exercised at the mobile-safari default.

### Cases

1. Cancellable states (`trialing`, `active`, `past_due`) render the interview
   form.
2. `support_call` shows “Support follow-up requested” and does not navigate to
   Stripe.
3. `continue_cancellation` shows portal-handoff intent, `aria-busy`, and an
   inline fail (billing-recovery pattern) without leaving the harness.
4. Non-cancellable states (`none`, `cancelled`) show the existing copy and no
   form.
5. `@a11y` on the form and the support-follow-up success state, using
   `dismissPwaInstall`, harness helpers, and `expectNoAxeViolations`.

### Acceptance

- Harness stays `NODE_ENV !== "production"` and never calls Stripe or Supabase.
- Production cancellable rule is not weakened.
- Default DB-free e2e CI can run the spec.

### Ready-to-paste PR body

```md
## Summary

- Mount the real cancellation interview on the DB-free merchant harness with
  cancellable (`trialing`, `active`, `past_due`) and non-cancellable
  (`none`, `cancelled`) fixtures.
- Prove support follow-up stays on-page, continue-to-cancel keeps the billing
  recovery busy/inline-fail pattern, and non-cancellable copy has no form.
- Audit the form and success state with axe.

## Verification

- [ ] `pnpm typecheck`
- [ ] Playwright: `tests/e2e/merchant-cancel-interview.spec.ts`

## Design System

- [ ] `DESIGN.md`, `app/globals.css`, and shared components remain aligned when UI changes.
- [ ] Copy stays plain British English with no emoji or exclamation marks.
```

## PR3 — customer recover `@customer-flow`

**Branch intent:** mirror `customer-login-flow.ts`. Live `/home/recover` proof,
gated with `CUSTOMER_FLOW_E2E=1`, skipped on the default DB-free e2e job.

### Files

- `tests/e2e/customer-recover-flow.ts` — export
  `describeCustomerAccessRecovery()`.
- `tests/e2e/customer-recover.spec.ts` and `customer-recover.desktop.spec.ts`
  (same split as login).
- `tests/e2e/helpers/customer-access-recovery.ts` — mint the pending recovery
  cookie when `CUSTOMER_SESSION_SECRET` is present; seed a matching customer
  when local Supabase is available.

Device continuity currently authenticates on verified phone
(`REQUIRE_DEVICE_CONTINUITY` is false), so login will not redirect into
recover. Cookie minting is the fixture that makes `/home/recover` reachable
without flipping that production constant.

### Cases

1. No pending recovery → redirect to `/home/login`.
2. Pending recovery with email HMACs → email UI anchors (`Email code`,
   `#recovery-code`, Open my wallet, resend).
3. Wrong OTP → no `nabaperks_customer_session`.
4. Happy path with `CUSTOMER_DEV_OTP_CODE` when a seeded customer exists.
5. No-email pending recovery → fail-closed copy when the cookie fixture can
   omit `emailHmac` / `codeHmac`.
6. Resend control reports a status (success or the existing inline failure).

Wrong-OTP, happy-path, and resend mutation cases skip when local Supabase or
the HMAC secrets are unavailable, with an explicit skip reason. They must not
be recorded as passing.

### Acceptance

- Default CI skips the describe unless `CUSTOMER_FLOW_E2E=1`.
- No production skip-ceiling or floor changes.
- Session cookie is asserted absent on the wrong-OTP path.

### Ready-to-paste PR body

```md
## Summary

- Add `@customer-flow` Playwright coverage for `/home/recover`, mirroring the
  customer-login flow helper/spec/desktop split.
- Prove missing recovery redirects to login, email UI anchors render, wrong OTP
  mints no customer session, and no-email recovery stays fail-closed.
- Gate the suite with `CUSTOMER_FLOW_E2E=1` so default DB-free e2e skips it.

## Verification

- [ ] `pnpm typecheck`
- [ ] Playwright default (no `CUSTOMER_FLOW_E2E`): specs skip, do not fail
- [ ] Playwright with `CUSTOMER_FLOW_E2E=1` against a customer-flow server

## Design System

- [ ] `DESIGN.md`, `app/globals.css`, and shared components remain aligned when UI changes.
- [ ] Copy stays plain British English with no emoji or exclamation marks.
```
