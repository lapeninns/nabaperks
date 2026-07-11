import { createHash, createHmac, randomUUID } from "node:crypto"

import { expect, type BrowserContext, type Page } from "@playwright/test"
import { parsePhoneNumberFromString } from "libphonenumber-js"

import {
  customerOtpSendIpRateLimitKey,
  customerOtpSendPhoneRateLimitKey,
  customerOtpVerifyPhoneRateLimitKey,
} from "@/lib/customer/otp-rate-limit-core"

import type { Sql } from "./admin-live-db"
import type { BrowserCustomerSession } from "./customer-readback-live-db"
import {
  publicQrPath,
  type PublicQrRouterFixture,
} from "./public-qr-router-live-db"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3500"
export const DEV_OTP = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"
export const WRONG_OTP = DEV_OTP === "000000" ? "111111" : "000000"

export type DisposablePhone = {
  readonly national: string
  readonly e164: string
  readonly last4: string
  readonly phoneHmac: string
}

export type JoinedMembershipRow = {
  readonly customer_id: string
  readonly membership_id: string
  readonly current_stamp_count: number
  readonly total_stamps_earned: number
  readonly stamp_count: number
  readonly join_event_count: number
}

export type MembershipCountRow = {
  readonly membership_count: number
}

type CustomerIdRow = {
  readonly customer_id: string
}

export async function openOtpStep(
  page: Page,
  fixture: PublicQrRouterFixture,
  phone: DisposablePhone,
  options?: { ref?: string }
): Promise<void> {
  const ref = options?.ref

  if (ref) {
    // The real referral link a member shares: no QR scan, just ?ref. With no qr
    // the join route derives straight to the phone step (derive.ts).
    await page.goto(
      `/m/${fixture.merchantSlug}/join?ref=${encodeURIComponent(ref)}`
    )
  } else {
    await page.goto(publicQrPath(fixture.activeQrId))
    await expect(
      page.getByRole("heading", { name: "Keep your card on your phone" })
    ).toBeVisible()

    await page.getByRole("link", { name: "Get today's stamp" }).click()
  }

  await expect(
    page.getByRole("heading", { name: "Save your card to your number" })
  ).toBeVisible()

  await page.locator("#contact").fill(phone.national)
  await page.getByRole("button", { name: "Text me the code" }).click()
  await expect(
    page.getByRole("heading", { name: "Enter your code" })
  ).toBeVisible()
  await expect(page.locator("#otp")).toBeVisible()

  // The "Use a different number" back link preserves the entry params — the QR
  // id and (when present) the referral code — so a bounce-back re-hydrates them.
  const backParams = new URLSearchParams()
  if (ref) backParams.set("ref", ref)
  else backParams.set("qr", fixture.activeQrId)
  backParams.set("step", "phone")
  await expect(
    page.getByRole("link", { name: "Use a different number" })
  ).toHaveAttribute(
    "href",
    `/m/${fixture.merchantSlug}/join?${backParams.toString()}`
  )
}

export async function openTermsStep(
  page: Page,
  fixture: PublicQrRouterFixture,
  phone: DisposablePhone
): Promise<void> {
  await openOtpStep(page, fixture, phone)
  await page.locator("#otp").fill(DEV_OTP)
  await page.getByRole("button", { name: "Check code" }).click()
  await expect(
    page.getByRole("heading", { name: "Collect your first stamp" })
  ).toBeVisible()
}

export async function openDirectTermsStep(
  page: Page,
  merchantSlug: string,
  phone: DisposablePhone
): Promise<void> {
  await page.goto(`/m/${merchantSlug}`)
  await expect(
    page.getByRole("heading", { name: "Collect your stamp" })
  ).toBeVisible()

  await page.getByRole("link", { name: "Join rewards" }).click()
  await expect(
    page.getByRole("heading", { name: "Save your card to your number" })
  ).toBeVisible()

  await page.locator("#contact").fill(phone.national)
  await page.getByRole("button", { name: "Text me the code" }).click()
  await expect(
    page.getByRole("heading", { name: "Enter your code" })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Use a different number" })
  ).toHaveAttribute("href", `/m/${merchantSlug}/join?step=phone`)

  await page.locator("#otp").fill(DEV_OTP)
  await page.getByRole("button", { name: "Check code" }).click()
  await expect(
    page.getByRole("heading", { name: "Save your loyalty card" })
  ).toBeVisible()
}

export async function installCustomerSession(
  context: BrowserContext,
  session: BrowserCustomerSession
): Promise<void> {
  await context.addCookies([
    {
      name: session.cookieName,
      value: session.cookieValue,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: session.expiresAt,
    },
  ])
}

export function disposableUkMobile(): DisposablePhone {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const digits = randomUUID().replace(/\D/g, "").padEnd(8, "0").slice(0, 8)
    const national = `074${digits}`
    const parsed = parsePhoneNumberFromString(national, "GB")

    if (parsed?.isValid()) {
      return disposablePhoneFromParts(national, parsed.number)
    }
  }

  return disposablePhoneFromParts("07400123456", "+447400123456")
}

export async function readJoinedMembership(
  sql: Sql,
  fixture: PublicQrRouterFixture,
  phone: DisposablePhone
): Promise<JoinedMembershipRow | undefined> {
  const rows = await sql<readonly JoinedMembershipRow[]>`
    select
      customers.id::text as customer_id,
      customer_memberships.id::text as membership_id,
      customer_memberships.current_stamp_count::int,
      customer_memberships.total_stamps_earned::int,
      (
        select count(*)::int
        from public.stamp_events
        where stamp_events.membership_id = customer_memberships.id
          and stamp_events.event_type = 'earned'
      ) as stamp_count,
      (
        select count(*)::int
        from public.product_events
        where product_events.membership_id = customer_memberships.id
          and product_events.event_name = 'customer_joined'
      ) as join_event_count
    from public.customer_memberships
    join public.customers
      on customers.id = customer_memberships.customer_id
    where customer_memberships.merchant_id = ${fixture.merchantId}::uuid
      and customers.phone_hmac = ${phone.phoneHmac}
    order by customer_memberships.created_at desc
    limit 1`

  return rows.at(0)
}

export async function readMerchantMembershipCount(
  sql: Sql,
  fixture: PublicQrRouterFixture
): Promise<number> {
  const rows = await sql<readonly MembershipCountRow[]>`
    select count(*)::int as membership_count
    from public.customer_memberships
    where merchant_id = ${fixture.merchantId}::uuid`

  return rows.at(0)?.membership_count ?? 0
}

export type SeededReferrer = {
  readonly membershipId: string
  readonly referralCode: string
  readonly customerId: string
}

// Enrol a referrer at the fixture venue and return their minted referral code —
// the value a friend carries as ?ref. Uses an email-only customer (the friend's
// phone stays distinct, so the friend is a genuinely different regular).
export async function seedReferrerMembership(
  sql: Sql,
  fixture: PublicQrRouterFixture
): Promise<SeededReferrer> {
  const [customer] = await sql<readonly { id: string }[]>`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`ref-${randomUUID()}@test.local`}, now(), now(), now())
    returning id::text as id`

  // Enrol by direct insert (like the fixture's own membership seed) so the
  // referral_code DEFAULT mints a code. The join RPC's service-role GUC bypass
  // isn't set on this raw connection; the friend's join below exercises the real
  // RPC end-to-end via the dev server's service-role client.
  const [membership] = await sql<
    readonly { membership_id: string; referral_code: string }[]
  >`
    insert into public.customer_memberships (merchant_id, customer_id)
    values (${fixture.merchantId}::uuid, ${customer.id}::uuid)
    returning id::text as membership_id, referral_code`

  return {
    membershipId: membership.membership_id,
    referralCode: membership.referral_code,
    customerId: customer.id,
  }
}

export type ReferralEdge = {
  readonly referrerMembershipId: string
  readonly referralCodeUsed: string
}

export async function readReferralEdge(
  sql: Sql,
  referredMembershipId: string
): Promise<ReferralEdge | undefined> {
  const rows = await sql<
    readonly {
      referrer_membership_id: string
      referral_code_used: string
    }[]
  >`
    select
      referrer_membership_id::text as referrer_membership_id,
      referral_code_used
    from public.referrals
    where referred_membership_id = ${referredMembershipId}::uuid`

  const row = rows.at(0)
  if (!row) return undefined
  return {
    referrerMembershipId: row.referrer_membership_id,
    referralCodeUsed: row.referral_code_used,
  }
}

export async function cleanupCustomerJoinRows(
  sql: Sql,
  fixture: PublicQrRouterFixture | undefined,
  phone?: DisposablePhone
): Promise<void> {
  const rateLimitKeys = [customerOtpSendIpRateLimitKey("unknown")]
  if (phone) {
    rateLimitKeys.push(
      customerOtpSendPhoneRateLimitKey(phone.e164),
      customerOtpVerifyPhoneRateLimitKey(phone.e164)
    )
  }
  for (const key of rateLimitKeys) {
    await sql`
      delete from public.rate_limit_buckets
      where bucket_key = ${createHash("sha256").update(key).digest("hex")}`
  }

  const merchantId = fixture?.merchantId ?? null
  const phoneHmac = phone?.phoneHmac ?? null
  const customerRows = await sql<readonly CustomerIdRow[]>`
    select customers.id::text as customer_id
    from public.customers
    where ${phoneHmac}::text is not null
      and customers.phone_hmac = ${phoneHmac}
    union
    select customer_memberships.customer_id::text as customer_id
    from public.customer_memberships
    where ${merchantId}::uuid is not null
      and customer_memberships.merchant_id = ${merchantId}::uuid`

  for (const row of customerRows) {
    await sql`
      delete from public.customer_sessions
      where customer_id = ${row.customer_id}::uuid`
    await sql`
      delete from public.product_events
      where customer_id = ${row.customer_id}::uuid`
  }

  if (fixture) {
    await sql`
      delete from public.consent_records
      where merchant_id = ${fixture.merchantId}::uuid`
    await sql`
      delete from public.product_events
      where merchant_id = ${fixture.merchantId}::uuid`
    await sql`
      delete from public.reward_events
      where merchant_id = ${fixture.merchantId}::uuid`
    await sql`
      delete from public.stamp_events
      where merchant_id = ${fixture.merchantId}::uuid`
    await sql`
      delete from public.customer_memberships
      where merchant_id = ${fixture.merchantId}::uuid`
  }

  for (const row of customerRows) {
    await sql`
      delete from public.customers
      where id = ${row.customer_id}::uuid`
  }
}

function disposablePhoneFromParts(
  national: string,
  e164: string
): DisposablePhone {
  return {
    national,
    e164,
    last4: e164.replace(/\D/g, "").slice(-4),
    phoneHmac: customerPhoneHmac(e164),
  }
}

function customerPhoneHmac(e164: string): string {
  return createHmac("sha256", requiredCustomerPhoneHmacSecret())
    .update(e164)
    .digest("hex")
}

function requiredCustomerPhoneHmacSecret(): string {
  const secret = process.env.CUSTOMER_PHONE_HMAC_SECRET?.trim()
  if (!secret) {
    throw new Error("CUSTOMER_PHONE_HMAC_SECRET is required for join E2E.")
  }

  return secret
}
