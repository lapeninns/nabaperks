import { randomUUID } from "node:crypto"

import { expect, test, type BrowserContext } from "@playwright/test"

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
import { dismissPwaInstall } from "./helpers/harness"

/**
 * The add-your-email prompt against the real server actions and local
 * Supabase: the confirmation write, the one-wallet-per-verified-email check
 * and the UI after the action re-renders /home. The DB-free harness spec
 * (customer-email-prompt.spec.ts) covers the prompt's states; this covers the
 * boundary it cannot.
 *
 * Sending a code needs the email provider, so each case starts with a code
 * already pending (the encrypted cookie the send step would set) and confirms
 * it with the local CUSTOMER_DEV_OTP_CODE bypass.
 *
 * Opt-in: CUSTOMER_FLOW_E2E=1 with local Supabase (SUPABASE_DB_URL) and the
 * dev server's CUSTOMER_SESSION_SECRET and CUSTOMER_EMAIL_HMAC_SECRET.
 */

const CONFLICT_COPY = "This email is already used by another Nabaperks wallet."
const PENDING_EMAIL_COOKIE = "nabaperks_pending_email"
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"

type CustomerEmailRow = {
  readonly email: string | null
  readonly email_hmac: string | null
  readonly email_verified: boolean
}

type EmailPromptFixture = {
  readonly customerIds: readonly string[]
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

test.describe("@customer-flow customer email prompt (live database)", () => {
  const reason = skipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("confirms an email from the home prompt and keeps the confirmation on screen", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const email = uniqueEmail("prompt-confirm")
    let fixture: EmailPromptFixture | undefined
    try {
      const guestId = randomUUID()
      fixture = await seedWallet(sql, { guestId, guestEmail: email })
      test.skip(!fixture, "seed merchant is not available")
      if (!fixture) return

      await signIn(context, await createBrowserCustomerSession(sql, guestId))
      await addPendingEmailCode(context, { email, customerId: guestId })

      await page.goto("/home")
      const prompt = page.getByTestId("email-prompt")
      await expect(
        prompt.getByText(`Enter the code we sent to ${email}.`)
      ).toBeVisible()

      await prompt.getByLabel("Email code").fill(DEV_OTP)
      await prompt.getByRole("button", { name: "Confirm email" }).click()

      // The action re-renders /home, which no longer asks for an email; the
      // prompt must stay long enough for the guest to see the answer.
      await expect(
        prompt.getByRole("heading", { name: "Email confirmed" })
      ).toBeVisible()
      await expect(prompt.getByRole("status")).toHaveText(
        "Your email is confirmed."
      )

      await expect(readCustomerEmail(sql, guestId)).resolves.toEqual({
        email,
        email_hmac: customerEmailHmac(email),
        email_verified: true,
      })
      await expect
        .poll(() => countEvents(sql, guestId, "customer_email_verified"))
        .toBe(1)

      // A fresh visit no longer asks.
      await page.goto("/home")
      await expect(page.getByTestId("email-prompt")).toHaveCount(0)
    } finally {
      await cleanupWallet(sql, fixture)
      await sql.end()
    }
  })

  test("refuses an email already verified on another wallet and changes nothing", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const email = uniqueEmail("prompt-conflict")
    let fixture: EmailPromptFixture | undefined
    try {
      const guestId = randomUUID()
      const holderId = randomUUID()
      fixture = await seedWallet(sql, {
        guestId,
        guestEmail: email,
        holder: { id: holderId, email },
      })
      test.skip(!fixture, "seed merchant is not available")
      if (!fixture) return

      await signIn(context, await createBrowserCustomerSession(sql, guestId))
      await addPendingEmailCode(context, { email, customerId: guestId })

      await page.goto("/home")
      const prompt = page.getByTestId("email-prompt")
      await prompt.getByLabel("Email code").fill(DEV_OTP)
      await prompt.getByRole("button", { name: "Confirm email" }).click()

      // Back to the email step, with the conflict explained.
      await expect(prompt.getByText(CONFLICT_COPY)).toBeVisible()
      await expect(prompt.getByLabel("Email", { exact: true })).toBeVisible()

      await expect(readCustomerEmail(sql, guestId)).resolves.toEqual({
        email,
        email_hmac: null,
        email_verified: false,
      })
      await expect(readCustomerEmail(sql, holderId)).resolves.toEqual({
        email,
        email_hmac: customerEmailHmac(email),
        email_verified: true,
      })
      await expect
        .poll(() => countEvents(sql, guestId, "customer_contact_conflict"))
        .toBe(1)
      await expect(
        countEvents(sql, guestId, "customer_email_verified")
      ).resolves.toBe(0)
    } finally {
      await cleanupWallet(sql, fixture)
      await sql.end()
    }
  })
})

function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 12)}@example.test`
}

// A guest with one card and an unverified email; optionally a second wallet
// (no card) that already holds the same email verified.
async function seedWallet(
  sql: Sql,
  input: {
    readonly guestId: string
    readonly guestEmail: string
    readonly holder?: { readonly id: string; readonly email: string }
  }
): Promise<EmailPromptFixture | undefined> {
  const setup = await pickSeedCustomerSetup(sql)
  if (!setup) return undefined

  const membershipId = randomUUID()
  const customerIds = input.holder
    ? [input.guestId, input.holder.id]
    : [input.guestId]
  const fixture = { customerIds, membershipId }

  try {
    await sql`
      insert into public.customers (id, email, full_name, date_of_birth)
      values (
        ${input.guestId}::uuid,
        ${input.guestEmail},
        'Email Prompt Browser',
        date '1990-01-01'
      )`
    if (input.holder) {
      await sql`
        insert into public.customers (
          id,
          email,
          email_hmac,
          email_verified_at,
          full_name,
          date_of_birth
        )
        values (
          ${input.holder.id}::uuid,
          ${input.holder.email},
          ${customerEmailHmac(input.holder.email)},
          now(),
          'Email Prompt Holder',
          date '1990-01-01'
        )`
    }
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
        ${input.guestId}::uuid,
        1,
        1,
        0,
        1
      )`
    return fixture
  } catch (error) {
    await cleanupWallet(sql, fixture)
    throw error
  }
}

async function cleanupWallet(
  sql: Sql,
  fixture: EmailPromptFixture | undefined
): Promise<void> {
  if (!fixture) return
  const ids = fixture.customerIds
  await sql`
    delete from public.product_events
    where customer_id = any(${ids}::uuid[])`
  await sql`
    delete from public.customer_sessions
    where customer_id = any(${ids}::uuid[])`
  await sql`
    delete from public.customer_memberships
    where id = ${fixture.membershipId}::uuid`
  await sql`
    delete from public.customers
    where id = any(${ids}::uuid[])`
}

async function signIn(
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
    {
      name: session.deviceCookieName,
      value: session.deviceCookieValue,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
      expires: session.expiresAt,
    },
  ])
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

async function readCustomerEmail(
  sql: Sql,
  customerId: string
): Promise<CustomerEmailRow | undefined> {
  const rows = await sql<readonly CustomerEmailRow[]>`
    select email, email_hmac, email_verified_at is not null as email_verified
    from public.customers
    where id = ${customerId}::uuid`
  return rows.at(0)
}

async function countEvents(
  sql: Sql,
  customerId: string,
  eventName: string
): Promise<number> {
  const [row] = await sql<readonly { readonly count: number }[]>`
    select count(*)::int as count
    from public.product_events
    where customer_id = ${customerId}::uuid
      and event_name = ${eventName}`
  return row?.count ?? 0
}
