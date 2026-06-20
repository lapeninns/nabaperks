import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const failures = []
const secretNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_API_KEY_SECRET",
  "TWILIO_VERIFY_SERVICE_SID",
  "CUSTOMER_SESSION_SECRET",
  "CUSTOMER_PHONE_HMAC_SECRET",
  "CUSTOMER_PHONE_ENCRYPTION_KEY",
]

for (const file of listFiles("app").concat(listFiles("components"))) {
  const source = readFileSync(file, "utf8")
  const isClientFile =
    source.startsWith('"use client"') || source.startsWith("'use client'")

  if (!isClientFile) continue

  for (const secretName of secretNames) {
    if (source.includes(secretName)) {
      failures.push(
        `client file references server secret ${secretName}: ${file}`
      )
    }
  }
}

const migrations = readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join("supabase/migrations", file), "utf8"))
  .join("\n")
const tenantTest = readFileSync("supabase/tests/tenant_isolation.sql", "utf8")
const webhook = readFileSync("app/api/stripe/webhook/route.ts", "utf8")
const rateLimit = readFileSync("lib/security/rate-limit.ts", "utf8")
const customerJoin = readFileSync("lib/customer/join.ts", "utf8")
const authActions = readFileSync("app/m/[merchantSlug]/join/actions.ts", "utf8")

requireMarker(
  migrations,
  "and reward_events.status = 'unlocked'",
  "duplicate redemption guard"
)
requireMarker(migrations, "high_stamp_velocity", "fraud velocity signal")
requireMarker(
  migrations,
  "self_service_geofence_out_of_range",
  "soft geofence out-of-range signal"
)
requireMarker(
  migrations,
  "self_service_geofence_unknown",
  "soft geofence unknown-location signal"
)
requireMarker(migrations, "selfstamp:", "self-service stamp rate-limit key")
requireMarker(migrations, "rate_limit_buckets", "durable rate-limit buckets")
requireMarker(migrations, "enforce_rate_limit", "durable rate-limit RPC")
requireMarker(migrations, "reward_scan_tokens", "reward scan token table")
requireMarker(
  migrations,
  "stripe_webhook_events",
  "Stripe webhook event ledger"
)
requireMarker(migrations, "customer_sessions", "revocable customer sessions")
requireMarker(
  migrations,
  "customers_prevent_verified_contact_change",
  "verified customer contact immutability trigger"
)
requireMarker(
  migrations,
  "Verified phone cannot be changed through customer profile updates",
  "verified phone immutability guard"
)
requireMarker(
  migrations,
  "Verified email cannot be changed through customer profile updates",
  "verified email immutability guard"
)
requireMarker(
  webhook,
  "stripe.webhooks.constructEvent",
  "Stripe signature verification"
)
requireMarker(webhook, "claimStripeWebhookEvent", "Stripe webhook idempotency")
requireMarker(rateLimit, 'createHash("sha256")', "hashed rate-limit keys")
requireMarker(
  rateLimit,
  "createSupabaseServiceRoleClient",
  "server-side durable rate-limit client"
)
requireMarker(customerJoin, "qr-scan:", "QR scan rate limit")
requireMarker(authActions, "customer-identity:", "auth request rate limit")
requireMarker(
  authActions,
  "startCustomerPhoneVerification",
  "customer Twilio Verify start"
)
requireMarker(
  authActions,
  "setPendingPhoneVerification",
  "signed pending phone session"
)
requireMarker(
  tenantTest,
  "role denial unexpectedly succeeded",
  "role-denial test marker"
)
requireMarker(
  tenantTest,
  "duplicate redemption boundary",
  "duplicate-redemption test marker"
)
requireMarker(
  tenantTest,
  "tenant_isolation_fixture",
  "self-contained tenant isolation fixture marker"
)
requireMarker(
  migrations,
  "record_cycle_stamp_soft_geofence_flag",
  "cycle stamp soft geofence minimized flag helper"
)

const latestStampRpc = latestFunctionSource(
  migrations,
  "public.issue_self_service_stamp"
)
if (!latestStampRpc.includes("p_accuracy_meters numeric default null")) {
  failures.push("latest stamp RPC missing accuracy parameter")
}
for (const marker of ["'latitude', p_latitude", "'longitude', p_longitude"]) {
  if (latestStampRpc.includes(marker)) {
    failures.push(`latest stamp RPC stores raw coordinate metadata: ${marker}`)
  }
}

const softFlagHelper = latestFunctionSource(
  migrations,
  "public.record_cycle_stamp_soft_geofence_flag"
)
for (const marker of [
  "'latitude'",
  "'longitude'",
  "p_latitude",
  "p_longitude",
  "distance_meters",
]) {
  if (softFlagHelper.includes(marker)) {
    failures.push(
      `soft geofence flag helper stores exact location metadata: ${marker}`
    )
  }
}

if (authActions.includes("signInWithOtp")) {
  failures.push("customer join action still starts Supabase Auth OTP")
}

if (failures.length) {
  console.error("Security verification failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("Security verification passed.")

function requireMarker(source, marker, label) {
  if (!source.includes(marker)) {
    failures.push(`missing ${label}`)
  }
}

function latestFunctionSource(source, signature) {
  const start = source.lastIndexOf(`create or replace function ${signature}(`)
  if (start === -1) return ""

  const end = source.indexOf("$$;", start)
  if (end === -1) return source.slice(start)

  return source.slice(start, end)
}

function listFiles(dir) {
  const files = []

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stat = statSync(path)

    if (stat.isDirectory()) {
      files.push(...listFiles(path))
      continue
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(path)
    }
  }

  return files
}
