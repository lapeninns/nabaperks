import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, isLiveDbReady } from "./helpers/db.mjs"
import {
  closeVerificationDb,
  createIdCheckFixture,
  inVerificationTxn,
  verifyFixture,
} from "./helpers/merchant-id-verification.mjs"
import { asPostgrestRole } from "./helpers/postgrest-role.mjs"

const skip = (await isLiveDbReady()) ? false : "local Supabase is not available"
after(async () => {
  await closeVerificationDb()
  await closeDb()
})

for (const state of [
  "verification_required",
  "ready",
  "redeemed",
  "blocked",
  "expired",
  "superseded",
]) {
  test(
    `authenticated owner RPC masks contact in the ${state} state`,
    { skip },
    async () => {
      await inVerificationTxn(async (tx) => {
        const f = await createIdCheckFixture(tx)
        const [customer] =
          await tx`select email from public.customers where id = ${f.customerId}::uuid`
        const asOwner = (fn) =>
          asPostgrestRole(tx, "authenticated", { sub: f.ownerUserId }, fn)
        await assert.rejects(
          () =>
            asOwner(
              (sp) =>
                sp`select email from public.customers where id = ${f.customerId}::uuid`
            ),
          /permission denied/i
        )
        const [masked] = await asOwner(
          (sp) =>
            sp`select email from public.customers_masked where id = ${f.customerId}::uuid`
        )
        assert.equal(masked.email, "r***@example.test")

        if (state === "ready") {
          await tx`update public.customers set date_of_birth_verified_at = clock_timestamp(), date_of_birth_verification_source = 'trusted_database', date_of_birth_verified_by = null where id = ${f.customerId}::uuid`
        } else if (state === "redeemed") {
          await verifyFixture(tx, f)
        } else if (state === "blocked") {
          await tx`update public.customer_memberships set current_stamp_count = 0 where id = ${f.membershipId}::uuid`
        } else if (state === "expired") {
          await tx`update public.reward_scan_tokens set expires_at = now() - interval '1 second' where id = ${f.scanToken}::uuid`
        } else if (state === "superseded") {
          await tx`update public.reward_scan_tokens set superseded_at = now() where id = ${f.scanToken}::uuid`
        }

        const [context] = await asOwner(
          (sp) =>
            sp`select * from public.get_owner_reward_scan_context(${f.scanToken}::uuid)`
        )
        assert.equal(
          context.scan_status,
          state === "superseded" ? "expired" : state
        )
        assert.equal(context.customer_email, masked.email)
        assert.equal(JSON.stringify(context).includes(customer.email), false)
        assert.equal(
          context.customer_full_name,
          state === "verification_required" ? "Reward Pool Customer" : null
        )
        if (state !== "verification_required")
          assert.equal(context.customer_date_of_birth, null)
      })
    }
  )
}
