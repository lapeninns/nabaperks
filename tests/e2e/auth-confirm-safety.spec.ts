import { expect, test } from "@playwright/test"

test.describe("auth callback safety @MS-production-security-closure", () => {
  test("an external continuation without a verified credential fails closed", async ({
    page,
  }) => {
    await page.goto(
      "/auth/confirm?next=https%3A%2F%2Fevil.example%2Fcollect-session"
    )

    await expect(page).toHaveURL(/\/login\?/)
    const redirect = new URL(page.url())

    expect(redirect.hostname).not.toBe("evil.example")
    expect(["localhost", "127.0.0.1"]).toContain(redirect.hostname)
    expect(redirect.port).toBe("3146")
    expect(redirect.pathname).toBe("/login")
    expect(redirect.searchParams.get("error")).toBe("verification")
    expect(redirect.searchParams.get("next")).toBe("/app/onboarding")
  })
})
