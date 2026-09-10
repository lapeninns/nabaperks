# P1/P2 Playwright outlines

Browser proof for the remaining P1/P2 e2e backlog after P0 PRs #303–#305
(cron/webhook gates, merchant cancellation interview, customer recover). Specs
follow the existing suite (`cron-route-auth.spec.ts`, `public-qr-router-flow.ts`,
`merchant-billing-recovery.spec.ts`, `customer-login-flow.ts`,
`helpers/harness.ts`, axe helpers). Production floors and skip ceilings stay
unchanged. These outlines do not authorise production database, merge, approval,
or release actions.

P0 work is already in open PRs. Do not redo it here.

## Shared constraints

- Match existing Playwright style: `APIRequestContext` with `maxRedirects: 0`
  for HTTP gates; `dismissPwaInstall`, harness helpers, and
  `expectNoAxeViolations` for UI.
- British English only when asserting existing UI copy.
- Prefer the smallest correct change. DB-free e2e remains the default CI plane.
- Do not add new default-CI skipped tests: e2e skip ceilings are already at
  the recorded maximum. Journeys that truly need live Supabase stay documented
  as follow-through in `tests/db` / existing `@customer-flow` specs, or wait for
  a separately reviewed ceiling change.
- Processor, RLS, and mutation proof stay in unit/DB suites.

## Gap map (verified against current routes/specs)

| ID  | Surface                                                                         | Verified gap                                                                                                                                                                                                                                 | Proof plane                                     |
| --- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| A   | `/p/[token]`, `/r/[token]`                                                      | Unit scanner tests own URL parsing; merchant scan UI is harness-covered; public UUID 404 and redirect Location are not e2e.                                                                                                                  | DB-free HTTP + navigation                       |
| B   | `/admin-mfa-bootstrap`, `/api/admin-mfa-bootstrap/authorize`, `/admin/security` | Admin route gates omit `/admin/security`; bootstrap UI and authorize fail-closed are not e2e. Layout enrolment/step-up is unreachable while `mfaRequired` is false, so those panels need a harness.                                          | DB-free HTTP + UI; harness for panels           |
| C   | Reward collection second factor                                                 | `customer-redemption-second-factor/visual.spec.ts` only mounts the incomplete-profile form. OTP step and post-verify QR are missing.                                                                                                         | DB-free harness query states                    |
| D   | `/invite/[token]`                                                               | Merchant invite e2e is the import form. Customer accept landing is not e2e. Join/OTP/membership writes stay in `tests/db/loyalty-invites.test.mjs` and existing customer-join live-db.                                                       | DB-free unavailable page + harness states       |
| E   | `/claim/unsubscribe/[token]`, `/invite/unsubscribe/[token]`, one-click API      | Unit/contracts own headers and RPC; public a11y sweep omits these routes. The claim page always rate-limits through Supabase first (including `?unsubscribe=done`), so its UI is harness-mounted. Invite unsubscribe has no rate-limit gate. | Invite UI + claim harness + HTTP                |
| F   | Push beyond profile disclosure                                                  | `customer-notification-settings` only opens the disclosure. `POST /api/notifications/push/subscribe` and the settings control are not e2e.                                                                                                   | DB-free HTTP + harness; no skip on missing APIs |

## PR-A — Public scan handoffs `/p/[token]` and `/r/[token]`

**Branch intent:** smallest HTTP and navigation proof that a malformed token is
a branded 404 and a UUID forwards into the merchant scan console.

### Files

- `tests/e2e/public-scan-handoff.spec.ts`

### Cases

1. `GET /p/not-a-uuid` and `GET /r/not-a-uuid` → `404`, heading “Page not found”.
2. `GET /p/{uuid}` with `maxRedirects: 0` → `307`/`308` `Location` containing
   `/app/offers/scan/{uuid}`.
3. `GET /r/{uuid}` with `maxRedirects: 0` → `307`/`308` `Location` containing
   `/app/rewards/scan/{uuid}`.
4. Following a good `/p/` or `/r/` UUID in the browser lands on merchant login
   with `next` set to the matching scan console (anonymous visitors must not
   see a pass or reward face).

### Acceptance

- No live scan-token fixture. UUID shape alone is enough for the handoff.
- Default DB-free e2e CI can run the spec. No skip-ceiling or floor changes.

### Ready-to-paste PR body

```md
## Summary

- Add Playwright proof that public `/p/[token]` and `/r/[token]` handoffs
  404 on a malformed token and redirect a UUID into the merchant scan consoles.
- Assert the anonymous follow-through lands on merchant login with `next`
  pointing at `/app/offers/scan/{uuid}` or `/app/rewards/scan/{uuid}`.
- Record the P1/P2 Playwright outlines.

## Verification

- [ ] `pnpm typecheck`
- [ ] Playwright: `tests/e2e/public-scan-handoff.spec.ts`

## Design System

- [ ] `DESIGN.md`, `app/globals.css`, and shared components remain aligned when UI changes.
- [ ] Copy stays plain British English with no emoji or exclamation marks.
```

## PR-B — Admin WebAuthn / MFA bootstrap UI

**Branch intent:** fail-closed without a session or approved origin; prove the
bootstrap and enrolment/step-up copy as far as a DB-free harness allows.
Do not weaken production admin auth (`mfaRequired` stays as product policy).

### Files

- `tests/e2e/admin-route-gates.spec.ts` — add `/admin/security`.
- `tests/e2e/admin-mfa-bootstrap.spec.ts`
- `app/dev/app-harness/admin-mfa/page.tsx` — mount `AdminMfaPanel` and
  `AdminMfaStepUp` (layout enrolment is currently unreachable).
- `tests/contracts/dev-route-production-guard.test.mjs` — inventory the page.

### Cases

1. Anonymous `/admin/security` redirects to `/login?next=/admin` (same gate as
   the other admin routes).
2. `POST /api/admin-mfa-bootstrap/authorize` without `Origin`, with a
   non-approved origin, or without a session → `403` `{ allowed: false }`.
3. `/admin-mfa-bootstrap` renders the email stage; empty email keeps Send
   disabled.
4. Harness `?surface=enroll|enrolled|step-up` renders the existing panel copy
   without granting admin authority.
5. `@a11y` on the bootstrap email stage and the enroll harness surface.

### Deferred

- Intercepting GoTrue `signInWithOtp` / `verifyOtp` from Playwright is not
  reliable without a live approved origin and a configured browser client.
  Do not skip-gate a flaky mock. Completing a live WebAuthn register/assert
  ceremony needs the `admin-webauthn` function, an approved origin, and a
  virtual authenticator. Security-page-after-enroll stays out while
  `mfaRequired` is false in `getAdminAccess`.

### Acceptance

- No production MFA policy change.
- Default DB-free e2e CI can run the specs.

### Ready-to-paste PR body

```md
## Summary

- Extend admin route-gates so anonymous `/admin/security` inherits the login
  redirect.
- Add HTTP fail-closed proof for `POST /api/admin-mfa-bootstrap/authorize` and
  DB-free UI proof of the bootstrap email stage plus harness enrolment and
  step-up panels.
- Do not change production admin MFA policy.

## Verification

- [ ] `pnpm typecheck`
- [ ] Playwright: `tests/e2e/admin-route-gates.spec.ts`
- [ ] Playwright: `tests/e2e/admin-mfa-bootstrap.spec.ts`

## Design System

- [ ] `DESIGN.md`, `app/globals.css`, and shared components remain aligned when UI changes.
- [ ] Copy stays plain British English with no emoji or exclamation marks.
```

## PR-C — Reward collection second-factor happy path

**Branch intent:** extend the existing home-harness so collection QR stays
hidden on the email-code gate and appears once the profile is complete.

### Files

- `app/dev/home-harness/redemption-second-factor/page.tsx` — `?gate=`
  `details` (default, current visual spec), `email-code`, `ready`.
- `tests/e2e/customer-redemption-second-factor.spec.ts`

The existing visual spec must keep passing on the default gate.

### Cases

1. Default / `gate=details`: email field, no collection QR (current behaviour).
2. `gate=email-code`: “Confirm your email”, OTP field, no collection QR.
3. `gate=ready` with route-mocked `qr.png` and status JSON: collection QR
   appears and “Ready for merchant scan.” is visible.

### Deferred

- Live OTP → `email_verified_at` → minted scan token remains
  `tests/db` / reward-collection live-db. A new `@customer-flow` skip would
  exceed the current skip ceiling.

### Acceptance

- Harness stays `NODE_ENV !== "production"`.
- Default DB-free e2e CI can run both the visual spec and the new spec.

### Ready-to-paste PR body

```md
## Summary

- Extend the redemption-second-factor harness with `email-code` and `ready`
  gates so Playwright can prove the collection QR stays hidden until the
  profile is complete, then appears.
- Keep the existing visual spec on the default incomplete-profile gate.

## Verification

- [ ] `pnpm typecheck`
- [ ] Playwright: `tests/e2e/customer-redemption-second-factor/visual.spec.ts`
- [ ] Playwright: `tests/e2e/customer-redemption-second-factor.spec.ts`

## Design System

- [ ] `DESIGN.md`, `app/globals.css`, and shared components remain aligned when UI changes.
- [ ] Copy stays plain British English with no emoji or exclamation marks.
```

## PR-D — Loyalty invite accept (`/invite/[token]`)

**Branch intent:** customer accept landing as far as is safe without new
skipped live-db tests. Writes stay in `tests/db/loyalty-invites.test.mjs`.

### Files

- `components/customer/invite-claim-panel.tsx` — shared available/expired/
  unavailable markup.
- `app/invite/[token]/page.tsx` — use the shared panel.
- `app/dev/home-harness/invite-claim/page.tsx` plus a harness start action.
- `tests/e2e/customer-invite-claim.spec.ts`
- `tests/contracts/dev-route-production-guard.test.mjs`

### Cases

1. Real `/invite/not-a-real-token` shows the unavailable copy (RPC miss or
   error collapses to unavailable; not an existence oracle).
2. Harness `?state=available` shows “Two stamps to start your card” and
   Collect; submitting the harness action reaches a claimed handoff state
   without writing membership rows.
3. Harness `?state=expired` and `?state=unavailable` show the matching copy.
4. `@a11y` on available and unavailable harness states.

### Deferred

- Open invite → OTP → two welcome stamps → `/card/{id}` needs a seeded
  recipient and `CUSTOMER_FLOW_E2E`. Existing customer-join live-db already
  covers phone OTP and membership. Invite cookie + `claim_loyalty_invite`
  remain db-owned.

### Acceptance

- No pretended write proofs. Default DB-free e2e CI can run the spec.

### Ready-to-paste PR body

```md
## Summary

- Share the customer invite-claim panel so a DB-free harness can mount
  available, expired, and unavailable states.
- Prove a real unknown `/invite/[token]` stays unavailable, and that Collect
  on the harness only performs the cookie-handoff step.
- Membership writes stay in `tests/db/loyalty-invites.test.mjs`.

## Verification

- [ ] `pnpm typecheck`
- [ ] Playwright: `tests/e2e/customer-invite-claim.spec.ts`

## Design System

- [ ] `DESIGN.md`, `app/globals.css`, and shared components remain aligned when UI changes.
- [ ] Copy stays plain British English with no emoji or exclamation marks.
```

## PR-E — Email unsubscribe fronts

**Branch intent:** valid/invalid token UI and one-click HTTP semantics in the
browser without revealing whether a token exists.

### Files

- `components/customer/claim-unsubscribe-panel.tsx`
- `app/claim/unsubscribe/[token]/page.tsx` — use the shared panel after the
  existing rate-limit gate.
- `app/dev/claim-unsubscribe/page.tsx` plus a harness action that only
  redirects to `?state=done`.
- `tests/e2e/email-unsubscribe.spec.ts`
- `tests/contracts/dev-route-production-guard.test.mjs`

### Cases

1. Claim harness default → “Stop these emails?”; `?state=done` →
   “You're unsubscribed”; `?state=failed` → retry. Submit reaches `?state=done`
   without calling the suppress RPC.
2. `/invite/unsubscribe/{token}` default → “Unsubscribe”; `?done=1` →
   “You've unsubscribed”. Browser submit reaches `?done=1` (action always
   acknowledges; it is not an existence oracle).
3. `GET /api/email/unsubscribe/{kind}/{token}` with `maxRedirects: 0` → `307`
   to `/{kind}/unsubscribe/{token}` (GET never mutates).
4. `POST` with a token that fails `^[A-Za-z0-9_-]{43}$` → `400`.
5. `POST` with a well-shaped token → not `400` (`200` no-op or `503` if
   persistence is down). Response body stays empty; no existence oracle.
6. `@a11y` on the claim harness default and the invite default page.

### Deferred

- Hitting the live `/claim/unsubscribe/[token]` page in default CI needs
  rate-limit storage. Persistence and suppress-RPC proof stay in unit/DB
  suites. Do not skip-gate a live claim-page spec against the current ceiling.

### Acceptance

- Default DB-free e2e CI can run the spec. No skip-ceiling change.

### Ready-to-paste PR body

```md
## Summary

- Add Playwright coverage for invite unsubscribe UI states, a DB-free claim
  unsubscribe harness, and one-click GET/POST semantics on
  `/api/email/unsubscribe/{kind}/{token}`.
- Keep unknown tokens non-oracular: well-shaped POST is `200` or `503`, never
  a distinct “not found”. The live claim page still rate-limits through
  Supabase; its copy is proven on the harness.

## Verification

- [ ] `pnpm typecheck`
- [ ] Playwright: `tests/e2e/email-unsubscribe.spec.ts`

## Design System

- [ ] `DESIGN.md`, `app/globals.css`, and shared components remain aligned when UI changes.
- [ ] Copy stays plain British English with no emoji or exclamation marks.
```

## PR-F — Push notifications beyond settings disclosure

**Branch intent:** permission grant + subscription POST as far as Playwright
can safely fake; never flake when permissions or PushManager are missing.

### Files

- `app/dev/home-harness/push/page.tsx`
- `tests/e2e/customer-push-notifications.spec.ts`
- `tests/contracts/dev-route-production-guard.test.mjs`
- `tests/unit/service-worker-offline-cache.test.mjs` — same-origin
  notification URL sanitisation used by `notificationclick`.

### Cases

1. Anonymous `POST /api/notifications/push/subscribe` → `401`
   `{ error: "unauthenticated" }`.
2. `GET /api/notifications/push/public-key` returns JSON with `enabled`.
3. Harness mounts “Push harness” plus the real settings panel. If Enable is
   available, fake `serviceWorker.ready` + PushManager + public-key +
   subscribe and expect the subscribe POST; if the browser cannot enable
   push, assert the existing unsupported / install / blocked / attention
   copy. Never `test.skip`.
4. Unit: `safeNotificationUrl` rejects a foreign origin and keeps a
   same-origin path (the click deep-link rule). Playwright cannot reliably
   click an OS notification in every project.

### Acceptance

- No new skipped tests. Missing VAPID or PushManager is a passing UI branch,
  not a skip.

### Ready-to-paste PR body

```md
## Summary

- Add a DB-free home-harness for browser-notification settings and Playwright
  proof of unauthenticated subscribe `401`, public-key readback, and Enable
  push when the browser can fake a subscription.
- Cover notification-click URL sanitisation in the existing service-worker
  unit suite so a foreign origin cannot deep-link out of the app.
- Do not skip when permissions or PushManager are unavailable.

## Verification

- [ ] `pnpm typecheck`
- [ ] Playwright: `tests/e2e/customer-push-notifications.spec.ts`
- [ ] Unit: `tests/unit/service-worker-offline-cache.test.mjs`

## Design System

- [ ] `DESIGN.md`, `app/globals.css`, and shared components remain aligned when UI changes.
- [ ] Copy stays plain British English with no emoji or exclamation marks.
```
