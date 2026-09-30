import assert from "node:assert/strict"
import { after, test } from "node:test"

import { createRewardCollectionFixture } from "../e2e/helpers/reward-collection-live-db.ts"
import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const skip = (await isLiveDbReady()) ? false : "local Supabase is not available"
after(closeDb)

test(
  "Given the ID collection browser fixture When created Then contacts are verified while photo ID remains pending",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardCollectionFixture(tx, {
        unverified: true,
      })
      assert.ok(fixture, "seed reward fixture is required")
      const [customer] = await tx`
        select email_verified_at is not null as email_verified,
               phone_hmac is not null and phone_verified_at is not null as phone_verified,
               date_of_birth_verified_at is not null as id_verified
        from public.customers where id = ${fixture.customerId}::uuid`
      assert.deepEqual(customer, {
        email_verified: true,
        phone_verified: true,
        id_verified: false,
      })
      const [token] = await tx`
        select consumed_at is null as available from public.reward_scan_tokens
        where reward_event_id = ${fixture.rewardEventId}::uuid`
      assert.equal(token.available, true)
    })
  }
)
