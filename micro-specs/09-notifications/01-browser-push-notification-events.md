---
spec_id: MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS
status: active
risk_class: rls-rpc-ledger
owner: factory-droid
last_reviewed: 2026-06-22
allowed_blast_radius:
  - app/api/cron/**
  - app/api/notifications/**
  - app/app/announcements/**
  - app/home/**
  - components/customer/**
  - components/pwa/**
  - config/env-contract.json
  - lib/analytics/events.ts
  - lib/customer/**
  - lib/env/**
  - lib/merchant/**
  - lib/notifications/**
  - micro-specs/09-notifications/01-browser-push-notification-events.md
  - micro-specs/TRACEABILITY.md
  - micro-specs/traceability.json
  - package.json
  - public/sw.js
  - supabase/migrations/**
  - supabase/tests/**
  - tests/e2e/**
  - tests/micro-specs/**
  - vercel.json
implementation_surfaces:
  - app/api/cron/**
  - app/api/notifications/**
  - app/app/announcements/**
  - app/home/**
  - components/customer/**
  - components/pwa/**
  - config/env-contract.json
  - lib/analytics/events.ts
  - lib/customer/**
  - lib/env/**
  - lib/merchant/**
  - lib/notifications/**
  - public/sw.js
  - supabase/migrations/**
  - supabase/tests/**
  - tests/e2e/**
  - tests/micro-specs/**
  - vercel.json
related_docs:
  - docs/PROJECT_SPEC.md
  - docs/ARCHITECTURE.md
  - docs/OBSERVABILITY.md
  - micro-specs/GLOBAL_CONTEXT.md
  - DESIGN.md
  - .omo/plans/browser-push-notification-events.md
  - .omo/drafts/browser-push-notification-events.md
related_tests:
  - tests/micro-specs/browser-push-notification-events.test.ts
verification_gates:
  - pnpm governance
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm db:verify
  - pnpm security:verify
  - npx playwright test
  - pnpm build
approved_exceptions: []
---

# Micro-Spec: Browser Push Notification Events

## Governance Status Evidence

- Lifecycle status: `active` after the browser push plan and decision ledger were reviewed on 2026-06-22.
- Evidence posture: implementation must use Red -> Green -> Refactor and keep task evidence under `.omo/evidence/task-<N>-browser-push-notification-events.*`.
- Platform sources checked before implementation: [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [MDN Using the Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API), [WebKit Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), and [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs).
- Stale/superseded handling: this spec narrows earlier push-reminder exclusions to browser/PWA Web Push only. It does not supersede loyalty, profile gate, or reward ownership rules.

## Exact Goal and User-Visible Outcomes

Customers who opt in can receive browser/PWA Web Push messages for loyalty progress, reward readiness, reward expiry, and consented venue announcements. Loyalty state remains server-side and authoritative when the browser does not support push, permission is denied, a subscription fails, or delivery is delayed.

## Blast Radius

In scope:

- Browser/PWA Web Push only.
- Web Push permission and subscription lifecycle.
- Customer push preferences and explicit marketing push preference.
- Server-side notification event ledger and per-subscription delivery ledger.
- Reward expiry state that is separate from reward scan-token expiry.
- Scheduled best-effort delivery worker on Vercel Cron.
- Transactional progress events: `one_stamp_away`, `next_stamp_available`, `reward_unlocked_waiting`, `reward_ready`, `profile_required_to_collect`, `reward_expiring_soon`, `reward_expired`, `reward_collected_cycle_started`.
- Marketing-gated events: `dormant_progress` and `venue_announcement`.
- Lifecycle events: `push_permission_prompt_viewed`, `push_permission_granted`, `push_subscription_created`, `push_subscription_disabled`, `push_subscription_failed`.

Out of scope:

- Do not implement native apps.
- Do not implement Firebase.
- Do not implement OneSignal.
- Do not implement SMS.
- Do not implement WhatsApp.
- Do not implement email.
- Do not implement passive near-venue/background geofencing.
- Do not store raw coordinates for notification targeting.
- Do not weaken RLS, reward ownership, profile gate, one-stamp-per-UK-business-day, or merchant-scan reward confirmation.
- Do not mutate hosted Supabase during QA unless explicitly approved.

## Strict Constraints and Assumptions

- Browser permission is requested only after an intentional customer action.
- Push support is optional; unsupported, denied, expired, or failed subscriptions must not block stamps or rewards.
- Marketing, venue announcements, dormant-progress, and winback-style notifications require explicit marketing consent plus push preference, implemented as a dedicated marketing push preference.
- Transactional reward and stamp notifications require browser permission, an enabled subscription, and the matching transactional or reminder push preference.
- Reward expiry is real reward expiry stored on the assigned reward event, not `reward_scan_tokens.expires_at`.
- Default reward expiry is no automatic expiry unless a merchant/card/reward configuration defines one.
- Notification targeting must never use raw customer latitude or longitude.
- Every send attempt is auditable by customer, merchant, membership, event type, due time, and subscription.
- Delivery is best effort; the server ledger is the source of truth.

## Behavioral Requirements

- **MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS-001** WHEN a browser cannot receive push because support is missing, permission is denied, or a subscription send fails, THE system SHALL preserve loyalty and reward behaviour without blocking the customer.
- **MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS-002** WHEN a customer intentionally enables browser push, THE system SHALL request browser permission from that user gesture and store the subscription with server-side ownership, RLS, and sanitized subscription metadata.
- **MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS-003** WHEN permission or subscription lifecycle state changes, THE system SHALL record `push_permission_prompt_viewed`, `push_permission_granted`, `push_subscription_created`, `push_subscription_disabled`, or `push_subscription_failed` as applicable.
- **MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS-004** WHEN server-confirmed stamp or reward transitions occur, THE system SHALL enqueue `one_stamp_away`, `reward_unlocked_waiting`, `reward_ready`, `profile_required_to_collect`, and `reward_collected_cycle_started` from authoritative server state only.
- **MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS-005** WHEN scheduled due windows are processed, THE system SHALL evaluate and dedupe `next_stamp_available`, `reward_expiring_soon`, `reward_expired`, and `dormant_progress` against current eligibility before delivery.
- **MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS-006** WHEN marketing, venue announcement, dormant-progress, or winback-style push is considered, THE system SHALL require explicit marketing consent plus an enabled marketing push preference before enqueueing or sending.
- **MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS-007** WHEN reward expiry is configured, THE system SHALL snapshot the real reward expiry on the assigned reward event and SHALL NOT use `reward_scan_tokens.expires_at` as reward expiry.
- **MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS-008** WHEN a notification is enqueued or sent, THE system SHALL write durable notification event and delivery ledger records with idempotency keys scoped by customer, membership, reward, cycle, event type, and due window.
- **MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS-009** WHEN a venue announcement is created, THE system SHALL enforce merchant/admin ownership, message limits, rate limits, preview, and marketing-consent gates before enqueueing `venue_announcement`.
- **MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS-010** WHEN the service worker receives push, notificationclick, or subscriptionchange events, THE system SHALL handle them without changing server-state caching rules or relying on passive background geofencing.

## Verification Criteria

Acceptance criteria:

- Customer settings expose unsupported, denied, granted, and subscribed states without blocking loyalty.
- Subscription create/disable/failure and permission events are captured in the ledger.
- Reward expiry uses assigned reward event state and stays distinct from reward scan-token expiry.
- The scheduled worker sends due eligible events only once per dedupe window.
- Marketing-gated pushes require marketing consent and enabled marketing push preference.
- Venue announcements can target only consented customers for the merchant's own venue.
- Analytics and logs avoid raw phone numbers, secrets, tokens, raw coordinates, and full subscription keys.

Manual QA:

- Mock unsupported browser support and confirm no prompt or broken loyalty UI.
- Mock denied permission and confirm calm disabled copy.
- Mock granted permission and subscription creation.
- Mock existing subscription and preference updates.
- Run scheduled delivery only against local/disposable database state.

Task breakdown:

- Add this micro-spec and traceability entry.
- Add service worker push lifecycle handlers.
- Add schema, RLS, SQL tests, and reward expiry columns.
- Add notification enqueue/delivery domain code.
- Add authenticated subscription and preferences endpoints.
- Add Vercel Cron delivery route.
- Add customer settings UI.
- Add merchant/admin venue announcement flow.
- Add analytics, observability, and QA evidence.
