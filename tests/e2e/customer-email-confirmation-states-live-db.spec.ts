import { randomBytes, randomUUID } from "node:crypto"

import { expect, test, type BrowserContext, type Page } from "@playwright/test"

import { customerEmailHmac } from "@/lib/customer/email-pii-core"
import { createPendingEmailCookieValue } from "@/lib/customer/session-cookie-core"

import type { Sql } from "./helpers/admin-live-db"
import { DEV_OTP } from "./helpers/customer-join-live-db"
import {
  connectCustomerReadbackDb,
  createBrowserCustomerSession,
  customerReadbackLiveDbSkipReason,
  type BrowserCustomerSession,
} from "./helpers/customer-readback-live-db"
import { pickSeedCustomerSetup } from "./helpers/customer-readback-seed"
import { dismissPwaInstall, waitForHydratedPage } from "./helpers/harness"

/**
 * The profile email card after the code step, against the real server:
 *
 * - QA BUG-036 (38c42a1..2c45031): with no code pending for the saved,
 *   unverified address (a failed send, a lapsed code, another browser), the
 *   card offers to send one instead of saying "Enter the code we sent".
 * - QA BUG-005 refinement: the "Email not confirmed" answer shown below the
 *   card is for a refused (conflict) address only, and goes once the customer
 *   edits their details. Other refusals are not shown there.
 *
 * Each code case starts with a code already pending (the signed cookie the
 * send step would set) and confirms it with the local CUSTOMER_DEV_OTP_CODE.
 *
 * Opt-in: CUSTOMER_FLOW_E2E=1 with local Supabase (SUPABASE_DB_URL) and the
 * dev server's CUSTOMER_SESSION_SECRET and CUSTOMER_EMAIL_HMAC_SECRET.
 */

const CONFLICT_COPY = "This email is already used by another Nabaperks wallet."
const PENDING_EMAIL_COOKIE = "nabaperks_pending_email"
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"

type Fixture = {
  readonly guestId: string
  readonly holderId: string | null
  readonly membershipId: string
}

function skipReason(): string | undefined {
  const reason = customerReadbackLiveDbSkipReason()
  if (reason) return reason
  if (!process.env.CUSTOMER_EMAIL_HMAC_SECRET?.trim()) {
    return "CUSTOMER_EMAIL_HMAC_SECRET is required to confirm customer emails"
  }
  return undefined
}

test.describe("@customer-flow profile email confirmation states (live database)", () => {
  const reason = skipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("with no code pending the profile offers to send one", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const email = uniqueEmail("no-code")
    let fixture: Fixture | undefined
    try {
      fixture = await seedGuest(sql, { email, holder: false })
      test.skip(!fixture, "seed merchant is not available")
      if (!fixture) return
      await signIn(
        context,
        await createBrowserCustomerSession(sql, fixture.guestId)
      )

      await page.goto("/home/profile")
      await expect(page.getByText("Confirm your email")).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Send me a code" })
      ).toBeVisible()
      await expect(page.getByText(/code we sent/i)).toHaveCount(0)
      await expect(page.getByLabel("Email code")).toHaveCount(0)

      // With a code pending for that address, the code step opens.
      await addPendingEmailCode(context, { email, customerId: fixture.guestId })
      await page.goto("/home/profile")
      await expect(
        page.getByText(`Enter the code we sent to ${email} to verify it.`)
      ).toBeVisible()
    } finally {
      await cleanup(sql, fixture)
      await sql.end()
    }
  })

  test("the conflict answer goes once the customer edits their details", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const email = uniqueEmail("conflict-edit")
    let fixture: Fixture | undefined
    try {
      fixture = await seedGuest(sql, { email, holder: true })
      test.skip(!fixture, "seed merchant is not available")
      if (!fixture) return
      await signIn(
        context,
        await createBrowserCustomerSession(sql, fixture.guestId)
      )
      await addPendingEmailCode(context, { email, customerId: fixture.guestId })

      await page.goto("/home/profile")
      await confirmCode(page)
      await expect(page.getByText(CONFLICT_COPY)).toBeVisible()

      await page.getByRole("button", { name: "Edit details" }).click()
      await expect(page.getByText(CONFLICT_COPY)).toHaveCount(0)
      await page.getByRole("button", { name: "Save changes" }).click()
      await expect(
        page.getByRole("button", { name: "Edit details" })
      ).toBeVisible()
      await page.waitForTimeout(1_000)
      await expect(page.getByText(CONFLICT_COPY)).toHaveCount(0)
      await expect(page.getByText("Email not confirmed")).toHaveCount(0)
    } finally {
      await cleanup(sql, fixture)
      await sql.end()
    }
  })

  test("a code refused because the email was confirmed elsewhere is not shown as a conflict", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const pendingEmail = uniqueEmail("second-device")
    const confirmedEmail = uniqueEmail("first-device")
    let fixture: Fixture | undefined
    try {
      fixture = await seedGuest(sql, { email: pendingEmail, holder: false })
      test.skip(!fixture, "seed merchant is not available")
      if (!fixture) return
      await signIn(
        context,
        await createBrowserCustomerSession(sql, fixture.guestId)
      )
      await addPendingEmailCode(context, {
        email: pendingEmail,
        customerId: fixture.guestId,
      })

      await page.goto("/home/profile")
      await waitForHydratedPage(page)
      // Another device confirms a different address for this wallet.
      await sql`
        update public.customers
        set email = ${confirmedEmail},
            email_hmac = ${customerEmailHmac(confirmedEmail)},
            email_verified_at = now()
        where id = ${fixture.guestId}::uuid`
      await confirmCode(page)

      await expect(
        page.getByRole("button", { name: "Edit details" })
      ).toBeVisible()
      await page.waitForTimeout(1_500)
      await expect(page.getByText("Email not confirmed")).toHaveCount(0)
      await expect(page.getByText(/couldn't confirm your email/i)).toHaveCount(
        0
      )
      await expect(page.getByText(confirmedEmail).first()).toBeVisible()
    } finally {
      await cleanup(sql, fixture)
      await sql.end()
    }
  })
})

async function confirmCode(page: Page): Promise<void> {
  // A fill before hydration posts an empty code under the harness webServer.
  await waitForHydratedPage(page)
  await page.getByLabel("Email code").fill(DEV_OTP)
  await page.getByRole("button", { name: "Confirm email" }).click()
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 12)}@example.test`
}

// A phone wallet with its details saved, a card, and an unverified email;
// optionally a second wallet (no card) already holding that email verified.
async function seedGuest(
  sql: Sql,
  input: { readonly email: string; readonly holder: boolean }
): Promise<Fixture | undefined> {
  const setup = await pickSeedCustomerSetup(sql)
  if (!setup) return undefined

  const fixture: Fixture = {
    guestId: randomUUID(),
    holderId: input.holder ? randomUUID() : null,
    membershipId: randomUUID(),
  }
  try {
    await sql`
      insert into public.customers (
        id, email, phone_hmac, phone_last4, phone_verified_at, full_name, date_of_birth
      )
      values (
        ${fixture.guestId}::uuid, ${input.email}, ${randomBytes(32).toString("hex")},
        '0000', now(), 'Email States Guest', date '1990-01-01'
      )`
    if (fixture.holderId) {
      await sql`
        insert into public.customers (
          id, email, email_hmac, email_verified_at, full_name, date_of_birth
        )
        values (
          ${fixture.holderId}::uuid, ${input.email}, ${customerEmailHmac(input.email)},
          now(), 'Email States Holder', date '1990-01-01'
        )`
    }
    await sql`
      insert into public.customer_memberships (
        id, merchant_id, customer_id, current_stamp_count, total_stamps_earned,
        total_rewards_redeemed, active_cycle_number
      )
      values (
        ${fixture.membershipId}::uuid, ${setup.merchant_id}::uuid,
        ${fixture.guestId}::uuid, 0, 1, 0, 1
      )`
    return fixture
  } catch (error) {
    await cleanup(sql, fixture)
    throw error
  }
}

async function cleanup(sql: Sql, fixture: Fixture | undefined): Promise<void> {
  if (!fixture) return
  const ids = [fixture.guestId, ...(fixture.holderId ? [fixture.holderId] : [])]
  await sql`delete from public.product_events where customer_id = any(${ids}::uuid[])`
  await sql`delete from public.audit_logs where customer_id = any(${ids}::uuid[])`
  await sql`delete from public.customer_sessions where customer_id = any(${ids}::uuid[])`
  await sql`delete from public.customer_memberships where id = ${fixture.membershipId}::uuid`
  await sql`delete from public.customers where id = any(${ids}::uuid[])`
}

async function signIn(
  context: BrowserContext,
  session: BrowserCustomerSession
): Promise<void> {
  await context.addCookies(
    [
      [session.cookieName, session.cookieValue],
      [session.deviceCookieName, session.deviceCookieValue],
    ].map(([name, value]) => ({
      name,
      value,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax" as const,
      expires: session.expiresAt,
    }))
  )
}

// The cookie the send step sets. Its code HMAC never matches: the dev code
// confirms it, exactly as a local customer-flow server accepts it.
async function addPendingEmailCode(
  context: BrowserContext,
  input: { readonly email: string; readonly customerId: string }
): Promise<void> {
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim() ?? ""
  const issuedAt = Math.floor(Date.now() / 1000)
  await context.addCookies([
    {
      name: PENDING_EMAIL_COOKIE,
      value: createPendingEmailCookieValue(
        {
          version: 1,
          email: input.email,
          codeHmac: "0".repeat(64),
          customerId: input.customerId,
          issuedAt,
          expiresAt: issuedAt + 10 * 60,
        },
        secret
      ),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: issuedAt + 10 * 60,
    },
  ])
}
