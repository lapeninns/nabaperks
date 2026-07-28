import { randomUUID } from "node:crypto"

import { expect, test, type Page } from "@playwright/test"

import {
  connectLocalDb,
  seedMerchantOwnerEmail,
  type Sql,
} from "./helpers/admin-live-db"
import {
  cleanupCustomerJoinRows,
  DEV_OTP,
  disposableUkMobile,
  type DisposablePhone,
} from "./helpers/customer-join-live-db"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * Bulk two-stamp loyalty invitations — the merchant import form renders and is
 * keyboard / screen-reader / responsive accessible, DB-free via the harness.
 * The opt-in live-DB test below covers import → synthetic delivery → OTP →
 * terms → two-stamp card without contacting an email provider.
 */
const INVITE = "/dev/app-harness/invite"
const SEED_MERCHANT_SLUG = "old-crown-girton"
const SEED_MERCHANT_PASSWORD = "NabaperksDemo1!"
const SYNTHETIC_SINK_HEADER = {
  "x-nabaperks-synthetic-sink": "loyalty-invite-e2e",
}

type InviteCampaignFixture = {
  readonly campaignId: string
  readonly merchantId: string
  readonly recipientId: string
}

type SyntheticSinkResponse = {
  readonly ok: boolean
  readonly result: {
    readonly drained: number
    readonly sent: number
  }
  readonly deliveries: readonly {
    readonly to: string
    readonly text: string
    readonly providerId: string
  }[]
}

test.describe("@merchant-flow merchant invite customers", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("renders the invite form with an accessible recipients field", async ({
    page,
  }) => {
    await gotoHydratedPage(page, INVITE)
    await expect(
      page.getByRole("heading", { level: 1, name: "Invite customers" })
    ).toBeVisible()
    await expect(page.getByLabel("Email addresses")).toBeVisible()
    await expect(page.getByRole("button", { name: "Check list" })).toBeVisible()
  })

  test("the recipients field is keyboard reachable and editable", async ({
    page,
  }) => {
    await gotoHydratedPage(page, INVITE)
    const textarea = page.getByLabel("Email addresses")
    await textarea.focus()
    await expect(textarea).toBeFocused()
    await textarea.fill("alex@example.com\njordan@example.com")
    await expect(textarea).toHaveValue(/alex@example.com/)
  })

  test("renders on a mobile viewport without horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoHydratedPage(page, INVITE)
    await expect(
      page.getByRole("heading", { level: 1, name: "Invite customers" })
    ).toBeVisible()
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    )
    expect(noOverflow).toBe(true)
  })
})

test.describe("@admin-live-db @customer-flow merchant invitation journey", () => {
  const reason = loyaltyInviteJourneySkipReason()
  test.skip(Boolean(reason), reason)
  test.use({ serviceWorkers: "block" })

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("imports, captures and claims an invitation without a provider send", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const email = `invite-${randomUUID()}@example.test`
    const phone = disposableUkMobile()
    let fixture: InviteCampaignFixture | undefined

    try {
      const setup = await readInviteSetup(sql)
      test.skip(!setup, "seed merchant or loyalty-invite RPCs are unavailable")
      if (!setup) return

      const merchantEmail = await seedMerchantOwnerEmail(
        sql,
        SEED_MERCHANT_SLUG
      )
      test.skip(!merchantEmail, "seed merchant owner email is unavailable")
      if (!merchantEmail) return

      await signInAsSeededMerchant(page, merchantEmail)
      await expect(page).toHaveURL(/\/app\/customers\/invite$/)

      await page.getByLabel("Email addresses").fill(email)
      await page.getByRole("button", { name: "Check list" }).click()
      await expect(page.getByText("customer ready to invite")).toBeVisible()

      const campaignId = await page
        .locator('input[name="campaignId"]')
        .inputValue()
      const recipientId = await readInviteRecipientId(sql, campaignId)
      if (!recipientId) {
        throw new Error("Invitation preview did not persist its recipient.")
      }
      fixture = {
        campaignId,
        merchantId: setup.merchantId,
        recipientId,
      }

      await page.getByLabel(/They gave this venue consent/).check()
      await page
        .getByLabel(/I confirm this list isn't bought, scraped or third-party/)
        .check()
      await page.getByRole("button", { name: "Send 1 invitation" }).click()
      await expect(page.getByText("Invitations queued")).toBeVisible()

      const sinkResponse = await page.request.post("/dev/loyalty-invite-sink", {
        headers: SYNTHETIC_SINK_HEADER,
      })
      expect(sinkResponse.ok()).toBe(true)
      const sink = (await sinkResponse.json()) as SyntheticSinkResponse
      expect(sink.ok).toBe(true)
      expect(sink.result).toMatchObject({ drained: 1, sent: 1 })
      expect(sink.deliveries).toHaveLength(1)
      expect(sink.deliveries[0]?.to).toBe(email)
      expect(sink.deliveries[0]?.providerId).toMatch(/^synthetic-/)

      const claimUrl = invitationClaimUrl(sink.deliveries[0]?.text ?? "")
      await page.goto(new URL(claimUrl).pathname)
      await expect(
        page.getByRole("heading", { name: "Two stamps to start your card" })
      ).toBeVisible()
      await page
        .getByRole("button", { name: "Collect your two stamps" })
        .click()

      await expect(
        page.getByRole("heading", { name: "Save your card to your number" })
      ).toBeVisible()
      await page.locator("#contact").fill(phone.national)
      await page.getByRole("button", { name: "Text me the code" }).click()
      await page.locator("#otp").fill(DEV_OTP)
      await page.getByRole("button", { name: "Check code" }).click()
      await page.getByLabel(/Loyalty terms/i).check()
      await Promise.all([
        page.waitForURL((url) => url.pathname.startsWith("/card/")),
        page.getByRole("button", { name: "Save my card" }).click(),
      ])

      const membership = await readInviteMembership(
        sql,
        setup.merchantId,
        phone
      )
      if (!membership) {
        throw new Error("Invitation claim did not create a membership.")
      }
      expect(membership.currentStampCount).toBe(2)
      expect(membership.inviteStampCount).toBe(2)
      await expect(page).toHaveURL(
        (url) => url.pathname === `/card/${membership.membershipId}`
      )
      await expect(page.locator(`[aria-label^="2 of "]`).first()).toBeVisible()
    } finally {
      await cleanupInviteJourney(sql, fixture, phone)
      await sql.end()
    }
  })
})

function loyaltyInviteJourneySkipReason(): string | undefined {
  if (process.env.LOYALTY_INVITE_E2E !== "1") {
    return "set LOYALTY_INVITE_E2E=1 with local Supabase to run invitation proof"
  }
  for (const name of [
    "CUSTOMER_EMAIL_ENCRYPTION_KEY",
    "CUSTOMER_EMAIL_HMAC_SECRET",
    "CUSTOMER_PHONE_HMAC_SECRET",
    "CUSTOMER_SESSION_SECRET",
  ]) {
    if (!process.env[name]?.trim()) return `${name} is required`
  }
  return undefined
}

async function readInviteSetup(
  sql: Sql
): Promise<{ merchantId: string } | undefined> {
  const rows = await sql<readonly { merchant_id: string; rpc_count: number }[]>`
    select
      merchants.id::text as merchant_id,
      (
        select count(*)::int
        from pg_proc
        where proname in (
          'claim_due_loyalty_invite_recipients',
          'claim_loyalty_invite',
          'create_loyalty_invite_draft'
        )
      ) as rpc_count
    from public.merchants
    where merchants.business_slug = ${SEED_MERCHANT_SLUG}
      and not exists (
        select 1
        from public.loyalty_invite_campaigns
        where loyalty_invite_campaigns.merchant_id = merchants.id
          and loyalty_invite_campaigns.status in ('draft', 'sending')
      )
    limit 1`
  const row = rows.at(0)
  if (!row || row.rpc_count < 3) return undefined
  return { merchantId: row.merchant_id }
}

async function readInviteRecipientId(
  sql: Sql,
  campaignId: string
): Promise<string | undefined> {
  const rows = await sql<readonly { recipient_id: string }[]>`
    select id::text as recipient_id
    from public.loyalty_invite_recipients
    where campaign_id = ${campaignId}::uuid
    limit 1`
  return rows.at(0)?.recipient_id
}

async function readInviteMembership(
  sql: Sql,
  merchantId: string,
  phone: DisposablePhone
): Promise<
  | {
      readonly membershipId: string
      readonly currentStampCount: number
      readonly inviteStampCount: number
    }
  | undefined
> {
  const rows = await sql<
    readonly {
      membership_id: string
      current_stamp_count: number
      invite_stamp_count: number
    }[]
  >`
    select
      memberships.id::text as membership_id,
      memberships.current_stamp_count::int,
      (
        select count(*)::int
        from public.stamp_events
        where stamp_events.membership_id = memberships.id
          and stamp_events.metadata ->> 'source' = 'loyalty_invite'
      ) as invite_stamp_count
    from public.customer_memberships memberships
    join public.customers on customers.id = memberships.customer_id
    where memberships.merchant_id = ${merchantId}::uuid
      and customers.phone_hmac = ${phone.phoneHmac}
    limit 1`
  const row = rows.at(0)
  if (!row) return undefined
  return {
    membershipId: row.membership_id,
    currentStampCount: row.current_stamp_count,
    inviteStampCount: row.invite_stamp_count,
  }
}

async function cleanupInviteJourney(
  sql: Sql,
  fixture: InviteCampaignFixture | undefined,
  phone: DisposablePhone
): Promise<void> {
  if (fixture) {
    await sql`
      delete from public.audit_logs
      where target_id in (
        ${fixture.campaignId}::uuid,
        ${fixture.recipientId}::uuid
      )
        or metadata ->> 'campaign_id' = ${fixture.campaignId}`
    await sql`
      delete from public.consent_records
      where merchant_id = ${fixture.merchantId}::uuid
        and customer_id in (
          select id from public.customers where phone_hmac = ${phone.phoneHmac}
        )`
    await sql`
      delete from public.loyalty_invite_campaigns
      where id = ${fixture.campaignId}::uuid`
  }
  await cleanupCustomerJoinRows(sql, undefined, phone)
}

async function signInAsSeededMerchant(
  page: Page,
  merchantEmail: string
): Promise<void> {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": `127.1.${Date.now() % 255}.1`,
  })
  await page.goto("/login?next=%2Fapp%2Fcustomers%2Finvite")
  await page.locator("#email").fill(merchantEmail)
  await page.locator("#password").fill(SEED_MERCHANT_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
}

function invitationClaimUrl(text: string): string {
  const match = text.match(/^Collect your stamps: (https?:\/\/\S+)$/m)
  if (!match?.[1])
    throw new Error("Synthetic invitation omitted its claim URL.")
  return match[1]
}
