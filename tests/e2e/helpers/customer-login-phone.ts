import { expect, type Page } from "@playwright/test"

import { waitForHydratedPage } from "./harness"

/**
 * Waits for /home/login's phone step. Phone leads in every
 * CUSTOMER_EMAIL_AUTH_MODE, with no email option beside the number; email is
 * only the phone code step's fallback (helpers/email-fallback.ts).
 */
export async function openPhoneLoginStep(page: Page): Promise<void> {
  await waitForHydratedPage(page)
  await expect(page.locator("#contact")).toBeVisible()
  await expect(page.getByLabel("Email address")).toHaveCount(0)
}
