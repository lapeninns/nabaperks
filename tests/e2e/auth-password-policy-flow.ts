import { expect, test, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import {
  AUTH_PASSWORD_POLICY_USER_AGENT,
  assertPublicLocalPasswordPolicy,
  authPasswordPolicyLiveDbSkipReason,
} from "./helpers/auth-password-policy-live-db"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

export function defineAuthPasswordPolicyTests() {
  test.use({ serviceWorkers: "block" })
  test.use({ userAgent: AUTH_PASSWORD_POLICY_USER_AGENT })

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("signup rules are visible, associated, contextual, and keyboard clear", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/signup")

    const password = page.getByLabel("Password", { exact: true })
    const requirements = page.getByRole("region", {
      name: "Password requirements",
    })
    await expect(requirements).toBeVisible()
    await expect(requirements).toContainText("8 or more characters")
    await expect(requirements).toContainText("At least one letter")
    await expect(requirements).toContainText("At least one number")
    await expect(password).toHaveAttribute(
      "aria-describedby",
      /signup-password-requirements/
    )
    await expect(requirements).toContainText("Password meets 0 of 3 rules")

    await password.fill("abcdefgh")
    await expect(requirements).toContainText("Password meets 2 of 3 rules")
    await password.fill("lowercase9")
    await expect(requirements).toContainText("Password meets all 3 rules")

    await password.focus()
    await expect(password).toBeFocused()
    const focus = await password.evaluate((element) => {
      const style = window.getComputedStyle(element)
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      }
    })
    expect(focus.outlineStyle).not.toBe("none")
    expect(focus.outlineWidth).not.toBe("0px")
    await expectFocusedHomeContract(page)
    await expectNoHorizontalOverflow(page)
    await expectNoAxeViolations(page, "signup password-policy guidance")
  })

  test("reset rules and focused footer keep the same accessible contract", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/reset-password?stage=verify&email=operator%40example.test"
    )

    const password = page.getByLabel("New password", { exact: true })
    const requirements = page.getByRole("region", {
      name: "Password requirements",
    })
    await expect(password).toHaveAttribute(
      "aria-describedby",
      /reset-password-requirements/
    )
    await expect(requirements).toContainText("Password meets 0 of 3 rules")
    await password.fill("lowercase9")
    await expect(requirements).toContainText("Password meets all 3 rules")
    await expectFocusedHomeContract(page)
    await expectNoHorizontalOverflow(page)
    await expectNoAxeViolations(page, "reset password-policy guidance")
  })

  test.describe("public local Supabase policy proof", () => {
    const skipReason = authPasswordPolicyLiveDbSkipReason()
    test.skip(Boolean(skipReason), skipReason)

    test("public signup and recovery accept the policy while missing rules reject", async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "provider-mutating proof runs once in Chromium"
      )
      if (testInfo.config.workers !== 1) {
        throw new Error(
          "Local Auth policy proof mutates disposable auth users and requires one Playwright worker."
        )
      }
      await assertPublicLocalPasswordPolicy(page)
    })
  })
}

async function expectFocusedHomeContract(page: Page) {
  await expect(
    page.getByRole("link", { name: "Nabaperks home", exact: true })
  ).toHaveCount(1)
  await expect(
    page.getByRole("link", { name: "Terms", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Privacy", exact: true })
  ).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBeLessThanOrEqual(1)
}
