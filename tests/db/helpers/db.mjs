import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import postgres from "postgres"

import { assertLocalSupabaseDbUrl } from "./db-target.mjs"

/**
 * Live-Supabase helper for the DB integration tier (`pnpm test:db`).
 *
 * These tests prove the ledger/RLS invariants mocks cannot enforce — one stamp
 * per UK business day, single-use redemption tokens, tenant isolation — by
 * calling the real security-definer RPCs against the local Supabase Postgres
 * reached via SUPABASE_DB_URL (.env.local points at 127.0.0.1:54322). They run
 * on `node --test` (no browser), separate from the Playwright e2e tier, and
 * skip cleanly when no live DB is reachable so the DB-free gates never block.
 */

export function dbUrl() {
  const env = {
    ...readEnvFile(path.join(projectRoot, ".env")),
    ...readEnvFile(path.join(projectRoot, ".env.local")),
    ...process.env,
  }

  return assertLocalSupabaseDbUrl(env.SUPABASE_DB_URL)
}

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
)

let cached = null

export function db() {
  if (cached) return cached
  const url = dbUrl()
  if (!url) throw new Error("SUPABASE_DB_URL is not set")
  cached = postgres(url, {
    max: 1,
    idle_timeout: 5,
  })
  return cached
}

export async function closeDb() {
  if (cached) {
    await cached.end({ timeout: 5 })
    cached = null
  }
}

/**
 * True when SUPABASE_DB_URL is set, the DB answers, AND the trust-mechanic RPCs
 * are deployed (schema current). Used to skip the tier when there is no DB.
 */
export async function isLiveDbReady() {
  if (!dbUrl()) return false
  try {
    const rows = await db()`
      select count(*)::int as n
      from pg_proc
      where proname in (
        'join_customer_membership_with_first_stamp',
        'issue_self_service_stamp',
        'redeem_self_service_reward',
        'create_reward_scan_token',
        'collect_reward_scan_token'
      )`
    return (rows[0]?.n ?? 0) >= 5
  } catch {
    return false
  }
}

/** Today's UK (Europe/London) business date as the DB computes it. */
export const UK_TODAY = "(now() at time zone 'Europe/London')::date"

/**
 * Run `fn(tx)` inside a transaction with the service-role request context set
 * (so the customer RPCs take the `is_service_role_request()` bypass — app
 * parity), then ALWAYS roll back so the seed is never mutated. Assertion
 * failures still propagate; only the sentinel rollback is swallowed.
 */
export async function inRolledBackTxn(fn) {
  const ROLLBACK = Symbol("rollback")
  try {
    await db().begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
      await fn(tx)
      throw ROLLBACK
    })
  } catch (error) {
    if (error !== ROLLBACK) throw error
  }
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {}

  const values = {}

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) continue

    const equalsIndex = trimmed.indexOf("=")

    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    values[key] = value
  }

  return values
}
