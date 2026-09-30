import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * The live-DB email journeys reset the send buckets they share between runs
 * (tests/e2e/helpers/customer-join-email-live-db.ts cleanupEmailJoinRows).
 * When admission moved from two constant "global" buckets to network-source
 * windows plus a platform-wide cap (QA BUG-003), the cleanup kept deleting the
 * retired keys, so every local run left the new ones counting up. This pins
 * the cleanup to the keys the app and the admission RPC actually debit: every
 * shared send bucket in admitSend, instantiated for a loopback browser (no
 * trusted client IP, so IP and network source are both `unknown`), and every
 * fixed platform key in the newest admission migration.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (...parts) => readFileSync(path.join(root, ...parts), "utf8")

function admitSendBody() {
  const source = read("lib", "customer", "email-sign-in.ts")
  const start = source.indexOf("async function admitSend(")
  assert.ok(start >= 0, "admitSend exists")
  return source.slice(start, source.indexOf("\n}\n", start))
}

/** Shared (not per-address, per-device or per-cooldown) keys admitSend hashes. */
function appSharedSendKeys() {
  const body = admitSendBody()
  const prefix = body.match(/const prefix = "([^"]+)"/)?.[1]
  assert.ok(prefix, "admitSend names its bucket prefix")
  const unknownFor = {
    clientIp: "unknown",
    source: "unknown",
  }
  const keys = []
  for (const match of body.matchAll(
    /rateLimitBucketHash\(\s*`\$\{prefix\}:([^`]*)`/g
  )) {
    const template = match[1]
    const variable = template.match(/\$\{(\w+)\}$/)?.[1]
    if (!variable || !(variable in unknownFor)) continue
    keys.push(
      `${prefix}:${template.replace(/\$\{\w+\}$/, unknownFor[variable])}`
    )
  }
  return keys
}

function platformSendKeys() {
  const migrations = readdirSync(path.join(root, "supabase", "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .filter((name) =>
      read("supabase", "migrations", name).includes(
        "function public.admit_anonymous_customer_email_otp_send"
      )
    )
  const latest = migrations.at(-1)
  assert.ok(latest, "an admission migration exists")
  const sql = read("supabase", "migrations", latest)
  return [
    ...sql.matchAll(/convert_to\('(customer-email-sign-in:send:[^']+)'/g),
  ].map((match) => match[1])
}

function cleanupSharedKeys() {
  const helper = read(
    "tests",
    "e2e",
    "helpers",
    "customer-join-email-live-db.ts"
  )
  const prefix = helper.match(/const EMAIL_SEND_PREFIX = "([^"]+)"/)?.[1]
  assert.ok(prefix, "the cleanup names the send prefix")
  const start = helper.indexOf("EMAIL_SEND_SHARED_BUCKET_KEYS = [")
  assert.ok(start >= 0, "the cleanup lists its shared bucket keys")
  const list = helper.slice(start, helper.indexOf("] as const", start))
  return [...list.matchAll(/[`"]([^`"]+)[`"]/g)].map((match) =>
    match[1].replace("${EMAIL_SEND_PREFIX}", prefix)
  )
}

test("the email journey cleanup deletes every shared send bucket the app debits", () => {
  const appKeys = appSharedSendKeys()
  assert.ok(
    appKeys.some((key) => key.includes(":source:")),
    "admitSend keys its backstops by network source"
  )
  const cleanup = new Set(cleanupSharedKeys())
  for (const key of appKeys) {
    assert.ok(cleanup.has(key), `cleanup resets ${key}`)
  }
})

test("the email journey cleanup deletes the admission RPC's platform caps", () => {
  const platformKeys = platformSendKeys()
  assert.ok(platformKeys.length >= 2, "the RPC keeps platform-wide caps")
  const cleanup = new Set(cleanupSharedKeys())
  for (const key of platformKeys) {
    assert.ok(cleanup.has(key), `cleanup resets ${key}`)
  }
})

test("the email journey cleanup no longer names the retired global buckets", () => {
  for (const key of cleanupSharedKeys()) {
    assert.doesNotMatch(key, /:global:/, key)
  }
})
