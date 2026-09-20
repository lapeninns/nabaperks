import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn } from "./helpers/db.mjs"
import {
  createSuspensionGraceFixture,
  isSuspensionGraceReady,
} from "./helpers/merchant-suspension-grace-fixture.mjs"
import { actAsMerchantOwner } from "./helpers/reward-pool-fixture.mjs"

const ready = await isSuspensionGraceReady()
const skip = ready ? false : "suspension-grace migration is not deployed"

after(closeDb)

test(
  "private grace primitives and direct suspension fields are not API-writable",
  { skip },
  async () => {
    const [privileges] = await db()`
      select
        has_function_privilege('authenticated', 'private.merchant_suspended_at(uuid)', 'execute') as "merchantHelper",
        has_function_privilege('service_role', 'private.reward_in_suspension_grace(uuid,timestamptz)', 'execute') as "rewardHelper",
        has_table_privilege('service_role', 'private.reward_suspension_extensions', 'select') as "extensionLedger",
        has_function_privilege('authenticated', 'public.admin_suspend_merchant(uuid,text)', 'execute') as "adminSuspend",
        has_function_privilege('service_role', 'public.admin_suspend_merchant(uuid,text)', 'execute') as "serviceSuspend",
        has_function_privilege('authenticated', 'public.prevent_expired_reward_redemption()', 'execute') as "redemptionTrigger",
        has_function_privilege('service_role', 'public.prevent_expired_reward_scan_token()', 'execute') as "tokenTrigger"`
    assert.equal(privileges.merchantHelper, false)
    assert.equal(privileges.rewardHelper, false)
    assert.equal(privileges.extensionLedger, false)
    assert.equal(privileges.adminSuspend, true)
    assert.equal(privileges.serviceSuspend, false)
    assert.equal(privileges.redemptionTrigger, false)
    assert.equal(privileges.tokenTrigger, false)

    await inRolledBackTxn(async (tx) => {
      const fixture = await createSuspensionGraceFixture(tx)
      await actAsMerchantOwner(tx, fixture.ownerUserId)
      await assert.rejects(
        tx.savepoint(
          () =>
            tx`update public.merchants
             set suspended_at = now(), suspension_reason = 'Forged pause'
             where id = ${fixture.merchantId}::uuid`
        ),
        (error) => error.code === "42501"
      )
    })
  }
)
