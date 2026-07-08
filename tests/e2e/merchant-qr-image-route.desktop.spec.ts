import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

import {
  adminLiveDbSkipReason,
  connectLocalDb,
  seedMerchantOwnerEmail,
  type Sql,
} from "./helpers/admin-live-db"
import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

const SEED_MERCHANT_PASSWORD = "NabaperksDemo1!"
const SEED_MERCHANT_SLUG = "old-crown-girton"

type SeedQrImageFixture = {
  readonly validQrCodeId: string
  readonly wrongMerchantQrCodeId: string
  readonly inactiveQrCodeId: string
  readonly nonJoinQrCodeId: string
  readonly missingQrCodeId: string
}

type SeedQrSetupRow = {
  readonly merchant_id: string
  readonly location_id: string
  readonly loyalty_card_id: string
  readonly valid_qr_code_id: string
  readonly wrong_merchant_qr_code_id: string | null
}

async function signInAsSeededMerchant(
  page: Page,
  merchantEmail: string
): Promise<void> {
  await page.goto("/login?next=/app/qr")
  await expect(
    page.getByRole("heading", { name: "Back to the counter" })
  ).toBeVisible()

  await page.locator("#email").fill(merchantEmail)
  await page.locator("#password").fill(SEED_MERCHANT_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()

  await expect(page).toHaveURL((url) => url.pathname.startsWith("/app"))
}

async function createSeedQrImageFixture(
  sql: Sql
): Promise<SeedQrImageFixture | undefined> {
  const rows = await sql<readonly SeedQrSetupRow[]>`
    select
      merchants.id::text as merchant_id,
      merchant_locations.id::text as location_id,
      loyalty_cards.id::text as loyalty_card_id,
      owned_qr.id::text as valid_qr_code_id,
      wrong_merchant_qr.id::text as wrong_merchant_qr_code_id
    from public.merchants
    join public.merchant_locations
      on merchant_locations.merchant_id = merchants.id
     and merchant_locations.is_primary
    join public.loyalty_cards
      on loyalty_cards.merchant_id = merchants.id
     and loyalty_cards.location_id = merchant_locations.id
     and loyalty_cards.is_active
    join public.qr_codes owned_qr
      on owned_qr.merchant_id = merchants.id
     and owned_qr.location_id = merchant_locations.id
     and owned_qr.loyalty_card_id = loyalty_cards.id
     and owned_qr.destination_type = 'join'
     and owned_qr.is_active
    left join lateral (
      select qr_codes.id
      from public.qr_codes
      where qr_codes.merchant_id <> merchants.id
        and qr_codes.destination_type = 'join'
        and qr_codes.is_active
      order by qr_codes.created_at asc
      limit 1
    ) wrong_merchant_qr on true
    where merchants.business_slug = ${SEED_MERCHANT_SLUG}
    order by owned_qr.created_at asc
    limit 1`

  const setup = rows.at(0)
  if (!setup?.wrong_merchant_qr_code_id) return undefined

  const runId = randomUUID().replaceAll("-", "").slice(0, 12)
  const inactiveQrCodeId = randomUUID()
  const nonJoinQrCodeId = randomUUID()

  await sql`
    insert into public.qr_codes (
      id,
      qr_id,
      merchant_id,
      location_id,
      loyalty_card_id,
      destination_type,
      is_active
    )
    values
      (
        ${inactiveQrCodeId}::uuid,
        ${`e2e-inactive-${runId}`},
        ${setup.merchant_id}::uuid,
        ${setup.location_id}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'join',
        false
      ),
      (
        ${nonJoinQrCodeId}::uuid,
        ${`e2e-stamp-${runId}`},
        ${setup.merchant_id}::uuid,
        ${setup.location_id}::uuid,
        ${setup.loyalty_card_id}::uuid,
        'stamp',
        true
      )`

  return {
    validQrCodeId: setup.valid_qr_code_id,
    wrongMerchantQrCodeId: setup.wrong_merchant_qr_code_id,
    inactiveQrCodeId,
    nonJoinQrCodeId,
    missingQrCodeId: randomUUID(),
  }
}

async function cleanupSeedQrImageFixture(
  sql: Sql,
  fixture: SeedQrImageFixture | undefined
): Promise<void> {
  if (!fixture) return

  await sql`
    delete from public.qr_codes
    where id in (
      ${fixture.inactiveQrCodeId}::uuid,
      ${fixture.nonJoinQrCodeId}::uuid
    )`
}

async function expectQrImageRejected(
  page: Page,
  qrCodeId: string,
  label: string
): Promise<void> {
  const response = await page.goto(`/app/qr/image/${qrCodeId}`)

  expect(response, `${label} should return an HTTP response`).not.toBeNull()
  if (!response) return

  expect(response.status(), `${label} should not render image bytes`).toBe(404)
  expect(response.headers()["content-type"] ?? "").not.toContain("image/png")
  await expect(response.text()).resolves.toContain("QR code not found")
}

test.describe("Merchant QR image route", () => {
  test("dev QR harness page loads the fixture image in the frame", async ({
    page,
  }) => {
    await dismissPwaInstall(page)

    const response = await page.goto(HARNESS_ROUTES.qr)
    const image = page.getByRole("img", {
      name: "QR code for Mystery Visit Card",
    })

    expect(response?.status()).toBe(200)
    await expect(image).toBeVisible()
    await expect
      .poll(async () => {
        return image.evaluate((node) => {
          if (!(node instanceof HTMLImageElement)) {
            return false
          }

          return node.complete && node.naturalWidth > 100
        })
      })
      .toBe(true)
  })

  test("dev harness QR image renders fixture bytes without auth", async ({
    request,
  }) => {
    const response = await request.get("/app/qr/image/qr_harness")

    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"] ?? "").toContain("image/png")
    expect(response.headers()["cache-control"] ?? "").toContain(
      "private, max-age=86400, immutable"
    )
    expect((await response.body()).byteLength).toBeGreaterThan(100)
  })

  test("unauthenticated internal QR image requests do not render image bytes", async ({
    request,
  }) => {
    const response = await request.get("/app/qr/image/not-owned")

    expect(response.status()).toBe(404)
    expect(response.headers()["content-type"] ?? "").not.toContain("image/png")
    await expect(response.text()).resolves.toContain("QR code not found")
  })

  test.describe("@admin-live-db authenticated merchant QR image route", () => {
    const reason = adminLiveDbSkipReason()
    test.skip(Boolean(reason), reason)
    test.use({ serviceWorkers: "block" })

    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("unauthenticated active QR image requests fail closed", async ({
      request,
    }) => {
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: SeedQrImageFixture | undefined

      try {
        fixture = await createSeedQrImageFixture(sql)
        test.skip(!fixture, "seed merchant QR image fixture is not available")
        if (!fixture) return

        const response = await request.get(
          `/app/qr/image/${fixture.validQrCodeId}`
        )

        expect(response.status()).toBe(404)
        expect(response.headers()["content-type"] ?? "").not.toContain(
          "image/png"
        )
        await expect(response.text()).resolves.toContain("QR code not found")
      } finally {
        await cleanupSeedQrImageFixture(sql, fixture)
        await sql.end({ timeout: 5 })
      }
    })

    test("seeded merchant only receives image bytes for an owned active join QR", async ({
      page,
    }) => {
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let fixture: SeedQrImageFixture | undefined

      try {
        fixture = await createSeedQrImageFixture(sql)
        test.skip(!fixture, "seed merchant QR image fixture is not available")
        if (!fixture) return

        const merchantEmail = await seedMerchantOwnerEmail(
          sql,
          SEED_MERCHANT_SLUG
        )
        test.skip(!merchantEmail, "seed merchant owner email is not available")
        if (!merchantEmail) return

        await signInAsSeededMerchant(page, merchantEmail)

        const validResponse = await page.goto(
          `/app/qr/image/${fixture.validQrCodeId}`
        )
        expect(validResponse?.status()).toBe(200)
        expect(validResponse?.headers()["content-type"] ?? "").toContain(
          "image/png"
        )
        expect(validResponse?.headers()["cache-control"] ?? "").toContain(
          "private, max-age=86400, immutable"
        )
        expect((await validResponse?.body())?.byteLength ?? 0).toBeGreaterThan(
          100
        )

        await expectQrImageRejected(
          page,
          fixture.wrongMerchantQrCodeId,
          "wrong merchant QR"
        )
        await expectQrImageRejected(
          page,
          fixture.inactiveQrCodeId,
          "inactive QR"
        )
        await expectQrImageRejected(
          page,
          fixture.nonJoinQrCodeId,
          "non-join QR"
        )
        await expectQrImageRejected(page, fixture.missingQrCodeId, "missing QR")
      } finally {
        await cleanupSeedQrImageFixture(sql, fixture)
        await sql.end({ timeout: 5 })
      }
    })
  })
})
