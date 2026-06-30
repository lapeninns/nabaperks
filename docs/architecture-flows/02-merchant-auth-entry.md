# Merchant Auth And Entry Flows

Flows covered: 9-15.

## Axis Architecture

Merchant entry is split between public auth pages, server actions, Supabase
Auth, custom merchant email alias codes, and the merchant app layout gate.
`/app/layout.tsx` is the durable product boundary: anonymous users are redirected
to merchant login, authenticated users get the merchant shell, and onboarding
fills the merchant/location records before setup continues.

## Flow Analysis

| ID | Flow | Architecture | Pitfalls | Improvements |
| --- | --- | --- | --- | --- |
| 9 | Merchant signup `/signup` | Public form posts to server action, creates Supabase Auth user, and relies on email confirmation/alias verification. | Alias code retention has been hardened with expired-row cleanup and consumed-token scrubbing. | Apply the cleanup migration in target Supabase and add provider-level auth hook smoke tests. |
| 10 | Merchant login `/login` | Password login server action redirects through safe merchant next-path handling. | Redirect sanitization should stay consistent across login and confirmation flows. | Share one safe merchant redirect helper across login, auth confirm, and protected layout redirects. |
| 11 | Password reset `/reset-password` | Supabase recovery email plus custom alias verification, then password update. | Reset path now shares the alias cleanup/retention policy. | Add reset-specific integration tests for expired, wrong, consumed, and replayed codes. |
| 12 | Merchant sign-out | Server action clears Supabase session and returns user to public/auth surface. | Sign-out is usually simple, but it is embedded into shell variants; future shells can accidentally omit it. | Keep sign-out wired through `MerchantAppShell` contract and smoke-test setup/full shell variants. |
| 13 | Auth confirmation `/auth/confirm` | Supabase token/code callback verifies auth state and redirects to safe destination or login error. | Redirect policy can drift from login safe-next policy. | Unify redirect helper and add blocked-path tests for auth, admin, external, and malformed next values. |
| 14 | Merchant onboarding `/app/onboarding` | Authenticated page/action creates or reuses merchant and primary location, then persists venue location details. | Completion now requires populated venue address fields and geofence coordinates when geofencing is required. | Longer-term option: move full onboarding persistence into one transactional RPC. |
| 15 | Start resolver `/start` | Session dispatcher routes merchant users to `/app`, admin users to `/admin`, customer-cookie users to `/home`. | Resolver remains non-authoritative; anonymous `/app`, `/home`, and `/admin` destination re-gating now has Playwright smoke coverage. | Keep `/start` as convenience only, document session precedence, and keep destination-gate smoke in sync with future launch targets. |

## Trust Boundaries

- Browser form data is untrusted and must be parsed in server actions.
- Supabase Auth owns primary merchant identity.
- Alias tables bridge product-friendly codes to Supabase tokens and therefore
  need strict retention and service-role access.
- `/app/layout.tsx` owns merchant console access, not individual child pages
  alone.

## Verification Gaps

- Signup, login, password reset, and confirmation action tests.
- OTP alias expiry/collision/replay tests.
- Onboarding partial-write recovery tests.
- Protected merchant route redirect smoke tests.

## Priority

P1 before wider pilot. Auth shape is coherent, but alias retention and partial
onboarding completion are reliability/security risks.
