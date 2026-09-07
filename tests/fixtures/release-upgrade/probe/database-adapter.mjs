import assert from "node:assert/strict"
import postgres from "postgres"

let transaction
const TABLE_RESULTS = new Set([
  "claim_stripe_webhook_event",
  "create_reward_scan_token",
])
const RPCS = new Set([
  ...TABLE_RESULTS,
  "fail_stripe_webhook_event",
  "complete_stripe_webhook_event",
  "apply_current_stripe_subscription",
])

export function validateProbeDatabase(env) {
  const url = new URL(env.UPGRADE_DATABASE_URL)
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol))
  assert.ok(
    ["127.0.0.1", "[::1]"].includes(url.hostname),
    "Disposable loopback required"
  )
  assert.match(url.pathname, /^\/codex_upgrade_[a-z0-9_]+$/)
  assert.equal(url.search + url.hash, "")
  assert.match(env.UPGRADE_TARGET_MARKER ?? "", /^[a-f0-9-]{36}$/)
  return url
}

// This adapter deliberately does not import dotenv or the normal DB test helper.
// It preserves actual application RPC argument names/values and executes the
// deployed SQL function, replacing only the Supabase HTTP transport seam.
export function createSupabaseServiceRoleClient() {
  assert.ok(transaction, "A verified disposable transaction is required")
  return {
    async rpc(name, parameters) {
      assert.ok(RPCS.has(name), "Unreviewed RPC forbidden")
      const entries = Object.entries(parameters)
      assert.ok(entries.every(([key]) => /^p_[a-z0-9_]+$/.test(key)))
      const argumentsSql = entries
        .map(([key], index) => `${key} => $${index + 1}`)
        .join(", ")
      const query = TABLE_RESULTS.has(name)
        ? `select * from public.${name}(${argumentsSql})`
        : `select public.${name}(${argumentsSql}) as result`
      try {
        const rows = await transaction.savepoint((savepoint) =>
          savepoint.unsafe(
            query,
            entries.map(([, value]) => value)
          )
        )
        const data = TABLE_RESULTS.has(name) ? rows : rows[0].result
        return {
          data: JSON.parse(
            JSON.stringify(data, (_key, value) =>
              typeof value === "bigint" ? value.toString() : value
            )
          ),
          error: null,
        }
      } catch (error) {
        return {
          data: null,
          error: { message: error.message, code: error.code },
        }
      }
    },
  }
}

export async function withDisposableTransaction(callback, env = process.env) {
  const url = validateProbeDatabase(env)
  const sql = postgres(url.toString(), {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 5,
    onnotice: () => {},
    types: { bigint: postgres.BigInt },
  })
  const rollback = Symbol("successful-probe-rollback")
  let result
  try {
    await sql.begin(async (tx) => {
      const [target] =
        await tx`select current_database() as database, marker::text, consumed from codex_upgrade_guard.target where marker=${env.UPGRADE_TARGET_MARKER}::uuid`
      assert.equal(target?.database, decodeURIComponent(url.pathname.slice(1)))
      assert.equal(target?.marker, env.UPGRADE_TARGET_MARKER)
      assert.equal(target?.consumed, true)
      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
      transaction = tx
      result = await callback(tx)
      throw rollback
    })
  } catch (error) {
    if (error !== rollback) throw error
  } finally {
    transaction = undefined
    await sql.end({ timeout: 5 })
  }
  return result
}
