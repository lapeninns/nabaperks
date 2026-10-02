import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { dbUrl } from "./helpers/db.mjs"
import { runErasureReferralRace } from "./helpers/erasure-referral-race.mjs"
import postgres from "postgres"
import { randomUUID } from "node:crypto"
import { createStampCollectionFixture } from "./helpers/stamp-collection-fixture.mjs"
import { cleanupRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"
import { actAsActivatedInternalAdmin } from "./helpers/admin-auth.mjs"

for (const first of ["erase", "settle"]) {
  test(
    `erasure and referral preserve privacy after real overlap (${first} first)`,
    { skip: !dbUrl() },
    async () => {
      const evidence = await runErasureReferralRace(dbUrl(), first)
      if (process.env.QA_EVIDENCE_DIR) {
        mkdirSync(process.env.QA_EVIDENCE_DIR, { recursive: true })
        writeFileSync(
          path.join(process.env.QA_EVIDENCE_DIR, `${first}.json`),
          JSON.stringify(evidence, null, 2)
        )
      }
      assert.equal(evidence.waits.length, 2)
      assert.equal(new Set(evidence.waits.map((row) => row.pid)).size, 2)
      const reachesHolder = (pid, seen = new Set()) =>
        pid === evidence.holderPid ||
        (!seen.has(pid) &&
          (seen.add(pid),
          (evidence.waits.find((row) => row.pid === pid)?.blockers ?? []).some(
            (blocker) => reachesHolder(blocker, new Set(seen))
          )))
      for (const row of evidence.waits) assert.ok(reachesHolder(row.pid))
      for (const outcome of evidence.outcomes)
        assert.equal(outcome.status, "fulfilled")
      const after = evidence.after
      assert.match(after.customer[0].email, /^erased\+.*@privacy\.invalid$/)
      assert.equal(after.customer[0].phone_hmac, null)
      assert.equal(after.customer[0].email_hmac, null)
      assert.equal(after.customer[0].date_of_birth, null)
      assert.ok(after.friend[0].phone_hmac)
      assert.ok(after.friend[0].email_verified_at)
      assert.deepEqual(after.friendMembership[0], {
        current_stamp_count: 1,
        total_stamps_earned: 1,
      })
      assert.deepEqual(after.terms, evidence.before.terms)
      assert.equal(after.bonusStamps.length, 1)
      assert.equal(after.referral[0].status, "awarded")
      assert.equal(after.referral[0].last_error, null)
      assert.deepEqual(after.membership[0], {
        current_stamp_count: 0,
        total_stamps_earned: 3,
        total_rewards_redeemed: 0,
        active_cycle_number: 2,
      })
      for (const reward of evidence.before.rewards)
        assert.deepEqual(
          after.rewards.find((row) => row.id === reward.id),
          reward
        )
      assert.equal(after.rewards.length, evidence.before.rewards.length + 1)
      assert.ok(after.session[0].revoked_at)
      assert.equal(after.tokens.length, 1)
      assert.ok(after.tokens[0].superseded_at)
      assert.equal(after.tokens[0].consumed_at, null)
      assert.equal(after.receipts[0].count, 0)
      assert.ok(
        after.notifications.some(
          (row) => row.event_type === "referral_bonus_stamp_issued"
        )
      )
      assert.ok(
        after.notifications.every(
          (row) => !["queued", "delivering"].includes(row.status)
        ),
        "Erased customer must not regain queued notification work after settlement"
      )
      for (const notification of after.notifications) {
        assert.ok(notification.cancelled_at)
        assert.equal(notification.metadata.cancelled_reason, "customer_erased")
      }
      assert.equal(evidence.cleaned, true)
    }
  )
}

test(
  "notification insert guard retains producer dedupe, terminal history and unrelated customer work",
  { skip: !dbUrl() },
  async () => {
    const sql = postgres(dbUrl(), { max: 1, onnotice: () => {} })
    let erased, other
    try {
      erased = await createStampCollectionFixture(sql)
      other = await createStampCollectionFixture(sql)
      await sql.begin(async (tx) => {
        await actAsActivatedInternalAdmin(tx, erased.adminUserId)
        await tx`select public.admin_erase_customer_pii(${erased.customerId},${erased.merchantId},'other','Synthetic notification boundary proof')`
      })
      const dedupe = `erased-notification-${randomUUID()}`
      const [first] =
        await sql`select public.enqueue_notification_event(p_event_type=>'referral_bonus_stamp_issued',p_customer_id=>${erased.customerId},p_merchant_id=>${erased.merchantId},p_membership_id=>${erased.membershipId},p_dedupe_key=>${dedupe}) id`
      const [replay] =
        await sql`select public.enqueue_notification_event(p_event_type=>'referral_bonus_stamp_issued',p_customer_id=>${erased.customerId},p_merchant_id=>${erased.merchantId},p_membership_id=>${erased.membershipId},p_dedupe_key=>${dedupe}) id`
      assert.equal(first.id, replay.id)
      const [event] =
        await sql`select status,cancelled_at,metadata from notification_events where id=${first.id}`
      assert.equal(event.status, "cancelled")
      assert.ok(event.cancelled_at)
      assert.equal(event.metadata.cancelled_reason, "customer_erased")
      const [direct] = await sql.begin(async (tx) => {
        await tx`set local role service_role`
        await tx`select set_config('request.jwt.claim.role','service_role',true)`
        return tx`insert into notification_events(event_type,category,customer_id,merchant_id,membership_id,dedupe_key,metadata) values('referral_bonus_stamp_issued','transactional',${erased.customerId},${erased.merchantId},${erased.membershipId},${`direct-${randomUUID()}`},'{"source":"system"}') returning status,metadata`
      })
      assert.equal(direct.status, "cancelled")
      assert.equal(direct.metadata.source, "system")
      await assert.rejects(
        sql`insert into notification_events(event_type,category,customer_id,merchant_id,membership_id,dedupe_key,status) values('referral_bonus_stamp_issued','transactional',${erased.customerId},${erased.merchantId},${erased.membershipId},${`invalid-${randomUUID()}`},null)`,
        { code: "23502" }
      )
      const [history] =
        await sql`insert into notification_events(event_type,category,customer_id,merchant_id,membership_id,dedupe_key,status,sent_at,metadata) values('referral_bonus_stamp_issued','transactional',${erased.customerId},${erased.merchantId},${erased.membershipId},${`history-${randomUUID()}`},'sent',now(),'{"source":"system_history"}') returning status,metadata`
      assert.equal(history.status, "sent")
      assert.deepEqual(history.metadata, { source: "system_history" })
      const [unrelated] =
        await sql`select public.enqueue_notification_event(p_event_type=>'referral_bonus_stamp_issued',p_customer_id=>${other.customerId},p_merchant_id=>${other.merchantId},p_membership_id=>${other.membershipId}) id`
      assert.equal(
        (
          await sql`select status from notification_events where id=${unrelated.id}`
        )[0].status,
        "queued"
      )
    } finally {
      if (erased) await cleanupRewardPoolFixture(sql, erased)
      if (other) await cleanupRewardPoolFixture(sql, other)
      await sql.end()
    }
  }
)
