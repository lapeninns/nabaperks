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
const EMAIL_REASON = "Verified email required for reward collection"

after(async () => {
  await closeVerificationDb()
  await closeDb()
})

async function setEmailState(tx, fixture, emailState) {
  await tx`select set_config('app.customer_erasure', 'true', true)`
  await tx`update public.customers
    set email = ${emailState === "missing" ? null : "unverified@example.test"},
      email_verified_at = null, email_hmac = null,
      phone_hmac = encode(extensions.digest(id::text, 'sha256'), 'hex')
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
    assert.deepEqual(state, { state: "blocked", reason: EMAIL_REASON })
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
      { message: EMAIL_REASON }
    ),
  tokenInsert: (tx, f) =>
    assert.rejects(
      () =>
        tx.savepoint(
          (sp) => sp`
    insert into public.reward_scan_tokens (reward_event_id, merchant_id, customer_id, membership_id)
    values (${f.rewardEventId}::uuid, ${f.merchantId}::uuid, ${f.customerId}::uuid, ${f.membershipId}::uuid)`
        ),
      { message: EMAIL_REASON }
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
      blocked_reason: EMAIL_REASON,
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
      blocked_reason: EMAIL_REASON,
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
      { message: EMAIL_REASON }
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
      { message: EMAIL_REASON }
    ),
  ownerVerification: (tx, f) =>
    assert.rejects(() => verifyFixture(tx, f), { message: EMAIL_REASON }),
}

for (const policyVersion of ["legacy_v1", "v2"]) {
  for (const ageCheck of [false, true]) {
    for (const emailState of ["missing", "unverified"]) {
      for (const [boundary, run] of Object.entries(boundaries)) {
        test(
          `Given ${policyVersion} age-check ${ageCheck} and ${emailState} email When ${boundary} runs Then collection is blocked without side effects`,
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
              await setEmailState(tx, f, emailState)
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
