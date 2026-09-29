import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn } from "./helpers/db.mjs"

/**
 * QA BUG-003 (20261009120000): signed-out email sign-in admission must not
 * let one actor starve every other customer of email codes.
 *
 * Before, the app passed two constant, unkeyed "global" buckets (30 a minute,
 * 150 an hour) shared by every send on the platform, so ~150 cheap requests
 * from three IPs refused every customer's email code for up to an hour. The
 * app now keys those two windows by the client's coarse network source (IPv4
 * /24, IPv6 /48), and the RPC adds its own platform-wide safety cap high
 * enough that no single source can reach it. This inverts QA TC-SECURITY-008:
 * after an attacker exhausts their own source's windows, a customer from
 * another source is still admitted.
 */

const SIGNATURE =
  "public.admit_anonymous_customer_email_otp_send(text,text,text,text,text,text)"
const ready = await (async () => {
  try {
    const [row] =
      await db()`select to_regprocedure(${SIGNATURE}) is not null as ready`
    return row.ready
  } catch {
    return false
  }
})()
const skip = ready ? false : "local anonymous email admission RPC unavailable"
after(closeDb)

const sha256 = (value) => createHash("sha256").update(value).digest("hex")
const PLATFORM_MINUTE = sha256("customer-email-sign-in:send:platform:minute")
const PLATFORM_HOUR = sha256("customer-email-sign-in:send:platform:hour")
const PLATFORM_MINUTE_LIMIT = 120
const PLATFORM_HOUR_LIMIT = 1000

const key = () => randomBytes(32).toString("hex")

// Named arguments, as PostgREST (supabase-js .rpc) sends them.
const call = (sql, b) =>
  sql`select public.admit_anonymous_customer_email_otp_send(
    p_device_bucket => ${b.device},
    p_ip_bucket => ${b.ip},
    p_recipient_bucket => ${b.recipient},
    p_cooldown_bucket => ${b.cooldown},
    p_global_minute_bucket => ${b.minute},
    p_global_hour_bucket => ${b.hour})`

function request(source) {
  return {
    device: key(),
    ip: key(),
    recipient: key(),
    cooldown: key(),
    minute: source.minute,
    hour: source.hour,
  }
}

function source() {
  return { minute: key(), hour: key() }
}

async function resetPlatform(tx) {
  await tx`delete from public.rate_limit_buckets
           where bucket_key in (${PLATFORM_MINUTE}, ${PLATFORM_HOUR})`
}

test(
  "an attacker who exhausts their own source's hour is refused while another source is still admitted",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await resetPlatform(tx)
      const attacker = source()
      // 150 admissions rotating device, IP and recipient, 30 per minute over
      // five minutes: a new minute window for the source, and for the
      // platform, every 30 sends stands in for the clock moving on.
      let minute = key()
      for (let sent = 0; sent < 150; sent++) {
        if (sent % 30 === 0) {
          minute = key()
          await tx`delete from public.rate_limit_buckets
                   where bucket_key = ${PLATFORM_MINUTE}`
        }
        await call(tx, { ...request(attacker), minute })
      }
      await assert.rejects(
        tx.savepoint((sp) => call(sp, { ...request(attacker), minute: key() })),
        /rate limit exceeded/i
      )

      // A customer on another network, in the same hour: still admitted.
      await call(tx, request(source()))
    })
  }
)

test(
  "an attacker who saturates their own source's minute does not refuse another source",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await resetPlatform(tx)
      const attacker = source()
      for (let sent = 0; sent < 30; sent++) await call(tx, request(attacker))
      await assert.rejects(
        tx.savepoint((sp) => call(sp, request(attacker))),
        /rate limit exceeded/i
      )
      await call(tx, request(source()))
    })
  }
)

test(
  "the platform-wide safety cap still refuses every source once reached, and all-or-nothing holds",
  { skip },
  async () => {
    for (const [bucket, limit, windowMs] of [
      [PLATFORM_MINUTE, PLATFORM_MINUTE_LIMIT, 60_000],
      [PLATFORM_HOUR, PLATFORM_HOUR_LIMIT, 3_600_000],
    ]) {
      await inRolledBackTxn(async (tx) => {
        await resetPlatform(tx)
        await call(tx, request(source()))
        const [window] = await tx`
          select count, extract(epoch from reset_at - clock_timestamp()) * 1000 as ms
          from public.rate_limit_buckets where bucket_key = ${bucket}`
        assert.equal(window.count, 1)
        assert.ok(window.ms > windowMs - 10_000 && window.ms <= windowMs)

        await tx`update public.rate_limit_buckets set count = ${limit}
                 where bucket_key = ${bucket}`
        const blocked = request(source())
        await assert.rejects(
          tx.savepoint((sp) => call(sp, blocked)),
          /rate limit exceeded/i
        )
        const debited =
          await tx`select bucket_key from public.rate_limit_buckets
          where bucket_key = any(${Object.values(blocked)}::text[])`
        assert.equal(debited.length, 0)

        await tx`update public.rate_limit_buckets set count = ${limit - 1}
                 where bucket_key = ${bucket}`
        await call(tx, request(source()))
      })
    }
  }
)

test(
  "the deployed app's call (constant global keys, same parameter names) is still admitted",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await resetPlatform(tx)
      const prefix = "customer-email-sign-in:send"
      await call(tx, {
        ...request(source()),
        minute: sha256(`${prefix}:global:minute`),
        hour: sha256(`${prefix}:global:hour`),
      })
      const [overloads] = await tx`
        select count(*)::int as n from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'admit_anonymous_customer_email_otp_send'`
      assert.equal(overloads.n, 1)
    })
  }
)

test(
  "a caller cannot pass the platform keys as its own buckets",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      for (const platform of [PLATFORM_MINUTE, PLATFORM_HOUR]) {
        await assert.rejects(
          tx.savepoint((sp) =>
            call(sp, { ...request(source()), hour: platform })
          ),
          /invalid anonymous customer email otp admission input/i
        )
      }
    })
  }
)
