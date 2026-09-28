import { expect, type Locator, type Page } from "@playwright/test"

/**
 * Email is only ever the phone code step's fallback, offered 30 seconds after
 * the server sent the code (lib/customer/phone-code-email-fallback.ts). These
 * helpers drive that wait with Playwright's clock: install it before the
 * first navigation, then fast-forward past the wait on the code step.
 */
export const EMAIL_FALLBACK_LABEL =
  "Not received a code? Use your email instead"

/** Past the 30-second wait, with room for the whole-second send time. */
const PAST_FALLBACK_WAIT_MS = 31_000

/** The join page's fallback (a link) or /home/login's (a form button). */
export function emailFallback(page: Page): Locator {
  return page
    .getByRole("link", { name: EMAIL_FALLBACK_LABEL })
    .or(page.getByRole("button", { name: EMAIL_FALLBACK_LABEL }))
}

/** Call before the first `page.goto` so every timer runs on the fake clock. */
export async function installFallbackClock(page: Page): Promise<void> {
  await page.clock.install()
}

/**
 * On a phone code step: wait out the 30 seconds and take the email fallback.
 * The specs that pin the wait itself assert it is hidden first; a journey may
 * already be past it on the page clock.
 */
export async function takeEmailFallback(page: Page): Promise<void> {
  const fallback = emailFallback(page)
  await page.clock.fastForward(PAST_FALLBACK_WAIT_MS)
  await expect(fallback).toBeVisible()
  await fallback.click()
}
