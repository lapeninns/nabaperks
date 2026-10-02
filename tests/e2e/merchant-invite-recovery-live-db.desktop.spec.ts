import { randomUUID } from "node:crypto"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { expect, test, type Request } from "@playwright/test"

import { connectLocalDb } from "./helpers/admin-live-db"
import { signInWithGeneratedEmailOtp } from "./helpers/passwordless-auth-session"

test.describe("@merchant-live-db invitation refusal recovery", () => {
  test.skip(
    process.env.INVITE_LIVE_DB_E2E !== "1",
    "Set INVITE_LIVE_DB_E2E=1 with an owned disposable local Supabase target"
  )
  test.use({ serviceWorkers: "block" })

  test("retains the draft and lawful basis on missing attestation, then admits one recipient", async ({
    page,
  }) => {
    const sql = connectLocalDb()
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!sql || !url || !anon || !service)
      throw new Error("An owned disposable Supabase target is required")
    const api = createClient(url, service, { auth: { persistSession: false } })
    const merchantId = randomUUID()
    const ownerEmail = `qa-invite-recovery-${merchantId}@example.test`
    const created = await api.auth.admin.createUser({
      email: ownerEmail,
      email_confirm: true,
    })
    if (created.error) throw created.error
    const ownerId = created.data.user.id
    const foreignMerchantId = randomUUID()
    let foreignOwnerId: string | undefined
    let submission: Request | undefined
    try {
      // Given: an owned draft and an ordinary passwordless owner session.
      await sql`insert into merchants(id,owner_user_id,business_name,business_slug,business_type,email,status,requires_billing)
        values(${merchantId}::uuid,${ownerId}::uuid,'Synthetic invitation venue',${`qa-invite-${merchantId}`},'cafe',${ownerEmail},'active',false)`
      const jar = new Map<string, string>()
      const auth = createServerClient(url, anon, {
        cookies: {
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          setAll: (cookies) => {
            for (const cookie of cookies) jar.set(cookie.name, cookie.value)
          },
        },
      })
      const verified = await signInWithGeneratedEmailOtp(auth, api, ownerEmail)
      if (verified.error) throw verified.error
      await page.context().addCookies(
        [...jar].map(([name, value]) => ({
          name,
          value,
          url: test.info().project.use.baseURL ?? "http://127.0.0.1:3146",
          sameSite: "Lax",
        }))
      )
      await page.goto("/app/customers/invite")
      await page
        .locator("textarea[name=recipients]")
        .fill(`qa-invite-recipient-${merchantId}@example.test`)
      await page.getByRole("button", { name: "Check list" }).click()
      const campaignInput = page.locator("input[name=campaignId]")
      await expect(campaignInput).toBeAttached()
      const ownDraftId = await campaignInput.inputValue()
      const foreignOwner = await api.auth.admin.createUser({
        email: `qa-foreign-invite-${foreignMerchantId}@example.test`,
        email_confirm: true,
      })
      if (foreignOwner.error) throw foreignOwner.error
      foreignOwnerId = foreignOwner.data.user.id
      await sql`insert into merchants(id,owner_user_id,business_name,business_slug,business_type,email,status,requires_billing)
        values(${foreignMerchantId}::uuid,${foreignOwnerId}::uuid,'Foreign synthetic invitation venue',${`qa-invite-${foreignMerchantId}`},'cafe',${`qa-foreign-invite-${foreignMerchantId}@example.test`},'active',false)`
      const foreignCampaignId = randomUUID()
      await sql`insert into loyalty_invite_campaigns(id,merchant_id,created_by_user_id,status)
        values(${foreignCampaignId}::uuid,${foreignMerchantId}::uuid,${foreignOwnerId}::uuid,'draft')`
      await page
        .locator("input[name=legalBasis][value=venue_email_consent]")
        .check()
      await page.locator("input[name=attestation]").check()
      await campaignInput.evaluate((input, id) => {
        ;(input as HTMLInputElement).value = id
      }, foreignCampaignId)
      await expect(campaignInput).toHaveValue(foreignCampaignId)
      await page.getByRole("button", { name: "Send 1 invitation" }).click()
      await expect(
        page.getByText(
          "This draft is no longer available. Check the list again."
        )
      ).toBeVisible()
      expect(
        await sql`select status,confirmed_at is not null confirmed from loyalty_invite_campaigns
          where id in (${ownDraftId}::uuid,${foreignCampaignId}::uuid)`
      ).toEqual([
        { status: "draft", confirmed: false },
        { status: "draft", confirmed: false },
      ])
      expect(
        await sql`select r.id from loyalty_invite_recipients r join loyalty_invite_campaigns c on c.id=r.campaign_id
          where c.merchant_id in (${merchantId}::uuid,${foreignMerchantId}::uuid) and c.status='sending' and r.status='queued'`
      ).toHaveLength(0)
      await page
        .locator("textarea[name=recipients]")
        .fill(`qa-invite-recipient-${merchantId}@example.test`)
      await page.getByRole("button", { name: "Check list" }).click()
      await expect(campaignInput).toBeAttached()
      const campaignId = await campaignInput.inputValue()
      const lawfulBasis = page.locator(
        "input[name=legalBasis][value=existing_customer_soft_opt_in]"
      )
      await lawfulBasis.check()
      // When: the native confirmation is submitted without attestation.
      await page.getByRole("button", { name: "Send 1 invitation" }).click()
      // Then: the same draft, error and selected basis survive the refusal.
      await expect(page.locator("#invite-attestation-error")).toBeVisible()
      await expect(campaignInput).toHaveValue(campaignId)
      await expect(lawfulBasis).toBeChecked()
      const read = async () => {
        const [row] = await sql`
          select c.status,c.confirmed_at is not null confirmed,
            (select count(*)::int from loyalty_invite_recipients r
             where r.campaign_id=c.id and r.status='queued' and c.status='sending') admitted
          from loyalty_invite_campaigns c where c.id=${campaignId}::uuid`
        return row
      }
      expect(await read()).toEqual({
        status: "draft",
        confirmed: false,
        admitted: 0,
      })

      await page.locator("input[name=attestation]").check()
      page.on("request", (request) => {
        if (request.method() === "POST" && request.headers()["next-action"])
          submission = request
      })
      await page.getByRole("button", { name: "Send 1 invitation" }).click()
      await expect(
        page.getByRole("heading", { name: "Done.", exact: true })
      ).toBeVisible()
      expect(await read()).toEqual({
        status: "sending",
        confirmed: true,
        admitted: 1,
      })

      if (!submission)
        throw new Error("Native confirmation POST was not observed")
      const replay = await page.request.fetch(submission.url(), {
        method: "POST",
        headers: submission.headers(),
        data: submission.postDataBuffer() ?? undefined,
      })
      expect(replay.status()).toBe(200)
      expect(await read()).toEqual({
        status: "sending",
        confirmed: true,
        admitted: 1,
      })
      expect(
        await sql`select id from audit_logs where merchant_id=${merchantId}::uuid and action='loyalty_invite_campaign_confirmed'`
      ).toHaveLength(1)
      await page.goto("/app/customers/invite")
      await expect(
        page.getByText("Sending your invitations", { exact: true })
      ).toBeVisible()
      expect(await read()).toEqual({
        status: "sending",
        confirmed: true,
        admitted: 1,
      })
    } finally {
      await sql`delete from product_events where merchant_id=${merchantId}::uuid`
      await sql`delete from audit_logs where merchant_id=${merchantId}::uuid`
      await sql`delete from merchants where id=${merchantId}::uuid`
      await sql`delete from merchants where id=${foreignMerchantId}::uuid`
      const removed = await api.auth.admin.deleteUser(ownerId)
      if (foreignOwnerId) {
        const foreignRemoved = await api.auth.admin.deleteUser(foreignOwnerId)
        if (foreignRemoved.error) throw foreignRemoved.error
      }
      await sql.end({ timeout: 5 })
      if (removed.error) throw removed.error
    }
  })
})
