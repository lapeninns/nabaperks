import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { after, test } from "node:test"
import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const fixture = readFileSync(
  new URL("../fixtures/release-upgrade/populate.sql", import.meta.url),
  "utf8"
)
  .replace(/^begin;$/m, "")
  .replace(/^commit;$/m, "")
const CUSTOMER = "ee500000-0000-4000-8000-000000000001"
const REWARD = "ee800000-0000-4000-8000-000000000001"
const skip = (await isLiveDbReady()) ? false : "local Supabase is not available"
after(closeDb)

test(
  "upgrade fixture satisfies the active phone gate while an unverified contact stays blocked",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await tx.unsafe(fixture)
      const [contact] = await tx`select phone_hmac is not null as has_phone,
      phone_verified_at is not null as verified from public.customers
      where id=${CUSTOMER}::uuid`
      assert.deepEqual({ ...contact }, { has_phone: true, verified: true })
      await tx`update public.customers set full_name='Synthetic Upgrade Customer',
      date_of_birth='1990-01-01', email_verified_at=now() where id=${CUSTOMER}::uuid`
      await tx`update public.reward_events set redeemable_from=null,
      expires_at=now()+interval '1 day' where id=${REWARD}::uuid`
      const [policy] =
        await tx`select private.reward_phone_verification_required() as enabled`
      assert.equal(policy.enabled, true)
      await assert.rejects(
        () =>
          tx.savepoint(async (sp) => {
            await sp`select set_config('app.customer_erasure', 'true', true)`
            await sp`update public.customers set phone_verified_at=null where id=${CUSTOMER}::uuid`
            await sp`select * from public.create_reward_scan_token(${REWARD}::uuid, ${CUSTOMER}::uuid)`
          }),
        { message: "Complete your profile before redeeming" }
      )
      const [token] =
        await tx`select * from public.create_reward_scan_token(${REWARD}::uuid, ${CUSTOMER}::uuid)`
      assert.ok(token.scan_token)
    })
  }
)
