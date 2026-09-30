import { createHash, randomUUID } from "node:crypto"

import { expect, type BrowserContext, type Page } from "@playwright/test"

import { customerEmailHmac } from "@/lib/customer/email-pii-core"
import {
  EMAIL_HANDOFF_TTL_SECONDS,
  EMAIL_SIGN_IN_TTL_SECONDS,
  createPendingEmailSignInCookieValue,
  createVerifiedEmailHandoffCookieValue,
  emailSignInCodeHmac,
} from "@/lib/customer/email-sign-in-core"
import { PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS } from "@/lib/customer/phone-code-email-fallback"
import {
  createPendingPhoneCookieValue,
  readPendingPhoneCookieValue,
} from "@/lib/customer/session-cookie-core"
import { issueCustomerDeviceToken } from "@/lib/security/customer-device-token"

import type { Sql } from "./admin-live-db"
import {
  DEV_OTP,
  openOtpStep,
  type DisposablePhone,
} from "./customer-join-live-db"
import { installFallbackClock, takeEmailFallback } from "./email-fallback"
import type { PublicQrRouterFixture } from "./public-qr-router-live-db"

/**
 * Fixtures for the join-by-email journeys against local Supabase. The server
 * skips the email provider while a local dev code is configured, so a journey
 * either confirms with that code or plants the encrypted challenge cookie the
 * send step would have set, with a code the test knows. Planting a known code
 * exercises the real digest comparison rather than the dev-code shortcut.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"

export const PENDING_EMAIL_SIGN_IN_COOKIE = "nabaperks_pending_email_sign_in"
export const EMAIL_HANDOFF_COOKIE = "nabaperks_email_handoff"
const PENDING_PHONE_COOKIE = "nabaperks_pending_phone"
const DEVICE_COOKIE = "nabaperks_device"

export type EmailJoinDevice = {
  readonly deviceId: string
  readonly deviceHash: string
}

export type EmailWalletRow = {
  readonly customer_id: string
  readonly phone_hmac: string | null
  readonly email_verified: boolean
}

/** Why the email journeys cannot run here, or undefined when they can. */
export function customerJoinEmailSkipReason(
  mode: "existing" | "full"
): string | undefined {
  if (process.env.CUSTOMER_EMAIL_AUTH_MODE !== mode) {
    return `set CUSTOMER_EMAIL_AUTH_MODE=${mode} for the join-by-email journeys`
  }
  try {
    customerEmailHmac("probe@example.test")
  } catch {
    return "CUSTOMER_EMAIL_HMAC_SECRET is required for the join-by-email journeys"
  }
  return undefined
}

export function uniqueJoinEmail(label: string): string {
  return `join-email-${label}-${randomUUID().slice(0, 12)}@example.test`
}

/**
 * Gives the browser a device the test knows, so a session or handoff can be
 * traced to it. Replacing it mid-journey is how a second device is simulated.
 */
export async function installKnownDevice(
  context: BrowserContext
): Promise<EmailJoinDevice> {
  const deviceId = randomUUID()
  const issuedAt = Math.floor(Date.now() / 1000)
  await context.addCookies([
    {
      name: DEVICE_COOKIE,
      value: issueCustomerDeviceToken(deviceId, sessionSecret()),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: issuedAt + 60 * 60,
    },
  ])
  return {
    deviceId,
    deviceHash: createHash("sha256")
      .update(`customer-device:${deviceId}`)
      .digest("hex"),
  }
}

/**
 * The challenge cookie the send step sets, for a code the test chooses. Its
 * resend time is already past so the code step can resend at once.
 */
export async function installPendingEmailChallenge(
  context: BrowserContext,
  input: { readonly email: string; readonly code: string }
): Promise<void> {
  const secret = sessionSecret()
  const now = Math.floor(Date.now() / 1000)
  const challengeId = randomUUID()
  const email = input.email.trim().toLowerCase()
  await context.addCookies([
    {
      name: PENDING_EMAIL_SIGN_IN_COOKIE,
      value: createPendingEmailSignInCookieValue(
        {
          version: 1,
          purpose: "join",
          email,
          emailHmac: customerEmailHmac(email),
          challengeId,
          codeHmac: emailSignInCodeHmac({
            secret,
            purpose: "join",
            challengeId,
            email,
            code: input.code,
          }),
          delivery: "sent",
          issuedAt: now - 120,
          expiresAt: now + EMAIL_SIGN_IN_TTL_SECONDS,
          resendAvailableAt: now - 60,
        },
        secret
      ),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: now + EMAIL_SIGN_IN_TTL_SECONDS,
    },
  ])
}

/** A handoff for `email`, bound to another device's hash. */
export async function installForeignDeviceHandoff(
  context: BrowserContext,
  input: {
    readonly email: string
    readonly merchantSlug: string
    readonly qrId: string
    readonly deviceHash: string
  }
): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await context.addCookies([
    {
      name: EMAIL_HANDOFF_COOKIE,
      value: createVerifiedEmailHandoffCookieValue(
        {
          version: 1,
          handoffId: randomUUID(),
          email: input.email,
          emailHmac: customerEmailHmac(input.email),
          deviceHash: input.deviceHash,
          merchantSlug: input.merchantSlug,
          qrId: input.qrId,
          issuedAt: now,
          expiresAt: now + EMAIL_HANDOFF_TTL_SECONDS,
        },
        sessionSecret()
      ),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: now + EMAIL_HANDOFF_TTL_SECONDS,
    },
  ])
}

/**
 * Moves the pending phone code's send time `seconds` into the past, as if the
 * server had sent it then: the server times the email fallback from its own
 * send time and clock, which the page clock cannot move. Re-sealed with the
 * dev server's session secret, so the server reads it as its own.
 */
export async function agePendingPhoneCode(
  page: Page,
  seconds: number = PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS + 1
): Promise<void> {
  const context = page.context()
  const cookie = (await context.cookies()).find(
    (candidate) => candidate.name === PENDING_PHONE_COOKIE
  )
  if (!cookie) throw new Error("No phone code is pending to age.")
  const secret = sessionSecret()
  const read = readPendingPhoneCookieValue(
    cookie.value,
    secret,
    Math.floor(Date.now() / 1000)
  )
  if (!read.ok) throw new Error(`Pending phone code unreadable: ${read.reason}`)
  await context.addCookies([
    {
      name: PENDING_PHONE_COOKIE,
      value: createPendingPhoneCookieValue(
        { ...read.payload, issuedAt: read.payload.issuedAt - seconds },
        secret
      ),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: cookie.expires,
    },
  ])
}

/**
 * Scan the venue QR and send a text to `phone` (phone always leads), let 30
 * seconds pass for the server (aging the pending code) and the page clock,
 * take the email fallback, and send a code to `email`. Installs the page
 * clock, so call it before any navigation. Pass the same `phone` to the
 * journey's cleanup: its send buckets are spent.
 */
export async function requestJoinEmailCode(
  page: Page,
  fixture: PublicQrRouterFixture,
  email: string,
  phone: DisposablePhone
): Promise<void> {
  await installFallbackClock(page)
  await openOtpStep(page, fixture, phone)
  await agePendingPhoneCode(page)
  await takeEmailFallback(page)
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("step") === "email" &&
      url.searchParams.get("qr") === fixture.activeQrId
  )
  await expect(
    page.getByRole("heading", { name: "Get your code by email", exact: true })
  ).toBeVisible()
  await expect(page.getByLabel("UK mobile number")).toHaveCount(0)

  await page.getByLabel("Email address").fill(email)
  await page.getByRole("button", { name: "Send code by email" }).click()
  await expect(page).toHaveURL(/step=otp/)
  await expect(
    page.getByRole("heading", { name: "Enter your code" })
  ).toBeVisible()
  await expect(page.getByText(maskedJoinEmail(email))).toBeVisible()
}

/** Confirm the pending code (email or phone), by default with the local dev code. */
export async function confirmJoinCode(
  page: Page,
  code: string = DEV_OTP
): Promise<void> {
  await page.getByLabel("Your code").fill(code)
  await page.getByRole("button", { name: "Continue" }).click()
}

export async function readEmailWallets(
  sql: Sql,
  email: string
): Promise<readonly EmailWalletRow[]> {
  return sql<readonly EmailWalletRow[]>`
    select
      id::text as customer_id,
      phone_hmac,
      email_verified_at is not null as email_verified
    from public.customers
    where email_hmac = ${customerEmailHmac(email)}
       or email = ${email}`
}

export async function countDeviceSessions(
  sql: Sql,
  customerId: string,
  device: EmailJoinDevice
): Promise<number> {
  const [row] = await sql<readonly { readonly count: number }[]>`
    select count(*)::int as count
    from public.customer_sessions
    where customer_id = ${customerId}::uuid
      and device_hash = ${device.deviceHash}
      and revoked_at is null`
  return row?.count ?? 0
}

/** Gives the fixture's customer the verified email digest a lookup needs. */
export async function verifyFixtureCustomerEmail(
  sql: Sql,
  fixture: PublicQrRouterFixture
): Promise<string> {
  const [row] = await sql<readonly { readonly email: string }[]>`
    update public.customers
    set email_hmac = ${customerEmailHmacForCustomer(fixture)},
        email_verified_at = coalesce(email_verified_at, now())
    where id = ${fixture.customerId}::uuid
    returning email`
  if (!row) throw new Error("The fixture customer is missing.")
  return row.email
}

const EMAIL_SEND_PREFIX = "customer-email-sign-in:send"

/** Send buckets every local email journey shares, before hashing. */
export const EMAIL_SEND_SHARED_BUCKET_KEYS = [
  `${EMAIL_SEND_PREFIX}:ip:unknown`,
  `${EMAIL_SEND_PREFIX}:source:minute:unknown`,
  `${EMAIL_SEND_PREFIX}:source:hour:unknown`,
  `${EMAIL_SEND_PREFIX}:platform:minute`,
  `${EMAIL_SEND_PREFIX}:platform:hour`,
  "email-sign-in:verify:ip:unknown",
] as const

/**
 * Removes wallets, sessions and events for `emails`, plus the send, cooldown
 * and guess buckets their journeys spent (the shared IP send bucket, the
 * network-source minute and hour backstops, the platform-wide send caps and
 * the shared IP guess bucket too, so repeated local runs start from the same
 * limits). The browser sends no trusted client IP locally, so its IP and
 * network source are both `unknown` (lib/customer/email-sign-in.ts admitSend;
 * the platform keys are fixed in 20261009120000).
 */
export async function cleanupEmailJoinRows(
  sql: Sql,
  emails: readonly string[]
): Promise<void> {
  const keys: string[] = [...EMAIL_SEND_SHARED_BUCKET_KEYS]
  for (const email of emails) {
    const hmac = customerEmailHmac(email)
    keys.push(
      `${EMAIL_SEND_PREFIX}:recipient:${hmac}`,
      `customer-email-otp:cooldown:${email}`,
      `email-sign-in:verify:email:${hmac}`
    )
    const wallets = await readEmailWallets(sql, email)
    for (const wallet of wallets) {
      await deleteCustomerRows(sql, wallet.customer_id)
    }
  }
  for (const key of keys) {
    await sql`
      delete from public.rate_limit_buckets
      where bucket_key = ${createHash("sha256").update(key).digest("hex")}`
  }
}

async function deleteCustomerRows(sql: Sql, customerId: string) {
  await sql`
    delete from public.product_events
    where customer_id = ${customerId}::uuid`
  await sql`
    delete from public.consent_records
    where customer_id = ${customerId}::uuid`
  await sql`
    delete from public.stamp_events
    where membership_id in (
      select id from public.customer_memberships
      where customer_id = ${customerId}::uuid
    )`
  await sql`
    delete from public.customer_memberships
    where customer_id = ${customerId}::uuid`
  await sql`
    delete from public.customers
    where id = ${customerId}::uuid`
}

function customerEmailHmacForCustomer(fixture: PublicQrRouterFixture): string {
  const runId = fixture.activeQrId.replace("e2e-public-", "")
  return customerEmailHmac(`public-qr-customer-${runId}@example.test`)
}

/** What the code step shows of the address, e.g. "j***@example.test". */
export function maskedJoinEmail(email: string): string {
  const at = email.indexOf("@")
  return `${email[0]}***${email.slice(at)}`
}

function sessionSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim()
  if (!secret || secret.length < 16) {
    throw new Error("CUSTOMER_SESSION_SECRET is required for email join E2E.")
  }
  return secret
}
