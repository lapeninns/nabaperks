import { expect, test } from "@playwright/test"

const NEXT_DEV_INLINE_SCRIPT_HASH =
  "sha256-BgBkXHgyVZ0ON/UalzXrbnvY5QVt+gqIrRnCdrvAxmk="

export function describePublicQrRouter() {
  test.describe("public QR router", () => {
    test("shows the unavailable QR state without CSP errors or layout overflow", async ({
      page,
    }) => {
      const cspMessages: string[] = []
      const pageErrors: string[] = []

      page.on("console", (message) => {
        const text = message.text()
        if (isActionableCspMessage(text)) {
          cspMessages.push(text)
        }
      })
      page.on("pageerror", (error) => {
        pageErrors.push(error.message)
      })

      const response = await page.goto("/q/not-a-real-qr")

      expect(response?.status()).toBe(200)
      await expect(
        page.getByRole("heading", {
          name: "This loyalty card is unavailable",
        })
      ).toBeVisible()
      await expect(page.getByRole("link", { name: "Scan a QR" })).toHaveAttribute(
        "href",
        "/scan"
      )
      await expect(
        page.getByRole("link", { name: "Open my cards" })
      ).toHaveAttribute("href", "/home")

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      )

      expect(hasHorizontalOverflow).toBe(false)
      expect(cspMessages).toEqual([])
      expect(pageErrors).toEqual([])
    })
  })
}

function isActionableCspMessage(text: string): boolean {
  const isCspMessage =
    text.includes("Content Security Policy") ||
    text.includes("violates Content Security Policy")
  if (!isCspMessage) return false

  return !(
    text.includes("Executing inline script violates") &&
    text.includes(NEXT_DEV_INLINE_SCRIPT_HASH)
  )
}
