import { expect, test, type Page } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  cleanupCustomerReadbackFixture,
  createCustomerReadbackFixture,
} from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  assertJourneyEnvironment,
  copyMerchantSession,
  installCustomerSession,
  postSignedDelivery,
  readDelivery,
  removeDeliveryFixture,
  rewardCounts,
  seedDeliveryFixture,
  writeJourneyEvidence,
  writeJourneyScreenshot,
} from "./helpers/journey-race-live-db"
import {
  assertMerchantRewardPresetBrowserSession,
  cleanupMerchantRewardPresetLiveDbFixture,
  createMerchantRewardPresetLiveDbFixture,
  type MerchantRewardPresetLiveDbFixture,
} from "./helpers/merchant-reward-preset-live-db"

const REWARDS_PATH = "/app/launch?tab=rewards"

test.describe("Task15 governed journey and race receipts", () => {
  test.beforeAll(() => assertJourneyEnvironment())
  test.beforeEach(async ({ page }) => dismissPwaInstall(page))

  test("cross-tenant sentinel remains absent from another merchant session and DB scope", async ({
    browser,
  }) => {
    const sql = requiredDb()
    const owner = await browser.newContext()
    const other = await browser.newContext()
    let ownerFixture: MerchantRewardPresetLiveDbFixture | undefined
    let otherFixture: MerchantRewardPresetLiveDbFixture | undefined
    try {
      ownerFixture = await createMerchantRewardPresetLiveDbFixture(sql, owner)
      otherFixture = await createMerchantRewardPresetLiveDbFixture(sql, other)
      const ownerPage = await owner.newPage()
      await ownerPage.goto(REWARDS_PATH)
      await addCustomReward(ownerPage, "Tenant sentinel")
      const otherPage = await other.newPage()
      await otherPage.goto(REWARDS_PATH)
      await expect(otherPage.getByText("Tenant sentinel")).toHaveCount(0)
      const ownerCounts = await rewardCounts(sql, ownerFixture)
      const otherCounts = await rewardCounts(sql, otherFixture)
      expect(ownerCounts.rewards).toBe(1)
      expect(otherCounts.rewards).toBe(0)
      await writeJourneyEvidence("tenant-noninterference", {
        ownerMerchantId: ownerFixture.merchantId,
        otherMerchantId: otherFixture.merchantId,
        ownerCounts,
        otherCounts,
      })
      await writeJourneyScreenshot(otherPage, "tenant-noninterference")
    } finally {
      await cleanupMerchantRewardPresetLiveDbFixture(sql, ownerFixture)
      await cleanupMerchantRewardPresetLiveDbFixture(sql, otherFixture)
      await owner.close()
      await other.close()
      await sql.end()
    }
  })

  test("customer cookie reaches real stamp and reward surfaces without a bearer URL", async ({
    context,
    page,
  }) => {
    const sql = requiredDb()
    let fixture: Awaited<ReturnType<typeof createCustomerReadbackFixture>>
    try {
      fixture = await createCustomerReadbackFixture(sql)
      expect(fixture).toBeDefined()
      if (!fixture) throw new Error("Customer journey seed merchant is absent.")
      await installCustomerSession(context, fixture.waitingSession)
      await page.goto(`/card/${fixture.waitingMembershipId}/stamp`)
      expect(page.url()).not.toContain("bearer")
      await expect(
        page.getByRole("heading", { name: "Your reward is unlocked" })
      ).toBeVisible()
      await page.getByRole("link", { name: "See your reward" }).click()
      await expect(page).toHaveURL(/\/reward\/[0-9a-f-]+$/)
      await installCustomerSession(context, fixture.populatedSession)
      await page.goto("/home/rewards")
      await page.getByRole("link", { name: "Open reward QR" }).first().click()
      await expect(page).toHaveURL(/\/reward\/[0-9a-f-]+$/)
      expect(page.url()).not.toContain("token=")
      await writeJourneyEvidence("cookie-auth-surfaces", {
        cookieName: fixture.populatedSession.cookieName,
        membershipId: fixture.waitingMembershipId,
        rewardUrl: new URL(page.url()).pathname,
      })
      await writeJourneyScreenshot(page, "cookie-auth-surfaces")
    } finally {
      await cleanupCustomerReadbackFixture(sql, fixture)
      await sql.end()
    }
  })

  test("manual reward add has visible success and complete DB readback", async ({
    context,
    page,
  }) => {
    const sql = requiredDb()
    let fixture: MerchantRewardPresetLiveDbFixture | undefined
    try {
      fixture = await createMerchantRewardPresetLiveDbFixture(sql, context)
      await page.goto(REWARDS_PATH)
      await assertMerchantRewardPresetBrowserSession(
        page,
        fixture,
        REWARDS_PATH
      )
      await addCustomReward(page, "Receipt reward")
      const counts = await rewardCounts(sql, fixture)
      expect(counts).toEqual({ audits: 1, events: 1, rewards: 1 })
      await writeJourneyEvidence("reward-add-readback", {
        merchantId: fixture.merchantId,
        counts,
        visibleReward: "Receipt reward",
      })
      await writeJourneyScreenshot(page, "reward-add-readback")
    } finally {
      await cleanupMerchantRewardPresetLiveDbFixture(sql, fixture)
      await sql.end()
    }
  })

  test("signed Resend delivery reaches terminal DB state and replay preserves timestamps", async ({
    context,
    page,
    request,
  }) => {
    const sql = requiredDb()
    let merchant: MerchantRewardPresetLiveDbFixture | undefined
    let delivery: Awaited<ReturnType<typeof seedDeliveryFixture>> | undefined
    try {
      merchant = await createMerchantRewardPresetLiveDbFixture(sql, context)
      delivery = await seedDeliveryFixture(sql, merchant)
      await page.goto(REWARDS_PATH)
      await page.getByRole("button", { name: "Add a reward" }).click()
      await page.getByRole("button", { name: "Cancel" }).click()
      const firstStatus = await postSignedDelivery(
        request,
        delivery,
        `evt_${delivery.recipientId}`
      )
      expect(firstStatus).toBe(200)
      const first = await readDelivery(sql, delivery)
      expect(first.status).toBe("delivered")
      expect(first.delivered_at).not.toBeNull()
      const replayStatus = await postSignedDelivery(
        request,
        delivery,
        `evt_${delivery.recipientId}`
      )
      expect(replayStatus).toBe(200)
      const replay = await readDelivery(sql, delivery)
      expect(replay).toEqual(first)
      await writeJourneyEvidence("resend-terminal-replay", {
        firstStatus,
        replayStatus,
        recipientId: delivery.recipientId,
        first,
        replay,
      })
      await writeJourneyScreenshot(page, "resend-terminal-replay")
    } finally {
      await removeDeliveryFixture(sql, delivery)
      await cleanupMerchantRewardPresetLiveDbFixture(sql, merchant)
      await sql.end()
    }
  })

  test("concurrent reward intent yields one UI add, one blocked duplicate, and one DB effect", async ({
    browser,
  }) => {
    const sql = requiredDb()
    const firstContext = await browser.newContext()
    const secondContext = await browser.newContext()
    let fixture: MerchantRewardPresetLiveDbFixture | undefined
    try {
      fixture = await createMerchantRewardPresetLiveDbFixture(sql, firstContext)
      await copyMerchantSession(firstContext, secondContext)
      const firstPage = await firstContext.newPage()
      const secondPage = await secondContext.newPage()
      await Promise.all([
        firstPage.goto(REWARDS_PATH),
        secondPage.goto(REWARDS_PATH),
      ])
      await Promise.all([
        firstPage.getByRole("button", { name: "Select Free starter" }).click(),
        secondPage.getByRole("button", { name: "Select Free starter" }).click(),
      ])
      await Promise.all([
        firstPage.getByRole("button", { name: "Add 1 reward" }).click(),
        secondPage.getByRole("button", { name: "Add 1 reward" }).click(),
      ])
      await expect
        .poll(async () => {
          const current = await Promise.all([
            firstPage.getByRole("status").allTextContents(),
            secondPage.getByRole("status").allTextContents(),
          ])
          return current.flat().join("\n")
        })
        .toContain("Nothing new was added.")
      const messages = await Promise.all([
        firstPage.getByRole("status").allTextContents(),
        secondPage.getByRole("status").allTextContents(),
      ])
      const combined = messages.flat().join("\n")
      expect(combined.match(/1 reward added\./g)?.length).toBe(1)
      expect(combined.match(/Nothing new was added\./g)?.length).toBe(1)
      const counts = await rewardCounts(sql, fixture)
      expect(counts).toEqual({ audits: 1, events: 1, rewards: 1 })
      await writeJourneyEvidence("reward-race-convergence", {
        counts,
        messages,
      })
      await writeJourneyScreenshot(firstPage, "reward-race-success")
      await writeJourneyScreenshot(secondPage, "reward-race-blocked")
    } finally {
      await cleanupMerchantRewardPresetLiveDbFixture(sql, fixture)
      await firstContext.close()
      await secondContext.close()
      await sql.end()
    }
  })
})

function requiredDb() {
  const sql = connectLocalDb()
  if (!sql) throw new Error("Journey proof requires local Supabase Postgres.")
  return sql
}

async function addCustomReward(page: Page, name: string) {
  await page.getByRole("button", { name: "Add a reward" }).click()
  await page.getByLabel("Reward name").fill(name)
  await page.getByLabel("Reward terms").fill("One reward per completed card.")
  await page.getByRole("button", { name: "Add reward" }).click()
  await expect(
    page.getByRole("button", { name: new RegExp(`^${name}\\s*· w1`) })
  ).toBeVisible()
}
