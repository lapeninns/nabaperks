# APIs And Background Workers

Flows covered: 45-51.

## Axis Architecture

The API/background axis is built from small App Router route handlers that
delegate to server-only modules, Supabase RPCs, provider SDKs, and shared
rate-limit/validation helpers. These flows are less visible than pages but carry
high reliability risk because they integrate auth messaging, Web Push, Stripe,
and scheduled notification work.

## Flow Analysis

| ID  | Flow                        | Architecture                                                                                                                                        | Pitfalls                                                                                                                                                                                                                                                                   | Improvements                                                                                                                                      |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 45  | Auth email/SMS hooks        | Supabase Standard Webhooks routes dispatch OTP messages through Resend/Twilio and merchant alias mapping.                                           | SMS payload parsing, Standard Webhook rejection, malformed signed payload handling, and missing-Resend-config alias retention are locally covered; live provider delivery still needs smoke proof.                                                                         | Run target Supabase auth-hook, Resend delivery, and Twilio delivery smoke checks.                                                                 |
| 46  | Push subscription lifecycle | Customer-session gated routes manage VAPID key, subscribe, refresh, unsubscribe, disable, preferences, and prompt viewed.                           | Push consent and subscription state cross browser, service worker, customer session, and DB records; parser and route contracts now fail closed locally, duplicate subscription registration reuses one row, and marketing consent eligibility is centralized server-side. | Run browser/service-worker push lifecycle proof and target Web Push provider smoke before launch.                                                 |
| 47  | Notification readback       | Customer-session gated readback returns current customer's notification/delivery rows.                                                              | Service-role readback now derives customer id only from the current session; delivery readback joins through the real `notification_event_id` ledger column; customer delivery output maps provider response/failure detail to safe issue codes.                           | Keep the route contract, local DB exclusion, and issue-code shaping tests in the required gate set; add pagination if notification history grows. |
| 48  | Venue announcements         | Merchant-session gated route queues member announcements after preference, consent, active subscription, content-moderation, and rate-limit checks. | Route scope, content normalization/moderation, dedupe keys, and no-consent/no-subscription audience exclusion are locally covered; recipient counts and provider failures still need operator visibility.                                                                  | Run target Web Push/provider smoke and add operator-facing delivery visibility before launch.                                                     |
| 49  | Notification cron           | Bearer-secret Vercel cron worker processes due notification events and sends Web Push.                                                              | Atomic claiming, retry/backoff, checked updates, and preference-driven quiet hours are now implemented.                                                                                                                                                                    | Apply migration and run Web Push/Vercel cron smoke checks.                                                                                        |
| 50  | Stripe webhook              | Route verifies Stripe signature, records/handles billing events, updates merchant billing state.                                                    | Failed/unprocessed duplicate events now have a retry claim path.                                                                                                                                                                                                           | Run Stripe CLI replay tests for success, failed retry, and duplicate processed events.                                                            |
| 51  | Health endpoint             | Lightweight liveness route.                                                                                                                         | Response now explicitly reports `scope: "liveness"` and remains dependency-free.                                                                                                                                                                                           | Add a separate authenticated readiness probe only if operations need dependency checks.                                                           |

## Trust Boundaries

- Supabase webhooks must verify signature before dispatching auth messages.
- Stripe webhooks must verify Stripe signature before state changes.
- Cron route must require bearer secret.
- Push routes must derive customer from session.
- Provider responses are untrusted external outcomes and need idempotent state
  transitions.

## Verification Gaps

- Auth-hook Standard Webhook rejection and signed malformed-payload route tests are local; live Supabase auth-hook invocation and provider delivery still need target proof.
- Stripe replay/failure/retry tests.
- Notification worker concurrent claim tests.
- Push consent and subscription lifecycle tests.
- Cron auth, Web Push delivery, and provider failure smoke tests in the target environment.

## Priority

P1 for Stripe failed-event replay and notification atomic claiming.
