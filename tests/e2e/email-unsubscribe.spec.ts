import { expect, test, type APIRequestContext } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall } from "./helpers/harness"

const INVITE_TOKEN = "invite-unsub-token"
const WELL_SHAPED_TOKEN = "A".repeat(43)
const SHORT_TOKEN = "too-short"
const CLAIM_HARNESS = "/dev/claim-unsubscribe"

async function getWithoutFollowing(request: APIRequestContext, path: string) {
  return request.get(path, { maxRedirects: 0 })
}

async function postWithoutFollowing(request: APIRequestContext, path: string) {
  return request.post(path, {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    form: { "List-Unsubscribe": "One-Click" },
    maxRedirects: 0,
  })
}

test.describe("email unsubscribe fronts", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("claim unsubscribe harness default asks before changing preferences @a11y", async ({
    page,
  }) => {
    await page.goto(CLAIM_HARNESS)

    await expect(
      page.getByRole("heading", { name: "Stop these emails?" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Stop these emails" })
    ).toBeVisible()
    await expectNoAxeViolations(page, "claim unsubscribe default")
  })

  test("claim unsubscribe harness done and failed states render", async ({
    page,
  }) => {
    await page.goto(`${CLAIM_HARNESS}?state=done`)
    await expect(
      page.getByRole("heading", { name: /You.re unsubscribed/ })
    ).toBeVisible()

    await page.goto(`${CLAIM_HARNESS}?state=failed`)
    await expect(
      page.getByRole("heading", { name: /We couldn.t save that change/ })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
  })

  test("claim unsubscribe harness submit acknowledges without an oracle", async ({
    page,
  }) => {
    await page.goto(CLAIM_HARNESS)
    await page.getByRole("button", { name: "Stop these emails" }).click()
    await expect(page).toHaveURL(/[?&]state=done/)
    await expect(
      page.getByRole("heading", { name: /You.re unsubscribed/ })
    ).toBeVisible()
  })

  test("invite unsubscribe default and done query states render @a11y", async ({
    page,
  }) => {
    await page.goto(`/invite/unsubscribe/${INVITE_TOKEN}`)
    await expect(
      page.getByRole("heading", { name: "Unsubscribe" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Yes, unsubscribe" })
    ).toBeVisible()
    await expectNoAxeViolations(page, "invite unsubscribe default")

    await page.goto(`/invite/unsubscribe/${INVITE_TOKEN}?done=1`)
    await expect(
      page.getByRole("heading", { name: /You.ve unsubscribed/ })
    ).toBeVisible()
  })

  test("one-click GET redirects to the matching unsubscribe page and does not POST", async ({
    request,
  }) => {
    for (const kind of ["invite", "claim"] as const) {
      const response = await getWithoutFollowing(
        request,
        `/api/email/unsubscribe/${kind}/${WELL_SHAPED_TOKEN}`
      )

      expect(response.status()).toBe(307)
      expect(response.headers().location ?? "").toContain(
        `/${kind}/unsubscribe/${WELL_SHAPED_TOKEN}`
      )
    }
  })

  test("one-click POST rejects a malformed token and accepts a well-shaped one without an oracle", async ({
    request,
  }) => {
    for (const kind of ["invite", "claim"] as const) {
      const invalid = await postWithoutFollowing(
        request,
        `/api/email/unsubscribe/${kind}/${SHORT_TOKEN}`
      )
      expect(invalid.status()).toBe(400)

      const validShape = await postWithoutFollowing(
        request,
        `/api/email/unsubscribe/${kind}/${WELL_SHAPED_TOKEN}`
      )
      expect(validShape.status()).not.toBe(400)
      expect([200, 503]).toContain(validShape.status())
      expect(await validShape.text()).toBe("")
    }
  })

  test("invite form submit acknowledges without revealing token validity", async ({
    page,
  }) => {
    await page.goto(`/invite/unsubscribe/${INVITE_TOKEN}`)
    await page.getByRole("button", { name: "Yes, unsubscribe" }).click()
    await expect(page).toHaveURL(/[?&]done=1/)
    await expect(
      page.getByRole("heading", { name: /You.ve unsubscribed/ })
    ).toBeVisible()
  })
})
