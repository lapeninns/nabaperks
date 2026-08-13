import { expect, test, type BrowserContext } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"
import {
  assertMerchantRewardPresetBrowserSession,
  assertMerchantRewardPresetDbState,
  assertMerchantRewardPresetRolledBack,
  cleanupMerchantRewardPresetLiveDbFixture,
  connectMerchantRewardPresetDb,
  createMerchantRewardPresetLiveDbFixture,
  installMerchantRewardPresetAuditFailure,
  merchantRewardPresetExpectedRewards,
  merchantRewardPresetLiveDbSkipReason,
  removeMerchantRewardPresetAuditFailure,
  type MerchantRewardPresetLiveDbFixture,
} from "./helpers/merchant-reward-preset-live-db"

const REWARDS_PATH = "/app/launch?tab=rewards"
const BILLING_PATH = "/app/launch?tab=billing"
const QR_PATH = "/app/launch?tab=qr"
type MerchantRewardPresetSql = NonNullable<
  ReturnType<typeof connectMerchantRewardPresetDb>
>
type RewardNameRow = Readonly<{ reward_name: string }>

export function defineMerchantRewardPresetAtomicAddTests() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test.describe("local Supabase transaction proof", () => {
    const skipReason = merchantRewardPresetLiveDbSkipReason()
    test.skip(Boolean(skipReason), skipReason)

    test("a separate save removes a now-existing preset from the draft batch", async ({
      page,
      context,
    }) => {
      const sql = connectMerchantRewardPresetDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantRewardPresetLiveDbFixture | undefined
      let proofError: unknown

      try {
        fixture = await createMerchantRewardPresetLiveDbFixture(sql, context)
        await page.goto(REWARDS_PATH)
        await assertMerchantRewardPresetBrowserSession(
          page,
          fixture,
          REWARDS_PATH
        )

        const freeStarter = page.getByRole("button", {
          name: "Select Free starter",
        })
        await freeStarter.click()
        await expect(
          page.getByRole("button", {
            name: "Remove Free starter from selection",
          })
        ).toHaveAttribute("aria-pressed", "true")

        await page.getByRole("button", { name: "Add a reward" }).click()
        await page.getByLabel("Reward name").fill("Free starter")
        await page
          .getByLabel("Reward terms")
          .fill("One starter with a paid main. Valid once issued.")
        await page.getByRole("button", { name: "Add reward" }).click()

        await expect(
          page.getByRole("button", {
            name: "Free starter is already in your pool",
          })
        ).toBeDisabled()
        await expect(
          page.getByRole("button", { name: "Add 1 reward" })
        ).toHaveCount(0)
        await expect(page.getByText(/1 selected/)).toHaveCount(0)
        await expect(
          page.getByRole("button", { name: /^Free starter\s*· w1/ })
        ).toBeVisible()

        const savedRewards = await sql<readonly RewardNameRow[]>`
          select reward_name
          from public.reward_pool_items
          where loyalty_card_id = ${fixture.cardId}::uuid
          order by display_order, id`
        expect(savedRewards).toEqual([{ reward_name: "Free starter" }])
        await assertMerchantRewardPresetBrowserSession(page, fixture)
      } catch (error) {
        proofError = error
      }

      await finishLiveProof(sql, fixture, proofError)
    })

    test("second audit failure rolls back all selected rewards and retry succeeds without reselecting", async ({
      page,
      context,
    }) => {
      const sql = connectMerchantRewardPresetDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantRewardPresetLiveDbFixture | undefined
      let proofError: unknown

      try {
        fixture = await createMerchantRewardPresetLiveDbFixture(sql, context)
        await installMerchantRewardPresetAuditFailure(sql, fixture)
        await page.goto(REWARDS_PATH)

        await assertMerchantRewardPresetBrowserSession(
          page,
          fixture,
          REWARDS_PATH
        )
        await expect(page.getByText("No rewards in the pool yet")).toBeVisible()
        await expect(page.getByText("0 / 3 active")).toBeVisible()

        for (const reward of merchantRewardPresetExpectedRewards) {
          const select = page.getByRole("button", {
            name: `Select ${reward.name}`,
          })
          await select.click()
          await expect(
            page.getByRole("button", {
              name: `Remove ${reward.name} from selection`,
            })
          ).toHaveAttribute("aria-pressed", "true")
        }

        const addSelected = page.getByRole("button", {
          name: "Add 3 rewards",
        })
        await expect(addSelected).toBeVisible()
        await assertMerchantRewardPresetRolledBack(sql, fixture)

        await addSelected.click()

        const saveError = page.getByRole("alert").filter({
          hasText:
            "Rewards not added. Nothing was changed. Your choices are still selected — try again.",
        })
        await expect(saveError).toBeVisible()
        await expect(saveError).toBeFocused()
        await expect(page).toHaveURL(
          (url) => `${url.pathname}${url.search}` === REWARDS_PATH
        )
        for (const reward of merchantRewardPresetExpectedRewards) {
          await expect(
            page.getByRole("button", {
              name: `Remove ${reward.name} from selection`,
            })
          ).toHaveAttribute("aria-pressed", "true")
        }
        await expect(
          page.getByRole("button", { name: "Add 3 rewards" })
        ).toBeEnabled()
        await assertMerchantRewardPresetBrowserSession(page, fixture)
        await assertMerchantRewardPresetRolledBack(sql, fixture)

        await removeMerchantRewardPresetAuditFailure(sql)
        await page.getByRole("button", { name: "Add 3 rewards" }).click()

        const success = page
          .getByRole("status")
          .filter({ hasText: "3 rewards added. 3 of 3 active" })
        await expect(success).toBeVisible()
        await expect(success).toBeFocused()
        await expect(page.getByText("3 active · ready")).toBeVisible()
        const nextStep = page.getByRole("complementary").getByRole("link", {
          name: "Billing",
          exact: true,
        })
        await expect(nextStep).toBeVisible()
        await expect(nextStep).toHaveAttribute("href", BILLING_PATH)
        const lockedQrLink = page.getByRole("link", {
          name: "Venue QR, to do",
          exact: true,
        })
        await expect(lockedQrLink).toBeVisible()

        for (const reward of merchantRewardPresetExpectedRewards) {
          await expect(
            page.getByRole("button", {
              name: `${reward.name} is already in your pool`,
            })
          ).toBeDisabled()
          await expect(
            page.getByRole("button", {
              name: new RegExp(`^${escapeRegex(reward.name)}\\s*· w1`),
            })
          ).toBeVisible()
        }

        await assertMerchantRewardPresetDbState(sql, fixture)

        await lockedQrLink.click()
        await expect(page).toHaveURL(
          (url) => `${url.pathname}${url.search}` === QR_PATH
        )
        await expect(
          page.getByRole("heading", {
            name: "Activate billing to unlock your venue QR",
          })
        ).toBeVisible()
        await expect(
          page.getByRole("alert").filter({
            hasText: "There is no venue QR to share or print yet.",
          })
        ).toBeVisible()
        await expect(
          page.getByRole("region", { name: "Venue QR code" })
        ).toHaveCount(0)
        await expect(page.getByText("Permanent venue link")).toHaveCount(0)
        await expect(
          page.getByRole("link", { name: "Go to billing" })
        ).toHaveAttribute("href", BILLING_PATH)
        await assertMerchantRewardPresetBrowserSession(page, fixture, QR_PATH)
        await assertMerchantRewardPresetDbState(sql, fixture)
      } catch (error) {
        proofError = error
      }

      await finishLiveProof(sql, fixture, proofError)
    })

    test("Given a foreign tenant reward sentinel When this merchant adds a preset Then the foreign row is unchanged", async ({
      browser,
      context,
      page,
    }) => {
      const sql = connectMerchantRewardPresetDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      const foreignContext = await browser.newContext()
      const fixtures: MerchantRewardPresetLiveDbFixture[] = []
      let proofError: unknown

      try {
        const fixture = await createMerchantRewardPresetLiveDbFixture(
          sql,
          context
        )
        fixtures.push(fixture)
        const foreignFixture = await createMerchantRewardPresetLiveDbFixture(
          sql,
          foreignContext
        )
        fixtures.push(foreignFixture)

        // Given: an independently owned row carries a value the target mutation must preserve.
        const [sentinel] = await sql<readonly { id: string }[]>`
          insert into public.reward_pool_items (
            merchant_id, location_id, loyalty_card_id, reward_name,
            reward_terms, weight, is_active, display_order
          ) values (
            ${foreignFixture.merchantId}::uuid,
            ${foreignFixture.locationId}::uuid,
            ${foreignFixture.cardId}::uuid,
            'Foreign tenant sentinel',
            'Must remain byte-for-byte unchanged.',
            7,
            true,
            1
          )
          returning id::text as id
        `
        const before = await readRewardSentinel(sql, sentinel.id)

        // When: the authenticated owner adds a preset through the real browser action.
        await page.goto(REWARDS_PATH)
        await assertMerchantRewardPresetBrowserSession(
          page,
          fixture,
          REWARDS_PATH
        )
        await page
          .getByRole("button", { name: "Select Regulars' pint" })
          .click()
        await page.getByRole("button", { name: "Add 1 reward" }).click()
        await expect(
          page.getByRole("status").filter({ hasText: "1 reward added" })
        ).toBeVisible()

        // Then: the target mutation exists and the foreign tenant sentinel is identical.
        const targetRewards = await sql<readonly RewardNameRow[]>`
          select reward_name
          from public.reward_pool_items
          where merchant_id = ${fixture.merchantId}::uuid
        `
        expect(targetRewards).toEqual([{ reward_name: "Regulars' pint" }])
        expect(await readRewardSentinel(sql, sentinel.id)).toEqual(before)
      } catch (error) {
        proofError = error
      }

      await finishTenantProof(sql, fixtures, foreignContext, proofError)
    })
  })
}

type RewardSentinelRow = Readonly<{
  id: string
  is_active: boolean
  merchant_id: string
  reward_name: string
  reward_terms: string
  weight: number
}>

async function readRewardSentinel(
  sql: MerchantRewardPresetSql,
  id: string
): Promise<RewardSentinelRow | undefined> {
  const rows = await sql<readonly RewardSentinelRow[]>`
    select id::text, merchant_id::text, reward_name, reward_terms, weight,
      is_active
    from public.reward_pool_items
    where id = ${id}::uuid
  `
  return rows.at(0)
}

async function finishTenantProof(
  sql: MerchantRewardPresetSql,
  fixtures: readonly MerchantRewardPresetLiveDbFixture[],
  foreignContext: BrowserContext,
  proofError: unknown
): Promise<void> {
  const cleanupErrors: Error[] = []
  for (const fixture of fixtures) {
    try {
      await cleanupMerchantRewardPresetLiveDbFixture(sql, fixture)
    } catch (error) {
      cleanupErrors.push(asTestError("tenant fixture cleanup", error))
    }
  }
  try {
    await foreignContext.close()
  } catch (error) {
    cleanupErrors.push(asTestError("foreign browser context close", error))
  }
  try {
    await sql.end({ timeout: 5 })
  } catch (error) {
    cleanupErrors.push(asTestError("database connection close", error))
  }

  if (proofError || cleanupErrors.length > 0) {
    throw new AggregateError(
      [
        ...(proofError ? [asTestError("tenant proof", proofError)] : []),
        ...cleanupErrors,
      ],
      "Tenant noninterference proof or cleanup failed."
    )
  }
}

async function finishLiveProof(
  sql: MerchantRewardPresetSql,
  fixture: MerchantRewardPresetLiveDbFixture | undefined,
  proofError: unknown
) {
  const cleanupErrors: Error[] = []
  try {
    await cleanupMerchantRewardPresetLiveDbFixture(sql, fixture)
  } catch (error) {
    cleanupErrors.push(asTestError("fixture cleanup", error))
  }
  try {
    await sql.end({ timeout: 5 })
  } catch (error) {
    cleanupErrors.push(asTestError("database connection close", error))
  }

  if (proofError && cleanupErrors.length > 0) {
    throw new AggregateError(
      [asTestError("transaction proof", proofError), ...cleanupErrors],
      "Reward preset proof and cleanup failed."
    )
  }
  if (proofError) throw proofError
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "Reward preset proof cleanup failed."
    )
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function asTestError(label: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : "unknown error"
  return new Error(`${label}: ${message}`)
}
