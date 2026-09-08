import assert from "node:assert/strict"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { after, test } from "node:test"
import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

const ready = await isLiveDbReady()
after(closeDb)
const hash = (token) => createHash("sha256").update(token).digest("hex")

test(
  "one-click loyalty suppression is idempotent, venue-scoped, and rejects the claim capability",
  { skip: ready ? false : "local Supabase unavailable" },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const emailHmac = hash(randomUUID())
      const unsubscribeToken = randomBytes(32).toString("base64url")
      const claimToken = randomBytes(32).toString("base64url")
      await tx`select * from public.create_loyalty_invite_draft(
      ${fx.merchantId}::uuid, null, ${[randomUUID()]}::uuid[], ${[emailHmac]}::text[],
      ${["v1.cipher.tag.body"]}::text[], ${["r***@example.test"]}::text[],
      ${[hash(claimToken)]}::text[], ${[hash(unsubscribeToken)]}::text[], 0, 0)`
      const [wrong] =
        await tx`select public.suppress_loyalty_invite_email(${hash(claimToken)}) as ok`
      assert.equal(wrong.ok, false)
      for (let repeat = 0; repeat < 2; repeat++) {
        const [result] =
          await tx`select public.suppress_loyalty_invite_email(${hash(unsubscribeToken)}) as ok`
        assert.equal(result.ok, true)
      }
      const rows =
        await tx`select merchant_id, reason from public.loyalty_invite_email_suppressions where email_hmac=${emailHmac}`
      assert.deepEqual(
        rows.map((r) => ({ ...r })),
        [{ merchant_id: fx.merchantId, reason: "unsubscribed" }]
      )
    })
  }
)
