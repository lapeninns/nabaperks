import { createHmac, randomUUID } from "node:crypto"

import { connectLocalDb, type Sql } from "./admin-live-db"
import {
  cleanupCustomerReadbackRows,
  createCustomerReadbackSeed,
  insertCustomerReadbackRows,
  pickSeedCustomerSetup,
  type CustomerReadbackSeed,
} from "./customer-readback-seed"

const CUSTOMER_SESSION_COOKIE = "nabaperks_customer_session"
const CUSTOMER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

type CustomerSessionPayload = {
  readonly version: 2
  readonly sessionId: string
  readonly customerId: string
  readonly issuedAt: number
  readonly expiresAt: number
}

export type BrowserCustomerSession = {
  readonly customerId: string
  readonly sessionId: string
  readonly cookieName: string
  readonly cookieValue: string
  readonly expiresAt: number
}

export type CustomerReadbackFixture = CustomerReadbackSeed & {
  readonly populatedSession: BrowserCustomerSession
  readonly emptySession: BrowserCustomerSession
}

export function customerReadbackLiveDbSkipReason(): string | undefined {
  if (process.env.CUSTOMER_FLOW_E2E !== "1") {
    return "set CUSTOMER_FLOW_E2E=1 with local Supabase to run customer browser proof"
  }
  if (!process.env.CUSTOMER_SESSION_SECRET?.trim()) {
    return "CUSTOMER_SESSION_SECRET is required for customer browser proof"
  }
  if (!process.env.SUPABASE_DB_URL?.trim()) {
    return "SUPABASE_DB_URL must point at local Supabase Postgres"
  }
  return undefined
}

export function connectCustomerReadbackDb(): Sql | undefined {
  return connectLocalDb()
}

export async function createCustomerReadbackFixture(
  sql: Sql
): Promise<CustomerReadbackFixture | undefined> {
  const setup = await pickSeedCustomerSetup(sql)
  if (!setup) return undefined

  const { seed, runId } = createCustomerReadbackSeed(setup)

  try {
    await insertCustomerReadbackRows(sql, seed, setup, runId)

    return {
      ...seed,
      populatedSession: await createBrowserCustomerSession(sql, seed.customerId),
      emptySession: await createBrowserCustomerSession(sql, seed.emptyCustomerId),
    }
  } catch (error) {
    await cleanupCustomerReadbackRows(sql, seed)
    throw error
  }
}

export async function cleanupCustomerReadbackFixture(
  sql: Sql,
  fixture: CustomerReadbackFixture | undefined
): Promise<void> {
  await cleanupCustomerReadbackRows(sql, fixture)
}

async function createBrowserCustomerSession(
  sql: Sql,
  customerId: string
): Promise<BrowserCustomerSession> {
  const sessionId = randomUUID()
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + CUSTOMER_SESSION_TTL_SECONDS
  const payload: CustomerSessionPayload = {
    version: 2,
    sessionId,
    customerId,
    issuedAt,
    expiresAt,
  }

  await sql`
    insert into public.customer_sessions (
      id,
      customer_id,
      created_at,
      expires_at,
      last_seen_at
    )
    values (
      ${sessionId}::uuid,
      ${customerId}::uuid,
      to_timestamp(${issuedAt}),
      to_timestamp(${expiresAt}),
      to_timestamp(${issuedAt})
    )`

  return {
    customerId,
    sessionId,
    cookieName: CUSTOMER_SESSION_COOKIE,
    cookieValue: signPayload(payload, customerSessionSecret()),
    expiresAt,
  }
}

function signPayload(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = createHmac("sha256", secret)
    .update(body)
    .digest("base64url")

  return `${body}.${signature}`
}

function customerSessionSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim()
  if (!secret) {
    throw new Error("CUSTOMER_SESSION_SECRET is required for customer sessions.")
  }
  return secret
}
