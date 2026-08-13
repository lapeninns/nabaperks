import { randomUUID } from "node:crypto"

import { expect, test, type Page } from "@playwright/test"

import {
  adminLiveDbSkipReason,
  connectLocalDb,
  databaseIsReady,
  type Sql,
} from "./helpers/admin-live-db"
import { dismissPwaInstall, waitForHydratedPage } from "./helpers/harness"

const PREFERENCE_KEY = "nabaperks:preference:theme"
const PREFERENCE_VALUE = "paper"

type ErasureFixture = Readonly<{
  authUserId: string
  customerId: string
  membershipId: string
  merchantId: string
  contactSearch: string
}>

test.describe("@admin-live-db onboarding erasure cleanup", () => {
  const skipReason = adminLiveDbSkipReason()
  test.skip(Boolean(skipReason), skipReason)
  test.use({ serviceWorkers: "block" })

  test.beforeEach(async ({ page }) => dismissPwaInstall(page))

  test("failed erasure retains the draft and genuine completed erasure clears only that account draft", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    let fixture: ErasureFixture | undefined
    try {
      test.skip(
        !(await databaseIsReady(sql)),
        "local Supabase DB is not migrated for admin actions"
      )
      fixture = await createErasureFixture(sql)
      await signInToAdmin(page)

      const draftKey = `nabaperks:onboarding-draft:${fixture.customerId}`
      await page.addInitScript(
        ({ accountId, key, preferenceKey, preferenceValue }) => {
          window.localStorage.setItem(
            key,
            JSON.stringify({
              accountId,
              fields: { addressCity: "Synthetic city" },
              savedAt: Date.now(),
              version: 1,
            })
          )
          window.localStorage.setItem(preferenceKey, preferenceValue)
          window.sessionStorage.setItem(
            "nabaperks:onboarding-draft:active-account",
            accountId
          )
        },
        {
          accountId: fixture.customerId,
          key: draftKey,
          preferenceKey: PREFERENCE_KEY,
          preferenceValue: PREFERENCE_VALUE,
        }
      )

      await openFixture(page, fixture)
      let form = await revealDataRequestForm(page, fixture.customerId)
      await fillDeletion(form)
      await form
        .locator('input[name="merchantId"]')
        .evaluate((input, invalidMerchantId) => {
          if (!(input instanceof HTMLInputElement)) throw new Error("not input")
          input.value = invalidMerchantId
        }, randomUUID())
      await form.getByRole("button", { name: "Log request" }).click()
      await expect(form.getByRole("alert")).toContainText(
        "Data request log failed"
      )
      await expectStorage(page, draftKey, true)

      await openFixture(page, fixture)
      form = await revealDataRequestForm(page, fixture.customerId)
      await fillDeletion(form)
      await form.getByRole("button", { name: "Log request" }).click()
      await expect
        .poll(() => erasureAuditCount(sql, fixture!.customerId))
        .toBe(1)
      await expectStorage(page, draftKey, false)
    } finally {
      if (fixture) await cleanupErasureFixture(sql, fixture)
      await sql.end({ timeout: 5 })
    }
  })
})

async function signInToAdmin(page: Page): Promise<void> {
  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": `127.${Math.floor(Math.random() * 200) + 1}.14.1`,
  })
  await page.goto("/login?next=/admin")
  await page.locator("#email").fill("admin@nabaperks.test")
  await page.locator("#password").fill("NabaperksDemo1!")
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/admin", {
      waitUntil: "domcontentloaded",
    }),
    page.getByRole("button", { name: "Log in" }).click(),
  ])
}

async function openFixture(page: Page, fixture: ErasureFixture) {
  await page.goto(
    `/admin/privacy?contact=${encodeURIComponent(fixture.contactSearch)}`,
    { waitUntil: "domcontentloaded" }
  )
  await waitForHydratedPage(page)
}

async function revealDataRequestForm(page: Page, customerId: string) {
  const selector = `input[name="customerId"][value="${customerId}"]`
  const details = page
    .locator(`details:has(${selector})`)
    .filter({ visible: true })
  if ((await details.count()) > 0)
    await details.first().locator("summary").click()
  const form = page
    .locator(`form:has(${selector}):has(select[name="requestType"])`)
    .filter({ visible: true })
  await expect(form).toHaveCount(1)
  return form
}

async function fillDeletion(form: ReturnType<Page["locator"]>) {
  await form.getByLabel("Request type").selectOption("deletion")
  await form.getByLabel("Channel").selectOption("email")
  await form.getByLabel("Notes").fill("Task14 guarded erasure verification")
}

async function expectStorage(
  page: Page,
  draftKey: string,
  draftPresent: boolean
) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ key, preferenceKey }) => ({
          draftPresent: window.localStorage.getItem(key) !== null,
          preference: window.localStorage.getItem(preferenceKey),
        }),
        { key: draftKey, preferenceKey: PREFERENCE_KEY }
      )
    )
    .toEqual({ draftPresent, preference: PREFERENCE_VALUE })
}

async function createErasureFixture(sql: Sql): Promise<ErasureFixture> {
  const authUserId = randomUUID()
  const customerId = randomUUID()
  const membershipId = randomUUID()
  const contactSearch = `task14-${randomUUID()}`
  const email = `${contactSearch}@example.test`
  const [merchant] = await sql<readonly { merchant_id: string }[]>`
    select id::text as merchant_id from public.merchants
    where status in ('trial', 'active') order by created_at limit 1`
  if (!merchant) throw new Error("No local merchant is available.")
  await sql`insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
    values (${authUserId}::uuid, ${email}, 'task14-password-hash', '{}'::jsonb)`
  await sql`insert into public.customers
    (id, auth_user_id, email, email_hmac, email_verified_at, full_name, phone_last4, created_at, updated_at)
    values (${customerId}::uuid, ${authUserId}::uuid, ${email},
      ${randomUUID().replaceAll("-", "")}, now(), 'Task14 synthetic', '4242', now(), now())`
  await sql`insert into public.customer_memberships (id, merchant_id, customer_id)
    values (${membershipId}::uuid, ${merchant.merchant_id}::uuid, ${customerId}::uuid)`
  return {
    authUserId,
    customerId,
    membershipId,
    merchantId: merchant.merchant_id,
    contactSearch,
  }
}

async function erasureAuditCount(
  sql: Sql,
  customerId: string
): Promise<number> {
  const [row] = await sql<readonly { count: number }[]>`
    select count(*)::int as count from public.audit_logs
    where customer_id = ${customerId}::uuid and action = 'customer_pii_erased'`
  return row?.count ?? 0
}

async function cleanupErasureFixture(sql: Sql, fixture: ErasureFixture) {
  await sql`delete from public.audit_logs where customer_id = ${fixture.customerId}::uuid`
  await sql`delete from public.customer_memberships where id = ${fixture.membershipId}::uuid`
  await sql`delete from public.customers where id = ${fixture.customerId}::uuid`
  await sql`delete from auth.users where id = ${fixture.authUserId}::uuid`
}
