import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
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

function notificationMigrationSource() {
  const directory = path.join(projectRoot, "supabase", "migrations")
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(path.join(directory, name), "utf8"))
    .join("\n")
}

test("Given a notification is reclaimed When the stale worker settles Then every write is fenced by its claim token", () => {
  // Given
  const worker = readProjectFile("lib", "notifications", "delivery-worker.ts")
  const migrations = notificationMigrationSource()

  // When / Then
  assert.ok(
    migrations.includes("lease_token uuid"),
    "lease token column is declared"
  )
  assert.ok(
    /claim_due_notification_events[\s\S]*returns table[\s\S]*lease_token uuid/.test(
      migrations
    ),
    "claim RPC returns the current lease token"
  )
  assert.ok(
    /settle_notification_event[\s\S]*p_lease_token uuid[\s\S]*status = 'delivering'[\s\S]*lease_token = p_lease_token/.test(
      migrations
    ),
    "settlement compares the current delivering lease"
  )
  assert.match(worker, /lease_token: string/)
  assert.match(worker, /p_lease_token: event\.lease_token/)
  assert.doesNotMatch(
    worker,
    /\.from\("notification_events"\)[\s\S]{0,300}\.update\(/
  )
})

test("Given Web Push reports success When the worker records it Then the current lease and one-success ledger fence are atomic", () => {
  // Given
  const worker = readProjectFile("lib", "notifications", "delivery-worker.ts")
  const migrations = notificationMigrationSource()

  // When / Then
  assert.ok(
    /create unique index if not exists notification_deliveries_one_sent_per_subscription_idx[\s\S]{0,300}on public\.notification_deliveries[\s\S]{0,300}notification_event_id[\s\S]{0,150}push_subscription_id[\s\S]{0,150}where status = 'sent'/.test(
      migrations
    ),
    "one successful ledger row is enforced per event and subscription"
  )
  assert.ok(
    /record_notification_delivery[\s\S]*p_lease_token uuid[\s\S]*for update[\s\S]*lease_token is distinct from p_lease_token/.test(
      migrations
    ),
    "delivery recording locks and compares the current lease"
  )
  assert.match(worker, /record_notification_delivery/)
  assert.match(worker, /p_lease_token: event\.lease_token/)
  assert.match(worker, /NotificationLeaseLostError/)
})
