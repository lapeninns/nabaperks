import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import postgres from "postgres"

import { dbUrl } from "./helpers/db.mjs"
import { cleanupRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"
import { createStampCollectionFixture } from "./helpers/stamp-collection-fixture.mjs"

const url = dbUrl()
const evidenceDir = process.env.QA_EVIDENCE_DIR
const save = (name, value) => {
  if (!evidenceDir) return
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(
    path.join(evidenceDir, `${name}.json`),
    JSON.stringify(value, null, 2)
  )
}

async function waitForLocks(sql, names, holderPid) {
  const deadline = Date.now() + 8000
  let rows = []
  while (Date.now() < deadline) {
    rows =
      await sql`select pid,application_name,wait_event_type,wait_event,pg_blocking_pids(pid) blockers from pg_stat_activity
      where application_name=any(${names}) and state='active' and wait_event_type='Lock'`
    const all =
      await sql`select pid,pg_blocking_pids(pid) blockers from pg_stat_activity where wait_event_type='Lock'`
    const reaches = (pid, seen = new Set()) =>
      pid === holderPid ||
      (!seen.has(pid) &&
        (seen.add(pid),
        (all.find((r) => r.pid === pid)?.blockers ?? []).some((p) =>
          reaches(p, new Set(seen))
        )))
    if (rows.length === names.length && rows.every((r) => reaches(r.pid)))
      return rows
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(
    `Missing real overlapping lock waits: ${JSON.stringify(rows)}`
  )
}

const schedules = [
  ["stamp", "collect"],
  ["collect", "stamp"],
  ["stamp", "link", "collect"],
  ["collect", "link", "stamp"],
  ["link", "stamp", "collect"],
  ["link", "collect", "stamp"],
]
const scenarios = [
  ...schedules.map((schedule) => ({ schedule, scope: "same" })),
  { schedule: ["stamp", "collect"], scope: "different" },
  { schedule: ["collect", "stamp"], scope: "unrelated" },
]
for (const { schedule, scope } of scenarios) {
  test(
    `stamp and collection both commit after overlapping waits (${scope}: ${schedule.join(" then ")})`,
    { skip: !url },
    async () => {
      const prefix = `lock-${randomUUID().slice(0, 8)}`
      const pools = ["observe", "hold", "stamp", "collect", "link"].map(
        (name) =>
          postgres(url, {
            max: 1,
            onnotice: () => {},
            connection: { application_name: `${prefix}-${name}` },
          })
      )
      const [sql, holder, stamper, collector, linker] = pools
      let f,
        release,
        holderJob,
        jobs = []
      const result = { schedule, waits: [], outcomes: [] }
      try {
        // Given: a eligible existing reward plus a card one authorised visit from full.
        f = await createStampCollectionFixture(sql)
        f.stampCustomerId = f.customerId
        f.stampMembershipId = f.membershipId
        if (scope === "different") {
          f.secondaryCustomerId = randomUUID()
          f.stampMembershipId = randomUUID()
          f.stampCustomerId = f.secondaryCustomerId
          await sql`insert into customers(id,email,email_hmac,email_verified_at,full_name,date_of_birth,phone_hmac,phone_verified_at,date_of_birth_verified_at,date_of_birth_verification_source)
          values(${f.secondaryCustomerId},${`different-${f.secondaryCustomerId}@example.test`},repeat(replace(${f.secondaryCustomerId},'-',''),2),now(),'Different member','1990-01-01',repeat(replace(${f.secondaryCustomerId},'-',''),2),now(),now(),'trusted_database')`
          await sql`insert into customer_memberships(id,merchant_id,customer_id) values(${f.stampMembershipId},${f.merchantId},${f.stampCustomerId})`
          await sql`update customer_memberships set current_stamp_count=0,total_stamps_earned=0 where id=${f.stampMembershipId}`
        }
        if (scope === "unrelated") {
          f.unrelated = await createStampCollectionFixture(sql)
          f.stampCustomerId = f.unrelated.customerId
          f.stampMembershipId = f.unrelated.membershipId
        }
        f.sessionId = randomUUID()
        await sql`select register_customer_session(${f.customerId},${f.sessionId},now()+interval '1 hour',repeat('b',64),'verified_phone')`
        f.linkCustomerId = randomUUID()
        f.linkEmail = `lock-link-${randomUUID()}@example.test`
        await sql`insert into customers(id,email,email_hmac,email_verified_at,full_name,date_of_birth) values(${f.linkCustomerId},${f.linkEmail},encode(extensions.digest(${f.linkEmail},'sha256'),'hex'),now(),'Link conflict fixture','1990-01-01')`
        const before =
          await sql`select id,terms_sha256,accepted_at from customer_loyalty_terms_acceptances where membership_id=${f.membershipId}`
        const held = Promise.withResolvers()
        const gate = Promise.withResolvers()
        release = gate.resolve
        holderJob = holder.begin(async (tx) => {
          await tx`set local statement_timeout='20s'`
          const [{ pid }] = await tx`select pg_backend_pid() pid`
          await tx`select id from customers where id=any(${[f.customerId, f.linkCustomerId, f.stampCustomerId]}) order by id for update`
          await tx`select id from customer_memberships where id=any(${[f.membershipId, f.stampMembershipId]}) order by id for update`
          held.resolve(pid)
          await gate.promise
        })
        const holderPid = await held.promise
        const stamp = () =>
          stamper.begin(async (tx) => {
            await tx`set local statement_timeout='15s'`
            await tx`select set_config('request.jwt.claim.role','service_role',true)`
            return tx`select * from issue_self_service_stamp(${f.stampMembershipId},${f.stampCustomerId},${f.unrelated?.qrId ?? f.qrId},52.205::numeric,0.119::numeric,5::numeric,'granted',100,0)`
          })
        const collect = () =>
          collector.begin(async (tx) => {
            await tx`set local statement_timeout='15s'`
            await tx`select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub',${f.ownerUserId},true)`
            return tx`select * from collect_owner_reward_scan_token(${f.token})`
          })
        const link = () =>
          linker.begin(async (tx) => {
            await tx`set local statement_timeout='15s'`
            await tx`select set_config('request.jwt.claim.role','service_role',true)`
            const [r] =
              await tx`select * from link_verified_customer_wallets(${f.customerId},${f.sessionId},'email',(select email_hmac from customers where id=${f.linkCustomerId}))`
            assert.equal(r.status, "conflict")
            return r
          })
        // When: both real transactions are observed blocked before releasing the holder.
        const actions = { stamp, collect, link }
        for (const actor of schedule) {
          jobs.push(
            actions[actor]().then(
              (value) => ({ status: "fulfilled", value }),
              (error) => ({
                status: "rejected",
                code: error.code,
                message: error.message,
              })
            )
          )
          await waitForLocks(sql, [`${prefix}-${actor}`], holderPid)
        }
        result.waits = await waitForLocks(
          sql,
          schedule.map((actor) => `${prefix}-${actor}`),
          holderPid
        )
        release()
        await holderJob
        result.outcomes = await Promise.all(jobs)
        // Then: neither operation requires retry, and the authoritative ledgers settle once.
        assert.ok(
          result.outcomes.every((r) => r.status === "fulfilled"),
          JSON.stringify(result.outcomes)
        )
        const [state] = await sql`select
          (select count(*)::int from stamp_events where membership_id=${f.stampMembershipId}) stamps,
          (select count(*)::int from reward_events where membership_id=${f.stampMembershipId} and source='stamp_cycle') cycles,
        (select count(*)::int from reward_scan_tokens where id=${f.token} and consumed_at is not null) consumed,
        (select count(*)::int from private.merchant_counter_collection_receipts where reward_event_id=${f.rewardEventId}) receipts,
        (select row_to_json(r) from (select reward_name,reward_terms,status from reward_events where id=${f.rewardEventId}) r) reward`
        result.state = state
        assert.deepEqual(state, {
          stamps: scope === "different" ? 1 : 3,
          cycles: scope === "different" ? 0 : 1,
          consumed: 1,
          receipts: 1,
          reward: {
            reward_name: "Original direct reward",
            reward_terms: "Immutable direct terms",
            status: "redeemed",
          },
        })
        assert.deepEqual(
          await sql`select id,terms_sha256,accepted_at from customer_loyalty_terms_acceptances where membership_id=${f.membershipId}`,
          before
        )
      } finally {
        release?.()
        await holderJob
        await Promise.all(jobs)
        if (f) {
          await cleanupRewardPoolFixture(sql, f)
          await sql`delete from customers where id=${f.linkCustomerId}`
          if (f.secondaryCustomerId)
            await sql`delete from customers where id=${f.secondaryCustomerId}`
          if (f.unrelated) await cleanupRewardPoolFixture(sql, f.unrelated)
        }
        result.cleaned = true
        save(`overlap-${scope}-${schedule.join("-")}`, result)
        await Promise.all(pools.map((p) => p.end({ timeout: 5 })))
      }
    }
  )
}
