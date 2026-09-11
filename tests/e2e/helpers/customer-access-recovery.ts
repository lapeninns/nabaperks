import { createHash, randomUUID } from "node:crypto"

import type { BrowserContext } from "@playwright/test"

import { customerEmailHmac } from "@/lib/customer/email-pii-core"
import { codeHmac as recoveryCodeHmac } from "@/lib/customer/access-continuity"
import { createPendingAccessRecoveryCookieValue } from "@/lib/customer/session-cookie-core"
import { issueCustomerDeviceToken } from "@/lib/security/customer-device-token"

import type { Sql } from "./admin-live-db"

const RECOVERY_COOKIE = "nabaperks_access_recovery"
const DEVICE_COOKIE = "nabaperks_device"
const RECOVERY_TTL_SECONDS = 10 * 60
const PLACEHOLDER_HMAC = "a".repeat(64)

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"

export const CUSTOMER_SESSION_COOKIE = "nabaperks_customer_session"

export type PendingAccessRecoveryFixture = {
  readonly customerId: string
  readonly phoneHmac: string
  readonly email: string | null
}

export function customerAccessRecoveryCookieSkipReason(): string | undefined {
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim()
  if (!secret || secret.length < 16) {
    return "CUSTOMER_SESSION_SECRET is required to mint a recovery cookie"
  }
  return undefined
}

export function customerAccessRecoveryMutationSkipReason(): string | undefined {
  const cookieReason = customerAccessRecoveryCookieSkipReason()
  if (cookieReason) return cookieReason

  try {
    customerEmailHmac("recover@example.test")
  } catch {
    return "CUSTOMER_EMAIL_HMAC_SECRET is required to seed a recoverable customer"
  }

  if (!process.env.SUPABASE_DB_URL?.trim()) {
    return "SUPABASE_DB_URL must point at local Supabase Postgres"
  }
  return undefined
}

export async function installPendingAccessRecovery(
  context: BrowserContext,
  options: {
    canUseEmail: boolean
    customerId?: string
    phoneHmac?: string
    email?: string | null
    next?: string
    recoveryCode?: string
  } = { canUseEmail: true }
): Promise<PendingAccessRecoveryFixture> {
  const secret = requiredSessionSecret()
  const customerId = options.customerId ?? randomUUID()
  const phoneHmac = options.phoneHmac ?? PLACEHOLDER_HMAC
  const deviceId = randomUUID()
  const deviceHash = createHash("sha256")
    .update(`customer-device:${deviceId}`)
    .digest("hex")
  const issuedAt = Math.floor(Date.now() / 1000)
  const email = options.canUseEmail ? (options.email ?? null) : null
  const emailHmac = options.canUseEmail
    ? email
      ? customerEmailHmac(email)
      : PLACEHOLDER_HMAC
    : null
  // With a recoveryCode, store the digest the production derivation actually
  // produces, so the happy path exercises the real comparison instead of the
  // dev-OTP bypass. A regression in that derivation then fails the test.
  const codeHmac = options.canUseEmail
    ? options.recoveryCode && email
      ? recoveryCodeHmac({
          customerId,
          deviceHash,
          email,
          code: options.recoveryCode,
        })
      : PLACEHOLDER_HMAC
    : null
  const cookieValue = createPendingAccessRecoveryCookieValue(
    {
      version: 1,
      sessionId: randomUUID(),
      customerId,
      phoneHmac,
      deviceHash,
      emailHmac,
      codeHmac,
      next: options.next ?? "/home",
      issuedAt,
      expiresAt: issuedAt + RECOVERY_TTL_SECONDS,
    },
    secret
  )

  await context.addCookies([
    {
      name: RECOVERY_COOKIE,
      value: cookieValue,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: issuedAt + RECOVERY_TTL_SECONDS,
    },
    {
      name: DEVICE_COOKIE,
      value: issueCustomerDeviceToken(deviceId, secret),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: issuedAt + RECOVERY_TTL_SECONDS,
    },
  ])

  return { customerId, phoneHmac, email }
}

export async function seedRecoverableCustomer(sql: Sql): Promise<{
  readonly customerId: string
  readonly email: string
  readonly phoneHmac: string
}> {
  const customerId = randomUUID()
  const email = `recover-${customerId.slice(0, 8)}@example.test`
  // customers_phone_hmac_unique_idx is a unique index and Playwright runs
  // fullyParallel, so a shared placeholder collides between concurrent
  // fixtures. Derive the digest from this fixture's own id instead.
  const phoneHmac = createHash("sha256")
    .update(`customer-phone:${customerId}`)
    .digest("hex")
  const emailHmac = customerEmailHmac(email)

  await sql`
    insert into public.customers (
      id,
      email,
      email_hmac,
      email_verified_at,
      phone_hmac,
      created_at,
      updated_at
    )
    values (
      ${customerId}::uuid,
      ${email},
      ${emailHmac},
      now(),
      ${phoneHmac},
      now(),
      now()
    )`

  return { customerId, email, phoneHmac }
}

export async function cleanupRecoverableCustomer(
  sql: Sql,
  customerId: string
): Promise<void> {
  await sql`
    delete from public.customer_sessions
    where customer_id = ${customerId}::uuid`
  await sql`
    delete from public.customers
    where id = ${customerId}::uuid`
}

function requiredSessionSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim()
  if (!secret || secret.length < 16) {
    throw new Error(
      "CUSTOMER_SESSION_SECRET is required to mint a recovery cookie."
    )
  }
  return secret
}
