import { createHmac, randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import type { APIRequestContext, BrowserContext, Page } from "@playwright/test"

import type { Sql } from "./admin-live-db"
import type { BrowserCustomerSession } from "./customer-readback-live-db"
import type { MerchantRewardPresetLiveDbFixture } from "./merchant-reward-preset-live-db"

const EVIDENCE_ROOT = resolve(
  ".omo/evidence/task-15/lanes/journey-race-v9/direct"
)

type DeliveryRow = Readonly<{
  delivered_at: string | null
  status: string
  updated_at: string
}>

export type DeliveryFixture = Readonly<{
  campaignId: string
  providerMessageId: string
  recipientId: string
}>

const JOURNEY_OPT_IN_FLAGS = [
  "CUSTOMER_FLOW_E2E",
  "MERCHANT_REWARD_PRESET_LIVE_DB_E2E",
] as const

/**
 * Reports why this suite is not selected for the current run, or null when it
 * is selected.
 *
 * Throwing from `beforeAll` marks a suite's remaining tests "skipped" without
 * ever executing them, which no reporter summary can tell apart from a
 * declared `test.skip()` — a hidden skip. Callers skip declaratively on a
 * non-null reason instead. Opt-in flags are checked here, ahead of the
 * connection variables `assertJourneyEnvironment` validates, so a DB-free run
 * reports "not selected" rather than "misconfigured".
 */
export function journeyEnvironmentSkipReason(): string | null {
  for (const name of JOURNEY_OPT_IN_FLAGS) {
    if (process.env[name] !== "1") return `${name}=1 is not set`
  }
  return null
}

export function assertJourneyEnvironment(): void {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DB_URL",
    "CUSTOMER_SESSION_SECRET",
    "RESEND_WEBHOOK_SECRET",
  ] as const
  for (const name of required) {
    if (!process.env[name]?.trim()) {
      throw new Error(`Journey proof requires ${name}.`)
    }
  }
  if (process.env.CUSTOMER_FLOW_E2E !== "1") {
    throw new Error("Journey proof requires CUSTOMER_FLOW_E2E=1.")
  }
  if (process.env.MERCHANT_REWARD_PRESET_LIVE_DB_E2E !== "1") {
    throw new Error(
      "Journey proof requires MERCHANT_REWARD_PRESET_LIVE_DB_E2E=1."
    )
  }
  if (process.env.PLAYWRIGHT_WORKERS !== "1") {
    throw new Error("Journey proof requires PLAYWRIGHT_WORKERS=1.")
  }
}

export async function installCustomerSession(
  context: BrowserContext,
  session: BrowserCustomerSession
): Promise<void> {
  await context.addCookies([
    {
      name: session.cookieName,
      value: session.cookieValue,
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146",
      httpOnly: true,
      sameSite: "Lax",
      expires: session.expiresAt,
    },
  ])
}

export async function copyMerchantSession(
  source: BrowserContext,
  destination: BrowserContext
): Promise<void> {
  const cookies = (await source.cookies()).filter(({ name }) =>
    /^sb-.+-auth-token(?:\.\d+)?$/.test(name)
  )
  if (cookies.length === 0) {
    throw new Error(
      "Merchant fixture did not create a Supabase cookie session."
    )
  }
  await destination.addCookies(cookies)
}

export async function seedDeliveryFixture(
  sql: Sql,
  merchant: MerchantRewardPresetLiveDbFixture
): Promise<DeliveryFixture> {
  const fixture = {
    campaignId: randomUUID(),
    providerMessageId: `msg_journey_${randomUUID()}`,
    recipientId: randomUUID(),
  }
  await sql`
    insert into public.loyalty_invite_campaigns
      (id, merchant_id, status, legal_basis, link_expires_at, confirmed_at)
    values
      (${fixture.campaignId}::uuid, ${merchant.merchantId}::uuid, 'sending',
       'venue_email_consent', now() + interval '30 days', now())`
  await sql`
    insert into public.loyalty_invite_recipients
      (id, campaign_id, merchant_id, email_hmac, email_ciphertext, email_masked,
       claim_token_hash, unsubscribe_token_hash, status, provider_message_id)
    values
      (${fixture.recipientId}::uuid, ${fixture.campaignId}::uuid,
       ${merchant.merchantId}::uuid, ${randomUUID().replaceAll("-", "")},
       'v1.cipher.tag.body', 'j***@example.test',
       ${randomUUID().replaceAll("-", "")},
       ${randomUUID().replaceAll("-", "")}, 'sent',
       ${fixture.providerMessageId})`
  return fixture
}

export async function postSignedDelivery(
  request: APIRequestContext,
  fixture: DeliveryFixture,
  webhookId: string
): Promise<number> {
  const body = JSON.stringify({
    type: "email.delivered",
    data: { email_id: fixture.providerMessageId },
  })
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const secret = requiredEnv("RESEND_WEBHOOK_SECRET")
    .replace(/^v1,/, "")
    .replace(/^whsec_/, "")
  const signature = createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`${webhookId}.${timestamp}.${body}`)
    .digest("base64")
  const response = await request.post("/api/resend/webhook", {
    headers: {
      "content-type": "application/json",
      "svix-id": webhookId,
      "svix-signature": `v1,${signature}`,
      "svix-timestamp": timestamp,
    },
    data: body,
  })
  return response.status()
}

export async function readDelivery(
  sql: Sql,
  fixture: DeliveryFixture
): Promise<DeliveryRow> {
  const rows = await sql<readonly DeliveryRow[]>`
    select status, delivered_at::text as delivered_at, updated_at::text as updated_at
    from public.loyalty_invite_recipients
    where id = ${fixture.recipientId}::uuid`
  const row = rows.at(0)
  if (!row) throw new Error("Delivery readback returned no recipient.")
  return row
}

export async function removeDeliveryFixture(
  sql: Sql,
  fixture: DeliveryFixture | undefined
): Promise<void> {
  if (!fixture) return
  await sql`
    delete from public.loyalty_invite_campaigns
    where id = ${fixture.campaignId}::uuid`
}

export async function rewardCounts(
  sql: Sql,
  fixture: MerchantRewardPresetLiveDbFixture
): Promise<Readonly<{ audits: number; events: number; rewards: number }>> {
  const rows = await sql<
    readonly {
      readonly audits: number
      readonly events: number
      readonly rewards: number
    }[]
  >`
    select
      (select count(*)::int from public.reward_pool_items
       where merchant_id = ${fixture.merchantId}::uuid) as rewards,
      (select count(*)::int from public.audit_logs
       where merchant_id = ${fixture.merchantId}::uuid
         and action = 'reward_pool_item_created') as audits,
      (select count(*)::int from public.product_events
       where merchant_id = ${fixture.merchantId}::uuid
         and event_name = 'reward_pool_item_created') as events`
  const counts = rows.at(0)
  if (!counts) throw new Error("Reward convergence readback returned no row.")
  return counts
}

export async function writeJourneyEvidence(
  name: string,
  value: unknown
): Promise<void> {
  await mkdir(EVIDENCE_ROOT, { recursive: true })
  await writeFile(
    resolve(EVIDENCE_ROOT, `${name}.json`),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  )
}

export async function writeJourneyScreenshot(
  page: Page,
  name: string
): Promise<void> {
  await mkdir(EVIDENCE_ROOT, { recursive: true })
  await page.screenshot({ path: resolve(EVIDENCE_ROOT, `${name}.png`) })
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Journey proof requires ${name}.`)
  return value
}
