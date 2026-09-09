import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"
import postgres from "postgres"
import { dbUrl } from "./helpers/db.mjs"
import {
  closeVerificationDb as closeDb,
  inVerificationTxn as inRolledBackTxn,
} from "./helpers/merchant-id-verification.mjs"
import { asPostgrestRole } from "./helpers/postgrest-role.mjs"
import {
  actAsMerchantOwner,
  createRewardPoolFixture,
  cleanupRewardPoolFixture,
  upsertRewardPoolItem,
  createOrGetJoinQr,
} from "./helpers/reward-pool-fixture.mjs"

after(closeDb)
const CODE = "739251"
async function fixture(tx) {
  await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
  const f = await createRewardPoolFixture(tx)
  f.ownerEmail = `owner-${f.ownerUserId}@example.test`
  await tx`update auth.users set email = ${f.ownerEmail}, email_confirmed_at = now() where id = ${f.ownerUserId}`
  await actAsMerchantOwner(tx, f.ownerUserId)
  for (let n = 1; n <= 3; n++)
    await upsertRewardPoolItem(tx, f, {
      rewardName: `Reward ${n}`,
      displayOrder: n,
    })
  const qr = await createOrGetJoinQr(tx, f)
  f.qrId = qr.qr_code_uuid
  return f
}
async function issue(tx, f) {
  const [row] = await asPostgrestRole(
    tx,
    "service_role",
    {},
    (sp) =>
      sp`select public.issue_qr_pause_challenge(${f.ownerUserId}, ${f.qrId}, ${CODE}) as result`
  )
  return row.result
}
async function ready(tx, f) {
  const result = await issue(tx, f)
  assert.equal(result.status, "issued")
  await tx`update public.qr_pause_challenges set state = 'ready' where id = ${result.challenge_id}`
  return result.challenge_id
}
async function verify(tx, f, id, code = CODE) {
  const [row] = await asPostgrestRole(
    tx,
    "authenticated",
    { sub: f.ownerUserId },
    (sp) =>
      sp`select public.verify_and_pause_qr(${id}, ${f.qrId}, ${code}) as result`
  )
  return row.result.status
}
async function state(tx, f) {
  const [row] = await tx`select is_active, status_revision::int,
    (select count(*)::int from public.qr_status_email_outbox where merchant_id = ${f.merchantId}) as emails,
    (select count(*)::int from public.audit_logs where merchant_id = ${f.merchantId} and action in ('qr_disabled', 'qr_enabled')) as audits
    from public.qr_codes where id = ${f.qrId}`
  return row
}
async function resume(tx, f) {
  return asPostgrestRole(
    tx,
    "authenticated",
    { sub: f.ownerUserId },
    (sp) => sp`select public.resume_merchant_qr(${f.merchantId}, ${f.qrId})`
  )
}

test("pause is atomic, single-use and resumes once with independent recipient snapshots", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    const id = await ready(tx, f)
    assert.deepEqual(await state(tx, f), {
      is_active: true,
      status_revision: 0,
      emails: 0,
      audits: 0,
    })
    assert.equal(await verify(tx, f, id), "paused")
    assert.deepEqual(await state(tx, f), {
      is_active: false,
      status_revision: 1,
      emails: 2,
      audits: 1,
    })
    assert.equal(await verify(tx, f, id), "already_completed")
    await resume(tx, f)
    await resume(tx, f)
    assert.equal(await verify(tx, f, id), "already_completed")
    assert.deepEqual(await state(tx, f), {
      is_active: true,
      status_revision: 2,
      emails: 4,
      audits: 2,
    })
    const [challenge] =
      await tx`select code_hash from public.qr_pause_challenges where id = ${id}`
    assert.notEqual(challenge.code_hash, CODE)
    assert.match(challenge.code_hash, /^\$2[aby]\$/)
  })
})

test("owner cannot forge issuance, read challenges, update status/revision, or call legacy pause; admin still can", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    for (const operation of [
      (sp) =>
        sp`select public.issue_qr_pause_challenge(${f.ownerUserId}, ${f.qrId}, ${CODE})`,
      (sp) => sp`select * from public.qr_pause_challenges`,
      (sp) =>
        sp`select public.record_merchant_qr_transition(${f.qrId}, ${f.ownerUserId})`,
      (sp) =>
        sp`update public.qr_codes set is_active = false where id = ${f.qrId}`,
      (sp) =>
        sp`update public.qr_codes set status_revision = 999 where id = ${f.qrId}`,
      (sp) =>
        sp`select public.set_qr_active(${f.merchantId}, ${f.qrId}, false)`,
    ]) {
      await assert.rejects(
        asPostgrestRole(tx, "authenticated", { sub: f.ownerUserId }, operation),
        /permission|authorised|verification/i
      )
    }
    await asPostgrestRole(
      tx,
      "authenticated",
      { sub: f.ownerUserId },
      (sp) =>
        sp`update public.qr_codes set updated_at = now() where id = ${f.qrId}`
    )
    await asPostgrestRole(
      tx,
      "authenticated",
      { sub: f.adminUserId, aal: "aal2" },
      (sp) =>
        sp`select public.admin_set_qr_active(${f.qrId}, false, 'Controlled test')`
    )
    const snapshot = await state(tx, f)
    assert.equal(snapshot.is_active, false)
    assert.equal(snapshot.emails, 0)
    assert.equal(snapshot.status_revision, 1)
  })
})

test("incorrect and missing codes consume attempts, lock on five, and do not change scans", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    const id = await ready(tx, f)
    for (const code of [null, "", "111111", "222222"])
      assert.equal(await verify(tx, f, id, code), "incorrect")
    assert.equal(await verify(tx, f, id, "000000"), "locked")
    assert.equal(await verify(tx, f, id), "locked")
    assert.deepEqual(await state(tx, f), {
      is_active: true,
      status_revision: 0,
      emails: 0,
      audits: 0,
    })
    const [row] =
      await tx`select attempts from public.qr_pause_challenges where id = ${id}`
    assert.equal(row.attempts, 5)
  })
})

test("expiry, email change, wrong owner, wrong QR and undelivered codes fail closed", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    const result = await issue(tx, f)
    const id = result.challenge_id
    assert.equal(await verify(tx, f, id), "superseded")
    await tx`update public.qr_pause_challenges set state = 'ready', expires_at = now() - interval '1 second' where id = ${id}`
    assert.equal(await verify(tx, f, id), "expired")
    await tx`update public.qr_pause_challenges set expires_at = now() + interval '10 minutes' where id = ${id}`
    const other = await fixture(tx)
    assert.equal(await verify(tx, other, id), "unavailable")
    assert.equal(
      await verify(tx, { ...f, qrId: other.qrId }, id),
      "unavailable"
    )
    await tx`update auth.users set email = 'changed@example.test' where id = ${f.ownerUserId}`
    assert.equal(await verify(tx, f, id), "unavailable")
    await tx`update auth.users set email_confirmed_at = null where id = ${f.ownerUserId}`
    assert.equal(await verify(tx, f, id), "email_required")
    assert.equal((await issue(tx, f)).status, "email_required")
    assert.equal((await state(tx, f)).is_active, true)
  })
})

test("resend cooldown and window limits persist; resend supersedes prior code", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    const first = await ready(tx, f)
    assert.equal((await issue(tx, f)).status, "throttled")
    for (let n = 0; n < 4; n++) {
      await tx`update public.qr_pause_challenges set created_at = now() - interval '61 seconds' where owner_user_id = ${f.ownerUserId}`
      await ready(tx, f)
    }
    assert.equal(await verify(tx, f, first), "superseded")
    await tx`update public.qr_pause_challenges set created_at = now() - interval '61 seconds' where owner_user_id = ${f.ownerUserId}`
    assert.equal((await issue(tx, f)).status, "throttled")
    assert.equal((await state(tx, f)).is_active, true)
  })
})

test("owner-wide guess budget cannot be bypassed using random challenge IDs", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    const id = await ready(tx, f)
    for (let n = 0; n < 20; n++)
      assert.equal(await verify(tx, f, randomUUID()), "unavailable")
    assert.equal(await verify(tx, f, id), "throttled")
    assert.equal((await state(tx, f)).is_active, true)
  })
})

test("status revision invalidates codes after admin pause/resume and setup preserves paused rows", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    const id = await ready(tx, f)
    await asPostgrestRole(
      tx,
      "authenticated",
      { sub: f.adminUserId, aal: "aal2" },
      async (sp) => {
        await sp`select public.admin_set_qr_active(${f.qrId}, false, 'Controlled pause')`
        await sp`select public.admin_set_qr_active(${f.qrId}, true, 'Controlled resume')`
      }
    )
    assert.equal(await verify(tx, f, id), "stale")
    await tx`update public.qr_codes set is_active = false where id = ${f.qrId}`
    await actAsMerchantOwner(tx, f.ownerUserId)
    await createOrGetJoinQr(tx, f)
    assert.equal((await state(tx, f)).is_active, false)
    assert.equal((await state(tx, f)).emails, 0)
  })
})

test("matching recipient addresses deduplicate, missing venue address still notifies owner", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    await tx`update public.merchants set email = ${` ${f.ownerEmail.toUpperCase()} `} where id = ${f.merchantId}`
    assert.equal(await verify(tx, f, await ready(tx, f)), "paused")
    assert.equal((await state(tx, f)).emails, 1)
    await tx`update public.merchants set email = '' where id = ${f.merchantId}`
    await resume(tx, f)
    assert.equal((await state(tx, f)).emails, 2)
  })
})

test("resume still enforces billing and reward pool requirements", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    assert.equal(await verify(tx, f, await ready(tx, f)), "paused")
    await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
    await tx`update public.merchants set requires_billing = true where id = ${f.merchantId}`
    await assert.rejects(resume(tx, f), /billing/i)
    await tx`update public.merchants set requires_billing = false where id = ${f.merchantId}`
    await tx`update public.reward_pool_items set is_active = false where merchant_id = ${f.merchantId}`
    await assert.rejects(resume(tx, f), /3 active mystery rewards/i)
    assert.equal((await state(tx, f)).is_active, false)
  })
})

test("delivery claims are leased, recipient completion is independent, crash retries reuse ID and stop at bounds", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    assert.equal(await verify(tx, f, await ready(tx, f)), "paused")
    const claim = () =>
      asPostgrestRole(
        tx,
        "service_role",
        {},
        (sp) =>
          sp`select * from public.claim_qr_status_emails(${f.merchantId}, 20)`
      )
    const rows = await claim()
    assert.equal(rows.length, 2)
    assert.equal((await claim()).length, 0)
    const finish = (row, lease, outcome) =>
      asPostgrestRole(
        tx,
        "service_role",
        {},
        (sp) =>
          sp`select public.finish_qr_status_email(${row.id}, ${lease}, ${outcome}) as ok`
      )
    assert.equal((await finish(rows[0], randomUUID(), "sent"))[0].ok, false)
    assert.equal((await finish(rows[0], rows[0].lease_id, "sent"))[0].ok, true)
    await tx`update public.qr_status_email_outbox set lease_until = now() - interval '1 second' where id = ${rows[1].id}`
    const [retried] = await claim()
    assert.equal(retried.id, rows[1].id)
    assert.notEqual(retried.lease_id, rows[1].lease_id)
    assert.equal(retried.attempts, 2)
    assert.equal((await finish(retried, rows[1].lease_id, "sent"))[0].ok, false)
    await tx`update public.qr_status_email_outbox set attempts = 12, lease_until = now() - interval '1 second' where id = ${retried.id}`
    assert.equal((await claim()).length, 0)
    const statuses =
      await tx`select status from public.qr_status_email_outbox where merchant_id = ${f.merchantId} order by status`
    assert.deepEqual(
      statuses.map((r) => r.status),
      ["failed", "sent"]
    )
  })
})

test("two concurrent verifications consume one challenge and create one transition", async () => {
  const url = new URL(dbUrl())
  url.username = "supabase_admin"
  const sql = postgres(url.toString(), { max: 3 })
  let f
  try {
    const prepared = await sql.begin(async (tx) => {
      f = await fixture(tx)
      return { id: await ready(tx, f) }
    })
    const outcomes = await Promise.all([
      sql.begin((tx) => verify(tx, f, prepared.id)),
      sql.begin((tx) => verify(tx, f, prepared.id)),
    ])
    assert.deepEqual(outcomes.sort(), ["already_completed", "paused"])
    assert.deepEqual(await state(sql, f), {
      is_active: false,
      status_revision: 1,
      emails: 2,
      audits: 1,
    })
    await sql.begin((tx) => resume(tx, f))
    await sql`update public.qr_pause_challenges set created_at = now() - interval '61 seconds' where owner_user_id = ${f.ownerUserId}`
    const sends = await Promise.all([
      sql.begin((tx) => issue(tx, f)),
      sql.begin((tx) => issue(tx, f)),
    ])
    assert.deepEqual(sends.map((r) => r.status).sort(), ["issued", "throttled"])
    const claims = await Promise.all([
      sql.begin((tx) =>
        asPostgrestRole(
          tx,
          "service_role",
          {},
          (sp) =>
            sp`select * from public.claim_qr_status_emails(${f.merchantId}, 20)`
        )
      ),
      sql.begin((tx) =>
        asPostgrestRole(
          tx,
          "service_role",
          {},
          (sp) =>
            sp`select * from public.claim_qr_status_emails(${f.merchantId}, 20)`
        )
      ),
    ])
    assert.equal(claims.flat().length, 4)
    assert.equal(new Set(claims.flat().map((r) => r.id)).size, 4)
  } finally {
    if (f) await cleanupRewardPoolFixture(sql, f)
    await sql.end({ timeout: 5 })
  }
})

test("outbox write failure rolls back the pause, challenge consumption and audit together", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    const id = await ready(tx, f)
    await tx.unsafe(
      `alter table public.qr_status_email_outbox add constraint qr_test_reject_outbox check (merchant_id <> '${f.merchantId}'::uuid) not valid`
    )
    await assert.rejects(verify(tx, f, id), /qr_test_reject_outbox/)
    assert.deepEqual(await state(tx, f), {
      is_active: true,
      status_revision: 0,
      emails: 0,
      audits: 0,
    })
    const [row] =
      await tx`select state, used_at from public.qr_pause_challenges where id = ${id}`
    assert.equal(row.state, "ready")
    assert.equal(row.used_at, null)
  })
})

test("20-hour expiry prevents another send even when attempt budget remains", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    await verify(tx, f, await ready(tx, f))
    await tx`update public.qr_status_email_outbox set changed_at = now() - interval '20 hours' where merchant_id = ${f.merchantId}`
    const rows = await asPostgrestRole(
      tx,
      "service_role",
      {},
      (sp) =>
        sp`select * from public.claim_qr_status_emails(${f.merchantId}, 20)`
    )
    assert.equal(rows.length, 0)
    const statuses =
      await tx`select status, failure_code from public.qr_status_email_outbox where merchant_id = ${f.merchantId}`
    assert.ok(
      statuses.every(
        (r) => r.status === "failed" && r.failure_code === "retry_exhausted"
      )
    )
  })
})

test("old readiness keeps seven jobs while v2 monitors the QR email drain", async () => {
  await inRolledBackTxn(async (tx) => {
    const [{ legacy, current }] = await asPostgrestRole(
      tx,
      "service_role",
      {},
      (sp) =>
        sp`select public.production_operational_signals() as legacy, public.production_operational_signals_v2() as current`
    )
    assert.equal(legacy.cronJobs.length, 7)
    assert.equal(current.cronJobs.length, 8)
    assert.equal(
      legacy.cronJobs.some((job) => job.name === "qr-status-email-drain"),
      false
    )
    assert.equal(
      current.cronJobs.some((job) => job.name === "qr-status-email-drain"),
      true
    )
  })
})

test("merchant resume reports no-ops without creating duplicate confirmations", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    const run = () =>
      asPostgrestRole(
        tx,
        "authenticated",
        { sub: f.ownerUserId },
        (sp) =>
          sp`select public.resume_merchant_qr(${f.merchantId}, ${f.qrId}) as result`
      )
    assert.equal((await run())[0].result.status, "unchanged")
    assert.equal((await state(tx, f)).emails, 0)
    await verify(tx, f, await ready(tx, f))
    assert.equal((await run())[0].result.status, "resumed")
    assert.equal((await run())[0].result.status, "unchanged")
    assert.equal((await state(tx, f)).emails, 4)
  })
})

test("old application setup cannot reactivate a paused QR and private activation is not callable", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    await verify(tx, f, await ready(tx, f))
    for (const operation of [
      (sp) => sp`select public.set_qr_active(${f.merchantId}, ${f.qrId}, true)`,
      (sp) =>
        sp`select public.activate_merchant_qr_explicit(${f.merchantId}, ${f.qrId}, true)`,
    ])
      await assert.rejects(
        asPostgrestRole(tx, "authenticated", { sub: f.ownerUserId }, operation),
        /permission|explicit Resume/i
      )
    assert.equal((await state(tx, f)).is_active, false)
    await resume(tx, f)
    assert.equal((await state(tx, f)).is_active, true)
  })
})

test("v2 includes QR retry failures, terminal failures and backoff queue age without changing legacy health", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    await verify(tx, f, await ready(tx, f))
    await tx`update public.qr_status_email_outbox set attempts = 1, last_attempt_at = now(), failure_code = 'temporary', next_attempt_at = now() + interval '1 hour', changed_at = now() - interval '30 minutes' where merchant_id = ${f.merchantId}`
    const read = async () =>
      (
        await tx`select public.production_operational_signals() as legacy, public.production_operational_signals_v2() as current`
      )[0]
    const [{ count }] =
      await tx`select count(*)::int from public.qr_status_email_outbox where merchant_id = ${f.merchantId}`
    const before = await read()
    assert.equal(
      before.current.providerDeliveryFailures24h -
        before.legacy.providerDeliveryFailures24h,
      count
    )
    assert.equal(
      before.current.providerDeliveryAttempts24h -
        before.legacy.providerDeliveryAttempts24h,
      count
    )
    assert.ok(before.current.notificationQueueAgeMinutes >= 30)
    await tx`update public.qr_status_email_outbox set status = 'failed', failure_code = 'retry_exhausted' where merchant_id = ${f.merchantId}`
    const after = await read()
    assert.deepEqual(after.legacy, before.legacy)
    assert.equal(
      after.current.providerDeliveryFailures24h -
        after.legacy.providerDeliveryFailures24h,
      count
    )
  })
})

test("leased outbox preparation persists exact first-send bytes across retry and rejects stale leases", async () => {
  await inRolledBackTxn(async (tx) => {
    const f = await fixture(tx)
    await verify(tx, f, await ready(tx, f))
    const [row] = await asPostgrestRole(
      tx,
      "service_role",
      {},
      (sp) =>
        sp`select * from public.claim_qr_status_emails(${f.merchantId}, 20)`
    )
    const original = JSON.stringify({
      from: "Original <sender@example.test>",
      to: [row.recipient],
      subject: "Original subject",
      text: "Original content https://original.test/app/qr",
      html: "<p>Original content</p>",
      reply_to: "original@example.test",
    })
    const prepare = (lease, payload) =>
      asPostgrestRole(
        tx,
        "service_role",
        {},
        (sp) =>
          sp`select public.prepare_qr_status_email(${row.id}, ${lease}, ${payload}) as payload`
      )
    await assert.rejects(prepare(randomUUID(), original), /lease expired/)
    assert.equal((await prepare(row.lease_id, original))[0].payload, original)
    await asPostgrestRole(
      tx,
      "service_role",
      {},
      (sp) =>
        sp`select public.finish_qr_status_email(${row.id}, ${row.lease_id}, 'temporary')`
    )
    await tx`update public.qr_status_email_outbox set next_attempt_at = now() where id = ${row.id}`
    const [retry] = await asPostgrestRole(
      tx,
      "service_role",
      {},
      (sp) =>
        sp`select * from public.claim_qr_status_emails(${f.merchantId}, 20)`
    )
    assert.equal(retry.id, row.id)
    assert.equal(retry.provider_payload, original)
    assert.equal(
      (
        await prepare(retry.lease_id, JSON.stringify({ changed: "deployment" }))
      )[0].payload,
      original
    )
    await assert.rejects(prepare(row.lease_id, original), /lease expired/)
  })
})
