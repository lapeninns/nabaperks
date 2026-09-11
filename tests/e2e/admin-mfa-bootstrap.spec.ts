import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall } from "./helpers/harness"

const BOOTSTRAP = "/admin-mfa-bootstrap"
const AUTHORIZE = "/api/admin-mfa-bootstrap/authorize"
const HARNESS = "/dev/app-harness/admin-mfa"

test.describe("admin MFA bootstrap UI", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("authorize fails closed without Origin", async ({ request }) => {
    const response = await request.post(AUTHORIZE, { maxRedirects: 0 })

    expect(response.status()).toBe(403)
    await expect(response.json()).resolves.toEqual({ allowed: false })
  })

  test("authorize fails closed on a non-approved origin", async ({
    request,
  }) => {
    const response = await request.post(AUTHORIZE, {
      headers: { origin: "http://127.0.0.1:3146" },
      maxRedirects: 0,
    })

    expect(response.status()).toBe(403)
    await expect(response.json()).resolves.toEqual({ allowed: false })
  })

  test("authorize fails closed on the approved origin without a session", async ({
    request,
  }) => {
    const response = await request.post(AUTHORIZE, {
      headers: { origin: "https://nabaperks.com" },
      maxRedirects: 0,
    })

    expect(response.status()).toBe(403)
    await expect(response.json()).resolves.toEqual({ allowed: false })
  })

  test("bootstrap email stage stays usable before a code is sent @a11y", async ({
    page,
  }) => {
    await page.goto(BOOTSTRAP)

    await expect(
      page.getByRole("heading", { name: "Set up your security key" })
    ).toBeVisible()
    await expect(page.getByLabel("Administrator email")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Send sign-in code" })
    ).toBeDisabled()
    await expectNoAxeViolations(page, "admin MFA bootstrap email stage")
  })

  test("enroll harness shows the passkey setup panel @a11y", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?surface=enroll`)

    await expect(
      page.getByRole("heading", { name: "Set up two-factor authentication" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Set up passkey or security key" })
    ).toBeVisible()
    await expectNoAxeViolations(page, "admin MFA enroll harness")
  })

  test("enrolled harness shows the on state without a privileged shell", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?surface=enrolled`)

    await expect(
      page.getByRole("heading", { name: "Two-factor authentication is on" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Turn off two-factor" })
    ).toBeVisible()
    await expect(
      page.getByRole("navigation", { name: "Admin navigation" })
    ).toHaveCount(0)
  })

  test("step-up harness asks for the enrolled security key", async ({
    page,
  }) => {
    await page.goto(`${HARNESS}?surface=step-up`)

    await expect(
      page.getByRole("heading", { name: /Verify it.s you/ })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Verify with security key" })
    ).toBeVisible()
  })
})
