import { expect, test, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"
import {
  assertMerchantOnboardingBrowserSession,
  assertMerchantOnboardingDbState,
  assertMerchantOnboardingRolledBack,
  cleanupMerchantOnboardingLiveDbFixture,
  connectMerchantOnboardingDb,
  createMerchantOnboardingLiveDbFixture,
  installMerchantOnboardingAuditFailure,
  merchantOnboardingLiveDbSkipReason,
  removeMerchantOnboardingAuditFailure,
  type MerchantOnboardingLiveDbFixture,
} from "./helpers/merchant-onboarding-live-db"

const DRAFT_KEY = "nabaperks:onboarding-draft:usr_harness_onboarding"

export function defineMerchantOnboardingContinuityTests() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("mobile orientation precedes the first field while the full roadmap remains available @MS-merchant-ux-audit-closure @a11y", async ({
    page,
  }, testInfo) => {
    await page.goto(HARNESS_ROUTES.onboarding)

    const summary = page.locator('[data-onboarding-orientation="summary"]')
    const firstField = page.locator('input[name="businessName"]')
    const roadmap = page.getByRole("heading", {
      name: "From sign-up to your first stamp",
    })

    if (testInfo.project.name === "mobile-safari") {
      await expect(summary).toBeVisible()
      const [summaryBox, firstFieldBox] = await Promise.all([
        summary.boundingBox(),
        firstField.boundingBox(),
      ])
      expect(summaryBox).not.toBeNull()
      expect(firstFieldBox).not.toBeNull()
      expect(summaryBox!.y + summaryBox!.height).toBeLessThanOrEqual(
        firstFieldBox!.y
      )
    } else {
      await expect(summary).toBeHidden()
    }

    await expect(roadmap).toBeVisible()
    await expectNoAxeViolations(page, "merchant onboarding orientation")
    await expectNoHorizontalOverflow(page)
  })

  test("server fields stay authoritative while a partial local draft restores the missing address", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key }) => {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            businessName: "Stale Draft Name",
            locationName: "Stale Draft Venue",
            addressLine1: "15 Market Street",
            addressLine2: "",
            addressCity: "Cambridge",
            addressPostcode: "CB2 3PA",
          })
        )
      },
      { key: DRAFT_KEY }
    )

    await page.goto(HARNESS_ROUTES.onboarding)

    await expect(page.locator('input[name="businessName"]')).toHaveValue(
      "Old Crown Girton"
    )
    await expect(page.locator('input[name="locationName"]')).toHaveValue(
      "Old Crown Girton"
    )
    await expect(page.locator('input[name="addressLine1"]')).toHaveValue(
      "15 Market Street"
    )
    await expect(page.locator('input[name="addressCity"]')).toHaveValue(
      "Cambridge"
    )
    await expect(page.locator('input[name="addressPostcode"]')).toHaveValue(
      "CB2 3PA"
    )
  })

  test("required-field failures stay client-side, announce, and refocus on every attempt", async ({
    page,
  }) => {
    await page.goto(HARNESS_ROUTES.onboarding)
    await page.locator('input[name="businessName"]').clear()
    await page.locator('input[name="locationName"]').clear()

    let actionPosts = 0
    page.on("request", (request) => {
      if (request.method() === "POST") actionPosts += 1
    })

    const submit = page.getByRole("button", { name: "Finish setup" })
    await submit.click()

    const businessName = page.locator('input[name="businessName"]')
    await expect(businessName).toBeFocused()
    await expect(
      page.getByRole("alert").filter({ hasText: "Enter the business name." })
    ).toBeVisible()
    expect(actionPosts).toBe(0)

    await submit.click()
    await expect(businessName).toBeFocused()
    await expect(
      page.getByRole("alert").filter({ hasText: "Enter the business name." })
    ).toBeVisible()
    expect(actionPosts).toBe(0)
  })

  test("a server failure retains safe fields, announces the recovery message, and focuses it", async ({
    page,
  }) => {
    await page.goto(HARNESS_ROUTES.onboarding)
    await page.locator('input[name="addressLine1"]').fill("15 Market Street")
    await page.locator('input[name="addressCity"]').fill("Cambridge")
    await page.locator('input[name="addressPostcode"]').fill("CB2 3PA")

    await page.getByRole("button", { name: "Finish setup" }).click()

    const sessionError = page
      .getByRole("alert")
      .filter({ hasText: "Your session expired. Log in again." })
    await expect(sessionError).toBeVisible()
    await expect(sessionError).toBeFocused()
    await expect(page.locator('input[name="businessName"]')).toHaveValue(
      "Old Crown Girton"
    )
    await expect(page.locator('input[name="addressLine1"]')).toHaveValue(
      "15 Market Street"
    )
    await expect(page.locator('input[name="addressPostcode"]')).toHaveValue(
      "CB2 3PA"
    )
  })

  test.describe("local Supabase transaction proof", () => {
    const skipReason = merchantOnboardingLiveDbSkipReason()
    test.skip(Boolean(skipReason), skipReason)

    test("audit failure rolls back the whole setup, preserves the form, and a retry succeeds", async ({
      page,
      context,
    }) => {
      const sql = connectMerchantOnboardingDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantOnboardingLiveDbFixture | undefined
      let proofError: unknown

      try {
        fixture = await createMerchantOnboardingLiveDbFixture(sql, context)
        await installMerchantOnboardingAuditFailure(sql, fixture)
        await page.goto("/app/onboarding")

        await page
          .locator('input[name="businessName"]')
          .fill(fixture.expected.businessName)
        await page
          .locator('select[name="businessType"]')
          .selectOption(fixture.expected.businessType)
        await page
          .locator('input[name="phone"]')
          .fill(fixture.expected.phone ?? "")
        await page
          .locator('input[name="locationName"]')
          .fill(fixture.expected.locationName)
        await page
          .locator('input[name="addressLine1"]')
          .fill(fixture.expected.addressLine1)
        await page
          .locator('input[name="addressLine2"]')
          .fill(fixture.expected.addressLine2 ?? "")
        await page
          .locator('input[name="addressCity"]')
          .fill(fixture.expected.addressCity)
        await page
          .locator('input[name="addressPostcode"]')
          .fill(fixture.expected.addressPostcode)
        await setProviderVenueProvenance(page, fixture)

        await page.getByRole("button", { name: "Finish setup" }).click()

        const saveError = page.getByRole("alert").filter({
          hasText:
            "Profile could not be saved. Check your details and try again.",
        })
        await expect(saveError).toBeVisible()
        await expect(saveError).toBeFocused()
        await expect(page).toHaveURL(
          (url) => url.pathname === "/app/onboarding"
        )
        await expect(page.locator('input[name="businessName"]')).toHaveValue(
          fixture.expected.businessName
        )
        await expect(page.locator('input[name="locationName"]')).toHaveValue(
          fixture.expected.locationName
        )
        await expect(page.locator('input[name="addressLine1"]')).toHaveValue(
          fixture.expected.addressLine1
        )
        await expect(page.locator('input[name="addressPostcode"]')).toHaveValue(
          fixture.expected.addressPostcode
        )
        await assertMerchantOnboardingBrowserSession(page, fixture)
        await assertMerchantOnboardingRolledBack(sql, fixture)

        await removeMerchantOnboardingAuditFailure(sql)
        await setProviderVenueProvenance(page, fixture)
        await page.getByRole("button", { name: "Finish setup" }).click()

        await expect(page).toHaveURL(
          (url) => `${url.pathname}${url.search}` === "/app/launch?tab=card"
        )
        await assertMerchantOnboardingBrowserSession(
          page,
          fixture,
          "/app/launch?tab=card"
        )
        await assertMerchantOnboardingDbState(sql, fixture)
      } catch (error) {
        proofError = error
      }

      const cleanupErrors: Error[] = []
      try {
        await cleanupMerchantOnboardingLiveDbFixture(sql, fixture)
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
          "Merchant onboarding proof and cleanup failed."
        )
      }
      if (proofError) throw proofError
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          cleanupErrors,
          "Merchant onboarding proof cleanup failed."
        )
      }
    })
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

async function setProviderVenueProvenance(
  page: Page,
  fixture: MerchantOnboardingLiveDbFixture
): Promise<void> {
  const fields = {
    addressSource: fixture.expected.addressSource,
    addressProvider: fixture.expected.addressProvider ?? "",
    addressProviderId: fixture.expected.addressProviderId ?? "",
    providerLatitude: String(fixture.expected.latitude ?? ""),
    providerLongitude: String(fixture.expected.longitude ?? ""),
  }

  for (const [name, value] of Object.entries(fields)) {
    await page.locator(`input[name="${name}"]`).evaluate((input, nextValue) => {
      if (!(input instanceof HTMLInputElement)) {
        throw new Error("Provider provenance field is not an input.")
      }
      input.value = nextValue
    }, value)
  }
}

function asTestError(label: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`${label}: ${message}`, { cause: error })
}
