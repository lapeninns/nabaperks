import { expect, type Page } from "@playwright/test"

import { waitForHydratedPage } from "./harness"

/**
 * Brings /home/login to its phone step whatever CUSTOMER_EMAIL_AUTH_MODE the
 * server runs with. With email sign-in off, or in `existing`, the page leads
 * with the phone; in `full` a fresh device leads with email and the phone is
 * one tap away (D12), so the phone journeys take that tap.
 */
export async function openPhoneLoginStep(page: Page): Promise<void> {
  await waitForHydratedPage(page)
  const contact = page.locator("#contact")
  const usePhone = page.getByRole("button", {
    name: "Use my phone number instead",
  })
  await expect(contact.or(usePhone)).toBeVisible()
  if (await usePhone.isVisible()) await usePhone.click()
  await expect(contact).toBeVisible()
}
