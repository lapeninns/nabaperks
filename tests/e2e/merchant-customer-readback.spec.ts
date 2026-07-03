import { expect, test, type Page } from "@playwright/test"

import {
  adminLiveDbSkipReason,
  connectLocalDb,
  type Sql,
} from "./helpers/admin-live-db"
import {
  cleanupCustomerReadbackRows,
  createCustomerReadbackSeed,
  insertCustomerReadbackRows,
  pickSeedCustomerSetup,
  type CustomerReadbackSeed,
} from "./helpers/customer-readback-seed"
import { dismissPwaInstall } from "./helpers/harness"

const SEED_MERCHANT_EMAIL = "mia@old-crown-girton.test"
const SEED_MERCHANT_PASSWORD = "NabaperksDemo1!"

type MerchantCustomerReadbackFixture = CustomerReadbackSeed & {
  readonly maskedIdentifier: string
  readonly totalMembers: number
}

test.describe("@admin-live-db merchant customer readback", () => {
  const reason = adminLiveDbSkipReason()
  test.skip(Boolean(reason), reason)
  test.use({ serviceWorkers: "block" })

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("renders masked member rows from the signed-in merchant scope", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: MerchantCustomerReadbackFixture | undefined

    try {
      fixture = await createMerchantCustomerReadbackFixture(sql)
      test.skip(!fixture, "merchant customer readback fixture is not available")
      if (!fixture) return

      await signInAsSeededMerchant(
        page,
        `/app/customers?highlight=${fixture.membershipId}`,
        fixture.membershipId
      )

      await expect(page).toHaveURL((url) => {
        return (
          url.pathname === "/app/customers" &&
          url.searchParams.get("highlight") === fixture?.membershipId
        )
      })
      await expect(
        page.getByRole("heading", { level: 1, name: "Loyalty members" })
      ).toBeVisible()

      const highlightedMember = page
        .locator('[data-customer-highlight="true"]')
        .filter({ hasText: fixture.maskedIdentifier })
        .first()

      await expect(highlightedMember).toBeVisible()
      await expect(highlightedMember).toContainText("Reward ready")
      await expect(page.getByRole("link", { name: "Open scanner" })).toBeVisible()

      const memberStat = page
        .locator(".surface-card")
        .filter({ hasText: "Members" })
        .first()
      await expect(memberStat).toContainText(String(fixture.totalMembers))

      const body = page.locator("body")
      await expect(body).not.toContainText(fixture.rawPrivateEmail)
      await expect(body).not.toContainText(fixture.readyRewardName)
      await expect(body).not.toContainText(fixture.waitingRewardName)
      await expect(body).not.toContainText(fixture.redeemedRewardName)
      await expect(body).not.toContainText(fixture.expiredRewardName)

      const search = page.getByLabel("Search members")
      await search.fill(fixture.rawPrivateEmail)
      await expect(page.getByText("No members match your filter")).toBeVisible()

      await search.fill(fixture.maskedIdentifier)
      await expect(highlightedMember).toBeVisible()
      await expectNoHorizontalOverflow(page)
    } finally {
      await cleanupCustomerReadbackRows(sql, fixture)
      await sql.end()
    }
  })
})

async function createMerchantCustomerReadbackFixture(
  sql: Sql
): Promise<MerchantCustomerReadbackFixture | undefined> {
  const setup = await pickSeedCustomerSetup(sql)
  if (!setup) return undefined

  const { seed, runId } = createCustomerReadbackSeed(setup)
  try {
    await insertCustomerReadbackRows(sql, seed, setup, runId)

    const rows = await sql<readonly { count: number }[]>`
      select count(*)::int as count
      from public.customer_memberships
      where merchant_id = ${setup.merchant_id}::uuid`

    return {
      ...seed,
      maskedIdentifier: expectedMaskedEmail(seed.rawPrivateEmail),
      totalMembers: rows.at(0)?.count ?? 0,
    }
  } catch (error) {
    await cleanupCustomerReadbackRows(sql, seed)
    throw error
  }
}

async function signInAsSeededMerchant(
  page: Page,
  next: string,
  rateLimitNonce: string
): Promise<void> {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": localLoopbackIp(rateLimitNonce),
  })
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await expect(
    page.getByRole("heading", { name: "Back to the counter" })
  ).toBeVisible()

  await page.locator("#email").fill(SEED_MERCHANT_EMAIL)
  await page.locator("#password").fill(SEED_MERCHANT_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
}

function expectedMaskedEmail(email: string): string {
  const trimmed = email.trim()
  const atIndex = trimmed.indexOf("@")
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return "Email hidden"

  return `${trimmed[0].toLowerCase()}***@${trimmed
    .slice(atIndex + 1)
    .toLowerCase()}`
}

function localLoopbackIp(nonce: string): string {
  const first = Number.parseInt(nonce.slice(0, 2), 16) || 1
  const second = Number.parseInt(nonce.slice(2, 4), 16) || 1
  return `127.${first}.${second}.1`
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1
  })

  expect(hasOverflow).toBe(false)
}
