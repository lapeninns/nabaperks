import { randomUUID } from "node:crypto"

import { expect, test, type Page } from "@playwright/test"

import { customerEmailHmac } from "@/lib/customer/email-pii-core"

import type { Sql } from "./helpers/admin-live-db"
import {
  agePendingPhoneCode,
  cleanupEmailJoinRows,
  countDeviceSessions,
  customerJoinEmailSkipReason,
  installKnownDevice,
  maskedJoinEmail,
  readEmailWallets,
  uniqueJoinEmail,
} from "./helpers/customer-join-email-live-db"
import {
  DEV_OTP,
  cleanupCustomerJoinRows,
  disposableUkMobile,
  type DisposablePhone,
} from "./helpers/customer-join-live-db"
import {
  connectCustomerReadbackDb,
  customerReadbackLiveDbSkipReason,
} from "./helpers/customer-readback-live-db"
import { pickSeedCustomerSetup } from "./helpers/customer-readback-seed"
import {
  emailFallback,
  installFallbackClock,
  takeEmailFallback,
} from "./helpers/email-fallback"
import {
  dismissPwaInstall,
  gotoHydratedPage,
  waitForHydratedPage,
} from "./helpers/harness"

/**
 * Email at /home/login against the real server actions and local Supabase,
 * with CUSTOMER_EMAIL_AUTH_MODE=full. The DB-free harness spec
 * (customer-login-email.spec.ts) covers what each step shows; this covers who
 * is signed in and that the page never creates a wallet. Each journey starts
 * where a customer does: a text to a phone, then the email fallback the code
 * step offers 30 seconds later.
 *
 * Opt-in: CUSTOMER_FLOW_E2E=1, local Supabase (SUPABASE_DB_URL), the dev
 * server's CUSTOMER_SESSION_SECRET and CUSTOMER_EMAIL_HMAC_SECRET, and
 * CUSTOMER_EMAIL_AUTH_MODE=full. The local dev code stands in for the email.
 */

const NO_WALLET = "You can use your mobile number instead."
const SESSION_COOKIE = "nabaperks_customer_session"

type EmailWallet = {
  readonly customerId: string
  readonly membershipId: string
  readonly businessName: string
}

type WalletContactRow = {
  readonly email: string | null
  readonly email_hmac: string | null
  readonly email_verified: boolean
  readonly phone_hmac: string | null
}

function skipReason(): string | undefined {
  return (
    customerReadbackLiveDbSkipReason() ?? customerJoinEmailSkipReason("full")
  )
}

test.describe("@customer-flow wallet sign-in by email (live database, mode full)", () => {
  const reason = skipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("a verified email opens the wallet that holds it and creates nothing", async ({
    context,
    page,
  }) => {
    const email = uniqueJoinEmail("login")
    await withDb([email], async (sql, phone) => {
      const wallet = await seedEmailWallet(sql, { email, verified: true })
      test.skip(!wallet, "seed merchant is not available")
      if (!wallet) return
      const device = await installKnownDevice(context)

      await requestLoginEmailCode(page, email, phone)
      await page.getByLabel("Your code").fill(DEV_OTP)
      await page.getByRole("button", { name: "Continue" }).click()

      await expect(page).toHaveURL(/\/home(?:\?|$)/)
      await expect(page.getByText(wallet.businessName).first()).toBeVisible()
      await expect(
        countDeviceSessions(sql, wallet.customerId, device)
      ).resolves.toBe(1)
      // The same wallet, still email-only: signing in added nothing.
      await expect(readEmailWallets(sql, email)).resolves.toEqual([
        {
          customer_id: wallet.customerId,
          phone_hmac: null,
          email_verified: true,
        },
      ])
      await expect
        .poll(() =>
          countLoginEvents(sql, wallet.customerId, "customer_login_verified")
        )
        .toBe(1)
    })
  })

  test("an email no wallet holds is told so after the code, and nothing is created", async ({
    context,
    page,
  }) => {
    const email = uniqueJoinEmail("login-none")
    await withDb([email], async (sql, phone) => {
      await installKnownDevice(context)

      await requestLoginEmailCode(page, email, phone)
      await page.getByLabel("Your code").fill(DEV_OTP)
      await page.getByRole("button", { name: "Continue" }).click()

      await expect(page.getByText(NO_WALLET)).toBeVisible()
      await expect(page).toHaveURL(/\/home\/login/)
      // The scan step a phone with no cards gets (#387), not another code.
      await expect(
        page.getByRole("link", { name: "Scan a venue QR" })
      ).toHaveAttribute("href", "/scan")
      await expect(
        page.getByRole("button", { name: "Send code by email", exact: true })
      ).toHaveCount(0)
      await expect(readEmailWallets(sql, email)).resolves.toEqual([])
      await expect(hasSessionCookie(page)).resolves.toBe(false)

      await page.getByRole("button", { name: "Change email" }).click()
      await expect(page.getByLabel("Email address")).toHaveValue(email)
    })
  })

  test("a text that arrives after the email fallback can still be entered", async ({
    context,
    page,
  }) => {
    await withDb([], async (_sql, phone) => {
      await installKnownDevice(context)
      await installFallbackClock(page)
      await gotoHydratedPage(page, "/home/login")
      await page.locator("#contact").fill(phone.national)
      await page.getByRole("button", { name: "Send my code" }).click()
      await expect(page.getByLabel("Your code")).toBeVisible()
      await agePendingPhoneCode(page)
      await takeEmailFallback(page)
      await expect(page.getByLabel("Email address")).toBeVisible()

      // Taking the fallback kept the phone code: phone returns to it.
      await page.getByRole("button", { name: "Back to the text code" }).click()
      await expect(page.getByLabel("Your code")).toBeVisible()
      await expect(
        page.getByLabel("UK mobile number", { exact: true })
      ).toHaveCount(0)
      await page.getByLabel("Your code").fill(DEV_OTP)
      await page.getByRole("button", { name: "Continue" }).click()
      // The code was accepted; this number simply holds no cards.
      await expect(
        page.getByRole("heading", {
          name: "We couldn't find any cards for this number.",
        })
      ).toBeVisible()
      await expect(hasSessionCookie(page)).resolves.toBe(false)
    })
  })

  test("the server refuses email before the code's 30 seconds, and a reload keeps the code step", async ({
    context,
    page,
  }) => {
    await withDb([], async (_sql, phone) => {
      await installKnownDevice(context)
      await installFallbackClock(page)
      await gotoHydratedPage(page, "/home/login")
      await page.locator("#contact").fill(phone.national)
      await page.getByRole("button", { name: "Send my code" }).click()
      await expect(page.getByLabel("Your code")).toBeVisible()

      // The page clock says 31 seconds; the server's says a few. The switch
      // answers with the code step, not the email form.
      await page.clock.fastForward(31_000)
      await Promise.all([
        page.waitForResponse(
          (response) => response.request().method() === "POST"
        ),
        emailFallback(page).click(),
      ])
      await expect(page.getByLabel("Your code")).toBeVisible()
      await expect(page.getByLabel("Email address")).toHaveCount(0)

      // A reload opens on the pending code, not a blank number, and counts
      // the server's wait again.
      await page.reload()
      await waitForHydratedPage(page)
      await expect(page.getByLabel("Your code")).toBeVisible()
      await expect(page.locator("#contact")).toHaveCount(0)
      await expect(
        page.getByText(new RegExp(`••${phone.national.slice(-3)}\\.`))
      ).toBeVisible()
      await expect(emailFallback(page)).toHaveCount(0)

      // Once 30 seconds have passed for the server, a reload offers email at
      // once and the switch opens it.
      await agePendingPhoneCode(page)
      await page.reload()
      await waitForHydratedPage(page)
      await expect(emailFallback(page)).toBeVisible()
      await emailFallback(page).click()
      await expect(page.getByLabel("Email address")).toBeVisible()

      // And back: the same code step, still pending.
      await page.getByRole("button", { name: "Back to the text code" }).click()
      await expect(page.getByLabel("Your code")).toBeVisible()
    })
  })

  test("an unconfirmed email on a wallet does not open it", async ({
    context,
    page,
  }) => {
    const email = uniqueJoinEmail("login-unverified")
    await withDb([email], async (sql, phone) => {
      const wallet = await seedEmailWallet(sql, { email, verified: false })
      test.skip(!wallet, "seed merchant is not available")
      if (!wallet) return
      const device = await installKnownDevice(context)

      await requestLoginEmailCode(page, email, phone)
      await page.getByLabel("Your code").fill(DEV_OTP)
      await page.getByRole("button", { name: "Continue" }).click()

      await expect(page.getByText(NO_WALLET)).toBeVisible()
      await expect(hasSessionCookie(page)).resolves.toBe(false)
      await expect(
        countDeviceSessions(sql, wallet.customerId, device)
      ).resolves.toBe(0)
      // Proving the inbox at sign-in does not confirm the wallet's email.
      await expect(readWalletContact(sql, wallet.customerId)).resolves.toEqual({
        email,
        email_hmac: null,
        email_verified: false,
        phone_hmac: null,
      })
    })
  })
})

/** Phone first, the 30-second fallback, then a code to `email`. */
async function requestLoginEmailCode(
  page: Page,
  email: string,
  phone: DisposablePhone
) {
  await installFallbackClock(page)
  await gotoHydratedPage(page, "/home/login")
  await expect(page.getByLabel("Email address")).toHaveCount(0)
  await page.locator("#contact").fill(phone.national)
  await page.getByRole("button", { name: "Send my code" }).click()
  await expect(page.getByLabel("Your code")).toBeVisible()
  await agePendingPhoneCode(page)
  await takeEmailFallback(page)
  await expect(
    page.getByRole("heading", { name: "Get your code by email", exact: true })
  ).toBeVisible()
  const field = page.getByLabel("Email address")
  await expect(field).toBeVisible()
  await field.fill(email)
  await page.getByRole("button", { name: "Send code by email" }).click()
  await expect(
    page.getByRole("heading", { name: "Enter your code" })
  ).toBeVisible()
  await expect(page.getByText(maskedJoinEmail(email))).toBeVisible()
}

async function withDb(
  emails: string[],
  run: (sql: Sql, phone: DisposablePhone) => Promise<void>
): Promise<void> {
  const sql = connectCustomerReadbackDb()
  test.skip(!sql, "local Supabase DB is not configured")
  if (!sql) return

  // The number texted before the email fallback; no wallet holds it.
  const phone = disposableUkMobile()
  try {
    await run(sql, phone)
  } finally {
    for (const email of emails) await deleteWalletsByEmail(sql, email)
    await cleanupEmailJoinRows(sql, emails)
    await cleanupCustomerJoinRows(sql, undefined, phone)
    await sql.end()
  }
}

/** An email-only wallet with one card at the seed venue. */
async function seedEmailWallet(
  sql: Sql,
  input: { readonly email: string; readonly verified: boolean }
): Promise<EmailWallet | undefined> {
  const setup = await pickSeedCustomerSetup(sql)
  if (!setup) return undefined

  const customerId = randomUUID()
  const membershipId = randomUUID()
  await sql`
    insert into public.customers (
      id,
      email,
      email_hmac,
      email_verified_at,
      created_at,
      updated_at
    )
    values (
      ${customerId}::uuid,
      ${input.email},
      ${input.verified ? customerEmailHmac(input.email) : null},
      ${input.verified ? new Date() : null},
      now() - interval '30 days',
      now()
    )`
  await sql`
    insert into public.customer_memberships (
      id,
      merchant_id,
      customer_id,
      current_stamp_count,
      total_stamps_earned,
      total_rewards_redeemed,
      active_cycle_number
    )
    values (
      ${membershipId}::uuid,
      ${setup.merchant_id}::uuid,
      ${customerId}::uuid,
      1,
      1,
      0,
      1
    )`
  return { customerId, membershipId, businessName: setup.business_name }
}

async function deleteWalletsByEmail(sql: Sql, email: string): Promise<void> {
  const rows = await sql<readonly { readonly id: string }[]>`
    select id::text as id from public.customers where email = ${email}`
  const ids = rows.map((row) => row.id)
  if (ids.length === 0) return
  await sql`
    delete from public.product_events
    where customer_id = any(${ids}::uuid[])`
  await sql`
    delete from public.audit_logs
    where customer_id = any(${ids}::uuid[])`
  await sql`
    delete from public.customers
    where id = any(${ids}::uuid[])`
}

async function readWalletContact(
  sql: Sql,
  customerId: string
): Promise<WalletContactRow | undefined> {
  const rows = await sql<readonly WalletContactRow[]>`
    select
      email,
      email_hmac,
      email_verified_at is not null as email_verified,
      phone_hmac
    from public.customers
    where id = ${customerId}::uuid`
  return rows.at(0)
}

async function countLoginEvents(
  sql: Sql,
  customerId: string,
  eventName: string
): Promise<number> {
  const [row] = await sql<readonly { readonly count: number }[]>`
    select count(*)::int as count
    from public.product_events
    where customer_id = ${customerId}::uuid
      and event_name = ${eventName}
      and metadata ->> 'method' = 'email'
      and metadata ->> 'surface' = 'home_login'`
  return row?.count ?? 0
}

async function hasSessionCookie(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies()
  return cookies.some((cookie) => cookie.name === SESSION_COOKIE)
}
