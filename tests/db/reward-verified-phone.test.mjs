import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, isLiveDbReady } from "./helpers/db.mjs"
import {
  closeVerificationDb,
  createIdCheckFixture,
  inVerificationTxn,
  readIdCheckState,
  verifyFixture,
} from "./helpers/merchant-id-verification.mjs"
import { asPostgrestRole } from "./helpers/postgrest-role.mjs"

const skip = (await isLiveDbReady()) ? false : "local Supabase is not available"
const PHONE_REASON = "Complete your profile before redeeming"

test(
  "Given an email-only wallet with an earned reward When its phone is verified Then collection can proceed",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createIdCheckFixture(tx, "stamp_cycle", "v2")
      await setPhoneState(tx, f, "missing")
      await tx`update public.reward_events
      set reward_policy_snapshot = reward_policy_snapshot || jsonb_build_object('age_check', false)
      where id = ${f.rewardEventId}::uuid`
      await tx`update public.customers
      set phone_hmac = encode(extensions.digest(id::text, 'sha256'), 'hex'),
        phone_last4 = '0123', phone_verified_at = now()
      where id = ${f.customerId}::uuid`

      const [state] =
        await tx`select state, reason from private.reward_collection_state(${f.rewardEventId}::uuid)`
      assert.deepEqual(state, { state: "ready", reason: null })
      await asPostgrestRole(
        tx,
        "service_role",
        {},
        (sp) => sp`
      select * from public.collect_current_reward_scan_token(${f.scanToken}::uuid, ${f.merchantId}::uuid)`
      )
      const [reward] =
        await tx`select status from public.reward_events where id = ${f.rewardEventId}::uuid`
      assert.equal(reward.status, "redeemed")
    })
  }
)

after(async () => {
  await closeVerificationDb()
  await closeDb()
})

async function setPhoneState(tx, fixture, phoneState) {
  await tx`select set_config('app.customer_erasure', 'true', true)`
  await tx`update public.customers
    set phone_hmac = case when ${phoneState === "missing"} then null
      else encode(extensions.digest(id::text, 'sha256'), 'hex') end,
      phone_last4 = case when ${phoneState === "missing"} then null else '0123' end,
      phone_verified_at = null
    where id = ${fixture.customerId}::uuid`
  await tx`select set_config('app.customer_erasure', 'false', true)`
}

async function sideEffects(tx, fixture) {
  const idCheck = await readIdCheckState(tx, fixture)
  const [events] = await tx`select
    (select count(*)::int from public.reward_scan_tokens where customer_id = ${fixture.customerId}::uuid) as tokens,
    (select count(*)::int from public.stamp_events where customer_id = ${fixture.customerId}::uuid) as stamps,
    (select count(*)::int from public.audit_logs where customer_id = ${fixture.customerId}::uuid) as audits,
    (select count(*)::int from public.product_events where customer_id = ${fixture.customerId}::uuid) as products,
    (select count(*)::int from public.notification_events where customer_id = ${fixture.customerId}::uuid) as notifications`
  return { ...idCheck, ...events }
}

const boundaries = {
  predicate: async (tx, f) => {
    const [state] = await asPostgrestRole(
      tx,
      "service_role",
      {},
      (sp) => sp`
      select state, reason from public.get_reward_collection_state(${f.rewardEventId}::uuid)`
    )
    assert.deepEqual(state, { state: "blocked", reason: PHONE_REASON })
  },
  mint: (tx, f) =>
    assert.rejects(
      () =>
        asPostgrestRole(
          tx,
          "service_role",
          {},
          (sp) => sp`
    select * from public.create_reward_scan_token(${f.rewardEventId}::uuid, ${f.customerId}::uuid)`
        ),
      { message: PHONE_REASON }
    ),
  tokenInsert: (tx, f) =>
    assert.rejects(
      () =>
        tx.savepoint(
          (sp) => sp`
    insert into public.reward_scan_tokens (reward_event_id, merchant_id, customer_id, membership_id)
    values (${f.rewardEventId}::uuid, ${f.merchantId}::uuid, ${f.customerId}::uuid, ${f.membershipId}::uuid)`
        ),
      { message: PHONE_REASON }
    ),
  merchantContext: async (tx, f) => {
    const [state] = await asPostgrestRole(
      tx,
      "service_role",
      {},
      (sp) => sp`
      select scan_status, blocked_reason from public.get_reward_scan_context(${f.scanToken}::uuid, ${f.merchantId}::uuid)`
    )
    assert.deepEqual(state, {
      scan_status: "blocked",
      blocked_reason: PHONE_REASON,
    })
  },
  ownerContext: async (tx, f) => {
    const [state] = await asPostgrestRole(
      tx,
      "authenticated",
      { sub: f.ownerUserId },
      (sp) => sp`
      select scan_status, blocked_reason from public.get_owner_reward_scan_context(${f.scanToken}::uuid)`
    )
    assert.deepEqual(state, {
      scan_status: "blocked",
      blocked_reason: PHONE_REASON,
    })
  },
  legacyCollector: (tx, f) =>
    assert.rejects(
      () =>
        asPostgrestRole(
          tx,
          "service_role",
          {},
          (sp) => sp`
    select * from public.collect_reward_scan_token(${f.scanToken}::uuid, ${f.merchantId}::uuid)`
        ),
      { message: PHONE_REASON }
    ),
  currentCollector: (tx, f) =>
    assert.rejects(
      () =>
        asPostgrestRole(
          tx,
          "service_role",
          {},
          (sp) => sp`
    select * from public.collect_current_reward_scan_token(${f.scanToken}::uuid, ${f.merchantId}::uuid)`
        ),
      { message: PHONE_REASON }
    ),
  directRedemption: (tx, f) =>
    assert.rejects(
      () =>
        tx.savepoint(
          (sp) => sp`
      update public.reward_events set status = 'redeemed'
      where id = ${f.rewardEventId}::uuid`
        ),
      { message: PHONE_REASON }
    ),
  ownerVerification: (tx, f) =>
    assert.rejects(() => verifyFixture(tx, f), { message: PHONE_REASON }),
}

for (const policyVersion of ["legacy_v1", "v2"]) {
  for (const ageCheck of [false, true]) {
    for (const phoneState of ["missing", "unverified"]) {
      for (const [boundary, run] of Object.entries(boundaries)) {
        test(
          `Given ${policyVersion} age-check ${ageCheck} and ${phoneState} phone When ${boundary} runs Then collection is blocked without side effects`,
          { skip },
          async () => {
            await inVerificationTxn(async (tx) => {
              const f = await createIdCheckFixture(
                tx,
                "stamp_cycle",
                policyVersion
              )
              await tx`update public.reward_events
              set reward_policy_snapshot = reward_policy_snapshot || jsonb_build_object('age_check', ${ageCheck})
              where id = ${f.rewardEventId}::uuid`
              await setPhoneState(tx, f, phoneState)
              const before = await sideEffects(tx, f)
              await run(tx, f)
              assert.deepEqual(await sideEffects(tx, f), before)
            })
          }
        )
      }
    }
  }
}
