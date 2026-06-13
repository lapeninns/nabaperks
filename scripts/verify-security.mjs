import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const failures = []
const secretNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
]

for (const file of listFiles("app").concat(listFiles("components"))) {
  const source = readFileSync(file, "utf8")
  const isClientFile = source.startsWith('"use client"') || source.startsWith("'use client'")

  if (!isClientFile) continue

  for (const secretName of secretNames) {
    if (source.includes(secretName)) {
      failures.push(`client file references server secret ${secretName}: ${file}`)
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

requireMarker(migrations, "station_pin_attempts_station_recent_idx", "station PIN rate-limit index")
requireMarker(migrations, "expires_at <= now()", "verification token expiry guard")
requireMarker(migrations, "and reward_events.status = 'unlocked'", "duplicate redemption guard")
requireMarker(migrations, "high_stamp_velocity", "fraud velocity signal")
requireMarker(migrations, "rate_limit_buckets", "durable rate-limit buckets")
requireMarker(migrations, "enforce_rate_limit", "durable rate-limit RPC")
requireMarker(webhook, "stripe.webhooks.constructEvent", "Stripe signature verification")
requireMarker(rateLimit, "createHash(\"sha256\")", "hashed rate-limit keys")
requireMarker(rateLimit, "createSupabaseServiceRoleClient", "server-side durable rate-limit client")
requireMarker(customerJoin, "qr-scan:", "QR scan rate limit")
requireMarker(authActions, "customer-identity:", "auth request rate limit")
requireMarker(tenantTest, "role denial unexpectedly succeeded", "role-denial test marker")
requireMarker(tenantTest, "duplicate redemption boundary", "duplicate-redemption test marker")

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
