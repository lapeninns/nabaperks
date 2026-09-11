import { expect, test } from "@playwright/test"

import { customerPhonePii } from "@/lib/customer/phone-pii-core"

import { connectLocalDb, type Sql } from "./helpers/admin-live-db"
import {
  cleanupCustomerJoinRows,
  DEV_OTP,
  disposableUkMobile,
  type DisposablePhone,
} from "./helpers/customer-join-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupPublicQrRouterFixture,
  createPublicQrRouterFixture,
  type PublicQrRouterFixture,
} from "./helpers/public-qr-router-live-db"

/**
 * The regression this pins was reported from a real handset: an established
 * wallet, a browser that had never opened it, and no verified recovery email.
 * The device-continuity gate refused the session and offered an email code it
 * could not send, so the customer had no route back to their own cards.
 *
 * Everything the failure needed is seeded here, so the scenario no longer
 * depends on owning the affected phone. See SEC-RISK-001 in
 * docs/operations/security-risk-register.md for why phone possession alone is
 * currently accepted, and what restoring the stronger control would require.
 */

type TrustedDeviceRow = {
  readonly trust_source: string
  readonly device_is_trusted: boolean
}

type CountRow = {
  readonly count: number
}

test.describe("@customer-flow customer login on an unrecognised device", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("opens an existing wallet from a browser that has never seen it", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const phone = disposableUkMobile()
    let fixture: PublicQrRouterFixture | undefined
    let customerId: string | undefined

    try {
      fixture = await createPublicQrRouterFixture(sql)
      test.skip(!fixture, "seed merchant owner is not available")
      if (!fixture) return

      customerId = await seedEstablishedWallet(sql, fixture, phone)

      // The precondition that made the reported failure reachable: a wallet
      // with history, and a browser that is a complete stranger to it.
      await expect(trustedDeviceCount(sql, customerId)).resolves.toBe(0)

      await page.goto("/home/login")
      await page.fill("#contact", phone.national)
      await page.getByRole("button", { name: "Send code" }).click()
      await page.fill("#otp", DEV_OTP)
      await page.getByRole("button", { name: "Open my cards" }).click()

      // Previously this landed on /home/recover and stopped there.
      await expect(page).toHaveURL(/\/home(?:\?|$)/)
      await expect(
        page.getByText("We can't safely open this existing wallet")
      ).toHaveCount(0)

      // The session exists because phone possession alone was accepted, and
      // the browser is still NOT trusted: restoring the gate must not inherit
      // trust that a phone code created.
      const trust = await readTrustedDevice(sql, customerId)
      expect(trust?.trust_source).toBe("verified_phone")
      expect(trust?.device_is_trusted).toBe(false)
      await expect(activeSessionCount(sql, customerId)).resolves.toBe(1)
    } finally {
      if (customerId) {
        await sql`
          delete from public.customer_otp_trusted_devices
          where customer_id = ${customerId}::uuid`
      }
      await cleanupCustomerJoinRows(sql, fixture, phone)
      await cleanupPublicQrRouterFixture(sql, fixture)
      await sql.end()
    }
  })
})

// An established wallet: verified phone, a card already collected, and no
// verified email to fall back on. Created well in the past so the new-identity
// shortcut in register_customer_session cannot apply.
async function seedEstablishedWallet(
  sql: Sql,
  fixture: PublicQrRouterFixture,
  phone: DisposablePhone
): Promise<string> {
  const pii = customerPhonePii(phone.e164)
  expect(pii.phoneHmac).toBe(phone.phoneHmac)

  const [customer] = await sql<readonly { id: string }[]>`
    insert into public.customers (
      email,
      email_verified_at,
      phone_hmac,
      phone_ciphertext,
      phone_last4,
      phone_country,
      phone_verified_at,
      created_at,
      updated_at
    )
    values (
      null,
      null,
      ${pii.phoneHmac},
      ${pii.phoneCiphertext},
      ${pii.phoneLast4},
      'GB',
      now(),
      now() - interval '400 days',
      now()
    )
    returning id::text as id`

  await sql`
    insert into public.customer_memberships (merchant_id, customer_id)
    values (${fixture.merchantId}::uuid, ${customer.id}::uuid)`

  return customer.id
}

async function trustedDeviceCount(
  sql: Sql,
  customerId: string
): Promise<number> {
  const rows = await sql<readonly CountRow[]>`
    select count(*)::int as count
    from public.customer_otp_trusted_devices
    where customer_id = ${customerId}::uuid
      and revoked_at is null`

  return rows.at(0)?.count ?? 0
}

async function activeSessionCount(
  sql: Sql,
  customerId: string
): Promise<number> {
  const rows = await sql<readonly CountRow[]>`
    select count(*)::int as count
    from public.customer_sessions
    where customer_id = ${customerId}::uuid
      and revoked_at is null
      and expires_at > now()`

  return rows.at(0)?.count ?? 0
}

async function readTrustedDevice(
  sql: Sql,
  customerId: string
): Promise<TrustedDeviceRow | undefined> {
  const rows = await sql<readonly TrustedDeviceRow[]>`
    select
      device.trust_source,
      public.customer_auth_device_is_trusted(
        device.customer_id,
        device.device_hash
      ) as device_is_trusted
    from public.customer_otp_trusted_devices device
    where device.customer_id = ${customerId}::uuid
      and device.revoked_at is null
    order by device.trusted_at desc
    limit 1`

  return rows.at(0)
}
