import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, isLiveDbReady } from "./helpers/db.mjs"
import {
  closeVerificationDb,
  createIdCheckFixture,
  inVerificationTxn,
} from "./helpers/merchant-id-verification.mjs"
import { asPostgrestRole } from "./helpers/postgrest-role.mjs"

// QA BUG-008 (38c42a1..2c45031): terms 2026-09-28.1 require a verified phone
// before collection, but private.reward_phone_verification_required() shipped
// as false, so the database, staff console and reward_ready producer reported
// email-only wallets as ready. The activation migration turns the switch on
// (owner decision Q1). These cases run against the shipped switch value, with
// no in-test override.
const skip = (await isLiveDbReady()) ? false : "local Supabase is not available"
const PHONE_REASON = "Complete your profile before redeeming"

after(async () => {
  await closeVerificationDb()
  await closeDb()
})

async function rewardFor(tx, phone) {
  const f = await createIdCheckFixture(tx, "stamp_cycle", "v2")
  await tx`update public.reward_events
    set reward_policy_snapshot = reward_policy_snapshot || jsonb_build_object('age_check', false)
    where id = ${f.rewardEventId}::uuid`
  if (phone !== "verified") {
    await tx`select set_config('app.customer_erasure', 'true', true)`
    await tx`update public.customers
      set phone_hmac = case when ${phone === "missing"} then null else phone_hmac end,
          phone_last4 = case when ${phone === "missing"} then null else phone_last4 end,
          phone_verified_at = null
      where id = ${f.customerId}::uuid`
    await tx`select set_config('app.customer_erasure', 'false', true)`
  }
  // The fixture's earlier token was minted before the phone was removed.
  await tx`delete from public.reward_scan_tokens where reward_event_id = ${f.rewardEventId}::uuid`
  return f
}

function batchState(tx, rewardId) {
  return asPostgrestRole(
    tx,
    "service_role",
    {},
    (sp) => sp`
      select state, reason
      from public.get_reward_collection_states(array[${rewardId}::uuid])`
  )
}

function mint(tx, f) {
  return asPostgrestRole(
    tx,
    "service_role",
    {},
    (sp) => sp`
      select * from public.create_reward_scan_token(
        ${f.rewardEventId}::uuid, ${f.customerId}::uuid)`
  )
}

function readyCandidates(tx) {
  return asPostgrestRole(
    tx,
    "service_role",
    {},
    (sp) => sp`
      select reward_event_id
      from public.list_pending_reward_notification_candidates(
        'reward_ready', now(), 500)`
  )
}

test(
  "Given the activation migration When the switch is read Then the database requires a verified phone",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const [row] =
        await tx`select private.reward_phone_verification_required() as enabled`
      assert.equal(row.enabled, true)
    })
  }
)

for (const phone of ["missing", "unverified"]) {
  test(
    `Given a wallet with a ${phone} phone When staff, notifications and the mint read its reward Then it is blocked, never ready`,
    { skip },
    async () => {
      await inVerificationTxn(async (tx) => {
        const f = await rewardFor(tx, phone)

        assert.deepEqual(
          (await batchState(tx, f.rewardEventId)).map((row) => ({ ...row })),
          [{ state: "blocked", reason: PHONE_REASON }]
        )
        assert.ok(
          !(await readyCandidates(tx)).some(
            (row) => row.reward_event_id === f.rewardEventId
          ),
          "no reward_ready notification is produced"
        )
        await assert.rejects(() => mint(tx, f), { message: PHONE_REASON })
        await assert.rejects(
          () =>
            tx.savepoint(
              (sp) => sp`update public.reward_events set status = 'redeemed'
                where id = ${f.rewardEventId}::uuid`
            ),
          { message: PHONE_REASON }
        )
        const [reward] =
          await tx`select status from public.reward_events where id = ${f.rewardEventId}::uuid`
        assert.equal(reward.status, "unlocked")
      })
    }
  )
}

test(
  "Given a phone-verified wallet When its reward is read and minted Then it is ready and collectable",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await rewardFor(tx, "verified")

      assert.deepEqual(
        (await batchState(tx, f.rewardEventId)).map((row) => ({ ...row })),
        [{ state: "ready", reason: null }]
      )
      assert.ok(
        (await readyCandidates(tx)).some(
          (row) => row.reward_event_id === f.rewardEventId
        )
      )
      const [minted] = await mint(tx, f)
      await asPostgrestRole(
        tx,
        "service_role",
        {},
        (sp) => sp`
          select * from public.collect_current_reward_scan_token(
            ${minted.scan_token}::uuid, ${f.merchantId}::uuid)`
      )
      const [reward] =
        await tx`select status from public.reward_events where id = ${f.rewardEventId}::uuid`
      assert.equal(reward.status, "redeemed")
    })
  }
)
