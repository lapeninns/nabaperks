import { expect, test } from "@playwright/test"

import {
  dismissPwaInstall,
  gotoHydratedPage,
  HARNESS_ROUTES,
} from "./helpers/harness"

const draftKey = "nabaperks:onboarding-draft:usr_harness_onboarding"
const preferenceKey = "nabaperks-theme"

test.describe("merchant onboarding draft cleanup", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test("Given an active merchant form When resumable inputs change Then the account-scoped draft persists only those inputs", async ({
    page,
  }) => {
    await dismissPwaInstall(page)
    await gotoHydratedPage(page, HARNESS_ROUTES.onboarding)

    await page.locator('input[name="addressLine1"]').fill("17 Synthetic Lane")
    await page.locator('input[name="addressCity"]').fill("Testborough")

    const persistedInputs = await page.evaluate((key) => {
      const savedDraft = window.localStorage.getItem(key)
      const fields = JSON.parse(savedDraft ?? "{}").fields ?? {}
      return {
        hasAddressLine: savedDraft?.includes("Synthetic Lane") ?? false,
        hasCity: savedDraft?.includes("Testborough") ?? false,
        hasOnlyResumableInputs: Object.keys(fields).every((field) =>
          [
            "businessName",
            "businessType",
            "phone",
            "addressLine1",
            "addressLine2",
            "addressCity",
            "addressPostcode",
          ].includes(field)
        ),
      }
    }, draftKey)
    expect(persistedInputs.hasAddressLine).toBe(true)
    expect(persistedInputs.hasCity).toBe(true)
    expect(persistedInputs.hasOnlyResumableInputs).toBe(true)

    await page.reload()
    await expect(page.locator('input[name="addressLine1"]')).toHaveValue(
      "17 Synthetic Lane"
    )
  })

  test("Given an active merchant draft When the real logout control is used Then the account draft is removed and unrelated preferences remain", async ({
    page,
  }) => {
    await dismissPwaInstall(page)
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, "dark")
    }, preferenceKey)
    await gotoHydratedPage(page, HARNESS_ROUTES.onboarding)
    await page.locator('input[name="addressLine1"]').fill("17 Synthetic Lane")
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key) !== null, draftKey)
      )
      .toBe(true)

    await page.getByRole("button", { name: "Log out" }).click()

    const storage = await page.evaluate(
      ({ accountDraftKey, unrelatedPreferenceKey }) => ({
        hasAccountDraft: window.localStorage.getItem(accountDraftKey) !== null,
        unrelatedPreference: window.localStorage.getItem(
          unrelatedPreferenceKey
        ),
      }),
      { accountDraftKey: draftKey, unrelatedPreferenceKey: preferenceKey }
    )
    expect(storage.hasAccountDraft).toBe(false)
    expect(storage.unrelatedPreference).toBe("dark")
  })

  test("Given a malformed account draft When the onboarding form loads Then it is removed and not rendered", async ({
    page,
  }) => {
    await dismissPwaInstall(page)
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, "{")
    }, draftKey)
    await gotoHydratedPage(page, HARNESS_ROUTES.onboarding)

    await expect(page.locator('input[name="addressLine1"]')).toHaveValue("")
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
      .toBeNull()
  })

  test("Given an expired account draft When the onboarding form loads Then it is removed and not rendered", async ({
    page,
  }) => {
    await dismissPwaInstall(page)
    await page.addInitScript((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          accountId: "usr_harness_onboarding",
          savedAt: Date.now() - 24 * 60 * 60 * 1000,
          fields: { addressLine1: "Expired fixture" },
        })
      )
    }, draftKey)
    await gotoHydratedPage(page, HARNESS_ROUTES.onboarding)

    await expect(page.locator('input[name="addressLine1"]')).toHaveValue("")
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
      .toBeNull()
  })

  test("Given another account's draft at the active key When the onboarding form loads Then it is removed and never rendered", async ({
    page,
  }) => {
    await dismissPwaInstall(page)
    await page.addInitScript((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          accountId: "usr_other_account",
          savedAt: Date.now(),
          fields: { addressLine1: "Other account fixture" },
        })
      )
    }, draftKey)
    await gotoHydratedPage(page, HARNESS_ROUTES.onboarding)

    await expect(page.locator('input[name="addressLine1"]')).toHaveValue("")
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
      .toBeNull()
  })

  test("Given draft text that looks like markup When the onboarding form loads Then it remains inert input text", async ({
    page,
  }) => {
    await dismissPwaInstall(page)
    await page.addInitScript((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          accountId: "usr_harness_onboarding",
          savedAt: Date.now(),
          fields: {
            addressLine1:
              "<img src=x onerror=sessionStorage.setItem('draft-injected','1')>",
          },
        })
      )
    }, draftKey)
    await gotoHydratedPage(page, HARNESS_ROUTES.onboarding)

    await expect(page.locator("img")).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem("draft-injected")))
      .toBeNull()
  })
})
