import { expect, test } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import {
  cleanupCustomerJoinRows,
  DEV_OTP,
  disposableUkMobile,
  openOtpStep,
  readJoinedMembership,
  WRONG_OTP,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

// Neutral resend reply from requestCustomerIdentityAction: the same copy
// whether the dispatch limiter admitted or refused the send (anti-enumeration).
const RESEND_OUTCOME = "If a new code arrives, use the latest one."
/** Past the code step's 30-second resend wait, with room for whole seconds. */
const PAST_RESEND_WAIT_MS = 31_000

test.describe("@customer-flow customer join live DB", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("joins from a disposable QR through OTP and records the first stamp", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: PublicQrRouterFixture | undefined
    const phone = disposableUkMobile()

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return

      await openOtpStep(page, fixture, phone)

      await page.locator("#otp").fill(DEV_OTP)
      await page.getByRole("button", { name: "Continue" }).click()
      await expect(
        page.getByRole("heading", { name: /^Join the card at / })
      ).toBeVisible()

      const loyaltyTerms = page.getByLabel(/Card terms/i)
      await page.getByRole("button", { name: "Add my first stamp" }).click()
      await expect(
        page.getByText("Tick the card terms to continue.", { exact: true })
      ).toBeVisible()
      await expect(loyaltyTerms).toHaveAttribute("aria-invalid", "true")

      await loyaltyTerms.check()
      await expect(
        page.getByText("Tick the card terms to continue.", { exact: true })
      ).toBeHidden()
      await expect(loyaltyTerms).toHaveAttribute("aria-invalid", "false")

      await Promise.all([
        page.waitForURL(
          (url) =>
            url.pathname.startsWith("/card/") &&
            url.searchParams.get("welcome") === "1" &&
            url.searchParams.get("stamp") === "issued"
        ),
        page.getByRole("button", { name: "Add my first stamp" }).click(),
      ])

      const joined = await readJoinedMembership(sql, fixture, phone)
      if (!joined) {
        throw new Error("Join did not create a disposable membership.")
      }
      expect(joined.current_stamp_count).toBe(1)
      expect(joined.total_stamps_earned).toBe(1)
      expect(joined.stamp_count).toBe(1)
      expect(joined.join_event_count).toBe(1)
      expect(new URL(page.url()).pathname).toBe(`/card/${joined.membership_id}`)
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })

  test("keeps a disposable QR join on the OTP step when the code is wrong", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: PublicQrRouterFixture | undefined
    const phone = disposableUkMobile()

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return

      await openOtpStep(page, fixture, phone)

      await page.locator("#otp").fill(WRONG_OTP)
      await page.getByRole("button", { name: "Continue" }).click()

      await expect(
        page.getByText("That code didn't work. Check it and try again.", {
          exact: true,
        })
      ).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Enter your code" })
      ).toBeVisible()
      await expect(readJoinedMembership(sql, fixture, phone)).resolves.toBe(
        undefined
      )
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })

  test("rate-limits resends without invalidating the current code", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: PublicQrRouterFixture | undefined
    const phone = disposableUkMobile()

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return

      // The code step counts a quiet 30-second wait after each send before
      // offering "Send a new code" again (PHONE_CODE_RESEND_AFTER_SECONDS).
      // The page clock waits it out, so every resend below still reaches the
      // server, whose limiter stays the authority.
      await page.clock.install()
      await openOtpStep(page, fixture, phone)
      const resend = page.getByRole("button", {
        name: "Send a new code",
        exact: true,
      })
      const resendOutcome = page.getByText(RESEND_OUTCOME, { exact: true })

      // The phone dispatch bucket admits 10 sends per 15 minutes: the initial
      // send plus 9 resends. The 10th resend is refused by the limiter, but the
      // action deliberately answers admitted and refused resends with the same
      // neutral copy so the reply never reveals whether a code was dispatched.
      // Every click round-trips a server action, so wait for that POST to
      // settle before reading the outcome — the copy is identical each time.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await page.clock.fastForward(PAST_RESEND_WAIT_MS)
        await expect(resend).toBeEnabled()
        await Promise.all([
          page.waitForResponse(
            (response) =>
              response.request().method() === "POST" &&
              new URL(response.url()).pathname.includes("/join")
          ),
          resend.click(),
        ])
        await expect(resendOutcome).toBeVisible()
        // Neither admitted nor refused resends lock the step: the code field
        // stays usable, and the control returns after the quiet wait (checked
        // before the next click).
        await expect(page.locator("#otp")).toBeEditable()
        await expect(page.getByText(/too many/i)).toHaveCount(0)
      }

      await page.locator("#otp").fill(DEV_OTP)
      await page.getByRole("button", { name: "Continue" }).click()
      await expect(
        page.getByRole("heading", { name: /^Join the card at / })
      ).toBeVisible()
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })

  test("locks repeated OTP guesses before accepting a later correct code", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: PublicQrRouterFixture | undefined
    const phone = disposableUkMobile()

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return

      await openOtpStep(page, fixture, phone)
      const otp = page.locator("#otp")
      const checkCode = page.getByRole("button", { name: "Continue" })

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await otp.fill(WRONG_OTP)
        await checkCode.click()
        await expect(otp).toHaveValue("")
        await expect(
          page.getByText("That code didn't work. Check it and try again.", {
            exact: true,
          })
        ).toBeVisible()
      }

      await otp.fill(DEV_OTP)
      await checkCode.click()
      await expect(
        page.getByText("Too many tries. Send a new code in a few minutes.", {
          exact: true,
        })
      ).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Enter your code" })
      ).toBeVisible()
      await expect(readJoinedMembership(sql, fixture, phone)).resolves.toBe(
        undefined
      )
    } finally {
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})
