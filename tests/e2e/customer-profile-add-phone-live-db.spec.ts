import { randomUUID } from "node:crypto"

import { expect, test, type Page } from "@playwright/test"

import { customerEmailHmac } from "@/lib/customer/email-pii-core"
import { encryptCustomerPhone } from "@/lib/customer/phone-pii-core"

import type { Sql } from "./helpers/admin-live-db"
import {
  DEV_OTP,
  cleanupCustomerJoinRows,
  disposableUkMobile,
  installCustomerSession,
  type DisposablePhone,
} from "./helpers/customer-join-live-db"
import {
  connectCustomerReadbackDb,
  createBrowserCustomerSession,
  customerReadbackLiveDbSkipReason,
} from "./helpers/customer-readback-live-db"
import { pickSeedCustomerSetup } from "./helpers/customer-readback-seed"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * Adding a phone to an email-only wallet from the profile, against the real
 * server actions and local Supabase. The DB-free harness spec
 * (customer-profile-add-phone.spec.ts) covers what the section shows; this
 * covers what is written, what is refused and what stays the same.
 *
 * Opt-in: CUSTOMER_FLOW_E2E=1 with local Supabase (SUPABASE_DB_URL) and the
 * dev server's CUSTOMER_SESSION_SECRET and CUSTOMER_PHONE_HMAC_SECRET. The
 * local dev code stands in for the text message.
 */

const ATTACHED = "Your phone number is added. You can sign in with it too."
const CONFLICT =
  "This phone number is already used by another Nabaperks wallet. Sign in with that number, or ask the venue for help."

type ContactRow = {
  readonly email: string | null
  readonly email_hmac: string | null
  readonly email_verified_at: string | null
  readonly phone_hmac: string | null
  readonly phone_last4: string | null
  readonly phone_country: string | null
  readonly has_ciphertext: boolean
  readonly phone_verified: boolean
}

test.describe("@customer-flow add a phone to an email-only wallet (live database)", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("a confirmed phone is added and audited, and the ready reward can still be collected", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const phone = disposableUkMobile()
    const customerId = randomUUID()
    try {
      const wallet = await seedEmailOnlyWallet(sql, customerId)
      test.skip(!wallet, "seed merchant is not available")
      if (!wallet) return
      const before = await readContact(sql, customerId)
      expect(before?.phone_hmac).toBeNull()
      expect(before?.email_verified_at).not.toBeNull()

      await installCustomerSession(
        context,
        await createBrowserCustomerSession(sql, customerId)
      )
      const blockedReward = await page.request.get(
        `/reward/${wallet.rewardId}/qr.png`
      )
      expect(blockedReward.status()).toBe(409)
      expect(await blockedReward.json()).toMatchObject({
        state: "blocked",
        reason: "Complete your profile before collecting this reward.",
      })

      await addPhoneFromProfile(page, phone)
      await expect(
        page.locator("[data-add-phone]").getByRole("status")
      ).toHaveText(ATTACHED)
      // After the re-render with a phone, only the confirmation remains.
      await expect(
        page
          .locator("[data-add-phone]")
          .getByRole("heading", { name: "Phone number added" })
      ).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Add a phone number" })
      ).toHaveCount(0)

      const after = await readContact(sql, customerId)
      expect(after).toEqual({
        // The email and its confirmation are untouched.
        email: before?.email,
        email_hmac: before?.email_hmac,
        email_verified_at: before?.email_verified_at,
        phone_hmac: phone.phoneHmac,
        phone_last4: phone.last4,
        phone_country: "GB",
        has_ciphertext: true,
        phone_verified: true,
      })
      await expect(readPhoneAudits(sql, customerId)).resolves.toEqual([
        {
          action: "customer_phone_attached",
          actor_type: "customer",
          actor_id: customerId,
          metadata: { surface: "profile" },
        },
      ])

      // Unaffected by the new phone: the same reward QR is still served.
      await expectRewardQrServed(page, wallet.rewardId)

      // The wallet has a phone now, so the profile stops offering to add one.
      await page.goto("/home/profile")
      await expect(page.locator("[data-account-section]")).toBeVisible()
      await expect(page.locator("[data-add-phone]")).toHaveCount(0)
    } finally {
      await deleteWallets(sql, [customerId])
      await cleanupCustomerJoinRows(sql, undefined, phone)
      await sql.end()
    }
  })

  test("verified complementary wallets link and their stamps and existing reward survive", async ({
    context,
    page,
  }, testInfo) => {
    const sql = connectCustomerReadbackDb()
    if (!sql) throw new Error("Local wallet linking database is required")
    const guestId = randomUUID()
    const holderId = randomUUID()
    const phone = disposableUkMobile()
    try {
      const wallet = await seedEmailOnlyWallet(sql, guestId)
      if (!wallet) throw new Error("Local seed merchant is required")
      await sql`update public.customers set date_of_birth_verified_at=null,date_of_birth_verification_source=null,date_of_birth_verified_by=null where id=${guestId}::uuid`
      await seedPhoneHolder(sql, { holderId, phone })
      await sql`update public.customers set phone_verified_at=now(),phone_ciphertext=${encryptCustomerPhone(phone.e164)} where id=${holderId}::uuid`
      const [source] =
        await sql`select merchant_id,loyalty_card_id from public.reward_events where id=${wallet.rewardId}::uuid`
      const holderMembership = randomUUID()
      await sql`insert into public.customer_memberships(id,merchant_id,customer_id,current_stamp_count,total_stamps_earned) values(${holderMembership}::uuid,${source.merchant_id}::uuid,${holderId}::uuid,2,2)`
      await sql`update public.customer_memberships set active_cycle_number=2,current_stamp_count=1,total_stamps_earned=9 where id=${wallet.membershipId}::uuid`
      const [card] =
        await sql`select location_id,stamps_required from public.loyalty_cards where id=${source.loyalty_card_id}::uuid`
      for (const [owner, membership, cycle, day] of [
        [holderId, holderMembership, 1, 8],
        [holderId, holderMembership, 1, 7],
        [guestId, wallet.membershipId, 2, 6],
      ] as const) {
        await sql`insert into public.stamp_events(merchant_id,customer_id,membership_id,loyalty_card_id,location_id,event_type,stamps_delta,cycle_number,earned_business_date) values(${source.merchant_id}::uuid,${owner}::uuid,${membership}::uuid,${source.loyalty_card_id}::uuid,${card.location_id}::uuid,'earned',1,${cycle},current_date-${day}::integer)`
      }
      await installCustomerSession(
        context,
        await createBrowserCustomerSession(sql, guestId)
      )
      await addPhoneFromProfile(page, phone)
      await expect(
        page.locator("[data-add-phone]").getByRole("status")
      ).toContainText("Your wallets are linked.")
      await page.screenshot({
        path: testInfo.outputPath("wallet-linked.png"),
        fullPage: true,
      })
      const [membership] =
        await sql`select current_stamp_count from public.customer_memberships where id=${holderMembership}::uuid`
      expect(membership.current_stamp_count).toBe(3 % card.stamps_required)
      const [ledger] =
        await sql`select count(*)::integer n from public.stamp_events where membership_id=${holderMembership}::uuid and event_type='earned'`
      expect(ledger.n).toBe(3)
      const [rewards] =
        await sql`select count(*)::integer n from public.reward_events where customer_id=${holderId}::uuid`
      expect(rewards.n).toBe(1 + Math.floor(3 / card.stamps_required))
      const [reward] =
        await sql`select customer_id,status from public.reward_events where id=${wallet.rewardId}::uuid`
      expect(reward).toEqual({ customer_id: holderId, status: "unlocked" })
      await expectRewardQrServed(page, wallet.rewardId)
      await page.reload()
      await expect(
        page.getByRole("heading", { name: "Add a phone number" })
      ).toHaveCount(0)
      const [sessions] =
        await sql`select count(*)::integer n from public.customer_sessions where customer_id=${holderId}::uuid and revoked_at is null`
      expect(sessions.n).toBe(1)
    } finally {
      await deleteWallets(sql, [guestId, holderId])
      await cleanupCustomerJoinRows(sql, undefined, phone)
      await sql.end()
    }
  })

  test("a phone another wallet holds is refused and neither wallet changes", async ({
    context,
    page,
  }) => {
    const sql = connectCustomerReadbackDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const phone = disposableUkMobile()
    const guestId = randomUUID()
    const holderId = randomUUID()
    try {
      const wallet = await seedEmailOnlyWallet(sql, guestId)
      test.skip(!wallet, "seed merchant is not available")
      if (!wallet) return
      await seedPhoneHolder(sql, { holderId, phone })
      const guestBefore = await readContact(sql, guestId)
      const holderBefore = await readContact(sql, holderId)

      await installCustomerSession(
        context,
        await createBrowserCustomerSession(sql, guestId)
      )
      await addPhoneFromProfile(page, phone)

      const section = page.locator("[data-add-phone]")
      await expect(section.getByText(CONFLICT)).toBeVisible()
      await expect(
        section.getByLabel("Phone number", { exact: true })
      ).toBeVisible()

      await expect(readContact(sql, guestId)).resolves.toEqual(guestBefore)
      await expect(readContact(sql, holderId)).resolves.toEqual(holderBefore)
      await expect(readPhoneAudits(sql, guestId)).resolves.toEqual([])
      await expect.poll(() => countConflictEvents(sql, guestId)).toBe(1)
    } finally {
      await deleteWallets(sql, [guestId, holderId])
      await cleanupCustomerJoinRows(sql, undefined, phone)
      await sql.end()
    }
  })
})

async function addPhoneFromProfile(
  page: Page,
  phone: DisposablePhone
): Promise<void> {
  await gotoHydratedPage(page, "/home/profile")
  const section = page.locator("[data-add-phone]")
  await expect(
    section.getByRole("heading", { name: "Add a phone number" })
  ).toBeVisible()
  await section.getByLabel("Phone number", { exact: true }).fill(phone.national)
  await section.getByRole("button", { name: "Send my code" }).click()
  await expect(section.getByText("Phone ending")).toContainText(phone.last4)
  await section.getByLabel("Phone code").fill(DEV_OTP)
  await section.getByRole("button", { name: "Add phone number" }).click()
}

async function expectRewardQrServed(
  page: Page,
  rewardId: string
): Promise<void> {
  const response = await page.request.get(`/reward/${rewardId}/qr.png`)
  expect(response.status(), await response.text()).toBe(200)
  expect(response.headers()["content-type"]).toContain("image/png")
}

type EmailOnlyWallet = {
  readonly membershipId: string
  readonly rewardId: string
}

/**
 * A wallet started with an email: confirmed email, name and adult date of
 * birth (so its profile is complete), no phone, and one card with a reward
 * earned two days ago and open for collection since yesterday.
 */
async function seedEmailOnlyWallet(
  sql: Sql,
  customerId: string
): Promise<EmailOnlyWallet | undefined> {
  const setup = await pickSeedCustomerSetup(sql)
  if (!setup) return undefined

  const email = `add-phone-${customerId.slice(0, 12)}@example.test`
  const membershipId = randomUUID()
  const rewardId = randomUUID()
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
      ${customerId}::uuid,
      ${email},
      ${customerEmailHmac(email)},
      now(),
      'Add Phone Browser',
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
      ${membershipId}::uuid,
      ${setup.merchant_id}::uuid,
      ${customerId}::uuid,
      0,
      8,
      0,
      1
    )`
  await sql`
    insert into public.reward_events (
      id,
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      status,
      reward_name,
      reward_terms,
      available_from,
      expires_at,
      cycle_number,
      metadata,
      created_at
    )
    values (
      ${rewardId}::uuid,
      ${setup.merchant_id}::uuid,
      ${customerId}::uuid,
      ${membershipId}::uuid,
      ${setup.loyalty_card_id}::uuid,
      'unlocked',
      'Add phone browser reward',
      'Add phone browser terms',
      now() - interval '1 day',
      now() + interval '14 days',
      1,
      jsonb_build_object('source', 'customer-profile-add-phone-e2e'),
      now() - interval '2 days'
    )`
  return { membershipId, rewardId }
}

/** Another wallet that already holds the phone. */
async function seedPhoneHolder(
  sql: Sql,
  input: { readonly holderId: string; readonly phone: DisposablePhone }
): Promise<void> {
  await sql`
    insert into public.customers (id, phone_hmac, phone_last4, phone_country)
    values (
      ${input.holderId}::uuid,
      ${input.phone.phoneHmac},
      ${input.phone.last4},
      'GB'
    )`
}

async function readContact(
  sql: Sql,
  customerId: string
): Promise<ContactRow | undefined> {
  const rows = await sql<readonly ContactRow[]>`
    select
      email,
      email_hmac,
      email_verified_at::text as email_verified_at,
      phone_hmac,
      phone_last4,
      phone_country,
      phone_ciphertext is not null as has_ciphertext,
      phone_verified_at is not null as phone_verified
    from public.customers
    where id = ${customerId}::uuid`
  return rows.at(0)
}

type AuditRow = {
  readonly action: string
  readonly actor_type: string
  readonly actor_id: string | null
  readonly metadata: unknown
}

async function readPhoneAudits(
  sql: Sql,
  customerId: string
): Promise<readonly AuditRow[]> {
  const rows = await sql<readonly AuditRow[]>`
    select action, actor_type, actor_id, metadata
    from public.audit_logs
    where customer_id = ${customerId}::uuid
      and target_table = 'customers'
      and action like 'customer_phone_%'
    order by created_at`
  return [...rows]
}

async function countConflictEvents(
  sql: Sql,
  customerId: string
): Promise<number> {
  const [row] = await sql<readonly { readonly count: number }[]>`
    select count(*)::int as count
    from public.product_events
    where customer_id = ${customerId}::uuid
      and event_name = 'customer_contact_conflict'
      and metadata ->> 'method' = 'phone'
      and metadata ->> 'surface' = 'profile'
      and metadata ->> 'reason' = 'phone_in_use'`
  return row?.count ?? 0
}

async function deleteWallets(
  sql: Sql,
  customerIds: readonly string[]
): Promise<void> {
  await sql`
    delete from public.audit_logs
    where customer_id = any(${customerIds}::uuid[])`
  await sql`
    delete from public.product_events
    where customer_id = any(${customerIds}::uuid[])`
  // Memberships, rewards and sessions go with the wallet.
  await sql`
    delete from public.customers
    where id = any(${customerIds}::uuid[])`
}
