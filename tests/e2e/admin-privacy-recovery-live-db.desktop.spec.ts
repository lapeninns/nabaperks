import { randomUUID } from "node:crypto"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { expect, test } from "@playwright/test"

import { adminLiveDbSkipReason, connectLocalDb } from "./helpers/admin-live-db"
import { signInWithGeneratedEmailOtp } from "./helpers/passwordless-auth-session"

test.describe("@admin-live-db privacy error recovery", () => {
  const reason = adminLiveDbSkipReason()
  test.skip(Boolean(reason), reason)
  test.use({ serviceWorkers: "block" })

  test("retains Export and channel when notes validation fails, then exports on notes-only retry", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    if (!sql) throw new Error("A disposable local database is required")
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !anonKey || !serviceKey)
      throw new Error("Local Supabase credentials are required")
    const runId = randomUUID()
    const email = `qa-admin-recovery-${runId}@example.test`
    const notes = `Synthetic export recovery ${runId}`
    const api = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })
    const created = await api.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (created.error) throw created.error
    const userId = created.data.user.id
    const merchantId = randomUUID()
    const customerId = randomUUID()
    try {
      // Given: an ordinary passwordless session with an active local admin grant.
      await sql`insert into internal_admins(user_id,email,is_active) values(${userId}::uuid,${email},true)`
      await sql`insert into merchants(id,owner_user_id,business_name,business_slug,business_type,email,status) values(${merchantId}::uuid,${userId}::uuid,${`QA Admin Recovery ${runId}`},${`qa-admin-recovery-${runId}`},'cafe',${email},'active')`
      await sql`insert into customers(id,email,email_verified_at,full_name) values(${customerId}::uuid,${`qa-admin-subject-${runId}@example.test`},now(),'Synthetic export subject')`
      await sql`insert into customer_memberships(id,customer_id,merchant_id) values(${randomUUID()}::uuid,${customerId}::uuid,${merchantId}::uuid)`
      const jar = new Map<string, string>()
      const auth = createServerClient(url, anonKey, {
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (cookies) => {
            for (const cookie of cookies) jar.set(cookie.name, cookie.value)
          },
        },
      })
      const verified = await signInWithGeneratedEmailOtp(auth, api, email)
      if (verified.error) throw verified.error
      await page.context().addCookies(
        [...jar].map(([name, value]) => ({
          name,
          value,
          url: test.info().project.use.baseURL ?? "http://127.0.0.1:3146",
          sameSite: "Lax",
        }))
      )
      await page.goto(
        `/admin/privacy?venue=${encodeURIComponent(`QA Admin Recovery ${runId}`)}`
      )
      const disclosure = page
        .locator(`details:has(input[name="customerId"][value="${customerId}"])`)
        .first()
      await disclosure.locator("summary").click()
      const form = disclosure.locator("form:has(select[name=requestType])")
      await form.locator("select[name=requestType]").selectOption("export")
      await form.locator("select[name=channel]").selectOption("phone")
      await form.locator("input[name=notes]").fill("    ")
      // When: native submission returns a structured validation error.
      await form.getByRole("button", { name: "Log request" }).click()
      // Then: the operator can correct only the invalid field.
      await expect(form.getByRole("alert")).toBeVisible()
      await expect(form.locator("select[name=requestType]")).toHaveValue(
        "export"
      )
      await expect(form.locator("select[name=channel]")).toHaveValue("phone")
      await expect(form.locator("input[name=notes]")).toHaveValue("    ")
      expect(
        await sql`select id from audit_logs where actor_id=${userId}::text`
      ).toHaveLength(0)
      await form.locator("input[name=notes]").fill(notes)
      await form.getByRole("button", { name: "Log request" }).click()
      const download = form.getByRole("link", {
        name: "Download customer data export",
      })
      await expect(download).toBeVisible()
      const href = await download.getAttribute("href")
      if (!href) throw new Error("The completed export must have a download")
      const content: unknown = JSON.parse(
        decodeURIComponent(href.slice(href.indexOf(",") + 1))
      )
      expect(JSON.stringify(content)).toContain(customerId)
      expect(
        await sql`select action from audit_logs where actor_id=${userId}::text and action='customer_data_exported'`
      ).toHaveLength(1)
      await expect(form.locator("select[name=requestType]")).toHaveValue(
        "access"
      )
      await expect(form.locator("select[name=channel]")).toHaveValue("email")
      await expect(form.locator("input[name=notes]")).toHaveValue("")
    } finally {
      await sql`delete from audit_logs where actor_id=${userId}::text`
      await sql`delete from customers where id=${customerId}::uuid`
      await sql`delete from merchants where id=${merchantId}::uuid`
      await sql`delete from internal_admins where user_id=${userId}::uuid`
      const removed = await api.auth.admin.deleteUser(userId)
      await sql.end({ timeout: 5 })
      if (removed.error) throw removed.error
    }
  })
})
