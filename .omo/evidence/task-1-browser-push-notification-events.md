# Task 1 Evidence: Browser Push Notification Events Micro-Spec

## Scope

- Added governance coverage for `MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS`.
- Bound the implementation to browser/PWA Web Push only.
- Explicitly excluded native apps, Firebase, OneSignal, SMS, WhatsApp, email, passive near-venue/background geofencing, and raw-coordinate targeting.
- Captured the split between transactional/reminder push preference and marketing consent plus marketing push preference.
- Captured reward expiry as assigned reward state, not `reward_scan_tokens.expires_at`.

## Platform Sources Checked

- MDN Push API: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- MDN Notifications API usage: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
- WebKit Web Push for Web Apps on iOS and iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- WebKit Declarative Web Push context: https://webkit.org/blog/16535/meet-declarative-web-push/
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs

## Red

- `pnpm test -- tests/micro-specs/browser-push-notification-events.test.ts`
- Expected failure: `micro-specs/09-notifications/01-browser-push-notification-events.md` was missing and `MS-NOTIFICATIONS-BROWSER-PUSH-EVENTS` was not registered in `micro-specs/traceability.json`.

## Green

- `pnpm test -- tests/micro-specs/browser-push-notification-events.test.ts`
- Result: passed. The command currently invokes the full Vitest micro-spec suite through the repo script; all 82 files / 679 tests passed.
- `pnpm governance`
- Result: passed all 12 governance checks, including Micro-Spec metadata, traceability JSON, traceability Markdown, ordering, and evidence map.

## Refactor

- Kept the spec split between lifecycle, transactional/reminder, reward-expiry, marketing-gated, and service-worker requirements so later implementation tasks can map evidence without widening the blast radius.
