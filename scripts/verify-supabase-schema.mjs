import { readdirSync, readFileSync } from "node:fs"

const migration = readFileSync(
  "supabase/migrations/20260606142000_initial_schema_rls.sql",
  "utf8"
)
const migrations = readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(`supabase/migrations/${file}`, "utf8"))
  .join("\n")
const tenantTest = readFileSync("supabase/tests/tenant_isolation.sql", "utf8")

const tables = [
  "internal_admins",
  "merchants",
  "merchant_locations",
  "staff_users",
  "loyalty_cards",
  "reward_pool_items",
  "qr_codes",
  "customers",
  "customer_memberships",
  "stamp_events",
  "reward_events",
  "fraud_flags",
  "rate_limit_buckets",
  "consent_records",
  "billing_customers",
  "audit_logs",
  "product_events",
]

const serviceRoleOnlyTables = new Set()

const requiredHelpers = [
  "is_internal_admin",
  "is_merchant_owner",
  "is_customer_owner",
  "is_staff_for_merchant",
  "customer_has_membership",
  "merchant_can_access_customer",
  "uk_business_date",
  "next_uk_business_date",
  "enforce_rate_limit",
  "create_merchant_onboarding",
  "save_loyalty_card",
  "upsert_reward_pool_item",
  "delete_reward_pool_item",
  "create_or_get_join_qr",
  "set_qr_active",
  "record_qr_download",
  "join_customer_membership",
  "add_staff_member",
  "set_staff_member_active",
  "geo_distance_meters",
  "record_self_service_geo_flag",
  "issue_self_service_stamp",
  "redeem_self_service_reward",
  "admin_adjust_membership_stamps",
  "admin_cancel_reward",
  "admin_set_qr_active",
  "admin_regenerate_qr_code",
  "admin_record_consent_opt_out",
  "admin_log_data_request",
  "admin_log_pilot_note",
]

const requiredTestMarkers = [
  "merchant owner A saw",
  "merchant owner B saw",
  "customer A saw",
  "customer B saw",
  "admin audit readback",
  "anon direct table access unexpectedly succeeded",
]

const failures = []

for (const table of tables) {
  if (
    !migrations.includes(`create table public.${table}`) &&
    !migrations.includes(`create table if not exists public.${table}`)
  ) {
    failures.push(`missing table: ${table}`)
  }

  if (
    !migrations.includes(
      `alter table public.${table} enable row level security`
    )
  ) {
    failures.push(`missing RLS enable: ${table}`)
  }

  if (
    !migrations.includes(`alter table public.${table} force row level security`)
  ) {
    failures.push(`missing RLS force: ${table}`)
  }

  if (
    !serviceRoleOnlyTables.has(table) &&
    !migrations.includes(`on public.${table} for`)
  ) {
    failures.push(`missing policy: ${table}`)
  }
}

for (const helper of requiredHelpers) {
  if (!migrations.includes(`function public.${helper}`)) {
    failures.push(`missing RLS helper: ${helper}`)
  }
}

for (const marker of requiredTestMarkers) {
  if (!tenantTest.includes(marker)) {
    failures.push(`tenant test missing marker: ${marker}`)
  }
}

if (migration.includes("grant usage on schema public to anon")) {
  failures.push("migration grants public schema usage to anon")
}

if (migration.includes("grant select") && migration.includes(" to anon")) {
  failures.push("migration grants table access to anon")
}

if (!migrations.includes("revoke usage on schema public from anon")) {
  failures.push(
    "migrations do not revoke direct public-schema access from anon"
  )
}

if (!migration.includes("unique (merchant_id, customer_id)")) {
  failures.push("memberships missing merchant/customer uniqueness")
}

if (!migration.includes("average_order_value_pence")) {
  failures.push("missing merchant average order value setting")
}

if (!migration.includes("estimated_gross_margin_bps")) {
  failures.push("missing merchant gross margin setting")
}

if (!migration.includes("reward_cost_pence")) {
  failures.push("missing merchant reward cost setting")
}

if (!migration.includes("loyalty_cards_one_active_per_location_idx")) {
  failures.push("missing one-active-card partial index")
}

if (!migrations.includes("reward_pool_items_card_order_idx")) {
  failures.push("missing reward pool card/order index")
}

if (!migrations.includes("qr_codes_one_active_join_per_location_idx")) {
  failures.push("missing one-active-venue-join-QR partial index")
}

if (!migrations.includes("stamp_events_one_earned_per_business_day_idx")) {
  failures.push("missing one-stamp-per-business-day index")
}

if (!migrations.includes("reward_pool_item_id")) {
  failures.push("reward events missing assigned reward pool item reference")
}

if (!migrations.includes("redeemable_from")) {
  failures.push("reward events missing redeemable_from boundary")
}

if (
  !migrations.includes(
    "Reward is not redeemable until the next UK business day"
  )
) {
  failures.push("missing next-business-day redemption guard")
}

if (!migrations.includes("At least one active reward pool item is required")) {
  failures.push("missing reward pool requirement before unlock")
}

if (!migration.includes("product_events_name_created_at_idx")) {
  failures.push("missing product event reporting index")
}

if (!migration.includes("loyalty_card_created")) {
  failures.push("missing loyalty card product event")
}

if (!migrations.includes("reward_pool_item_created")) {
  failures.push("missing reward pool item creation event")
}

if (!migration.includes("qr_created")) {
  failures.push("missing QR creation event")
}

if (!migration.includes("qr_downloaded")) {
  failures.push("missing QR download event")
}

if (!migration.includes("customer_joined")) {
  failures.push("missing customer join event")
}

if (!migration.includes("stamp_issued")) {
  failures.push("missing stamp issued event")
}

if (!migration.includes("reward_redeemed")) {
  failures.push("missing reward redeemed event")
}

if (!migration.includes("reward_unlocked")) {
  failures.push("missing reward unlocked event")
}

if (!migration.includes("reward_redemption_failed")) {
  failures.push("missing reward redemption failure event")
}

if (!migrations.includes("staff_member_added")) {
  failures.push("missing named staff audit action")
}

if (!migration.includes("stamp_adjusted")) {
  failures.push("missing admin stamp adjustment event")
}

if (!migration.includes("reward_cancelled")) {
  failures.push("missing admin reward cancellation event")
}

if (!migration.includes("qr_regenerated")) {
  failures.push("missing admin QR regeneration event")
}

if (!migration.includes("consent_opt_out_recorded")) {
  failures.push("missing admin consent opt-out audit action")
}

if (!migration.includes("data_request_logged")) {
  failures.push("missing admin data request audit action")
}

if (!migration.includes("pilot_note_logged")) {
  failures.push("missing pilot note audit action")
}

if (!migrations.includes("launch_self_service_checked")) {
  failures.push("missing self-service launch proof action")
}

if (!migration.includes("merchant_cancel_reason_recorded")) {
  failures.push("missing merchant cancellation reason audit action")
}

if (!migration.includes("if existing_location_id is null then")) {
  failures.push("missing partial-onboarding location recovery")
}

if (!migration.includes("rate_limit_buckets_reset_at_idx")) {
  failures.push("missing durable rate-limit bucket index")
}

if (
  !migration.includes("grant execute on function public.enforce_rate_limit")
) {
  failures.push("missing durable rate-limit RPC grant")
}

if (!migration.includes("fraud_flags_merchant_status_created_at_idx")) {
  failures.push("missing fraud flags reporting index")
}

if (!migration.includes("high_stamp_velocity")) {
  failures.push("missing high stamp velocity fraud signal")
}

if (!migration.includes("fraud_flag_created")) {
  failures.push("missing fraud flag audit action")
}

for (const marker of [
  "latitude numeric",
  "longitude numeric",
  "geofence_radius_meters",
  "require_geofence",
  "selfstamp:",
  "geo_flagged",
  "self_service_geofence_out_of_range",
  "self_service_geofence_unknown",
  "drop table if exists public.verification_tokens",
  "drop table if exists public.stations",
  "drop table if exists public.staff_sessions",
  "drop table if exists public.station_pin_attempts",
  "drop function if exists public.approve_stamp_token",
  "drop function if exists public.redeem_reward_token",
]) {
  if (!migrations.includes(marker)) {
    failures.push(`missing self-service migration marker: ${marker}`)
  }
}

for (const marker of [
  "phone_hmac text",
  "phone_ciphertext text",
  "phone_last4 text",
  "phone_country text",
  "phone_verified_at timestamptz",
  "customers_phone_hmac_unique_idx",
  "function public.is_service_role_request()",
  "function public.join_customer_membership(\n  p_customer_id uuid",
  "function public.issue_self_service_stamp(\n  p_membership_id uuid,\n  p_customer_id uuid",
  "function public.redeem_self_service_reward(\n  p_reward_event_id uuid,\n  p_customer_id uuid",
  "if not public.is_service_role_request() then",
]) {
  if (!migrations.includes(marker)) {
    failures.push(`missing customer phone identity migration marker: ${marker}`)
  }
}

if (failures.length) {
  console.error("Supabase schema verification failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("Supabase schema verification passed.")
