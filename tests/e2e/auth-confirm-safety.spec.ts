import { expect, test, type Page } from "@playwright/test"

test.describe("auth callback safety @MS-production-security-closure", () => {
  async function expectVerificationFailure(page: Page) {
    await expect(page).toHaveURL(/\/login\?/)
    const redirect = new URL(page.url())

    expect(["localhost", "127.0.0.1"]).toContain(redirect.hostname)
    expect(redirect.port).toBe("3146")
    expect(redirect.pathname).toBe("/login")
    expect(redirect.searchParams.get("error")).toBe("verification")
    expect(redirect.searchParams.get("next")).toBe("/app/onboarding")
  }

  test("an external continuation without a verified credential fails closed", async ({
    page,
  }) => {
    await page.goto(
      "/auth/confirm?next=https%3A%2F%2Fevil.example%2Fcollect-session"
    )

    await expectVerificationFailure(page)
    expect(new URL(page.url()).hostname).not.toBe("evil.example")
  })

  test("an invalid PKCE code cannot create an authenticated session", async ({
    context,
    page,
  }) => {
    await page.goto("/auth/confirm?code=invalid-pkce-code")

    await expectVerificationFailure(page)
    expect(
      (await context.cookies()).filter(({ name }) =>
        name.startsWith("sb-")
      )
    ).toHaveLength(0)
  })

  test("an invalid email token cannot create an authenticated session", async ({
    context,
    page,
  }) => {
    await page.goto(
      "/auth/confirm?token_hash=invalid-email-token&type=magiclink"
    )

    await expectVerificationFailure(page)
    expect(
      (await context.cookies()).filter(({ name }) =>
        name.startsWith("sb-")
      )
    ).toHaveLength(0)
  })
})
