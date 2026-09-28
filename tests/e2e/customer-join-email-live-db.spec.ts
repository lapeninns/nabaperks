import { expect, test, type BrowserContext, type Page } from "@playwright/test"

import { connectLocalDb, type Sql } from "./helpers/admin-live-db"
import {
  EMAIL_HANDOFF_COOKIE,
  cleanupEmailJoinRows,
  confirmJoinCode,
  countDeviceSessions,
  customerJoinEmailSkipReason,
  installForeignDeviceHandoff,
  installKnownDevice,
  installPendingEmailChallenge,
  readEmailWallets,
  requestJoinEmailCode,
  uniqueJoinEmail,
  verifyFixtureCustomerEmail,
} from "./helpers/customer-join-email-live-db"
import {
  WRONG_OTP,
  cleanupCustomerJoinRows,
  disposableUkMobile,
  openOtpStep,
  readJoinedMembership,
  type DisposablePhone,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import {
  emailFallback,
  installFallbackClock,
  takeEmailFallback,
} from "./helpers/email-fallback"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  publicQrPath,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

/**
 * Joining by email against the real server actions and local Supabase, with
 * CUSTOMER_EMAIL_AUTH_MODE=full. The DB-free harness spec
 * (customer-join-email.spec.ts) covers what each screen offers; this covers
 * who gets signed in, what is created and what is refused. Every email
 * journey starts where a customer does: a text to their phone, then the
 * email fallback the code step offers 30 seconds later.
 *
 * Opt-in: CUSTOMER_FLOW_E2E=1, local Supabase (SUPABASE_DB_URL), the dev
 * server's CUSTOMER_SESSION_SECRET and CUSTOMER_EMAIL_HMAC_SECRET, and
 * CUSTOMER_EMAIL_AUTH_MODE=full. The local dev code stands in for the email.
 */

const CHOICE_HEADING = "Have you collected stamps with Nabaperks before?"
const START_WALLET = "No, I’m new here: start my wallet"
const USE_PHONE = "Yes, with my phone number: use my phone"
const NOT_ACCEPTED = "That code was not accepted."
const KNOWN_CODE = "135790"

type Journey = {
  readonly sql: Sql
  readonly fixture: PublicQrRouterFixture
  /** The number the journey texts first; cleaned up with the journey. */
  readonly phone: DisposablePhone
}

function skipReason(): string | undefined {
  return (
    customerReadbackLiveDbSkipReason() ?? customerJoinEmailSkipReason("full")
  )
}

test.describe("@customer-flow join by email (live database, mode full)", () => {
  const reason = skipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("a wallet that holds the email signs in from a QR scan and keeps its card", async ({
    context,
    page,
  }) => {
    await withJourney([], async ({ sql, fixture, phone }, emails) => {
      const email = await verifyFixtureCustomerEmail(sql, fixture)
      emails.push(email)
      const device = await installKnownDevice(context)

      await requestJoinEmailCode(page, fixture, email, phone)
      await confirmJoinCode(page)

      // Same routing as the phone path: an existing member goes to today's stamp.
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === `/card/${fixture.membershipId}/stamp` &&
          url.searchParams.get("qr") === fixture.activeQrId
      )
      await expect(readEmailWallets(sql, email)).resolves.toEqual([
        {
          customer_id: fixture.customerId,
          phone_hmac: null,
          email_verified: true,
        },
      ])
      await expect(
        countDeviceSessions(sql, fixture.customerId, device)
      ).resolves.toBe(1)
      await expect(countMemberships(sql, fixture)).resolves.toBe(1)
      await expect
        .poll(() =>
          countEmailEvents(sql, fixture.customerId, "join_otp_verified")
        )
        .toBe(1)
    })
  })

  test("a new email starts a wallet only when chosen, then collects the first stamp", async ({
    context,
    page,
  }) => {
    const email = uniqueJoinEmail("new")
    await withJourney([email], async ({ sql, fixture, phone }) => {
      const device = await installKnownDevice(context)

      await requestJoinEmailCode(page, fixture, email, phone)
      await confirmJoinCode(page)

      await expect(page).toHaveURL(/step=email_choice/)
      await expect(
        page.getByRole("heading", { name: CHOICE_HEADING })
      ).toBeVisible()
      // Proving the email created nothing: only the choice does.
      await expect(readEmailWallets(sql, email)).resolves.toEqual([])

      await page.getByRole("button", { name: START_WALLET }).click()
      await expect(
        page.getByRole("heading", { name: "Collect your first stamp" })
      ).toBeVisible()
      await expect(page.getByText("by email. Optional")).toBeVisible()

      const wallets = await readEmailWallets(sql, email)
      expect(wallets).toHaveLength(1)
      const wallet = wallets[0]!
      expect(wallet.phone_hmac).toBeNull()
      expect(wallet.email_verified).toBe(true)
      await expect(
        countDeviceSessions(sql, wallet.customer_id, device)
      ).resolves.toBe(1)
      await expect(
        context
          .cookies()
          .then((cookies) =>
            cookies.some((cookie) => cookie.name === EMAIL_HANDOFF_COOKIE)
          )
      ).resolves.toBe(false)

      await page.getByLabel(/Loyalty terms/i).check()
      await Promise.all([
        page.waitForURL(
          (url) =>
            url.pathname.startsWith("/card/") &&
            url.searchParams.get("welcome") === "1" &&
            url.searchParams.get("stamp") === "issued"
        ),
        page.getByRole("button", { name: "Get my first stamp" }).click(),
      ])
      await expect(
        readFirstStamp(sql, fixture, wallet.customer_id)
      ).resolves.toEqual({ current_stamp_count: 1, stamp_count: 1 })
      await expect
        .poll(() =>
          countEmailEvents(
            sql,
            wallet.customer_id,
            "join_new_email_wallet_confirmed"
          )
        )
        .toBe(1)
    })
  })

  test("choosing phone on the choice screen creates nothing and opens the phone step", async ({
    context,
    page,
  }) => {
    const email = uniqueJoinEmail("phone")
    await withJourney([email], async ({ sql, fixture, phone }) => {
      await installKnownDevice(context)
      await requestJoinEmailCode(page, fixture, email, phone)
      await confirmJoinCode(page)
      await expect(
        page.getByRole("heading", { name: CHOICE_HEADING })
      ).toBeVisible()

      await page.getByRole("button", { name: USE_PHONE }).click()
      await expect(page).toHaveURL(/step=phone/)
      await expect(page.getByLabel("UK phone number")).toBeVisible()
      await expect(readEmailWallets(sql, email)).resolves.toEqual([])
      await expect(hasCookie(context, EMAIL_HANDOFF_COOKIE)).resolves.toBe(
        false
      )

      // The handoff is gone, so the choice cannot be reopened.
      await page.goto(
        `/m/${fixture.merchantSlug}/join?qr=${fixture.activeQrId}&step=email_choice`
      )
      await expect(
        page.getByRole("heading", { name: CHOICE_HEADING })
      ).toHaveCount(0)
      await expect(readEmailWallets(sql, email)).resolves.toEqual([])
    })
  })

  test("the welcome CTA opens the phone step, and the phone path joins with no email offered first", async ({
    context,
    page,
  }) => {
    const phone = disposableUkMobile()
    await withJourney(
      [],
      async ({ sql, fixture }) => {
        await installKnownDevice(context)
        await page.goto(publicQrPath(fixture.activeQrId))
        await page.getByRole("link", { name: "Claim my first stamp" }).click()
        await expect(page).toHaveURL(/step=phone/)
        await expect(page.getByLabel("UK phone number")).toBeVisible()
        await expect(page.getByLabel("Email address")).toHaveCount(0)
        await expect(page.getByRole("link", { name: /email/i })).toHaveCount(0)

        await page.getByLabel("UK phone number").fill(phone.national)
        await page.getByRole("button", { name: "Send my code" }).click()
        await expect(
          page.getByRole("heading", { name: "Enter your code" })
        ).toBeVisible()
        await confirmJoinCode(page)
        await expect(
          page.getByRole("heading", { name: "Collect your first stamp" })
        ).toBeVisible()
        await page.getByLabel(/Loyalty terms/i).check()
        await Promise.all([
          page.waitForURL(
            (url) =>
              url.pathname.startsWith("/card/") &&
              url.searchParams.get("stamp") === "issued"
          ),
          page.getByRole("button", { name: "Get my first stamp" }).click(),
        ])
        const joined = await readJoinedMembership(sql, fixture, phone)
        expect(joined?.stamp_count).toBe(1)
      },
      phone
    )
  })

  test("a phone code requested after the choice screen opens its code step", async ({
    context,
    page,
  }) => {
    const email = uniqueJoinEmail("then-phone")
    const phone = disposableUkMobile()
    await withJourney(
      [email],
      async ({ sql, fixture }) => {
        // The same number texted first, before the email fallback.
        await installKnownDevice(context)
        await requestJoinEmailCode(page, fixture, email, phone)
        await confirmJoinCode(page)
        await expect(
          page.getByRole("heading", { name: CHOICE_HEADING })
        ).toBeVisible()

        // Away from the choice without answering it, then on to phone.
        await page.getByRole("link", { name: "Use a different email" }).click()
        await expect(page).toHaveURL(/step=email/)
        await page
          .getByRole("link", { name: "Use my phone number instead" })
          .click()
        await expect(page).toHaveURL(/step=phone/)
        await page.getByLabel("UK phone number").fill(phone.national)
        await page.getByRole("button", { name: "Send my code" }).click()

        await expect(page).toHaveURL(/step=otp/)
        await expect(
          page.getByRole("heading", { name: "Enter your code" })
        ).toBeVisible()
        await expect(
          page.getByRole("heading", { name: CHOICE_HEADING })
        ).toHaveCount(0)
        await expect(hasCookie(context, EMAIL_HANDOFF_COOKIE)).resolves.toBe(
          false
        )

        await confirmJoinCode(page)
        await expect(
          page.getByRole("heading", { name: "Collect your first stamp" })
        ).toBeVisible()
        await expect(readEmailWallets(sql, email)).resolves.toEqual([])
      },
      phone
    )
  })

  test("a text that arrives after the email fallback can still be entered", async ({
    context,
    page,
  }) => {
    const phone = disposableUkMobile()
    await withJourney(
      [],
      async ({ sql, fixture }) => {
        await installKnownDevice(context)
        await installFallbackClock(page)
        await openOtpStep(page, fixture, phone)
        await takeEmailFallback(page)
        await expect(
          page.getByRole("heading", { name: "Get your code by email instead" })
        ).toBeVisible()

        // The code turns up now: phone returns to it, not a blank number.
        await page
          .getByRole("link", { name: "Use my phone number instead" })
          .click()
        await expect(
          page.getByRole("heading", { name: "Enter your code" })
        ).toBeVisible()
        await expect(page.getByLabel("UK phone number")).toHaveCount(0)
        // Email is still offered on the server's timing if it does not come.
        await page.clock.fastForward(31_000)
        await expect(emailFallback(page)).toBeVisible()

        await confirmJoinCode(page)
        await expect(
          page.getByRole("heading", { name: "Collect your first stamp" })
        ).toBeVisible()
        await page.getByLabel(/Loyalty terms/i).check()
        await Promise.all([
          page.waitForURL((url) => url.pathname.startsWith("/card/")),
          page.getByRole("button", { name: "Get my first stamp" }).click(),
        ])
        const joined = await readJoinedMembership(sql, fixture, phone)
        expect(joined?.stamp_count).toBe(1)
      },
      phone
    )
  })

  test("a wrong code is refused and the right one is accepted", async ({
    context,
    page,
  }) => {
    const email = uniqueJoinEmail("wrong")
    await withJourney([email], async ({ sql, fixture }) => {
      await installKnownDevice(context)
      await installPendingEmailChallenge(context, { email, code: KNOWN_CODE })
      await openCodeStep(page, fixture)

      await confirmJoinCode(page, WRONG_OTP)
      await expect(page.getByText(NOT_ACCEPTED, { exact: true })).toBeVisible()
      await expect(
        page.getByRole("heading", { name: "Enter your code" })
      ).toBeVisible()

      // The real digest, not the dev shortcut, accepts the emailed code.
      await confirmJoinCode(page, KNOWN_CODE)
      await expect(
        page.getByRole("heading", { name: CHOICE_HEADING })
      ).toBeVisible()
      await expect(readEmailWallets(sql, email)).resolves.toEqual([])
    })
  })

  test("a resend replaces the code, so the earlier code no longer works", async ({
    context,
    page,
  }) => {
    const email = uniqueJoinEmail("resend")
    await withJourney([email], async ({ fixture }) => {
      await installKnownDevice(context)
      await installPendingEmailChallenge(context, { email, code: KNOWN_CODE })
      await openCodeStep(page, fixture)

      await page.getByRole("button", { name: "Resend code" }).click()
      await expect(
        page.getByText("Use the latest code we sent.", { exact: true })
      ).toBeVisible()

      await confirmJoinCode(page, KNOWN_CODE)
      await expect(page.getByText(NOT_ACCEPTED, { exact: true })).toBeVisible()
      await expect(
        page.getByRole("heading", { name: CHOICE_HEADING })
      ).toHaveCount(0)
    })
  })

  test("a verified-email handoff does not work from another device", async ({
    browser,
    context,
    page,
  }) => {
    const email = uniqueJoinEmail("device")
    await withJourney([email], async ({ sql, fixture, phone }) => {
      const first = await installKnownDevice(context)
      await requestJoinEmailCode(page, fixture, email, phone)
      await confirmJoinCode(page)
      await expect(
        page.getByRole("heading", { name: CHOICE_HEADING })
      ).toBeVisible()

      // Another browser holding a handoff issued to the first device sees no
      // choice at all.
      const other = await browser.newContext()
      try {
        await installKnownDevice(other)
        await installForeignDeviceHandoff(other, {
          email,
          merchantSlug: fixture.merchantSlug,
          qrId: fixture.activeQrId,
          deviceHash: first.deviceHash,
        })
        const otherPage = await other.newPage()
        await dismissPwaInstall(otherPage)
        await otherPage.goto(
          `/m/${fixture.merchantSlug}/join?qr=${fixture.activeQrId}&step=email_choice`
        )
        await expect(
          otherPage.getByRole("heading", { name: "Your first stamp is ready" })
        ).toBeVisible()
        await expect(
          otherPage.getByRole("heading", { name: CHOICE_HEADING })
        ).toHaveCount(0)
      } finally {
        await other.close()
      }

      // The open choice screen, now posting from a different device, is
      // refused by the action itself.
      await installKnownDevice(context)
      await page.getByRole("button", { name: START_WALLET }).click()
      await expect(
        page.getByText(
          "That email confirmation has expired. Enter your email again."
        )
      ).toBeVisible()
      await expect(readEmailWallets(sql, email)).resolves.toEqual([])
    })
  })
})

async function withJourney(
  emails: string[],
  run: (journey: Journey, emails: string[]) => Promise<void>,
  phone: DisposablePhone = disposableUkMobile()
): Promise<void> {
  const sql = connectLocalDb()
  test.skip(!sql, "local Supabase DB is not configured")
  if (!sql) return

  let fixture: PublicQrRouterFixture | undefined
  try {
    fixture = await createPublicQrRouterFixture(sql)
    test.skip(!fixture, "seed merchant owner is not available")
    if (!fixture) return
    await run({ sql, fixture, phone }, emails)
  } finally {
    await cleanupCustomerJoinRows(sql, fixture, phone)
    await cleanupEmailJoinRows(sql, emails)
    await cleanupPublicQrRouterFixture(sql, fixture)
    await sql.end()
  }
}

async function openCodeStep(
  page: Page,
  fixture: PublicQrRouterFixture
): Promise<void> {
  await page.goto(
    `/m/${fixture.merchantSlug}/join?qr=${fixture.activeQrId}&step=otp`
  )
  await expect(
    page.getByRole("heading", { name: "Enter your code" })
  ).toBeVisible()
  await expect(page.getByLabel("Your code")).toBeVisible()
}

async function hasCookie(
  context: BrowserContext,
  name: string
): Promise<boolean> {
  const cookies = await context.cookies()
  return cookies.some((cookie) => cookie.name === name)
}

async function countMemberships(
  sql: Sql,
  fixture: PublicQrRouterFixture
): Promise<number> {
  const [row] = await sql<readonly { readonly count: number }[]>`
    select count(*)::int as count
    from public.customer_memberships
    where merchant_id = ${fixture.merchantId}::uuid`
  return row?.count ?? 0
}

async function readFirstStamp(
  sql: Sql,
  fixture: PublicQrRouterFixture,
  customerId: string
): Promise<{ current_stamp_count: number; stamp_count: number } | undefined> {
  const rows = await sql<
    readonly { current_stamp_count: number; stamp_count: number }[]
  >`
    select
      customer_memberships.current_stamp_count::int as current_stamp_count,
      (
        select count(*)::int
        from public.stamp_events
        where stamp_events.membership_id = customer_memberships.id
          and stamp_events.event_type = 'earned'
      ) as stamp_count
    from public.customer_memberships
    where customer_memberships.merchant_id = ${fixture.merchantId}::uuid
      and customer_memberships.customer_id = ${customerId}::uuid`
  return rows.at(0)
}

/** Events recorded for `customerId` whose metadata says email proved them. */
async function countEmailEvents(
  sql: Sql,
  customerId: string,
  eventName: string
): Promise<number> {
  const [row] = await sql<readonly { readonly count: number }[]>`
    select count(*)::int as count
    from public.product_events
    where customer_id = ${customerId}::uuid
      and event_name = ${eventName}
      and metadata ->> 'method' = 'email'`
  return row?.count ?? 0
}
