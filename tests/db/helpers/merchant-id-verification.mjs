import postgres from "postgres"

import { dbUrl } from "./db.mjs"
import { createRewardPoolFixture } from "./reward-pool-fixture.mjs"
import { asPostgrestRole } from "./postgrest-role.mjs"

let connection
export function verificationDb() {
  if (!connection) {
    const url = new URL(dbUrl())
    url.username = "supabase_admin"
    connection = postgres(url.toString(), { max: 4, idle_timeout: 5 })
  }
  return connection
}

export async function closeVerificationDb() {
  if (connection) await connection.end({ timeout: 5 })
  connection = undefined
}

export async function inVerificationTxn(fn) {
  const rollback = Symbol("rollback")
  try {
    await verificationDb().begin(async (tx) => {
      await tx`set local lock_timeout = '5s'`
      await fn(tx)
      throw rollback
    })
  } catch (error) {
    if (error !== rollback) throw error
  }
}

export async function createIdCheckFixture(tx, source = "stamp_cycle") {
  const fixture = await createRewardPoolFixture(tx)
  await asPostgrestRole(
    tx,
    "service_role",
    {},
    (sp) => sp`
    update public.customers set date_of_birth = date '1991-02-03'
    where id = ${fixture.customerId}::uuid`
  )
  await tx`
    insert into public.reward_events (
      id, merchant_id, customer_id, membership_id, loyalty_card_id,
      status, source, reward_name, reward_terms, redeemable_from, cycle_number
    ) values (
      ${fixture.rewardEventId}::uuid, ${fixture.merchantId}::uuid,
      ${fixture.customerId}::uuid, ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
      'unlocked', ${source}, 'ID check test reward', 'One test reward, subject to availability.',
      public.uk_business_date(now()), ${source === "stamp_cycle" ? 1 : null}
    )`
  const [minted] = await asPostgrestRole(
    tx,
    "service_role",
    {},
    (sp) => sp`
    select * from public.create_reward_scan_token(
      ${fixture.rewardEventId}::uuid, ${fixture.customerId}::uuid
    )`
  )
  return { ...fixture, scanToken: minted.scan_token, dateOfBirth: "1991-02-03" }
}

export function verifyFixture(tx, fixture, overrides = {}) {
  return asPostgrestRole(
    tx,
    overrides.role ?? "authenticated",
    {
      sub: overrides.ownerId ?? fixture.ownerUserId,
    },
    (sp) => sp`
    select * from public.verify_and_collect_reward_scan_token(
      ${overrides.scanToken ?? fixture.scanToken}::uuid,
      ${overrides.dateOfBirth ?? fixture.dateOfBirth}::date,
      ${overrides.confirmed ?? true}::boolean
    )`
  )
}

export async function readIdCheckState(tx, fixture) {
  const [state] = await tx`
    select r.status, c.date_of_birth_verified_at as verified_at,
      c.date_of_birth_verification_source as source,
      c.date_of_birth_verified_by as verified_by,
      cm.current_stamp_count as stamps, cm.active_cycle_number as cycle,
      cm.total_rewards_redeemed as redeemed,
      t.consumed_at,
      (select count(*)::int from private.merchant_id_verification_receipts
       where customer_id = c.id) as receipts,
      (select count(*)::int from public.audit_logs
       where customer_id = c.id and action = 'customer_date_of_birth_verified') as checks
    from public.reward_events r
    join public.customers c on c.id = r.customer_id
    join public.customer_memberships cm on cm.id = r.membership_id
    join public.reward_scan_tokens t on t.id = ${fixture.scanToken}::uuid
    where r.id = ${fixture.rewardEventId}::uuid`
  return state
}
