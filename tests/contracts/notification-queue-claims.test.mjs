import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Given the push worker runs in parallel When due notifications are claimed Then SQL locks and marks rows atomically", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630121000_claim_due_notification_events.sql"
  )
  const worker = readProjectFile("lib", "notifications", "delivery-worker.ts")

  assert.match(migration, /claim_due_notification_events/)
  assert.match(migration, /for update skip locked/)
  assert.match(migration, /set status = 'delivering'/)
  assert.match(worker, /rpc\(\s*"claim_due_notification_events"/)
  assert.doesNotMatch(
    worker,
    /\.from\("notification_events"\)\s*\.select\([\s\S]*\.eq\("status", "queued"\)/
  )
})

test("Given a claimed notification lands in quiet hours When it is deferred Then the worker returns it to queued", () => {
  const worker = readProjectFile("lib", "notifications", "delivery-worker.ts")

  assert.match(
    worker,
    /const preferences = await getPreferences\(supabase, event\.customer_id\)/
  )
  assert.match(
    worker,
    /preferences\.quietHoursStart \?\? undefined[\s\S]*preferences\.quietHoursEnd \?\? undefined/
  )
  assert.match(
    worker,
    /nextQuietHoursEnd\(now, preferences\.quietHoursEnd \?\? undefined\)/
  )
  assert.match(
    worker,
    /\.update\(\{ status: "queued", due_at: nextDueAt\.toISOString\(\) \}\)/
  )
})

test("Given push delivery fails temporarily When no subscription succeeds Then the worker schedules a bounded retry", () => {
  const worker = readProjectFile("lib", "notifications", "delivery-worker.ts")

  assert.match(worker, /const MAX_PUSH_DELIVERY_ATTEMPTS = 3/)
  assert.match(
    worker,
    /const PUSH_RETRY_BACKOFF_MS = \[5 \* 60_000, 30 \* 60_000\]/
  )
  assert.match(worker, /nextDeliveryAttemptNumber\(supabase, event\.id\)/)
  assert.match(
    worker,
    /retryableFailures > 0[\s\S]*attemptNumber < MAX_PUSH_DELIVERY_ATTEMPTS/
  )
  assert.match(
    worker,
    /deferEvent\(supabase, event\.id, nextRetryDueAt\(now, attemptNumber\)\)/
  )
  assert.match(worker, /p_attempt_number: attemptNumber/)
  assert.doesNotMatch(worker, /p_attempt_number: 1,\s*\n\s*p_response_status/)
})

test("Given notification ledger writes fail When worker helpers update Supabase Then errors are checked instead of swallowed", () => {
  const worker = readProjectFile("lib", "notifications", "delivery-worker.ts")

  assert.match(worker, /Unable to record notification delivery/)
  assert.match(worker, /p_notification_event_id: event\.id/)
  assert.doesNotMatch(worker, /p_event_id: event\.id/)
  assert.match(worker, /Unable to mark notification event/)
  assert.match(worker, /Unable to defer notification event/)
  assert.match(worker, /push_subscription_disable_failed/)
})

test("Given notification readback uses service-role access When a request includes inputs Then customer scope comes only from the current session", () => {
  const route = readProjectFile(
    "app",
    "api",
    "notifications",
    "readback",
    "route.ts"
  )
  const readback = readProjectFile("lib", "notifications", "readback.ts")
  const readbackCore = readProjectFile(
    "lib",
    "notifications",
    "readback-core.ts"
  )
  const deliveryPublicType = readbackCore.slice(
    readbackCore.indexOf("export type CustomerNotificationDeliveryReadback ="),
    readbackCore.indexOf(
      "export type CustomerNotificationDeliveryReadbackSource ="
    )
  )

  assert.match(route, /const customer = await getCurrentCustomer\(\)/)
  assert.match(
    route,
    /if \(!customer\) return json\(\{ error: "unauthenticated" \}, 401\)/
  )
  assert.match(route, /customerId: customer\.id/)
  assert.match(route, /searchParams\.get\("limit"\)/)
  assert.doesNotMatch(route, /searchParams\.get\("customer/)
  assert.doesNotMatch(route, /request\.json\(/)

  assert.match(
    readback,
    /\.from\("notification_events"\)[\s\S]*\.eq\("customer_id", customerId\)/
  )
  assert.match(
    readback,
    /\.from\("notification_deliveries"\)[\s\S]*\.eq\("customer_id", customerId\)[\s\S]*\.in\("notification_event_id", eventIds\)/
  )
  assert.match(readback, /notification_event_id/)
  assert.match(readback, /shapeCustomerNotificationDeliveryReadback/)
  assert.match(deliveryPublicType, /issue: CustomerNotificationDeliveryIssue/)
  assert.doesNotMatch(deliveryPublicType, /responseStatus|failureReason/)
  assert.doesNotMatch(readback, /\.in\("event_id", eventIds\)/)
  assert.doesNotMatch(readback, /"event_id, status/)
})

test("Given push subscription routes mutate service-role state When source is inspected Then customer scope and lifecycle reasons are fixed", () => {
  const subscribe = readProjectFile(
    "app",
    "api",
    "notifications",
    "push",
    "subscribe",
    "route.ts"
  )
  const refresh = readProjectFile(
    "app",
    "api",
    "notifications",
    "push",
    "refresh",
    "route.ts"
  )
  const unsubscribe = readProjectFile(
    "app",
    "api",
    "notifications",
    "push",
    "unsubscribe",
    "route.ts"
  )
  const disable = readProjectFile(
    "app",
    "api",
    "notifications",
    "push",
    "disable",
    "route.ts"
  )
  const promptViewed = readProjectFile(
    "app",
    "api",
    "notifications",
    "push",
    "prompt-viewed",
    "route.ts"
  )
  const preferences = readProjectFile(
    "app",
    "api",
    "notifications",
    "push",
    "preferences",
    "route.ts"
  )

  for (const route of [
    subscribe,
    refresh,
    unsubscribe,
    disable,
    promptViewed,
    preferences,
  ]) {
    assert.match(route, /const customer = await getCurrentCustomer\(\)/)
    assert.match(
      route,
      /if \(!customer\) return json\(\{ error: "unauthenticated" \}, 401\)/
    )
    assert.match(route, /headers: \{ "cache-control": "no-store, max-age=0" \}/)
    assert.doesNotMatch(route, /customerId:\s*(body|request)/)
  }

  assert.match(subscribe, /key: `push-subscribe:\$\{customer\.id\}`/)
  assert.match(
    subscribe,
    /validatePushSubscriptionInput\(subscriptionBody\(body\)\)/
  )
  assert.match(subscribe, /customerId: customer\.id/)

  assert.match(refresh, /key: `push-refresh:\$\{customer\.id\}`/)
  assert.match(refresh, /validatePushEndpoint\(oldEndpointBody\(body\)\)/)
  assert.match(refresh, /reason: "subscription_refreshed"/)
  assert.match(
    refresh,
    /validatePushSubscriptionInput\(newSubscriptionBody\(body\)\)/
  )

  assert.match(unsubscribe, /key: `push-unsubscribe:\$\{customer\.id\}`/)
  assert.match(unsubscribe, /reason: "customer_disabled"/)

  assert.match(disable, /key: `push-disable:\$\{customer\.id\}`/)
  assert.match(disable, /reason: "service_worker_disabled"/)

  assert.match(promptViewed, /key: `push-prompt-viewed:\$\{customer\.id\}`/)
  assert.match(promptViewed, /recordPushPermissionPromptViewed\(customer\.id\)/)

  assert.match(preferences, /key: `push-preferences:\$\{customer\.id\}`/)
  assert.match(
    preferences,
    /updateCustomerNotificationPreferences\(\{[\s\S]*customerId: customer\.id/
  )
})

test("Given one customer receives many push events When enqueue and delivery run Then a rolling per-customer frequency cap applies", () => {
  const events = readProjectFile("lib", "notifications", "events.ts")
  const worker = readProjectFile("lib", "notifications", "delivery-worker.ts")
  const cap = readProjectFile("lib", "notifications", "frequency-cap.ts")
  const capCore = readProjectFile(
    "lib",
    "notifications",
    "frequency-cap-core.ts"
  )

  assert.match(capCore, /CUSTOMER_DAILY_NOTIFICATION_CAP = 6/)
  assert.match(capCore, /NOTIFICATION_CAP_WINDOW_MS = 24 \* 60 \* 60 \* 1000/)
  assert.match(
    capCore,
    /NOTIFICATION_ENQUEUE_CAP_STATUSES = \[[\s\S]*"queued",[\s\S]*"delivering",[\s\S]*"sent",?[\s\S]*\] as const/
  )
  assert.match(
    capCore,
    /NOTIFICATION_DELIVERY_CAP_STATUSES = \["sent"\] as const/
  )
  assert.match(cap, /from "@\/lib\/notifications\/frequency-cap-core"/)
  assert.match(cap, /customerNotificationFrequencyCapReached/)
  assert.match(cap, /customerNotificationDeliveryCapReached/)
  assert.match(cap, /statuses: NOTIFICATION_ENQUEUE_CAP_STATUSES/)
  assert.match(cap, /statuses: NOTIFICATION_DELIVERY_CAP_STATUSES/)
  assert.match(events, /customerNotificationFrequencyCapReached/)
  assert.match(events, /notification_frequency_cap/)
  assert.match(worker, /customerNotificationDeliveryCapReached/)
  assert.match(worker, /nextNotificationFrequencyWindow\(now\)/)
  assert.match(worker, /notification_frequency_cap/)
  assert.doesNotMatch(
    worker,
    /customerNotificationFrequencyCapReached\(supabase, \{[\s\S]*excludeEventId: event\.id/
  )
})

test("Given one endpoint succeeds and another fails temporarily When the event retries Then only unsent subscriptions are retried", () => {
  const worker = readProjectFile("lib", "notifications", "delivery-worker.ts")

  assert.match(worker, /filterAlreadySentSubscriptions/)
  assert.match(
    worker,
    /\.from\("notification_deliveries"\)[\s\S]*\.eq\("notification_event_id", eventId\)[\s\S]*\.eq\("status", "sent"\)/
  )
  assert.match(worker, /sentSubscriptionIds/)
  assert.match(
    worker,
    /const previouslySentCount = Math\.max\([\s\S]*enabledSubscriptions\.length - subscriptions\.length,[\s\S]*0[\s\S]*\)/
  )
  assert.match(
    worker,
    /const totalSentForEvent = previouslySentCount \+ result\.sent/
  )
  assert.match(
    worker,
    /retryableFailures > 0 &&\s+attemptNumber < MAX_PUSH_DELIVERY_ATTEMPTS[\s\S]*deferEvent/
  )
  assert.match(worker, /else if \(totalSentForEvent > 0\)/)
  assert.doesNotMatch(worker, /else if \(result\.sent > 0\)/)
  assert.doesNotMatch(
    worker,
    /if \(result\.sent > 0\) \{\s+await markEvent\(supabase, event\.id, "sent"\)\s+\} else if \(\s+retryableFailures > 0/
  )
})
