import { expect, test, type Page } from "@playwright/test"

test.describe("auth callback safety @MS-production-security-closure", () => {
  function expectedBaseUrl(baseURL: string | undefined) {
    if (!baseURL) {
      throw new Error("Playwright baseURL is required for auth safety tests")
    }

    return new URL(baseURL)
  }

  async function expectVerificationFailure(page: Page, baseURL: string | undefined) {
    await expect(page).toHaveURL(/\/login\?/)
    const redirect = new URL(page.url())
    const expected = expectedBaseUrl(baseURL)

    expect(["localhost", "127.0.0.1"]).toContain(redirect.hostname)
    expect(redirect.protocol).toBe(expected.protocol)
    expect(redirect.port).toBe(expected.port)
    expect(redirect.pathname).toBe("/login")
    expect(redirect.searchParams.get("error")).toBe("verification")
    expect(redirect.searchParams.get("next")).toBe("/app/onboarding")
  }

  test("an external continuation without a verified credential fails closed", async ({
    baseURL,
    page,
  }) => {
    await page.goto(
      "/auth/confirm?next=https%3A%2F%2Fevil.example%2Fcollect-session"
    )

    await expectVerificationFailure(page, baseURL)
    expect(new URL(page.url()).hostname).not.toBe("evil.example")
  })

  test("an invalid PKCE code cannot create an authenticated session", async ({
    baseURL,
    context,
    page,
  }) => {
    await page.goto("/auth/confirm?code=invalid-pkce-code")

    await expectVerificationFailure(page, baseURL)
    expect(
      (await context.cookies()).filter(({ name }) =>
        name.startsWith("sb-")
      )
    ).toHaveLength(0)
  })

  test("an invalid email token cannot create an authenticated session", async ({
    baseURL,
    context,
    page,
  }) => {
    await page.goto(
      "/auth/confirm?token_hash=invalid-email-token&type=magiclink"
    )

    await expectVerificationFailure(page, baseURL)
    expect(
      (await context.cookies()).filter(({ name }) =>
        name.startsWith("sb-")
      )
    ).toHaveLength(0)
  })
})
