import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import { installCustomerSession } from "./helpers/customer-join-live-db"
import {
  createBrowserCustomerSession,
  customerReadbackLiveDbSkipReason,
} from "./helpers/customer-readback-live-db"
import { dismissPwaInstall } from "./helpers/harness"

test.describe("session revocation", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  test("redirects an anonymized abandoned identity to sign in", async ({
    context,
    page,
  }) => {
    const sql = connectLocalDb()
    test.skip(!sql, "local Supabase DB is not configured")
    if (!sql) return

    const suffix = randomUUID().replaceAll("-", "")
    let customerId: string | undefined
    try {
      const rows = await sql<readonly { id: string }[]>`
        insert into public.customers (
          email, phone_hmac, phone_ciphertext, phone_last4, phone_country,
          phone_verified_at, created_at, updated_at
        ) values (
          ${`browser-abandoned-${suffix}@test.local`},
          ${suffix.padEnd(64, "0").slice(0, 64)}, ${`v1.${suffix}`},
          '1234', 'GB', now(), '2000-01-01', '2000-01-01'
        ) returning id`
      customerId = rows.at(0)?.id
      if (!customerId) throw new Error("Customer fixture was not created.")

      const session = await createBrowserCustomerSession(sql, customerId)
      await installCustomerSession(context, session)
      await dismissPwaInstall(page)
      await page.goto("/home", { waitUntil: "commit" })
      await expect(
        page.getByRole("heading", { name: "Your cards" })
      ).toBeVisible()

      await sql`
        update public.customer_sessions
        set last_seen_at = '2000-01-01'
        where customer_id = ${customerId}::uuid`

      const candidates = await sql`
        select id from public.customers
        where created_at < '2000-01-02' and updated_at < '2000-01-02'
          and coalesce(email, '') not like 'erased+%@privacy.invalid'`
      expect(candidates.map((row) => row.id)).toEqual([customerId])
      await sql`select set_config('request.jwt.claim.role', 'service_role', false)`
      await sql`
        select public.admin_purge_abandoned_customer_identities('2000-01-02')`

      const [erased] = await sql`
        select email like 'erased+%@privacy.invalid' as email_erased,
          phone_hmac is null as phone_erased,
          (select count(*)::integer from public.customer_sessions
            where customer_id = ${customerId}::uuid and revoked_at is null)
            as active_sessions
        from public.customers where id = ${customerId}::uuid`
      expect(erased).toEqual({
        email_erased: true,
        phone_erased: true,
        active_sessions: 0,
      })
      await page.goto("/home", { waitUntil: "commit" })
      await expect(page).toHaveURL(/\/home\/login/)
      await expect(
        page.getByRole("heading", { name: "Open my cards" })
      ).toBeVisible()
    } finally {
      if (customerId) {
        await sql`delete from public.customer_sessions where customer_id = ${customerId}::uuid`
        await sql`delete from public.customers where id = ${customerId}::uuid`
      }
      await sql.end()
    }
  })
})
