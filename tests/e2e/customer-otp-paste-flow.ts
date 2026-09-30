import { expect, test, type Page } from "@playwright/test"

import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

/**
 * QA BUG-050: the shared customer OTP field carried `maxlength="8"`. The
 * browser applies that cap to pasted text before the `input` event, so a
 * code pasted with its message ("Code: 123456", "Your code is 123456")
 * reached normalisation as "Code: 12" or "Your cod" and the field was left
 * holding "12" or nothing. Rendered by the DB-free customer-login harness,
 * which mounts the real phone code step; nothing is submitted.
 */
const PASTE_CASES: ReadonlyArray<readonly [string, string]> = [
  ["digits", "123456"],
  ["trailing space", "123456 "],
  ["leading and trailing spaces", "  123456  "],
  ["grouped", "123 456"],
  ["hyphenated", "123-456"],
  ["spaced pairs", "12 34 56 "],
  ["short prefix", "Code: 123456"],
  ["letter prefix", "G-123456"],
  ["long prefix", "Your code is 123456"],
  ["whole message", "Your Nabaperks code is 123456. It expires in 10 minutes."],
]

async function pasteInto(page: Page, text: string): Promise<void> {
  const field = page.getByLabel("Phone code")
  await field.fill("")
  await field.focus()
  if (test.info().project.use.browserName === "chromium") {
    // A real clipboard paste in Chromium.
    await page.evaluate((value) => navigator.clipboard.writeText(value), text)
    await page.keyboard.press("ControlOrMeta+V")
  } else {
    // WebKit and Firefox headless have no clipboard permission: insertText
    // takes the same user-agent insertion path, where maxlength applies.
    await page.keyboard.insertText(text)
  }
}

export function describeCustomerOtpPaste(): void {
  test.describe("@customer-flow customer OTP paste", () => {
    test.beforeEach(async ({ page, context, baseURL }) => {
      await dismissPwaInstall(page)
      if (test.info().project.use.browserName === "chromium" && baseURL) {
        await context.grantPermissions(["clipboard-read", "clipboard-write"], {
          origin: new URL(baseURL).origin,
        })
      }
    })

    test("a pasted code keeps its digits whatever surrounds it", async ({
      page,
    }) => {
      const sentAt = Math.floor(Date.now() / 1000)
      await gotoHydratedPage(page, `/dev/customer-login?sentAt=${sentAt}`)
      const field = page.getByLabel("Phone code")
      await expect(field).toBeVisible()

      for (const [name, text] of PASTE_CASES) {
        await pasteInto(page, text)
        await expect(field, `paste case: ${name}`).toHaveValue("123456")
      }
    })

    test("a pasted run longer than the accepted code is capped", async ({
      page,
    }) => {
      const sentAt = Math.floor(Date.now() / 1000)
      await gotoHydratedPage(page, `/dev/customer-login?sentAt=${sentAt}`)
      const field = page.getByLabel("Phone code")
      await pasteInto(page, "1234567890")
      await expect(field).toHaveValue("12345678")
    })
  })
}
