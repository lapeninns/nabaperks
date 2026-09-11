import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"
import { connectLocalDb } from "./helpers/admin-live-db"
import {
  cleanupRecoverableCustomer,
  CUSTOMER_SESSION_COOKIE,
  customerAccessRecoveryCookieSkipReason,
  customerAccessRecoveryMutationSkipReason,
  installPendingAccessRecovery,
  seedRecoverableCustomer,
} from "./helpers/customer-access-recovery"

/**
 * customer access recovery — existing-wallet email proof (e2e).
 *
 * Device continuity currently authenticates on verified phone, so `/home/login`
 * will not redirect into recover. This flow mints the pending recovery cookie
 * (when CUSTOMER_SESSION_SECRET is present) and drives the real
 * `/home/recover` actions. Mutation cases need local Supabase.
 *
 * Opt-in: run with CUSTOMER_FLOW_E2E=1 against such a server; the default
 * DB-free e2e CI job leaves it skipped.
 */

const DEV_OTP = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"
const WRONG_OTP = DEV_OTP === "000000" ? "111111" : "000000"
// Deliberately not the dev OTP: verifyCustomerAccessRecovery short-circuits on
// that value, so a real code is required to exercise the production digest
// comparison. Kept distinct from WRONG_OTP so the reject case stays meaningful.
const REAL_RECOVERY_CODE = DEV_OTP === "314159" ? "271828" : "314159"
const NO_EMAIL_COPY =
  /We can't safely open this existing wallet on a new device because it has no verified recovery email/i

export function describeCustomerAccessRecovery() {
  test.describe("@customer-flow wallet access recovery", () => {
    test.skip(
      !process.env.CUSTOMER_FLOW_E2E,
      "set CUSTOMER_FLOW_E2E=1 with a customer-flow dev server + local Supabase"
    )

    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("no pending recovery redirects to wallet login", async ({ page }) => {
      const response = await page.goto("/home/recover")
      test.skip(
        !response,
        "customer-flow dev server is not serving /home/recover"
      )
      expect(
        response?.status() ?? 0,
        "/home/recover must respond successfully; a 4xx or 5xx is an application regression"
      ).toBeLessThan(400)

      await expect(page).toHaveURL(/\/home\/login/)
      await expect(
        page.getByRole("heading", { name: "Welcome back" })
      ).toBeVisible()
    })

    test("pending recovery with email HMACs shows the email code anchors", async ({
      context,
      page,
    }) => {
      const cookieReason = customerAccessRecoveryCookieSkipReason()
      test.skip(Boolean(cookieReason), cookieReason)

      await installPendingAccessRecovery(context, { canUseEmail: true })
      const response = await page.goto("/home/recover")
      test.skip(
        !response,
        "customer-flow dev server is not serving /home/recover"
      )
      expect(
        response?.status() ?? 0,
        "/home/recover must respond successfully; a 4xx or 5xx is an application regression"
      ).toBeLessThan(400)

      await expect(
        page.getByRole("heading", { name: "Confirm this is your wallet" })
      ).toBeVisible()
      await expect(page.getByLabel("Email code")).toBeVisible()
      await expect(page.locator("#recovery-code")).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Open my wallet" })
      ).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Send a fresh email code" })
      ).toBeVisible()
      await expect(
        page.getByRole("link", { name: "Start again with a different phone" })
      ).toHaveAttribute("href", "/home/login")
    })

    test("wrong OTP does not mint a customer session", async ({
      context,
      page,
    }) => {
      const mutationReason = customerAccessRecoveryMutationSkipReason()
      test.skip(Boolean(mutationReason), mutationReason)

      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let customerId: string | undefined
      try {
        const seeded = await seedRecoverableCustomer(sql)
        customerId = seeded.customerId
        await installPendingAccessRecovery(context, {
          canUseEmail: true,
          customerId: seeded.customerId,
          phoneHmac: seeded.phoneHmac,
          email: seeded.email,
        })

        const response = await page.goto("/home/recover")
        test.skip(
          !response,
          "customer-flow dev server is not serving /home/recover"
        )
        expect(
          response?.status() ?? 0,
          "/home/recover must respond successfully; a 4xx or 5xx is an application regression"
        ).toBeLessThan(400)

        await page.locator("#recovery-code").fill(WRONG_OTP)
        await Promise.all([
          page.waitForResponse(
            (candidate) =>
              candidate.url().includes("/home/recover") &&
              candidate.request().method() === "POST"
          ),
          page.getByRole("button", { name: "Open my wallet" }).click(),
        ])

        await expect(page.getByText(/That code didn't match/i)).toBeVisible()
        await expect(page.locator("#recovery-code")).toBeVisible()

        const cookies = await context.cookies()
        expect(
          cookies.find((cookie) => cookie.name === CUSTOMER_SESSION_COOKIE),
          "no customer session is minted for a rejected recovery code"
        ).toBeUndefined()
        expect(new URL(page.url()).pathname).toBe("/home/recover")

        // A rejected code must not leave a server session behind, even if the
        // response never emitted Set-Cookie. Check the ledger before cleanup
        // deletes the row that would expose the regression.
        const sessions = await sql`
          select 1 from public.customer_sessions
          where customer_id = ${customerId}::uuid`
        expect(
          sessions.length,
          "a rejected recovery code must not create a customer session row"
        ).toBe(0)
      } finally {
        if (customerId) await cleanupRecoverableCustomer(sql, customerId)
        await sql.end()
      }
    })

    test("a valid recovery code opens the existing wallet", async ({
      context,
      page,
    }) => {
      const mutationReason = customerAccessRecoveryMutationSkipReason()
      test.skip(Boolean(mutationReason), mutationReason)

      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let customerId: string | undefined
      try {
        const seeded = await seedRecoverableCustomer(sql)
        customerId = seeded.customerId
        await installPendingAccessRecovery(context, {
          canUseEmail: true,
          customerId: seeded.customerId,
          phoneHmac: seeded.phoneHmac,
          email: seeded.email,
          recoveryCode: REAL_RECOVERY_CODE,
        })

        const response = await page.goto("/home/recover")
        test.skip(
          !response,
          "customer-flow dev server is not serving /home/recover"
        )
        expect(
          response?.status() ?? 0,
          "/home/recover must respond successfully; a 4xx or 5xx is an application regression"
        ).toBeLessThan(400)

        await page.locator("#recovery-code").fill(REAL_RECOVERY_CODE)
        await Promise.all([
          page.waitForResponse(
            (candidate) =>
              candidate.url().includes("/home/recover") &&
              candidate.request().method() === "POST"
          ),
          page.getByRole("button", { name: "Open my wallet" }).click(),
        ])

        await expect
          .poll(async () => {
            const cookies = await context.cookies()
            return cookies.some(
              (cookie) => cookie.name === CUSTOMER_SESSION_COOKIE
            )
          })
          .toBe(true)
        // The fixture fixes next to /home, so assert that exact destination:
        // a redirect to /home/login would satisfy a negative assertion.
        await expect.poll(() => new URL(page.url()).pathname).toBe("/home")
      } finally {
        if (customerId) await cleanupRecoverableCustomer(sql, customerId)
        await sql.end()
      }
    })

    test("no verified recovery email stays fail-closed", async ({
      context,
      page,
    }) => {
      const cookieReason = customerAccessRecoveryCookieSkipReason()
      test.skip(Boolean(cookieReason), cookieReason)

      await installPendingAccessRecovery(context, { canUseEmail: false })
      const response = await page.goto("/home/recover")
      test.skip(
        !response,
        "customer-flow dev server is not serving /home/recover"
      )
      expect(
        response?.status() ?? 0,
        "/home/recover must respond successfully; a 4xx or 5xx is an application regression"
      ).toBeLessThan(400)

      await expect(page.getByText(NO_EMAIL_COPY)).toBeVisible()
      await expect(page.locator("#recovery-code")).toHaveCount(0)
      await expect(
        page.getByRole("link", { name: "Try another phone number" })
      ).toHaveAttribute("href", "/home/login")

      const cookies = await context.cookies()
      expect(
        cookies.find((cookie) => cookie.name === CUSTOMER_SESSION_COOKIE)
      ).toBeUndefined()
    })

    test("resend reports a status without minting a session", async ({
      context,
      page,
    }) => {
      const mutationReason = customerAccessRecoveryMutationSkipReason()
      test.skip(Boolean(mutationReason), mutationReason)

      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let customerId: string | undefined
      try {
        const seeded = await seedRecoverableCustomer(sql)
        customerId = seeded.customerId
        await installPendingAccessRecovery(context, {
          canUseEmail: true,
          customerId: seeded.customerId,
          phoneHmac: seeded.phoneHmac,
          email: seeded.email,
        })

        const response = await page.goto("/home/recover")
        test.skip(
          !response,
          "customer-flow dev server is not serving /home/recover"
        )
        expect(
          response?.status() ?? 0,
          "/home/recover must respond successfully; a 4xx or 5xx is an application regression"
        ).toBeLessThan(400)

        await page
          .getByRole("button", { name: "Send a fresh email code" })
          .click()
        await expect(
          page.getByText(
            /A fresh code has been sent|couldn't send a new code|Too many recovery emails|recovery attempt has expired/i
          )
        ).toBeVisible()

        const cookies = await context.cookies()
        expect(
          cookies.find((cookie) => cookie.name === CUSTOMER_SESSION_COOKIE)
        ).toBeUndefined()
      } finally {
        if (customerId) await cleanupRecoverableCustomer(sql, customerId)
        await sql.end()
      }
    })
  })
}
