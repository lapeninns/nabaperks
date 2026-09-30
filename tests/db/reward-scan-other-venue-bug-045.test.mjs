import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, isLiveDbReady } from "./helpers/db.mjs"
import {
  closeVerificationDb,
  createIdCheckFixture,
  inVerificationTxn,
  readIdCheckState,
} from "./helpers/merchant-id-verification.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"
import { asPostgrestRole } from "./helpers/postgrest-role.mjs"

// QA BUG-045 (38c42a1..2c45031): the owner of venue B opening venue A's
// reward code was refused with the same error as a code that does not exist,
// so staff were told the code had "gone cold". The refusal keeps its SQLSTATE
// and message (the deployed app maps 42501 to not-found), and only a token
// that exists at another venue carries the other-venue hint. Nothing about
// the other venue's reward or member is returned.
const skip = (await isLiveDbReady()) ? false : "local Supabase is not available"
after(async () => {
  await closeVerificationDb()
  await closeDb()
})

const OTHER_VENUE_HINT = "reward_scan_other_merchant"

async function scanAs(tx, ownerUserId, scanToken) {
  try {
    await asPostgrestRole(
      tx,
      "authenticated",
      { sub: ownerUserId },
      (sp) =>
        sp`select * from public.get_owner_reward_scan_context(${scanToken}::uuid)`
    )
  } catch (error) {
    return error
  }
  assert.fail("expected the owner scan to be refused")
}

test(
  "another venue's reward code is refused with the other-venue hint and no state change",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const venueA = await createIdCheckFixture(tx)
      const venueB = await createRewardPoolFixture(tx)
      const before = await readIdCheckState(tx, venueA)

      const error = await scanAs(tx, venueB.ownerUserId, venueA.scanToken)

      assert.equal(error.code, "42501")
      assert.equal(error.message, "Reward not available to this merchant")
      assert.equal(error.hint, OTHER_VENUE_HINT)
      assert.equal(JSON.stringify(error).includes(venueA.customerId), false)

      await assert.rejects(
        () =>
          asPostgrestRole(
            tx,
            "authenticated",
            { sub: venueB.ownerUserId },
            (sp) =>
              sp`select * from public.collect_owner_reward_scan_token(${venueA.scanToken}::uuid)`
          ),
        (collectError) =>
          collectError.code === "42501" &&
          collectError.message === "Reward not available to this merchant"
      )

      assert.deepEqual(await readIdCheckState(tx, venueA), before)
    })
  }
)

test(
  "a code that does not exist keeps the plain refusal without the other-venue hint",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const venueB = await createRewardPoolFixture(tx)
      const error = await scanAs(tx, venueB.ownerUserId, randomUUID())

      assert.equal(error.code, "42501")
      assert.equal(error.message, "Reward not available to this merchant")
      assert.notEqual(error.hint, OTHER_VENUE_HINT)
    })
  }
)

test(
  "the venue's own owner still reads the ready context",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const venueA = await createIdCheckFixture(tx)
      await tx`update public.customers set date_of_birth_verified_at = clock_timestamp(), date_of_birth_verification_source = 'trusted_database', date_of_birth_verified_by = null where id = ${venueA.customerId}::uuid`
      const [context] = await asPostgrestRole(
        tx,
        "authenticated",
        { sub: venueA.ownerUserId },
        (sp) =>
          sp`select scan_status from public.get_owner_reward_scan_context(${venueA.scanToken}::uuid)`
      )
      assert.equal(context.scan_status, "ready")
    })
  }
)
