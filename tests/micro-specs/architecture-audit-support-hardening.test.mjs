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

test("Given an admin handles GDPR requests When export or deletion is requested Then data is exported or anonymized instead of only logged", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630129000_execute_customer_data_requests.sql"
  )
  const actions = readProjectFile("app", "admin", "actions.ts")
  const privacyCron = readProjectFile(
    "app",
    "api",
    "cron",
    "privacy-retention",
    "route.ts"
  )
  const vercel = readProjectFile("vercel.json")

  assert.match(migration, /admin_export_customer_data/)
  assert.match(migration, /returns jsonb/)
  assert.match(migration, /nabaperks\.customer-data-export\.v1/)
  assert.match(migration, /'customer', customer_json/)
  assert.match(migration, /'memberships', membership_json/)
  assert.match(migration, /'stamp_events', stamp_json/)
  assert.match(migration, /event_type/)
  assert.match(migration, /stamps_delta/)
  assert.match(migration, /'reward_events', reward_json/)
  assert.match(migration, /'consent_records', consent_json/)
  assert.match(migration, /admin_erase_customer_pii/)
  for (const column of [
    "auth_user_id = null",
    "full_name = null",
    "date_of_birth = null",
    "phone = null",
    "phone_hmac = null",
    "phone_ciphertext = null",
    "phone_last4 = null",
    "phone_country = null",
  ]) {
    assert.match(migration, new RegExp(column))
  }
  assert.match(migration, /erased\+'/)
  assert.match(migration, /@privacy\.invalid/)
  assert.match(migration, /customer_pii_erased/)
  assert.match(migration, /admin_purge_stale_customer_pii/)
  assert.match(migration, /set_config\('app\.customer_erasure', 'true'/)
  assert.match(
    migration,
    /current_setting\('app\.customer_erasure', true\) = 'true'/
  )
  assert.match(
    actions,
    /await requireAdminAction\(\)[\s\S]*admin_log_data_request/
  )
  assert.match(privacyCron, /isAuthorizedCronRequest/)
  assert.match(
    readProjectFile("lib", "security", "cron-auth.ts"),
    /CRON_SECRET/
  )
  assert.match(privacyCron, /admin_purge_stale_customer_pii/)
  assert.match(privacyCron, /STALE_CUSTOMER_PII_RETENTION_DAYS = 365/)
  assert.match(vercel, /"path": "\/api\/cron\/privacy-retention"/)
  assert.match(vercel, /"schedule": "0 3 \* \* \*"/)
})

test("Given fraud flags are queued for support When an admin reviews them Then status can be resolved from the UI and audit logged", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630130000_resolve_fraud_flags.sql"
  )
  const actions = readProjectFile("app", "admin", "actions.ts")
  const page = readProjectFile("app", "admin", "fraud", "page.tsx")
  const fraudFlagsPanel = readProjectFile(
    "app",
    "admin",
    "fraud",
    "fraud-flags-panel.tsx"
  )

  assert.match(migration, /admin_resolve_fraud_flag/)
  assert.match(migration, /p_status not in \('reviewed', 'dismissed'\)/)
  assert.match(
    migration,
    /update public\.fraud_flags[\s\S]*set status = p_status/
  )
  assert.match(migration, /fraud_flag_resolved/)
  assert.match(migration, /previous_status/)
  assert.match(actions, /resolveFraudFlagAction/)
  assert.match(actions, /await requireAdminAction\(\)/)
  assert.match(actions, /admin_resolve_fraud_flag/)
  assert.match(page, /FraudFlagsPanel/)
  assert.match(fraudFlagsPanel, /resolveFraudFlagAction/)
  assert.match(fraudFlagsPanel, /Mark reviewed/)
  assert.match(fraudFlagsPanel, /Dismiss/)
})

test("Given self-service stamping is live When docs are inspected Then dead counter-handshake SQL is removed", () => {
  const counterHandshake = readProjectFile(
    "supabase",
    "migrations",
    "20260613090000_counter_handshake.sql"
  )
  const decision = readProjectFile(
    "docs",
    "architecture-flows",
    "self-service-stamping-decision.md"
  )

  assert.match(
    counterHandshake,
    /counter_handshake_removed_in_favour_of_self_service_stamping/
  )
  assert.doesNotMatch(
    counterHandshake,
    /create table if not exists public\.stations/
  )
  assert.doesNotMatch(counterHandshake, /verification_tokens/)
  assert.match(decision, /stable venue QR slug/)
  assert.match(decision, /photographed poster/)
  assert.match(
    decision,
    /one self-service stamp per customer, merchant,\s+location, and UK business day/
  )
  assert.match(decision, /short-lived signed QR nonce/)
})

test("Given a live join QR depends on three active rewards When reward pool edits drop below minimum Then mutation is blocked", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630131000_guard_reward_pool_minimum.sql"
  )
  const actions = readProjectFile("app", "app", "card", "actions.ts")

  assert.match(migration, /assert_reward_pool_launch_ready/)
  assert.match(migration, /active_reward_count < 3/)
  assert.match(migration, /destination_type = 'join'/)
  assert.match(migration, /qr_codes\.is_active/)
  assert.match(
    migration,
    /Keep at least 3 active rewards before launch QR stays live\./
  )
  assert.match(migration, /perform public\.assert_reward_pool_launch_ready/)
  assert.match(actions, /REWARD_MIN_ACTIVE_ERROR/)
  assert.match(actions, /rewardPoolMutationError/)
  assert.match(actions, /at least 3 active rewards/)
})

test("Given wallet progress includes referral bonuses When counters drift Then earned dots follow server progress with bonus labels", () => {
  const cardStampLabels = readProjectFile(
    "lib",
    "customer",
    "card-stamp-labels.ts"
  )
  const home = readProjectFile("lib", "customer", "home.ts")

  assert.match(
    cardStampLabels,
    /return Math\.min\(Math\.max\(membershipCount, 0\), Math\.max\(total, 0\)\)/
  )
  assert.doesNotMatch(
    cardStampLabels,
    /Math\.max\(membershipCount, stampDateCount\)/
  )
  assert.match(
    home,
    /stampDisplayLabelsForCount\(\{[\s\S]*?count: currentStamps/
  )
})

test("Given landing venue proof uses real venues When copy is editorial Then provenance is disclosed", () => {
  const proof = readProjectFile(
    "components",
    "marketing",
    "landing",
    "venue-proof.tsx"
  )
  const reviews = readProjectFile(
    "components",
    "marketing",
    "landing",
    "venue-proof-reviews.tsx"
  )
  const data = readProjectFile(
    "components",
    "marketing",
    "landing",
    "venue-proof-data.ts"
  )

  assert.match(proof, /independent pub/)
  assert.match(proof, /day-to-day service/)
  assert.match(reviews, /Independent pub/)
  assert.match(reviews, /venueProofSignoff/)
  assert.match(data, /Paraphrased pub team feedback/)
  assert.doesNotMatch(data, /attribution:\s*"/)
  assert.doesNotMatch(reviews, /In their words/)
  assert.doesNotMatch(proof, /Real words from/)
  assert.doesNotMatch(data, /Paraphrased operator voice/)
  assert.doesNotMatch(data, /Operator voice/)
})
