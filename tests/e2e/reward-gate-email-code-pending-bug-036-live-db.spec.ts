import { randomBytes, randomUUID } from "node:crypto"

import { expect, test, type BrowserContext } from "@playwright/test"

import { createPendingEmailCookieValue } from "@/lib/customer/session-cookie-core"

import type { Sql } from "./helpers/admin-live-db"
import {
  connectCustomerReadbackDb,
  createBrowserCustomerSession,
  customerReadbackLiveDbSkipReason,
  type BrowserCustomerSession,
} from "./helpers/customer-readback-live-db"
import { pickSeedCustomerSetup } from "./helpers/customer-readback-seed"
import { dismissPwaInstall, waitForHydratedPage } from "./helpers/harness"

/**
 * QA BUG-036 remainder (38c42a1..2c45031), against the real server: the
 * reward collection gate's email step said "Enter the code we sent to
 * <address>" for any saved, unverified email, even with no code pending (a
 * failed send, a lapsed code, another browser). It now asks for a code only
 * while one for that address is pending for this customer; otherwise it
 * offers to send one.
 *
 * The no-code case needs no email provider. With the CI placeholder Resend
 * key the "Send me a code" request fails, which keeps the no-code state and
 * must not claim a code was sent; with a working provider the code step opens.
 *
 * Opt-in: CUSTOMER_FLOW_E2E=1 with local Supabase (SUPABASE_DB_URL) and the
 * dev server's CUSTOMER_SESSION_SECRET.
 */

const PENDING_EMAIL_COOKIE = "nabaperks_pending_email"
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"

type Fixture = {
  readonly guestId: string
  readonly membershipId: string
  readonly rewardEventId: string
}

test.describe("@customer-flow reward gate email code state (live database)", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("with no code pending the gate offers to send one", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const email = uniqueEmail("gate-no-code")
    let fixture: Fixture | undefined
    try {
      fixture = await seedGuest(sql, email)
      test.skip(!fixture, "seed merchant is not available")
      if (!fixture) return
      await signIn(
        context,
        await createBrowserCustomerSession(sql, fixture.guestId)
      )

      await page.goto(`/reward/${fixture.rewardEventId}`)
      await expect(
        page.getByText(`We'll send a code to ${email} to confirm it.`, {
          exact: true,
        })
      ).toBeVisible()
      const send = page.getByRole("button", { name: "Send me a code" })
      await expect(send).toBeVisible()
      await expect(page.getByText(/code we sent/i)).toHaveCount(0)
      await expect(page.getByLabel("Email code")).toHaveCount(0)

      // With a code pending for that address, the code step opens.
      await addPendingEmailCode(context, { email, customerId: fixture.guestId })
      await page.goto(`/reward/${fixture.rewardEventId}`)
      await expect(
        page.getByText(`Enter the code we sent to ${email}.`, { exact: false })
      ).toBeVisible()
      await expect(page.getByLabel("Email code")).toBeVisible()
    } finally {
      await cleanup(sql, fixture)
      await sql.end()
    }
  })

  test("send me a code asks for the code only once one was sent", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const email = uniqueEmail("gate-send-fails")
    let fixture: Fixture | undefined
    try {
      fixture = await seedGuest(sql, email)
      test.skip(!fixture, "seed merchant is not available")
      if (!fixture) return
      await signIn(
        context,
        await createBrowserCustomerSession(sql, fixture.guestId)
      )

      await page.goto(`/reward/${fixture.rewardEventId}`)
      await waitForHydratedPage(page)
      await page.getByRole("button", { name: "Send me a code" }).click()
      const notSent = page.getByText("Code not sent")
      await expect(notSent.or(page.getByLabel("Email code"))).toBeVisible()
      if (await notSent.isVisible()) {
        // The provider refused the send (the CI placeholder key does): no
        // code is on its way, so the gate must not claim one was sent.
        await page.waitForTimeout(1_000)
        await expect(page.getByText(/code we sent/i)).toHaveCount(0)
        await expect(page.getByLabel("Email code")).toHaveCount(0)
      } else {
        await expect(
          page.getByText(`Enter the code we sent to ${email}.`, {
            exact: false,
          })
        ).toBeVisible()
      }
    } finally {
      await cleanup(sql, fixture)
      await sql.end()
    }
  })
})

function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 12)}@example.test`
}

// A phone wallet with its details saved, an unverified email and an unlocked
// reward, so the collection gate opens at its email step.
async function seedGuest(
  sql: Sql,
  email: string
): Promise<Fixture | undefined> {
  const setup = await pickSeedCustomerSetup(sql)
  if (!setup) return undefined

  const fixture: Fixture = {
    guestId: randomUUID(),
    membershipId: randomUUID(),
    rewardEventId: randomUUID(),
  }
  try {
    await sql`
      insert into public.customers (
        id, email, phone_hmac, phone_last4, phone_verified_at, full_name, date_of_birth
      )
      values (
        ${fixture.guestId}::uuid, ${email}, ${randomBytes(32).toString("hex")},
        '0000', now(), 'Gate Email Guest', date '1990-01-01'
      )`
    await sql`
      insert into public.customer_memberships (
        id, merchant_id, customer_id, current_stamp_count, total_stamps_earned,
        total_rewards_redeemed, active_cycle_number
      )
      values (
        ${fixture.membershipId}::uuid, ${setup.merchant_id}::uuid,
        ${fixture.guestId}::uuid, 0, 1, 0, 2
      )`
    await sql`
      insert into public.reward_events (
        id, merchant_id, customer_id, membership_id, loyalty_card_id, status,
        cycle_number, reward_name, reward_terms, redeemable_from, metadata,
        created_at, updated_at
      )
      values (
        ${fixture.rewardEventId}::uuid, ${setup.merchant_id}::uuid,
        ${fixture.guestId}::uuid, ${fixture.membershipId}::uuid,
        ${setup.loyalty_card_id}::uuid, 'unlocked', 1, 'E2E gate email reward',
        'Browser gate email fixture', public.uk_business_date(now()),
        jsonb_build_object('source', 'reward-gate-email-code-e2e'),
        now() - interval '2 days', now() - interval '2 days'
      )`
    return fixture
  } catch (error) {
    await cleanup(sql, fixture)
    throw error
  }
}

async function cleanup(sql: Sql, fixture: Fixture | undefined): Promise<void> {
  if (!fixture) return
  await sql`delete from public.product_events where customer_id = ${fixture.guestId}::uuid`
  await sql`delete from public.audit_logs where customer_id = ${fixture.guestId}::uuid`
  await sql`delete from public.customer_sessions where customer_id = ${fixture.guestId}::uuid`
  await sql`delete from public.reward_events where id = ${fixture.rewardEventId}::uuid`
  await sql`delete from public.customer_memberships where id = ${fixture.membershipId}::uuid`
  await sql`delete from public.customers where id = ${fixture.guestId}::uuid`
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

// The cookie the send step sets for a code on its way to this customer.
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
