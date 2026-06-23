---
slug: browser-push-notification-events
status: complete
intent: clear
pending-action: none; implementation and final verification completed
approach: Add opt-in browser Web Push as an auditable notification subsystem, triggered only from confirmed server loyalty state transitions plus scheduled due-event jobs.
---

# Draft: browser-push-notification-events

## Components (topology ledger)
| id | outcome | status | evidence path |
| --- | --- | --- | --- |
| C1 | Web Push capability and service-worker handlers exist without weakening the current offline/network-only PWA rules. | complete | `.omo/evidence/task-2-browser-push-notification-events.md` |
| C2 | Customer browser subscriptions and notification preferences are persisted server-side with RLS-safe access and durable opt-out. | complete | `.omo/evidence/task-3-browser-push-notification-events.md` |
| C3 | Notification event ledger dedupes all sends by event type, customer, membership/reward/cycle, and due window. | complete | `.omo/evidence/task-4-browser-push-notification-events.md` |
| C4 | Reward expiry is first-class server state, snapshotted onto assigned `reward_events`, visible in customer/merchant terms, and available to scheduled jobs. | complete | `.omo/evidence/task-5-browser-push-notification-events.md` |
| C5 | Transactional loyalty triggers enqueue push events only after confirmed stamp/reward/profile state transitions. | complete | `.omo/evidence/task-6-browser-push-notification-events.md`, `.omo/evidence/task-7-browser-push-notification-events.md` |
| C6 | Scheduled notification worker sends due reminders, handles expiry, prunes dead subscriptions, and records delivery outcomes. | complete | `.omo/evidence/task-9-browser-push-notification-events.md` |
| C7 | Customer-facing settings and permission UX are opt-in, reversible, unsupported-browser safe, and separate from marketing consent. | complete | `.omo/evidence/task-10-browser-push-notification-events.md` |
| C8 | Product analytics and operational observability make notification funnel, delivery, failures, and opt-outs auditable without raw PII. | complete | `.omo/evidence/task-12-browser-push-notification-events.md` |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
| --- | --- | --- | --- |
| Browser only | Use standards-based Web Push for installed/capable browsers; do not introduce native mobile apps, Firebase, OneSignal, or SMS/WhatsApp for this lane. | User clarified browser-based direction; repo already has a PWA shell. | Yes |
| Browser support | Treat Web Push as progressive enhancement: supported Chromium/Firefox/Safari browsers can subscribe, while iOS/iPadOS requires the installed Home Screen web-app path and a user-initiated permission prompt. | Push capability varies by browser/platform; denied or unsupported push must never block loyalty. | Yes |
| Near-venue event | Do not implement passive "near venue" background push. Replace it with in-app/QR-driven location prompts only when the app is open and the user has explicitly granted permission. | Browsers cannot reliably background geofence a web app, and the product already uses soft GPS only as a stamp/reward review signal. | Yes, with native app or explicit web capability research |
| Consent split | Browser permission plus notification preferences control transactional/reminder push; existing marketing consent remains required for venue announcements, dormant/winback campaigns, or offers. | Current consent records are marketing-only and loyalty participation must stay separate from marketing opt-in. | Yes |
| Reward expiry default | Add expiry fields but default to no automatic expiry until a merchant/card/reward setting is configured. | Current specs only mention displayed expiry terms and explicitly exclude automated expiry. | Yes |
| Delivery semantics | Push delivery is best-effort; server event ledger is the source of truth, not the browser. | Push can be delayed, denied, or stale; loyalty state must stay server authoritative. | No |
| Hosted data | Verification must use tests and local/disposable Supabase only unless the user explicitly approves hosted data mutation. | Existing Nabaperks QA memory requires local/disposable DB proof for schema/RPC lanes. | No |
| Notification target | Send each eligible event to all of the customer's enabled subscriptions/devices, with membership/reward/merchant scope captured in the payload and delivery rows. | Customers can use multiple devices; event dedupe and delivery attempts are different concerns. | Yes |

## Findings (cited - path:lines)
- `public/sw.js:23-61` registers install, activate, and fetch handlers only. There is no `push`, `notificationclick`, or subscription cleanup handling.
- `components/pwa/app-pwa.tsx:139-157` already registers `/sw.js` at scope `/`, so Web Push can extend the existing PWA layer instead of introducing a second worker.
- `app/manifest.ts:6-74` already declares a standalone manifest with icons and shortcuts.
- `package.json:86-110` has no `web-push`, Firebase, or OneSignal dependency.
- `lib/customer/consent.ts:6-12` and `supabase/migrations/20260606142000_initial_schema_rls.sql:210-220` restrict consent channels to `email`, `sms`, and `whatsapp`.
- `components/customer/profile-marketing-consent.tsx:41-45` tells customers marketing toggles are optional and do not affect stamps or rewards.
- `micro-specs/07-observability-compliance/02-consent-legal-pages-and-data-requests.md:80-83` requires loyalty participation and marketing opt-in to stay separate and requires reward expiry display where available.
- `micro-specs/03-customer/02-digital-stamp-card.md:67-72` currently excludes push notifications and automated reminders.
- `micro-specs/04-staff-rewards/02-reward-unlock-and-redemption.md:70-74` currently excludes automated reward expiry beyond displayed merchant terms, while `supabase/migrations/20260606142000_initial_schema_rls.sql:167-168` already allows `expired` reward status.
- `app/card/[membershipId]/actions.ts:35-62` receives `newStampCount` and `rewardUnlocked` after a confirmed stamp RPC, making it a safe trigger point for one-away/reward-unlocked enqueueing.
- `lib/customer/stamp.ts:49-70` centralizes `issueSelfServiceStamp` and returns trusted server results.
- `supabase/migrations/20260617110000_backend_hardening.sql:18-40` defines short-lived `reward_scan_tokens.expires_at`; this is scan-token expiry, not customer reward expiry.
- `supabase/migrations/20260617110000_backend_hardening.sql:116-227` creates reward scan tokens only after ownership, redeemable date, card, profile, merchant, and billing checks pass.
- `supabase/migrations/20260617110000_backend_hardening.sql:379-445` collects a reward through `collect_reward_scan_token`, which calls `redeem_self_service_reward` before marking a token consumed.
- `supabase/migrations/20260615120000_customer_profile_completion.sql:97-131` treats already redeemed rewards idempotently and enforces the profile gate before first redemption.
- `lib/customer/rewards.ts:43-89` filters customer rewards to `unlocked` and `redeemed`, so the implementation must define expired reward readback and UI behavior when expiry becomes real state.
- `lib/analytics/events.ts:5-25` lists current product events and `lib/analytics/events.ts:40-58` persists Supabase product events before best-effort PostHog capture.
- Implementation references must include current MDN Push/Notification API docs, WebKit iOS/iPadOS Web Push docs, and Vercel Cron/runtime docs before coding browser/platform behavior.

## Decisions (with rationale)
- Use VAPID Web Push with a small server wrapper rather than a hosted notification SaaS. The repo already owns customer identity, consent, and PWA registration; VAPID keeps the first version auditable and avoids syncing loyalty PII to a vendor.
- Add a notification ledger instead of sending inline from stamp/reward actions. Loyalty mutations must stay fast and deterministic; enqueueing with idempotency lets a cron worker retry safely.
- Model browser subscriptions separately from marketing consent. Browser permission is device-level capability; marketing consent is a legal preference. Transactional reward/stamp messages can be preference-controlled without silently expanding marketing consent.
- Treat reward expiry as assigned reward state. Expiry must snapshot onto `reward_events` so merchant edits do not move the date for rewards already earned.
- Do not send a passive "you are near the venue" push. Use in-app copy after app open, QR scan, or explicit geolocation attempt; anything else is unreliable in browsers and conflicts with the soft-geofence trust model.
- Include "expiring soon" as a first-class due event, not just copy. The system must dedupe at least 72-hour and 24-hour reminders and never send after redemption/expiration.

## Scope IN
- New browser push micro-spec and traceability updates.
- VAPID env contract, Web Push dependency, and Vercel cron/runtime constraints.
- Service worker `push`, `notificationclick`, `pushsubscriptionchange`, and stale-subscription failure handling.
- Customer notification preferences and browser subscription API routes/actions.
- Notification event/delivery tables with RLS, service-role-only mutation boundaries, idempotency keys, and indexes.
- Reward expiry configuration and `reward_events.expires_at` snapshot.
- Event types:
  - `push_permission_prompt_viewed`
  - `push_permission_granted`
  - `push_subscription_created`
  - `push_subscription_disabled`
  - `push_subscription_failed`
  - `one_stamp_away`
  - `next_stamp_available`
  - `reward_unlocked_waiting`
  - `reward_ready`
  - `profile_required_to_collect`
  - `reward_expiring_soon`
  - `reward_expired`
  - `reward_collected_cycle_started`
  - `dormant_progress`
  - `venue_announcement`
- Trigger sources:
  - confirmed self-service stamp issue,
  - confirmed reward unlock,
  - confirmed reward collection,
  - profile-gate state,
  - scheduled due-event scans,
  - explicit merchant/admin venue announcement action.
- Customer settings UI on the customer home/profile surface.
- Agent-executed unit, SQL, route-handler, service-worker, and Playwright verification with mocked Push APIs.

## Scope OUT (Must NOT have)
- No native app, Firebase Cloud Messaging, OneSignal, SMS, WhatsApp, or email implementation in this lane.
- No passive background GPS/geofence push.
- No raw customer coordinates stored for notification targeting.
- No notification send without browser permission and stored enabled subscription.
- No marketing/announcement/dormant push without explicit marketing consent and push preference.
- No cached/offline stamp or reward mutation.
- No weakening of RLS, profile gate, reward ownership, one-stamp-per-UK-business-day, or server-confirmed redemption.
- No hosted Supabase mutation during QA without explicit user approval.
- No confusion between 10-minute reward scan-token expiry and actual assigned reward expiry.

## Open questions
- Default reward expiry duration: the plan uses "no automatic expiry unless configured" and proposes merchant-configured days. Product should decide the pilot default before enabling expiry in production.
- Quiet hours: the plan uses Europe/London 09:00-20:00 for reminders and announcements unless merchant-specific hours exist later.
- Venue announcement moderation: the first implementation should keep this admin/merchant-controlled with rate caps; broader campaign tooling can be later.

## Approval gate
status: complete
Implementation and final verification are recorded in `.omo/evidence/task-1-browser-push-notification-events.md` through `.omo/evidence/task-13-browser-push-notification-events.md`.
