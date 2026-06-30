import { expect, type Page, type TestInfo, test } from "@playwright/test"

import { adminLiveDbSkipReason, connectLocalDb } from "./helpers/admin-live-db"
import {
  deleteInternalAdmin,
  hasInternalAdminRow,
  insertInactiveInternalAdmin,
  type InternalAdminAccount,
} from "./helpers/admin-gate-db"
import { dismissPwaInstall } from "./helpers/harness"

type AdminCredentials = {
  readonly email: string
  readonly password: string
}

type AdminGateAccount = AdminCredentials &
  InternalAdminAccount & {
    readonly label: string
  }

type AdminResponseError = {
  readonly status: number
  readonly url: string
}

const PASSWORD = "NabaperksDemo1!"
const MFA_REQUIRED_FLAG = "true"
const INTERNAL_ADMIN_REASON = "Internal admin access is required."
const MFA_REASON = "Admin MFA verification is required."

const ACTIVE_ADMIN = {
  email: "admin@nabaperks.test",
  password: PASSWORD,
} satisfies AdminCredentials

const MERCHANT_ACCOUNT = {
  label: "seed merchant",
  userId: "00000000-0000-0000-0000-000000000101",
  email: "mia@old-crown-girton.test",
  password: PASSWORD,
} satisfies AdminGateAccount

const INACTIVE_ADMIN_MOBILE = {
  label: "mobile inactive admin",
  userId: "00000000-0000-0000-0000-000000000201",
  email: "staff-a@nabaperks.test",
  password: PASSWORD,
} satisfies AdminGateAccount

const INACTIVE_ADMIN_DESKTOP = {
  label: "desktop inactive admin",
  userId: "00000000-0000-0000-0000-000000000202",
  email: "staff-b@nabaperks.test",
  password: PASSWORD,
} satisfies AdminGateAccount

function inactiveAdminAccount(testInfo: TestInfo): AdminGateAccount {
  return testInfo.project.name === "chromium"
    ? INACTIVE_ADMIN_DESKTOP
    : INACTIVE_ADMIN_MOBILE
}

async function signInToAdmin(
  page: Page,
  credentials: AdminCredentials
): Promise<void> {
  await page.goto("/login?next=/admin")
  await expect(
    page.getByRole("heading", { name: "Back to the counter" })
  ).toBeVisible()

  await page.locator("#email").fill(credentials.email)
  await page.locator("#password").fill(credentials.password)
  await page.getByRole("button", { name: "Log in" }).click()
}

function collectAdminResponseErrors(page: Page): AdminResponseError[] {
  const errors: AdminResponseError[] = []

  page.on("response", (response) => {
    const responseUrl = response.url()
    if (responseUrl.includes("/admin") && response.status() >= 500) {
      errors.push({ status: response.status(), url: responseUrl })
    }
  })

  return errors
}

async function expectAccessDenied(
  page: Page,
  reason: string,
  errors: readonly AdminResponseError[]
): Promise<void> {
  await expect(
    page.getByRole("heading", { exact: true, name: "Access denied" })
  ).toBeVisible()
  await expect(page.getByText(reason, { exact: true })).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "Admin navigation" })
  ).toHaveCount(0)
  await expect(page.getByText("Operator:")).toHaveCount(0)
  expect(new URL(page.url()).pathname).toBe("/admin")
  expect(errors).toEqual([])
}

export function describeAdminGateStates(): void {
  test.describe("@admin-live-db admin access gate states", () => {
    const reason = adminLiveDbSkipReason()
    test.skip(Boolean(reason), reason)

    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("denies a merchant account without rendering the admin shell", async ({
      page,
    }) => {
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      try {
        const hasAdminRow = await hasInternalAdminRow(
          sql,
          MERCHANT_ACCOUNT.userId
        )
        test.skip(
          hasAdminRow,
          `${MERCHANT_ACCOUNT.label} already has an internal admin row`
        )
        if (hasAdminRow) return

        const adminResponseErrors = collectAdminResponseErrors(page)
        await signInToAdmin(page, MERCHANT_ACCOUNT)
        await expectAccessDenied(
          page,
          INTERNAL_ADMIN_REASON,
          adminResponseErrors
        )
      } finally {
        await sql.end({ timeout: 5 })
      }
    })

    test("denies an inactive internal admin without rendering the admin shell", async ({
      page,
    }, testInfo) => {
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      const account = inactiveAdminAccount(testInfo)

      try {
        const hasAdminRow = await hasInternalAdminRow(sql, account.userId)
        test.skip(
          hasAdminRow,
          `${account.label} already has an internal admin row`
        )
        if (hasAdminRow) return

        await insertInactiveInternalAdmin(sql, account)

        try {
          const adminResponseErrors = collectAdminResponseErrors(page)
          await signInToAdmin(page, account)
          await expectAccessDenied(
            page,
            INTERNAL_ADMIN_REASON,
            adminResponseErrors
          )
        } finally {
          await deleteInternalAdmin(sql, account.userId)
        }
      } finally {
        await sql.end({ timeout: 5 })
      }
    })

    test("denies a seeded admin without aal2 when MFA is required", async ({
      page,
    }) => {
      test.skip(
        process.env.ADMIN_MFA_REQUIRED !== MFA_REQUIRED_FLAG,
        "set ADMIN_MFA_REQUIRED=true to prove the admin MFA gate"
      )

      const adminResponseErrors = collectAdminResponseErrors(page)
      await signInToAdmin(page, ACTIVE_ADMIN)
      await expectAccessDenied(page, MFA_REASON, adminResponseErrors)
    })
  })
}
