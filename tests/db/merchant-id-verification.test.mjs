import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { isLiveDbReady, closeDb } from "./helpers/db.mjs"
import { asPostgrestRole } from "./helpers/postgrest-role.mjs"
import {
  closeVerificationDb,
  createIdCheckFixture,
  inVerificationTxn,
  readIdCheckState,
  verificationDb,
  verifyFixture,
} from "./helpers/merchant-id-verification.mjs"
import {
  cleanupRewardPoolFixture,
  createRewardPoolFixture,
} from "./helpers/reward-pool-fixture.mjs"

const skip = (await isLiveDbReady()) ? false : "local Supabase is not available"
after(async () => {
  await closeVerificationDb()
  await closeDb()
})

test(
  "unverified adult can present a QR, but every ordinary collection entry point stays blocked",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createIdCheckFixture(tx)
      const [context] = await asPostgrestRole(
        tx,
        "authenticated",
        { sub: f.ownerUserId },
        (sp) => sp`
      select * from public.get_owner_reward_scan_context(${f.scanToken}::uuid)`
      )
      assert.equal(context.scan_status, "verification_required")
      assert.equal(context.customer_full_name, "Reward Pool Customer")
      assert.equal(
        context.customer_date_of_birth.toISOString().slice(0, 10),
        f.dateOfBirth
      )

      for (const rpc of [
        "collect_reward_scan_token",
        "collect_current_reward_scan_token",
      ]) {
        await assert.rejects(
          () =>
            asPostgrestRole(tx, "service_role", {}, (sp) =>
              sp.unsafe(`select * from public.${rpc}($1::uuid, $2::uuid)`, [
                f.scanToken,
                f.merchantId,
              ])
            ),
          /verified adult date of birth required/i
        )
      }
      for (const role of ["service_role", "authenticated"]) {
        await assert.rejects(
          () =>
            asPostgrestRole(
              tx,
              role,
              { sub: f.customerUserId },
              (sp) => sp`
        select * from public.redeem_self_service_reward(${f.rewardEventId}::uuid, ${f.customerId}::uuid)
      `
            ),
          /verified adult date of birth required/i
        )
      }
      const state = await readIdCheckState(tx, f)
      assert.equal(state.status, "unlocked")
      assert.equal(state.receipts, 0)
      assert.equal(state.verified_at, null)
    })
  }
)

for (const source of ["stamp_cycle", "merchant_direct"]) {
  test(
    `owner ID check atomically verifies, audits and collects a ${source} reward once`,
    { skip },
    async () => {
      await inVerificationTxn(async (tx) => {
        const f = await createIdCheckFixture(tx, source)
        const [collected] = await verifyFixture(tx, f)
        assert.equal(collected.reward_event_id, f.rewardEventId)
        const state = await readIdCheckState(tx, f)
        assert.equal(state.status, "redeemed")
        assert.equal(state.source, "merchant_owner")
        assert.equal(state.verified_by, f.ownerUserId)
        assert.ok(state.verified_at)
        assert.ok(state.consumed_at)
        assert.equal(state.receipts, 1)
        assert.equal(state.checks, 1)
        assert.equal(state.stamps, source === "stamp_cycle" ? 0 : 3)
        assert.equal(state.cycle, source === "stamp_cycle" ? 2 : 1)
        assert.equal(state.redeemed, 1)
        await assert.rejects(() => verifyFixture(tx, f), /already collected/i)
        const [context] = await asPostgrestRole(
          tx,
          "authenticated",
          { sub: f.ownerUserId },
          (sp) => sp`
        select * from public.get_owner_reward_scan_context(${f.scanToken}::uuid)`
        )
        assert.equal(context.scan_status, "redeemed")
        assert.equal(context.customer_full_name, null)
        assert.equal(context.customer_date_of_birth, null)
        const [audit] = await tx`
        select actor_type, actor_id, metadata from public.audit_logs
        where target_id = ${f.rewardEventId}::uuid and action = 'reward_redeemed'`
        assert.equal(audit.actor_type, "merchant")
        assert.equal(audit.actor_id, f.ownerUserId)
      })
    }
  )
}

test(
  "only the authenticated owner can see ID details or perform verification",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createIdCheckFixture(tx)
      for (const caller of [
        { role: "anon", ownerId: "" },
        { role: "service_role", ownerId: "" },
        { role: "authenticated", ownerId: f.customerUserId },
        { role: "authenticated", ownerId: f.adminUserId },
        { role: "authenticated", ownerId: randomUUID() },
      ]) {
        await assert.rejects(
          () => verifyFixture(tx, f, caller),
          (e) => e.code === "42501"
        )
        await assert.rejects(
          () =>
            asPostgrestRole(
              tx,
              caller.role,
              { sub: caller.ownerId },
              (sp) => sp`
        select * from public.get_owner_reward_scan_context(${f.scanToken}::uuid)`
            ),
          (e) => e.code === "42501"
        )
      }
      assert.equal((await readIdCheckState(tx, f)).receipts, 0)
    })
  }
)

test(
  "neither service-role nor owner profile writes can forge verification or receipts",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createIdCheckFixture(tx)
      for (const role of ["service_role", "authenticated"]) {
        await assert.rejects(
          () =>
            asPostgrestRole(
              tx,
              role,
              { sub: f.ownerUserId },
              (sp) => sp`
        update public.customers set date_of_birth_verified_at = now(),
          date_of_birth_verification_source = 'merchant_owner', date_of_birth_verified_by = ${f.ownerUserId}::uuid
        where id = ${f.customerId}::uuid`
            ),
          /provenance|permission denied/i
        )
        await assert.rejects(
          () =>
            asPostgrestRole(
              tx,
              role,
              { sub: f.ownerUserId },
              (sp) => sp`
        insert into private.merchant_id_verification_receipts
          (customer_id, merchant_id, owner_user_id, reward_event_id, verified_at, attestation)
        values (${f.customerId}::uuid, ${f.merchantId}::uuid, ${f.ownerUserId}::uuid,
          ${f.rewardEventId}::uuid, now(), 'photo_id_matches_customer_dob_and_adult')`
            ),
          /permission denied/i
        )
        await assert.rejects(
          () =>
            asPostgrestRole(
              tx,
              role,
              { sub: f.ownerUserId },
              (sp) => sp`
        select * from private.redeem_self_service_reward_transition(${f.rewardEventId}::uuid, ${f.customerId}::uuid)
      `
            ),
          /permission denied/i
        )
      }
    })
  }
)

test(
  "missing confirmation and a stale date leave the reward and account untouched",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createIdCheckFixture(tx)
      await assert.rejects(
        () => verifyFixture(tx, f, { confirmed: false }),
        /confirm the in-person/i
      )
      await assert.rejects(
        () => verifyFixture(tx, f, { dateOfBirth: "1992-04-05" }),
        /date of birth changed/i
      )
      await assert.rejects(
        () => verifyFixture(tx, f, { scanToken: randomUUID() }),
        /not available/i
      )
      const state = await readIdCheckState(tx, f)
      assert.equal(state.verified_at, null)
      assert.equal(state.receipts, 0)
      assert.equal(state.checks, 0)
      assert.equal(state.status, "unlocked")
    })
  }
)

for (const condition of [
  "expired_token",
  "superseded_token",
  "expired_reward",
  "future_reward",
  "inactive_card",
  "inactive_merchant",
  "insufficient_stamps",
  "underage",
  "incomplete_profile",
]) {
  test(
    `ID verification refuses ${condition} without side effects`,
    { skip },
    async () => {
      await inVerificationTxn(async (tx) => {
        const f = await createIdCheckFixture(tx)
        if (condition === "expired_token")
          await tx`update public.reward_scan_tokens set expires_at = now() - interval '1 second' where id = ${f.scanToken}::uuid`
        if (condition === "superseded_token")
          await tx`update public.reward_scan_tokens set superseded_at = now() where id = ${f.scanToken}::uuid`
        if (condition === "expired_reward")
          await tx`update public.reward_events set expires_at = now() - interval '1 second' where id = ${f.rewardEventId}::uuid`
        if (condition === "future_reward")
          await tx`update public.reward_events set redeemable_from = public.uk_business_date(now()) + 1 where id = ${f.rewardEventId}::uuid`
        if (condition === "inactive_card")
          await tx`update public.loyalty_cards set is_active = false where id = ${f.cardId}::uuid`
        if (condition === "inactive_merchant")
          await tx`update public.merchants set status = 'suspended' where id = ${f.merchantId}::uuid`
        if (condition === "insufficient_stamps")
          await tx`update public.customer_memberships set current_stamp_count = 1 where id = ${f.membershipId}::uuid`
        if (condition === "incomplete_profile")
          await tx`update public.customers set full_name = null where id = ${f.customerId}::uuid`
        if (condition === "underage") {
          await asPostgrestRole(
            tx,
            "service_role",
            {},
            (sp) =>
              sp`update public.customers set date_of_birth = date '2020-01-01' where id = ${f.customerId}::uuid`
          )
          await assert.rejects(
            () =>
              asPostgrestRole(
                tx,
                "service_role",
                {},
                (sp) => sp`
          select * from public.create_reward_scan_token(${f.rewardEventId}::uuid, ${f.customerId}::uuid)`
              ),
            /18 or over/i
          )
        }
        await assert.rejects(
          () => verifyFixture(tx, f),
          /expired|superseded|unavailable|not ready|not redeemable|profile|18 or over/i
        )
        const state = await readIdCheckState(tx, f)
        assert.equal(state.receipts, 0)
        assert.equal(state.checks, 0)
        assert.equal(state.verified_at, null)
        assert.equal(state.status, "unlocked")
      })
    }
  )
}

test(
  "a downstream collection failure rolls back the ID check and audit",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createIdCheckFixture(tx)
      // Fail after verification, inside the actual reward transition.
      await tx.unsafe(`create function pg_temp.reject_id_test_collection() returns trigger language plpgsql as
      'begin raise exception ''Injected collection failure''; end';
      create trigger id_test_reject_collection before update on public.reward_events
      for each row execute function pg_temp.reject_id_test_collection();`)
      await assert.rejects(
        () => verifyFixture(tx, f),
        /Injected collection failure/i
      )
      const state = await readIdCheckState(tx, f)
      assert.equal(state.verified_at, null)
      assert.equal(state.receipts, 0)
      assert.equal(state.checks, 0)
      assert.equal(state.status, "unlocked")
      assert.equal(state.consumed_at, null)
    })
  }
)

test(
  "account verification is reused at another venue and a later DOB edit invalidates it",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createIdCheckFixture(tx, "merchant_direct")
      await verifyFixture(tx, f)
      const other = await createRewardPoolFixture(tx)
      const [membership] =
        await tx`insert into public.customer_memberships(merchant_id, customer_id)
      values (${other.merchantId}::uuid, ${f.customerId}::uuid) returning id`
      const [reward] = await tx`insert into public.reward_events(
      merchant_id, customer_id, membership_id, loyalty_card_id, status, source, reward_name, reward_terms, redeemable_from
    ) values (${other.merchantId}::uuid, ${f.customerId}::uuid, ${membership.id}::uuid, ${other.cardId}::uuid,
      'unlocked', 'merchant_direct', 'Another venue gift', 'One reward per member.', public.uk_business_date(now())) returning id`
      const [token] =
        await tx`select * from public.create_reward_scan_token(${reward.id}::uuid, ${f.customerId}::uuid)`
      const [context] = await asPostgrestRole(
        tx,
        "authenticated",
        { sub: other.ownerUserId },
        (sp) => sp`
      select * from public.get_owner_reward_scan_context(${token.scan_token}::uuid)`
      )
      assert.equal(context.scan_status, "ready")
      assert.equal(context.customer_date_of_birth, null)
      await asPostgrestRole(
        tx,
        "service_role",
        {},
        (sp) => sp`
      update public.customers set date_of_birth = date '1992-04-05' where id = ${f.customerId}::uuid`
      )
      assert.equal((await readIdCheckState(tx, f)).verified_at, null)
      const [retired] =
        await tx`select superseded_at from public.reward_scan_tokens where id = ${token.scan_token}::uuid`
      assert.ok(retired.superseded_at)
      await assert.rejects(
        () =>
          asPostgrestRole(
            tx,
            "service_role",
            {},
            (sp) => sp`
      select * from public.collect_current_reward_scan_token(${token.scan_token}::uuid, ${other.merchantId}::uuid)`
          ),
        /superseded/i
      )
    })
  }
)

test(
  "customer erasure purges private ID receipts and clears verification",
  { skip },
  async () => {
    await inVerificationTxn(async (tx) => {
      const f = await createIdCheckFixture(tx)
      await verifyFixture(tx, f)
      await asPostgrestRole(
        tx,
        "service_role",
        { sub: f.adminUserId },
        (sp) => sp`
      select public.admin_erase_customer_pii(${f.customerId}::uuid, ${f.merchantId}::uuid, 'in_person', 'Test erasure request')`
      )
      const state = await readIdCheckState(tx, f)
      assert.equal(state.receipts, 0)
      assert.equal(state.verified_at, null)
      assert.equal(state.source, null)
    })
  }
)

test(
  "simultaneous owner submissions produce one collection and one receipt",
  { skip },
  async () => {
    const sql = verificationDb()
    let fixture
    try {
      fixture = await sql.begin(createIdCheckFixture)
      const results = await Promise.allSettled(
        [0, 1].map(() => sql.begin((tx) => verifyFixture(tx, fixture)))
      )
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
      assert.equal(results.filter((r) => r.status === "rejected").length, 1)
      const failure = results.find((r) => r.status === "rejected")
      assert.match(failure.reason.message, /already collected/i)
      const state = await readIdCheckState(sql, fixture)
      assert.equal(state.receipts, 1)
      assert.equal(state.checks, 1)
      assert.equal(state.redeemed, 1)
      assert.equal(state.cycle, 2)
      assert.equal(state.stamps, 0)
    } finally {
      if (fixture) await cleanupRewardPoolFixture(sql, fixture)
    }
  }
)
