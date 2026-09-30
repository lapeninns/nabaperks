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
import { dismissPwaInstall } from "./helpers/harness"

/**
 * QA BUG-005 (38c42a1..2c45031): a phone wallet confirms an email that another
 * wallet already holds as verified. The server refuses it, releases this
 * wallet's unverified copy and clears the pending code, and that re-renders
 * the route: the profile card falls back to its summary and the reward gate
 * back to the details step. The conflict answer must survive that re-render
 * on both surfaces instead of vanishing with the code step.
 *
 * Sending a code needs the email provider, so each case starts with a code
 * already pending (the signed cookie the send step would set) and confirms it
 * with the local CUSTOMER_DEV_OTP_CODE bypass, as the email prompt spec does.
 *
 * Opt-in: CUSTOMER_FLOW_E2E=1 with local Supabase (SUPABASE_DB_URL) and the
 * dev server's CUSTOMER_SESSION_SECRET and CUSTOMER_EMAIL_HMAC_SECRET.
 */

const CONFLICT_COPY = "This email is already used by another Nabaperks wallet."
const PENDING_EMAIL_COOKIE = "nabaperks_pending_email"
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"

type ConflictFixture = {
  readonly guestId: string
  readonly holderId: string
  readonly membershipId: string
  readonly rewardEventId: string | null
}

function skipReason(): string | undefined {
  const reason = customerReadbackLiveDbSkipReason()
  if (reason) return reason
  if (!process.env.CUSTOMER_EMAIL_HMAC_SECRET?.trim()) {
    return "CUSTOMER_EMAIL_HMAC_SECRET is required to confirm customer emails"
  }
  return undefined
}

test.describe("@customer-flow email conflict copy on the profile and reward gate (live database)", () => {
  const reason = skipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("the profile keeps the conflict answer after the card returns to its summary", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const email = uniqueEmail("profile-conflict")
    let fixture: ConflictFixture | undefined
    try {
      fixture = await seedConflict(sql, { email, withReward: false })
      test.skip(!fixture, "seed merchant is not available")
      if (!fixture) return

      await signIn(
        context,
        await createBrowserCustomerSession(sql, fixture.guestId)
      )
      await addPendingEmailCode(context, {
        email,
        customerId: fixture.guestId,
      })

      await page.goto("/home/profile")
      await confirmCode(page)

      await expectConflictCopyStays(page)
      // The card is back on its summary: the refused address is gone.
      await expect(
        page.getByRole("button", { name: "Edit details" })
      ).toBeVisible()
      await expectReleased(sql, fixture, email)
    } finally {
      await cleanup(sql, fixture)
      await sql.end()
    }
  })

  test("the reward gate keeps the conflict answer after it returns to the details step", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const email = uniqueEmail("gate-conflict")
    let fixture: ConflictFixture | undefined
    try {
      fixture = await seedConflict(sql, { email, withReward: true })
      test.skip(!fixture?.rewardEventId, "seed merchant is not available")
      if (!fixture?.rewardEventId) return

      await signIn(
        context,
        await createBrowserCustomerSession(sql, fixture.guestId)
      )
      await addPendingEmailCode(context, {
        email,
        customerId: fixture.guestId,
      })

      await page.goto(`/reward/${fixture.rewardEventId}`)
      await confirmCode(page)

      await expectConflictCopyStays(page)
      // Back on the details step with the email field empty, and told why.
      await expect(page.getByLabel("Email address")).toHaveValue("")
      await expectReleased(sql, fixture, email)
    } finally {
      await cleanup(sql, fixture)
      await sql.end()
    }
  })
})

async function confirmCode(page: Page): Promise<void> {
  await page.getByLabel("Email code").fill(DEV_OTP)
  await page.getByRole("button", { name: "Confirm email" }).click()
}

async function expectConflictCopyStays(page: Page): Promise<void> {
  await expect(page.getByText(CONFLICT_COPY)).toBeVisible()
  // Still there once the re-rendered route has settled.
  await page.waitForTimeout(1_500)
  await expect(page.getByText(CONFLICT_COPY)).toBeVisible()
}

async function expectReleased(
  sql: Sql,
  fixture: ConflictFixture,
  email: string
): Promise<void> {
  const rows = await sql<
    readonly {
      readonly id: string
      readonly email: string | null
      readonly email_verified: boolean
    }[]
  >`
    select id::text, email, email_verified_at is not null as email_verified
    from public.customers
    where id = any(${[fixture.guestId, fixture.holderId]}::uuid[])`
  const byId = new Map(rows.map((row) => [row.id, row]))
  expect(byId.get(fixture.guestId)).toMatchObject({
    email: null,
    email_verified: false,
  })
  expect(byId.get(fixture.holderId)).toMatchObject({
    email,
    email_verified: true,
  })
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 12)}@example.test`
}

// A phone wallet with its details saved and an unverified copy of an address
// that a second wallet (no card) already holds verified; optionally with an
// unlocked reward so the collection gate asks for the email code.
async function seedConflict(
  sql: Sql,
  input: { readonly email: string; readonly withReward: boolean }
): Promise<ConflictFixture | undefined> {
  const setup = await pickSeedCustomerSetup(sql)
  if (!setup) return undefined

  const fixture: ConflictFixture = {
    guestId: randomUUID(),
    holderId: randomUUID(),
    membershipId: randomUUID(),
    rewardEventId: input.withReward ? randomUUID() : null,
  }

  try {
    await sql`
      insert into public.customers (
        id,
        email,
        phone_hmac,
        phone_last4,
        phone_verified_at,
        full_name,
        date_of_birth
      )
      values (
        ${fixture.guestId}::uuid,
        ${input.email},
        ${randomBytes(32).toString("hex")},
        '0000',
        now(),
        'Email Conflict Guest',
        date '1990-01-01'
      )`
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
        ${fixture.holderId}::uuid,
        ${input.email},
        ${customerEmailHmac(input.email)},
        now(),
        'Email Conflict Holder',
        date '1990-01-01'
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
        ${fixture.membershipId}::uuid,
        ${setup.merchant_id}::uuid,
        ${fixture.guestId}::uuid,
        0,
        1,
        0,
        ${input.withReward ? 2 : 1}
      )`
    if (fixture.rewardEventId) {
      await sql`
        insert into public.reward_events (
          id,
          merchant_id,
          customer_id,
          membership_id,
          loyalty_card_id,
          status,
          cycle_number,
          reward_name,
          reward_terms,
          redeemable_from,
          metadata,
          created_at,
          updated_at
        )
        values (
          ${fixture.rewardEventId}::uuid,
          ${setup.merchant_id}::uuid,
          ${fixture.guestId}::uuid,
          ${fixture.membershipId}::uuid,
          ${setup.loyalty_card_id}::uuid,
          'unlocked',
          1,
          'E2E email conflict reward',
          'Browser email conflict fixture',
          public.uk_business_date(now()),
          jsonb_build_object('source', 'email-conflict-copy-e2e'),
          now() - interval '2 days',
          now() - interval '2 days'
        )`
    }
    return fixture
  } catch (error) {
    await cleanup(sql, fixture)
    throw error
  }
}

async function cleanup(
  sql: Sql,
  fixture: ConflictFixture | undefined
): Promise<void> {
  if (!fixture) return
  const ids = [fixture.guestId, fixture.holderId]
  await sql`
    delete from public.product_events
    where customer_id = any(${ids}::uuid[])`
  await sql`
    delete from public.audit_logs
    where customer_id = any(${ids}::uuid[])`
  await sql`
    delete from public.customer_sessions
    where customer_id = any(${ids}::uuid[])`
  if (fixture.rewardEventId) {
    await sql`
      delete from public.reward_events
      where id = ${fixture.rewardEventId}::uuid`
  }
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
