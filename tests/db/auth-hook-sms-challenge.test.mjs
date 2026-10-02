import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import test, { after } from "node:test"
import postgres from "postgres"

import { closeDb, dbUrl, inRolledBackTxn } from "./helpers/db.mjs"

const options = { skip: !dbUrl() }
const digest = () => createHash("sha256").update(randomUUID()).digest("hex")
const claim = async (tx, key, window = 60) =>
  (
    await tx`select public.claim_auth_hook_sms_delivery(${key}, ${window}) as result`
  )[0].result
const expire = async (tx, key) => tx`
  update private.auth_hook_sms_challenges
  set first_seen_at = clock_timestamp() - interval '120 seconds',
      expires_at = clock_timestamp() - interval '1 second'
  where challenge_digest = ${key}`
const settle = async (tx, fn, value) =>
  (
    await tx`select ${tx(fn)}('sms', ${value.delivery_id}, ${value.lease_id}::uuid) as result`
  )[0].result

after(closeDb)

test(
  "same SMS challenge has one owner across overlapping envelope claims",
  options,
  async () => {
    const key = digest()
    const owner = postgres(dbUrl(), {
      max: 1,
      connection: { application_name: "sms-semantic-owner" },
    })
    const contender = postgres(dbUrl(), {
      max: 1,
      connection: { application_name: "sms-semantic-contender" },
    })
    const observer = postgres(dbUrl(), { max: 1 })
    let release
    let started
    const barrier = new Promise((resolve) => {
      release = resolve
    })
    const ready = new Promise((resolve) => {
      started = resolve
    })
    let first
    let ownerPid
    let secondPromise
    try {
      const firstPromise = owner.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
        ownerPid = (await tx`select pg_backend_pid() as pid`)[0].pid
        first = await claim(tx, key)
        started()
        await barrier
      })
      await ready
      secondPromise = contender.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
        return claim(tx, key)
      })
      let overlap
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        overlap = (
          await observer`
        select pid, wait_event_type, wait_event, pg_blocking_pids(pid) as blockers
        from pg_stat_activity where application_name = 'sms-semantic-contender'
          and wait_event_type = 'Lock' and ${ownerPid} = any(pg_blocking_pids(pid))`
        )[0]
        if (overlap) break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      assert.ok(overlap, "must observe real overlapping PostgreSQL lock waits")
      release()
      await firstPromise
      const second = await secondPromise
      assert.equal(first.status, "claimed")
      assert.equal(second.status, "busy")
      assert.equal(second.delivery_id, first.delivery_id)
      const rows =
        await observer`select status, attempt_count from public.auth_hook_deliveries
      where channel = 'sms' and webhook_id like ${`sms-otp:${key}:%`}`
      assert.deepEqual(Array.from(rows), [
        { status: "processing", attempt_count: 1 },
      ])
      if (process.env.QA_EVIDENCE_DIR) {
        mkdirSync(process.env.QA_EVIDENCE_DIR, { recursive: true })
        writeFileSync(
          path.join(process.env.QA_EVIDENCE_DIR, "sms-overlap.json"),
          JSON.stringify({ ownerPid, overlap, first, second, rows }, null, 2)
        )
      }
    } finally {
      release?.()
      await secondPromise?.catch(() => undefined)
      await observer`delete from private.auth_hook_sms_challenges where challenge_digest = ${key}`
      await observer`delete from public.auth_hook_deliveries where channel = 'sms'
      and webhook_id like ${`sms-otp:${key}:%`}`
      await Promise.all([owner.end(), contender.end(), observer.end()])
    }
  }
)

test(
  "completed challenge replays without extending its default OTP window",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const key = digest()
      const first = await claim(tx, key)
      assert.match(first.delivery_id, /^sms-otp:[a-f0-9]{64}:[a-f0-9-]{36}$/)
      const initial = (
        await tx`select *, extract(epoch from expires_at-first_seen_at)::int as seconds
      from private.auth_hook_sms_challenges where challenge_digest = ${key}`
      )[0]
      assert.equal(initial.seconds, 60)
      assert.equal(
        await settle(tx, "public.complete_auth_hook_delivery_v2", first),
        true
      )
      assert.deepEqual(await claim(tx, key, 86400), {
        status: "replay",
        delivery_id: first.delivery_id,
      })
      const current = (
        await tx`select expires_at from private.auth_hook_sms_challenges
      where challenge_digest = ${key}`
      )[0]
      assert.equal(
        current.expires_at.toISOString(),
        initial.expires_at.toISOString()
      )
    })
  }
)

test(
  "definitive failure retries the same generation and fences superseded lease callbacks",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const key = digest()
      const first = await claim(tx, key)
      assert.equal(
        await settle(tx, "public.fail_auth_hook_delivery_v2", first),
        true
      )
      const retry = await claim(tx, key)
      assert.equal(retry.status, "claimed")
      assert.equal(retry.delivery_id, first.delivery_id)
      assert.notEqual(retry.lease_id, first.lease_id)
      for (const fn of [
        "mark_auth_hook_delivery_attempted_v2",
        "complete_auth_hook_delivery_v2",
        "fail_auth_hook_delivery_v2",
      ]) {
        assert.equal(await settle(tx, `public.${fn}`, first), false)
      }
    })
  }
)

test(
  "expired terminal challenges permit future reuse with a separately fenced generation",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      for (const terminal of [
        "complete_auth_hook_delivery_v2",
        "fail_auth_hook_delivery_v2",
      ]) {
        const key = digest()
        const first = await claim(tx, key)
        assert.equal(await settle(tx, `public.${terminal}`, first), true)
        await expire(tx, key)
        const future = await claim(tx, key)
        assert.equal(future.status, "claimed")
        assert.notEqual(future.delivery_id, first.delivery_id)
        assert.equal(
          await settle(tx, "public.complete_auth_hook_delivery_v2", first),
          false
        )
        const current = (
          await tx`select status, lease_id from public.auth_hook_deliveries
        where channel='sms' and webhook_id=${future.delivery_id}`
        )[0]
        assert.equal(current.status, "processing")
        assert.equal(current.lease_id, future.lease_id)
      }
      assert.equal((await claim(tx, digest())).status, "claimed")
    })
  }
)

test(
  "OTP expiry preserves active and attempted uncertain provider owners",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const key = digest()
      const first = await claim(tx, key)
      await expire(tx, key)
      assert.deepEqual(await claim(tx, key), {
        status: "busy",
        delivery_id: first.delivery_id,
      })
      assert.equal(
        await settle(tx, "public.mark_auth_hook_delivery_attempted_v2", first),
        true
      )
      await tx`update public.auth_hook_deliveries set lease_expires_at=clock_timestamp()-interval '1 second'
      where channel='sms' and webhook_id=${first.delivery_id}`
      assert.deepEqual(await claim(tx, key), {
        status: "replay",
        delivery_id: first.delivery_id,
      })
      assert.equal(
        await settle(tx, "public.complete_auth_hook_delivery_v2", first),
        true
      )
      assert.notEqual((await claim(tx, key)).delivery_id, first.delivery_id)
    })
  }
)

test(
  "expired unattempted leases permit a new generation without late provider attempt ownership",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const key = digest()
      const first = await claim(tx, key)
      await expire(tx, key)
      await tx`update public.auth_hook_deliveries set lease_expires_at=clock_timestamp()-interval '1 second'
      where channel='sms' and webhook_id=${first.delivery_id}`
      const future = await claim(tx, key)
      assert.equal(future.status, "claimed")
      assert.notEqual(future.delivery_id, first.delivery_id)
      assert.equal(
        await settle(tx, "public.mark_auth_hook_delivery_attempted_v2", first),
        false
      )
      await settle(tx, "public.complete_auth_hook_delivery_v2", first)
      assert.deepEqual(await claim(tx, key), {
        status: "busy",
        delivery_id: future.delivery_id,
      })
    })
  }
)

test(
  "missing recorded delivery state refuses recovery before and after OTP expiry",
  options,
  async () => {
    for (const expired of [false, true]) {
      await inRolledBackTxn(async (tx) => {
        const key = digest()
        const first = await claim(tx, key)
        if (expired) await expire(tx, key)
        await tx`delete from public.auth_hook_deliveries where channel='sms' and webhook_id=${first.delivery_id}`
        await assert.rejects(
          tx.savepoint((sp) => claim(sp, key)),
          (error) =>
            error.code === "P0001" &&
            error.message === "SMS delivery state unavailable"
        )
        assert.equal(
          (
            await tx`select delivery_id from private.auth_hook_sms_challenges
        where challenge_digest=${key}`
          )[0].delivery_id,
          first.delivery_id
        )
        assert.equal(
          (
            await tx`select count(*)::int as n from public.auth_hook_deliveries
        where channel='sms' and webhook_id like ${`sms-otp:${key}:%`}`
          )[0].n,
          0
        )
      })
    }
  }
)

test(
  "SMS claim validates inputs and keeps digest storage and execution restricted",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      for (const key of [
        null,
        "",
        "a".repeat(63),
        "A".repeat(64),
        "g".repeat(64),
      ]) {
        await assert.rejects(
          tx.savepoint((sp) => claim(sp, key)),
          { code: "22023" }
        )
      }
      for (const window of [null, 0, 86401]) {
        await assert.rejects(
          tx.savepoint((sp) => claim(sp, digest(), window)),
          { code: "22023" }
        )
      }
      for (const role of ["anon", "authenticated", "service_role"]) {
        await tx.savepoint(async (sp) => {
          await sp`set local role ${sp(role)}`
          await assert.rejects(
            sp.savepoint(
              (denied) => denied`select * from private.auth_hook_sms_challenges`
            ),
            { code: "42501" }
          )
          if (role !== "service_role") {
            await assert.rejects(
              sp.savepoint((denied) => claim(denied, digest())),
              { code: "42501" }
            )
          } else {
            assert.equal((await claim(sp, digest(), 1)).status, "claimed")
            assert.equal((await claim(sp, digest(), 86400)).status, "claimed")
          }
        })
      }
      const table = (
        await tx`select relrowsecurity, relforcerowsecurity from pg_class
      where oid='private.auth_hook_sms_challenges'::regclass`
      )[0]
      assert.deepEqual(table, {
        relrowsecurity: true,
        relforcerowsecurity: true,
      })
    })
  }
)
