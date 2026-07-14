import { expect, test, type Locator, type Page } from "@playwright/test"

import type { MerchantOtpActionState } from "../../lib/auth/merchant-auth-action-state"
import { rateLimitIdentityFromHeaders } from "../../lib/security/rate-limit-core"
import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall } from "./helpers/harness"
import {
  assertMerchantAuthBrowserSession,
  assertMerchantAuthVerifiedDbState,
  assertMerchantRecoveryPasswordUnchanged,
  assertMerchantRecoveryPasswordUpdated,
  assertMerchantRecoverySessionClosed,
  allowMerchantAuthProviderSend,
  cleanupMerchantAuthLiveDbFixture,
  connectMerchantAuthRecoveryDb,
  createMerchantRecoveryLiveDbFixture,
  createMerchantSignupLiveDbFixture,
  merchantAuthRecoveryLiveDbSkipReason,
  installMerchantPasswordUpdateFault,
  prepareMerchantAuthAliasOutcome,
  restoreMerchantAuthLiveDbFaults,
  seedMerchantAuthResendCooldown,
  seedMerchantAuthVerificationLimit,
  setMerchantAuthRateLimitReadAvailable,
  setMerchantAuthRateLimitRpcAvailable,
  setMerchantAuthReservationRpcAvailable,
  startMerchantAuthLocalEmailHookSink,
  type MerchantAuthAliasTestOutcome,
  type MerchantAuthLocalEmailHookSink,
  type MerchantAuthLiveDbFixture,
} from "./helpers/merchant-auth-recovery-live-db"

const LIVE_PROOF_IP = "127.0.0.42"
const LIVE_PROOF_USER_AGENT = "Nabaperks merchant auth local proof"
const LIVE_PROOF_IDENTITY = rateLimitIdentityFromHeaders(
  new Headers({
    "user-agent": LIVE_PROOF_USER_AGENT,
    "x-vercel-forwarded-for": LIVE_PROOF_IP,
  })
)

export function defineMerchantAuthRecoveryTests() {
  test.use({ serviceWorkers: "block" })

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("signup correction preserves email, name, and destination context", async ({
    page,
  }) => {
    const next = "/app/onboarding?proof=context-round-trip"
    await page.goto(
      `/signup/verify?email=operator%40example.test&name=Alex%20Morgan&next=${encodeURIComponent(next)}`
    )

    const correction = page.getByRole("link", { name: "Back to sign up" })
    await expect(correction).toHaveAttribute(
      "href",
      `/signup?email=operator%40example.test&name=Alex+Morgan&next=${encodeURIComponent(next)}`
    )
  })

  test("password reset verification resumes after refresh with live password guidance", async ({
    page,
  }) => {
    await page.goto(
      "/reset-password?stage=verify&email=operator%40example.test&next=%2Fapp%2Fonboarding"
    )

    await expect(page.getByLabel("Reset code")).toBeVisible()
    await expect(page.getByLabel("New password")).toBeVisible()
    await expect(
      page.getByRole("region", { name: "Password requirements" })
    ).toBeVisible()
    await expectNoAxeViolations(page, "merchant password reset verify stage")

    await page.reload()

    await expect(page.getByLabel("Reset code")).toBeVisible()
    await expect(
      page.getByRole("region", { name: "Password requirements" })
    ).toBeVisible()
  })

  test("password reset correction leaves verify mode and restores editable email", async ({
    page,
  }) => {
    await page.goto(
      "/reset-password?stage=verify&email=operator%40example.test&next=%2Fapp%2Fonboarding"
    )

    await page.getByRole("link", { name: "Use a different email" }).click()

    await expect(page).toHaveURL((url) => !url.searchParams.has("stage"))
    await expect(page.getByLabel("Email")).toBeEditable()
    await expect(page.getByLabel("Reset code")).toHaveCount(0)
  })

  test("invalid signup code uses an associated alert, focuses the code, and blocks concurrent resend", async ({
    page,
  }) => {
    await page.goto(
      "/signup/verify?email=operator%40example.test&name=Alex%20Morgan"
    )
    const otp = page.getByLabel("Email code")
    const verifyForm = page.locator("form").filter({
      has: page.locator('input[name="intent"][value="verify"]'),
    })
    const verify = verifyForm.getByRole("button")
    const resendForm = page.getByRole("form", {
      name: "Request another verification email",
    })
    const resend = resendForm.getByRole("button")
    const requestGate = await gateNextPost(page, "**/signup/verify?**")

    await otp.fill("1")
    const verification = verify.click()
    await requestGate.observed

    await expect(verify).toBeDisabled()
    await expect(resend).toBeDisabled()
    requestGate.release()
    await verification

    await expect(
      page.getByRole("alert").filter({ hasText: "code from your email" })
    ).toBeVisible()
    await expect(otp).toBeFocused()
  })

  test("resend pending disables verification without sending an email", async ({
    page,
  }) => {
    await page.goto(
      "/signup/verify?email=operator%40example.test&name=Alex%20Morgan"
    )
    const otp = page.getByLabel("Email code")
    const verify = page.getByRole("button", { name: "Verify email" })
    const resendForm = page.getByRole("form", {
      name: "Request another verification email",
    })
    const resend = resendForm.getByRole("button")
    const requestGate = await gateNextPost(page, "**/signup/verify?**")

    await otp.fill("123456")
    const resending = resend.click()
    try {
      await requestGate.observed
      await expect(resend).toBeDisabled()
      await expect(verify).toBeDisabled()
    } finally {
      requestGate.abort()
      await resending.catch(() => undefined)
    }
  })

  test("reset resend pending disables password confirmation without sending an email", async ({
    page,
  }) => {
    await page.goto(
      "/reset-password?stage=verify&email=operator%40example.test&next=%2Fapp%2Fonboarding"
    )
    await page.getByLabel("Reset code").fill("123456")
    await page.getByLabel("New password", { exact: true }).fill("SafePass1!")
    await page.getByLabel("Confirm password").fill("SafePass1!")

    const confirm = page.getByRole("button", { name: "Set new password" })
    const resendForm = page.getByRole("form", {
      name: "Request another password-reset email",
    })
    const resend = resendForm.getByRole("button")
    const requestGate = await gateNextPost(page, "**/reset-password?**")
    const resending = resend.click()

    try {
      await requestGate.observed
      await expect(resend).toBeDisabled()
      await expect(confirm).toBeDisabled()
    } finally {
      requestGate.abort()
      await resending.catch(() => undefined)
    }
  })

  test("enumeration-neutral resend presentation stays honest and keeps recovery paths", async ({
    page,
  }) => {
    await page.goto(
      "/signup/verify?email=operator%40example.test&name=Alex%20Morgan"
    )
    const otp = page.getByLabel("Email code")
    const resendForm = page.getByRole("form", {
      name: "Request another verification email",
    })
    await expect(
      page.getByText(/a six-digit code may be on its way/i)
    ).toBeVisible()
    await expect(page.getByRole("main")).not.toContainText(/code we sent/i)
    await otp.fill("123456")
    await setFormIntent(resendForm, "resend", "refuse")
    await mockInvalidNextActionState(
      page,
      "**/signup/verify?**",
      (invalidState) => ({
        outcome: "sent",
        context: { ...invalidState.context, step: "verify" },
        retryAt: new Date(Date.now() + 60_000).toISOString(),
        message:
          "If this email can receive a signup code, a fresh 6-digit code may be on its way. If it arrives, earlier codes no longer work. Used this email before? Log in or reset your password.",
      })
    )

    await resendForm.getByRole("button", { name: "Resend code" }).click()

    const status = page.locator("#signup-otp-sent")
    await expect(status).toContainText(/may be on its way/i)
    await expect(status).toContainText(
      /used this email before\? log in or reset your password/i
    )
    await expect(status).not.toContainText(/we sent/i)
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible()
    await expect(
      page.getByRole("link", { name: "reset your password" })
    ).toBeVisible()
    await expect(otp).toHaveValue("")
    await expect(otp).toBeFocused()
  })

  test.describe("local Supabase session proof", () => {
    const skipReason = merchantAuthRecoveryLiveDbSkipReason()
    let localEmailHookSink: MerchantAuthLocalEmailHookSink | undefined
    test.skip(Boolean(skipReason), skipReason)
    test.use({
      userAgent: LIVE_PROOF_USER_AGENT,
    })
    test.beforeAll(async ({}, testInfo) => {
      if (!skipReason && testInfo.config.workers !== 1) {
        throw new Error(
          "Merchant auth live DB proof mutates global local-only fault controls and must run with exactly one Playwright worker."
        )
      }
      if (skipReason) return
      localEmailHookSink = await startMerchantAuthLocalEmailHookSink()
      try {
        await restoreMerchantAuthProofFaults()
      } catch (error) {
        await localEmailHookSink.close()
        localEmailHookSink = undefined
        throw error
      }
    })
    test.afterAll(async () => {
      const cleanupErrors: Error[] = []
      try {
        await restoreMerchantAuthProofFaults()
      } catch (error) {
        cleanupErrors.push(asTestError("fault restoration", error))
      }
      try {
        await localEmailHookSink?.close()
      } catch (error) {
        cleanupErrors.push(asTestError("email-hook sink shutdown", error))
      }
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          cleanupErrors,
          "Merchant auth proof suite cleanup failed."
        )
      }
    })

    test("signup code establishes a browser session and continues to safe onboarding", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantSignupLiveDbFixture(sql)
        const query = new URLSearchParams({
          email: fixture.email,
          name: fixture.name,
          next: fixture.nextPath,
        })

        await page.goto(`/signup/verify?${query}`)
        await page.getByLabel("Email code").fill(fixture.aliasCode)
        const requestGate = await gateNextPost(page, "**/signup/verify?**")
        const verification = page
          .getByRole("button", { name: "Verify email" })
          .click()
        await requestGate.observed
        await expect(
          page.getByRole("button", { name: "Resend code" })
        ).toBeDisabled()
        requestGate.release()
        await verification

        await expect(page).toHaveURL(
          (url) => `${url.pathname}${url.search}` === fixture?.nextPath
        )
        await assertMerchantAuthBrowserSession(page, fixture)
        await assertMerchantAuthVerifiedDbState(sql, fixture)
      } finally {
        try {
          await cleanupMerchantAuthLiveDbFixture(
            sql,
            fixture,
            LIVE_PROOF_IDENTITY
          )
        } finally {
          await sql.end({ timeout: 5 })
        }
      }
    })

    test("recovery code updates the password, establishes a session, and continues safely", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantRecoveryLiveDbFixture(sql)
        const query = new URLSearchParams({
          stage: "verify",
          email: fixture.email,
          next: fixture.nextPath,
        })

        await page.goto(`/reset-password?${query}`)
        await page.getByLabel("Reset code").fill(fixture.aliasCode)
        await page
          .getByLabel("New password", { exact: true })
          .fill(fixture.replacementPassword)
        await page
          .getByLabel("Confirm password")
          .fill(fixture.replacementPassword)
        const requestGate = await gateNextPost(page, "**/reset-password?**")
        const confirmation = page
          .getByRole("button", { name: "Set new password" })
          .click()
        await requestGate.observed
        await expect(
          page.getByRole("button", { name: "Resend reset code" })
        ).toBeDisabled()
        requestGate.release()
        await confirmation

        await expect(page).toHaveURL(
          (url) => `${url.pathname}${url.search}` === fixture?.nextPath
        )
        await assertMerchantAuthBrowserSession(page, fixture)
        await assertMerchantAuthVerifiedDbState(sql, fixture)
        await assertMerchantRecoveryPasswordUpdated(fixture)
      } finally {
        try {
          await cleanupMerchantAuthLiveDbFixture(
            sql,
            fixture,
            LIVE_PROOF_IDENTITY
          )
        } finally {
          await sql.end({ timeout: 5 })
        }
      }
    })

    test("password-update failure closes recovery auth and a blocked resend cannot revive the code", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined
      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantRecoveryLiveDbFixture(sql)
        await installMerchantPasswordUpdateFault(sql, fixture)
        const query = new URLSearchParams({
          stage: "verify",
          email: fixture.email,
          next: fixture.nextPath,
        })

        await page.goto(`/reset-password?${query}`)
        await page.getByLabel("Reset code").fill(fixture.aliasCode)
        await page
          .getByLabel("New password", { exact: true })
          .fill(fixture.replacementPassword)
        await page
          .getByLabel("Confirm password")
          .fill(fixture.replacementPassword)
        await page.getByRole("button", { name: "Set new password" }).click()

        await expect(
          page.getByRole("alert").filter({
            hasText: "could not save that password",
          })
        ).toBeVisible()
        await expect(
          page.getByRole("button", { name: "Set new password" })
        ).toBeDisabled()
        await expect(page.getByLabel("Reset code")).toHaveValue("")
        expect(
          (await page.context().cookies()).filter((cookie) =>
            /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name)
          )
        ).toHaveLength(0)
        await assertMerchantRecoverySessionClosed(sql, fixture)
        await assertMerchantRecoveryPasswordUnchanged(fixture)
        await assertMerchantRecoverySessionClosed(sql, fixture)

        await seedMerchantAuthResendCooldown(
          sql,
          fixture,
          LIVE_PROOF_IDENTITY,
          60_000
        )
        await page.getByRole("button", { name: "Resend reset code" }).click()

        await expect(
          page.getByRole("alert").filter({
            hasText: "Another code can be sent",
          })
        ).toBeVisible()
        await expect(
          page.getByRole("button", { name: "Set new password" })
        ).toBeDisabled()
        await expect(page.getByLabel("Reset code")).toHaveValue("")
      } finally {
        await finalizeMerchantAuthProof(sql, fixture, true)
      }
    })

    const outcomeScenarios: readonly {
      outcome: MerchantAuthAliasTestOutcome
      message: RegExp
      focus: "otp" | "recovery"
      clearsCode: boolean
      disablesVerify: boolean
    }[] = [
      {
        outcome: "expired",
        message: /code has expired/i,
        focus: "recovery",
        clearsCode: true,
        disablesVerify: true,
      },
      {
        outcome: "used",
        message: /already been used/i,
        focus: "recovery",
        clearsCode: true,
        disablesVerify: true,
      },
      {
        outcome: "superseded",
        message: /earlier email/i,
        focus: "recovery",
        clearsCode: true,
        disablesVerify: true,
      },
      {
        outcome: "rejected",
        message: /does not match/i,
        focus: "otp",
        clearsCode: false,
        disablesVerify: false,
      },
      {
        outcome: "busy",
        message: /already being checked/i,
        focus: "recovery",
        clearsCode: false,
        disablesVerify: true,
      },
      {
        outcome: "throttled",
        message: /too many code checks/i,
        focus: "recovery",
        clearsCode: false,
        disablesVerify: true,
      },
    ]

    for (const scenario of outcomeScenarios) {
      test(`signup exposes the exact ${scenario.outcome} outcome and recovery focus`, async ({
        page,
      }) => {
        const sql = connectMerchantAuthRecoveryDb()
        test.skip(!sql, "local Supabase DB is not configured")
        if (!sql) return

        let fixture: MerchantAuthLiveDbFixture | undefined

        try {
          await page.setExtraHTTPHeaders({
            "x-vercel-forwarded-for": LIVE_PROOF_IP,
          })
          fixture = await createMerchantSignupLiveDbFixture(sql)
          await prepareMerchantAuthAliasOutcome(sql, fixture, scenario.outcome)
          await page.goto(signupVerificationPath(fixture))

          const otp = page.getByLabel("Email code")
          const verify = page.getByRole("button", { name: "Verify email" })
          await otp.fill(fixture.aliasCode)
          await verify.click()

          await expect(
            page
              .locator("#signup-otp-recovery, #otp-error")
              .filter({ hasText: scenario.message })
          ).toBeVisible()
          if (scenario.focus === "otp") {
            await expect(otp).toBeFocused()
          } else {
            await expect(page.locator("#signup-otp-recovery")).toBeFocused()
          }
          await expect(otp).toHaveValue(
            scenario.clearsCode ? "" : fixture.aliasCode
          )
          if (scenario.disablesVerify) {
            await expect(
              page.getByRole("button", {
                name: /Verify email|Try again in/,
              })
            ).toBeDisabled()
          } else {
            await expect(verify).toBeEnabled()
          }
        } finally {
          try {
            await cleanupMerchantAuthLiveDbFixture(
              sql,
              fixture,
              LIVE_PROOF_IDENTITY
            )
          } finally {
            await sql.end({ timeout: 5 })
          }
        }
      })
    }

    for (const scenario of outcomeScenarios) {
      test(`recovery exposes the exact ${scenario.outcome} outcome in its separate renderer`, async ({
        page,
      }) => {
        const sql = connectMerchantAuthRecoveryDb()
        test.skip(!sql, "local Supabase DB is not configured")
        if (!sql) return

        let fixture: MerchantAuthLiveDbFixture | undefined

        try {
          await page.setExtraHTTPHeaders({
            "x-vercel-forwarded-for": LIVE_PROOF_IP,
          })
          fixture = await createMerchantRecoveryLiveDbFixture(sql)
          await prepareMerchantAuthAliasOutcome(sql, fixture, scenario.outcome)
          await page.goto(recoveryVerificationPath(fixture))

          const otp = page.getByLabel("Reset code")
          const confirm = page.getByRole("button", {
            name: "Set new password",
          })
          await otp.fill(fixture.aliasCode)
          await page
            .getByLabel("New password", { exact: true })
            .fill(fixture.replacementPassword)
          await page
            .getByLabel("Confirm password")
            .fill(fixture.replacementPassword)
          await confirm.click()

          await expect(
            page
              .locator("#recovery, #otp-error")
              .filter({ hasText: scenario.message })
          ).toBeVisible()
          if (scenario.focus === "otp") {
            await expect(otp).toBeFocused()
          } else {
            await expect(page.locator("#recovery")).toBeFocused()
          }
          await expect(otp).toHaveValue(
            scenario.clearsCode ? "" : fixture.aliasCode
          )
          if (scenario.disablesVerify) {
            await expect(confirm).toBeDisabled()
          } else {
            await expect(confirm).toBeEnabled()
          }
        } finally {
          try {
            await cleanupMerchantAuthLiveDbFixture(
              sql,
              fixture,
              LIVE_PROOF_IDENTITY
            )
          } finally {
            await sql.end({ timeout: 5 })
          }
        }
      })
    }

    test("temporary alias verification failure preserves the code and focuses recovery", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined
      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantSignupLiveDbFixture(sql)
        await setMerchantAuthReservationRpcAvailable(sql, false)
        await page.goto(signupVerificationPath(fixture))

        const otp = page.getByLabel("Email code")
        await otp.fill(fixture.aliasCode)
        await page.getByRole("button", { name: "Verify email" }).click()

        await expect(page.locator("#signup-otp-recovery")).toContainText(
          /could not check your code just now/i
        )
        await expect(otp).toHaveValue(fixture.aliasCode)
        await expect(page.locator("#signup-otp-recovery")).toBeFocused()
        await expect(
          page.getByRole("button", { name: "Verify email" })
        ).toBeEnabled()
      } finally {
        await finalizeMerchantAuthProof(sql, fixture, true)
      }
    })

    test("reset verification infrastructure failure preserves the code in its renderer", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined
      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantRecoveryLiveDbFixture(sql)
        await setMerchantAuthReservationRpcAvailable(sql, false)
        await page.goto(recoveryVerificationPath(fixture))

        const otp = page.getByLabel("Reset code")
        const confirm = page.getByRole("button", { name: "Set new password" })
        await otp.fill(fixture.aliasCode)
        await page
          .getByLabel("New password", { exact: true })
          .fill(fixture.replacementPassword)
        await page
          .getByLabel("Confirm password")
          .fill(fixture.replacementPassword)
        await confirm.click()

        await expect(page.locator("#recovery")).toContainText(
          /could not check your code just now/i
        )
        await expect(otp).toHaveValue(fixture.aliasCode)
        await expect(page.locator("#recovery")).toBeFocused()
        await expect(confirm).toBeEnabled()
      } finally {
        await finalizeMerchantAuthProof(sql, fixture, true)
      }
    })

    test("resend limiter infrastructure failure preserves the current code before provider send", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantSignupLiveDbFixture(sql)
        await page.goto(signupVerificationPath(fixture))
        await page.getByLabel("Email code").fill(fixture.aliasCode)
        const sinkRequestsBefore = localEmailHookSink?.requestCount()
        expect(sinkRequestsBefore).toBeDefined()
        await setMerchantAuthRateLimitRpcAvailable(sql, false)

        await page.getByRole("button", { name: "Resend code" }).click()

        await expect(page.locator("#signup-otp-recovery")).toContainText(
          /could not start a fresh code send just now/i
        )
        await expect(page.locator("#signup-otp-recovery")).toBeFocused()
        await expect(page.getByLabel("Email code")).toHaveValue(
          fixture.aliasCode
        )
        await expect(
          page.getByRole("button", { name: "Verify email" })
        ).toBeEnabled()
        expect(localEmailHookSink?.requestCount()).toBe(sinkRequestsBefore)
      } finally {
        await finalizeMerchantAuthProof(sql, fixture, true)
      }
    })

    test("local email-hook failure exposes destructive delivery unavailable without production contact", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantSignupLiveDbFixture(sql)
        await allowMerchantAuthProviderSend(sql, fixture)
        await page.goto(signupVerificationPath(fixture))
        await page.getByLabel("Email code").fill(fixture.aliasCode)
        const sinkRequestsBefore = localEmailHookSink?.requestCount()
        expect(sinkRequestsBefore).toBeDefined()

        await page.getByRole("button", { name: "Resend code" }).click()

        await expect(page.locator("#signup-otp-recovery")).toContainText(
          /could not send a fresh code just now/i
        )
        await expect(page.locator("#signup-otp-recovery")).toBeFocused()
        await expect(page.getByLabel("Email code")).toHaveValue("")
        await expect(
          page.getByRole("button", { name: "Verify email" })
        ).toBeDisabled()
        await expect(
          page.getByRole("button", { name: /Resend code in \d+s/ })
        ).toBeDisabled()
        expect(localEmailHookSink?.requestCount()).toBeGreaterThan(
          sinkRequestsBefore ?? Number.MAX_SAFE_INTEGER
        )
      } finally {
        try {
          await cleanupMerchantAuthLiveDbFixture(
            sql,
            fixture,
            LIVE_PROOF_IDENTITY
          )
        } finally {
          await sql.end({ timeout: 5 })
        }
      }
    })

    test("verification-limit readback failure stays retryable instead of inventing a wait", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantSignupLiveDbFixture(sql)
        await seedMerchantAuthVerificationLimit(
          sql,
          fixture,
          LIVE_PROOF_IDENTITY
        )
        await setMerchantAuthRateLimitReadAvailable(sql, false)
        await page.goto(signupVerificationPath(fixture))
        const otp = page.getByLabel("Email code")
        await otp.fill(fixture.aliasCode)

        await page.getByRole("button", { name: "Verify email" }).click()

        await expect(page.locator("#signup-otp-recovery")).toContainText(
          /could not check your code just now/i
        )
        await expect(page.locator("#signup-otp-recovery")).toBeFocused()
        await expect(otp).toHaveValue(fixture.aliasCode)
        await expect(
          page.getByRole("button", { name: "Verify email" })
        ).toBeEnabled()
      } finally {
        await finalizeMerchantAuthProof(sql, fixture, true)
      }
    })

    test("@MS-auth-cooldown-hydration persisted cooldown hydrates without replacing the auth subtree", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      const hydrationErrors: string[] = []
      const recordHydrationError = (message: string) => {
        if (
          /hydration failed|server rendered text didn't match|hydration mismatch/i.test(
            message
          )
        ) {
          hydrationErrors.push(message)
        }
      }
      page.on("console", (message) => recordHydrationError(message.text()))
      page.on("pageerror", (error) => recordHydrationError(error.message))

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.addInitScript(() => {
          const browserNow = Date.now.bind(Date)
          Date.now = () => browserNow() + 2_100
        })
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantSignupLiveDbFixture(sql)
        await seedMerchantAuthResendCooldown(
          sql,
          fixture,
          LIVE_PROOF_IDENTITY,
          8_000
        )

        await page.goto(signupVerificationPath(fixture))

        const resendForm = page.getByRole("form", {
          name: "Request another verification email",
        })
        const resendButton = resendForm.getByRole("button", {
          name: /Resend code(?: in \d+s)?/,
        })
        const availability = resendForm.getByRole("status")

        await expect(resendButton).toBeDisabled()
        await expect(resendButton).toHaveAccessibleName(/Resend code in \d+s/)
        await expect(availability).toHaveText(
          "Resend wait started. You can request another code when the timer ends."
        )
        await expect(resendButton).toBeEnabled({ timeout: 10_000 })
        await expect(resendButton).toHaveAccessibleName("Resend code")
        await expect(availability).toHaveText(
          "You can request another code now."
        )
        expect(hydrationErrors).toEqual([])
      } finally {
        try {
          await cleanupMerchantAuthLiveDbFixture(
            sql,
            fixture,
            LIVE_PROOF_IDENTITY
          )
        } finally {
          await sql.end({ timeout: 5 })
        }
      }
    })

    test("server cooldown survives refresh and announces availability once", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantSignupLiveDbFixture(sql)
        await seedMerchantAuthResendCooldown(
          sql,
          fixture,
          LIVE_PROOF_IDENTITY,
          5_000
        )
        await page.goto(signupVerificationPath(fixture))

        const resendForm = page.getByRole("form", {
          name: "Request another verification email",
        })
        const availability = resendForm.getByRole("status")
        await expect(
          resendForm.getByRole("button", { name: /Resend code in \d+s/ })
        ).toBeDisabled()
        await expect(availability).toHaveText(
          "Resend wait started. You can request another code when the timer ends."
        )
        await page.reload()
        await expect(
          resendForm.getByRole("button", { name: /Resend code in \d+s/ })
        ).toBeDisabled()

        await expect(availability).toHaveText(
          "You can request another code now.",
          { timeout: 10_000 }
        )
        await expect(
          resendForm.getByRole("button", { name: "Resend code" })
        ).toBeEnabled()
        await expect(availability).toHaveCount(1)
      } finally {
        try {
          await cleanupMerchantAuthLiveDbFixture(
            sql,
            fixture,
            LIVE_PROOF_IDENTITY
          )
        } finally {
          await sql.end({ timeout: 5 })
        }
      }
    })

    test("sent action-response presentation clears the old code, focuses the new code field, and starts cooldown", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantSignupLiveDbFixture(sql)
        await page.goto(signupVerificationPath(fixture))
        await page.getByLabel("Email code").fill(fixture.aliasCode)
        const retryAt = await seedMerchantAuthResendCooldown(
          sql,
          fixture,
          LIVE_PROOF_IDENTITY,
          60_000
        )
        const resendForm = page.getByRole("form", {
          name: "Request another verification email",
        })
        await setFormIntent(resendForm, "resend", "refuse")
        await mockInvalidNextActionState(
          page,
          "**/signup/verify?**",
          (invalidState) => ({
            outcome: "sent",
            context: { ...invalidState.context, step: "verify" },
            retryAt,
            message:
              "If this email can receive a signup code, a fresh 6-digit code may be on its way. If it arrives, earlier codes no longer work. Used this email before? Log in or reset your password.",
          })
        )

        await resendForm.getByRole("button", { name: "Resend code" }).click()

        await expect(page.locator("#signup-otp-sent")).toContainText(
          /earlier codes no longer work/i
        )
        await expect(page.locator("#signup-otp-sent")).toContainText(
          /used this email before\? log in or reset your password/i
        )
        await expect(page.locator("#signup-otp-sent")).not.toContainText(
          /we sent/i
        )
        await expect(page.locator("#signup-otp-sent")).toHaveAttribute(
          "role",
          "status"
        )
        await expect(page.getByLabel("Email code")).toHaveValue("")
        await expect(page.getByLabel("Email code")).toBeFocused()
        await expect(
          resendForm.getByRole("button", { name: /Resend code in \d+s/ })
        ).toBeDisabled()
        await expect(resendForm.getByRole("status")).toHaveText(
          "Resend wait started. You can request another code when the timer ends."
        )
      } finally {
        try {
          await cleanupMerchantAuthLiveDbFixture(
            sql,
            fixture,
            LIVE_PROOF_IDENTITY
          )
        } finally {
          await sql.end({ timeout: 5 })
        }
      }
    })

    test("reset sent presentation advances request to resumable verification", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantRecoveryLiveDbFixture(sql)
        const query = new URLSearchParams({
          email: fixture.email,
          next: fixture.nextPath,
        })
        await page.goto(`/reset-password?${query}`)
        const requestButton = page.getByRole("button", {
          name: "Send reset code",
        })
        const requestForm = requestButton.locator("xpath=ancestor::form")
        const retryAt = await seedMerchantAuthResendCooldown(
          sql,
          fixture,
          LIVE_PROOF_IDENTITY,
          60_000
        )
        await setFormIntent(requestForm, "request", "refuse")
        await mockInvalidNextActionState(
          page,
          "**/reset-password?**",
          (invalidState) => ({
            outcome: "sent",
            context: { ...invalidState.context, step: "verify" },
            retryAt,
            message:
              "If that email has a venue account, we sent a fresh 6-digit reset code. Earlier codes no longer work.",
          })
        )

        await requestButton.click()

        await expect(page).toHaveURL((url) => {
          return (
            url.pathname === "/reset-password" &&
            url.searchParams.get("stage") === "verify" &&
            url.searchParams.get("email") === fixture?.email &&
            url.searchParams.get("next") === fixture?.nextPath
          )
        })
        await expect(page.getByLabel("Venue email")).toHaveAttribute(
          "readonly",
          ""
        )
        await expect(page.getByLabel("Reset code")).toBeFocused()
        await expect(
          page.getByRole("status").filter({
            hasText: /earlier codes no longer work/i,
          })
        ).toBeVisible()
        await expect(
          page.getByRole("button", { name: /Resend reset code in \d+s/ })
        ).toBeDisabled()
      } finally {
        try {
          await cleanupMerchantAuthLiveDbFixture(
            sql,
            fixture,
            LIVE_PROOF_IDENTITY
          )
        } finally {
          await sql.end({ timeout: 5 })
        }
      }
    })

    test("a cooldown returned after an idle page starts from the fresh client clock", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantSignupLiveDbFixture(sql)
        await page.goto(signupVerificationPath(fixture))

        await page.evaluate((offsetMs) => {
          const realNow = Date.now.bind(Date)
          Date.now = () => realNow() + offsetMs
        }, 20 * 60_000)
        await seedMerchantAuthResendCooldown(
          sql,
          fixture,
          LIVE_PROOF_IDENTITY,
          21 * 60_000
        )

        const resendForm = page.locator("form").filter({
          has: page.locator('input[name="intent"][value="resend"]'),
        })
        await resendForm.getByRole("button", { name: "Resend code" }).click()

        await expect(
          resendForm.getByRole("button", { name: /Resend code in \d+s/ })
        ).toBeDisabled()
        await expect(resendForm.getByRole("status")).toHaveText(
          "Resend wait started. You can request another code when the timer ends."
        )
      } finally {
        try {
          await cleanupMerchantAuthLiveDbFixture(
            sql,
            fixture,
            LIVE_PROOF_IDENTITY
          )
        } finally {
          await sql.end({ timeout: 5 })
        }
      }
    })

    test("a blocked first reset request stays on the editable email step", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantRecoveryLiveDbFixture(sql)
        await seedMerchantAuthResendCooldown(
          sql,
          fixture,
          LIVE_PROOF_IDENTITY,
          60_000
        )
        const query = new URLSearchParams({
          email: fixture.email,
          next: fixture.nextPath,
        })
        await page.goto(`/reset-password?${query}`)
        await page.getByRole("button", { name: "Send reset code" }).click()

        await expect(page.getByLabel("Email")).toBeEditable()
        await expect(page.getByLabel("Reset code")).toHaveCount(0)
        await expect(
          page.getByRole("alert").filter({
            hasText: "Another code can be sent",
          })
        ).toBeVisible()
        await expect(page.locator("#reset-request-recovery")).toBeFocused()
        await expect(
          page.getByRole("button", { name: /Send reset code in \d+s/ })
        ).toBeDisabled()
      } finally {
        try {
          await cleanupMerchantAuthLiveDbFixture(
            sql,
            fixture,
            LIVE_PROOF_IDENTITY
          )
        } finally {
          await sql.end({ timeout: 5 })
        }
      }
    })

    test("login fresh-code recovery is a throttled POST with the real wait", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantSignupLiveDbFixture(sql)
        await seedMerchantAuthResendCooldown(
          sql,
          fixture,
          LIVE_PROOF_IDENTITY,
          60_000
        )
        await page.goto(`/login?next=${encodeURIComponent(fixture.nextPath)}`)
        await page.getByLabel("Email").fill(fixture.email)
        await page.getByLabel("Password").fill(fixture.initialPassword)
        await page.getByRole("button", { name: "Log in" }).click()

        const freshCodeForm = page.getByRole("form", {
          name: "Get a fresh verification code",
        })
        const freshCode = freshCodeForm.getByRole("button", {
          name: "Get a fresh code",
        })
        await expect(freshCode).toBeVisible()
        await expect(freshCodeForm).toBeFocused()
        await freshCode.click()

        await expect(
          page.getByRole("alert").filter({
            hasText: "Another code can be sent",
          })
        ).toBeVisible()
        await expect(freshCodeForm).toBeFocused()
        await expect(
          page.getByRole("button", {
            name: /Get a fresh code in \d+s/,
          })
        ).toBeDisabled()
        expect(new URL(page.url()).pathname).toBe("/login")
      } finally {
        try {
          await cleanupMerchantAuthLiveDbFixture(
            sql,
            fixture,
            LIVE_PROOF_IDENTITY
          )
        } finally {
          await sql.end({ timeout: 5 })
        }
      }
    })

    test("login fresh-code redirect presentation continues with safe context", async ({
      page,
    }) => {
      const sql = connectMerchantAuthRecoveryDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: MerchantAuthLiveDbFixture | undefined

      try {
        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": LIVE_PROOF_IP,
        })
        fixture = await createMerchantSignupLiveDbFixture(sql)
        await page.goto(`/login?next=${encodeURIComponent(fixture.nextPath)}`)
        await page.getByLabel("Email").fill(fixture.email)
        await page.getByLabel("Password").fill(fixture.initialPassword)
        await page.getByRole("button", { name: "Log in" }).click()
        await expect(
          page.getByRole("button", { name: "Get a fresh code" })
        ).toBeVisible()

        await seedMerchantAuthResendCooldown(
          sql,
          fixture,
          LIVE_PROOF_IDENTITY,
          60_000
        )
        const verificationPath = `/signup/verify?${new URLSearchParams({
          email: fixture.email,
          next: fixture.nextPath,
        })}`
        const freshCodeForm = page.getByRole("form", {
          name: "Get a fresh verification code",
        })
        await setFormIntent(freshCodeForm, "resend", "refuse")
        await mockInvalidNextActionRedirect(
          page,
          "**/login?**",
          verificationPath
        )

        await freshCodeForm
          .getByRole("button", { name: "Get a fresh code" })
          .click()

        await expect(page).toHaveURL((url) => {
          return (
            url.pathname === "/signup/verify" &&
            url.searchParams.get("email") === fixture?.email &&
            url.searchParams.get("next") === fixture?.nextPath
          )
        })
        await expect(page.getByLabel("Email code")).toBeVisible()
        await expect(
          page.getByRole("button", { name: /Resend code in \d+s/ })
        ).toBeDisabled()
      } finally {
        try {
          await cleanupMerchantAuthLiveDbFixture(
            sql,
            fixture,
            LIVE_PROOF_IDENTITY
          )
        } finally {
          await sql.end({ timeout: 5 })
        }
      }
    })
  })
}

function signupVerificationPath(fixture: MerchantAuthLiveDbFixture): string {
  const query = new URLSearchParams({
    email: fixture.email,
    name: fixture.name,
    next: fixture.nextPath,
  })
  return `/signup/verify?${query}`
}

function recoveryVerificationPath(fixture: MerchantAuthLiveDbFixture): string {
  const query = new URLSearchParams({
    stage: "verify",
    email: fixture.email,
    next: fixture.nextPath,
  })
  return `/reset-password?${query}`
}

async function gateNextPost(page: Page, url: string) {
  let markObserved!: () => void
  let release!: () => void
  const observed = new Promise<void>((resolve) => {
    markObserved = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let gatedPost = false
  let abortRequest = false

  await page.route(url, async (route) => {
    if (route.request().method() !== "POST" || gatedPost) {
      await route.continue()
      return
    }
    gatedPost = true
    markObserved()
    await gate
    if (abortRequest) await route.abort()
    else await route.continue()
  })

  return {
    observed,
    release,
    abort() {
      abortRequest = true
      release()
    },
  }
}

async function restoreMerchantAuthProofFaults(): Promise<void> {
  const sql = connectMerchantAuthRecoveryDb()
  if (!sql) return

  try {
    await restoreMerchantAuthLiveDbFaults(sql)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function finalizeMerchantAuthProof(
  sql: NonNullable<ReturnType<typeof connectMerchantAuthRecoveryDb>>,
  fixture: MerchantAuthLiveDbFixture | undefined,
  restoreFaults: boolean
): Promise<void> {
  const cleanupErrors: Error[] = []

  if (restoreFaults) {
    try {
      await restoreMerchantAuthLiveDbFaults(sql)
    } catch (error) {
      cleanupErrors.push(asTestError("fault restoration", error))
    }
  }

  try {
    await cleanupMerchantAuthLiveDbFixture(sql, fixture, LIVE_PROOF_IDENTITY)
  } catch (error) {
    cleanupErrors.push(asTestError("fixture cleanup", error))
  }

  try {
    await sql.end({ timeout: 5 })
  } catch (error) {
    cleanupErrors.push(asTestError("database connection close", error))
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "Merchant auth proof cleanup failed."
    )
  }
}

async function mockInvalidNextActionState(
  page: Page,
  url: string,
  transform: (state: MerchantOtpActionState) => MerchantOtpActionState
): Promise<void> {
  let handled = false
  await page.route(url, async (route) => {
    if (route.request().method() !== "POST" || handled) {
      await route.continue()
      return
    }
    handled = true
    const response = await route.fetch()
    const body = await response.text()
    const parsed = parseNextActionState(body)
    if (
      parsed.state.outcome !== "invalid" ||
      parsed.state.errors?.form !==
        "Choose a valid email-code action and try again."
    ) {
      throw new Error(
        "Refusing to mock a provider outcome unless the real action stopped at the invalid-intent guard."
      )
    }
    const replacement = JSON.stringify(transform(parsed.state))
    const patchedBody = `${body.slice(0, parsed.start)}${replacement}${body.slice(parsed.end)}`
    const headers = response.headers()
    delete headers["content-encoding"]
    delete headers["content-length"]
    delete headers["transfer-encoding"]

    await route.fulfill({
      status: response.status(),
      headers,
      body: patchedBody,
    })
  })
}

async function mockInvalidNextActionRedirect(
  page: Page,
  url: string,
  redirectPath: string
): Promise<void> {
  let handled = false
  await page.route(url, async (route) => {
    if (route.request().method() !== "POST" || handled) {
      await route.continue()
      return
    }
    handled = true
    const response = await route.fetch()
    const body = await response.text()
    const parsed = parseNextActionState(body)
    if (
      parsed.state.outcome !== "invalid" ||
      parsed.state.errors?.form !==
        "Choose a valid email-code action and try again."
    ) {
      throw new Error(
        "Refusing to mock a provider redirect unless the real action stopped at the invalid-intent guard."
      )
    }
    const headers = response.headers()
    headers["x-action-redirect"] = `${redirectPath};push`

    await route.fulfill({ response, headers })
  })
}

async function setFormIntent(
  form: Locator,
  currentIntent: string,
  safeInvalidIntent: string
): Promise<void> {
  await form.evaluate(
    (element, intents) => {
      if (!(element instanceof HTMLFormElement)) {
        throw new Error("Expected a form element.")
      }
      const input = element.elements.namedItem("intent")
      if (
        !(input instanceof HTMLInputElement) ||
        input.value !== intents.currentIntent
      ) {
        throw new Error("Expected the current hidden intent input.")
      }
      element.addEventListener(
        "formdata",
        (event) => {
          event.formData.set("intent", intents.safeInvalidIntent)
        },
        { once: true }
      )
    },
    { currentIntent, safeInvalidIntent }
  )
}

function parseNextActionState(body: string): {
  state: MerchantOtpActionState
  start: number
  end: number
} {
  const match = /(?:^|\n)1:(\{[^\n]*\})(?=\n|$)/.exec(body)
  if (!match || match.index === undefined) {
    throw new Error("Next action response did not contain a serialised state.")
  }
  const json = match[1]
  const start = match.index + match[0].indexOf(json)
  return {
    state: JSON.parse(json) as MerchantOtpActionState,
    start,
    end: start + json.length,
  }
}

function asTestError(label: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : "unknown error"
  return new Error(`${label}: ${message}`)
}
