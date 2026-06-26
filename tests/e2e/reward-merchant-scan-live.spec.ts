import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test, type Page } from "@playwright/test"

import postgres from "postgres"

/**
 * Live, browser-level proof of the merchant-scanned reward collection loop.
 *
 * The customer keeps their own phone and only ever *shows* a QR; the merchant is
 * the sole mutation. This spec drives a real customer to a redeemable reward via
 * the proven `scripts/customer-flow-demo.mjs` harness (the same mechanism as
 * `customer-flow-screenshots.spec.ts`), then:
 *
 *   1. opens `/reward/<rewardId>` and confirms the live collection QR with no
 *      customer-operated redeem/collect control,
 *   2. mints + reads the one-time `reward_scan_tokens.id` (the QR encodes
 *      `/r/<scanToken>`, distinct from `reward_events.id`),
 *   3. logs the owning merchant in, scans `/r/<scanToken>` and marks the reward
 *      collected,
 *   4. asserts the customer page updates to the collected proof *via polling*
 *      (no manual reload), and that the status endpoint is `no-store` and
 *      `redeemed: true`.
 *
 * Setup writes against the live DB, so the test is gated on `SUPABASE_DB_URL`
 * being resolvable (env or .env.local) exactly like the demo harness.
 */

// A distinct, libphonenumber-valid GB mobile so this spec never races the demo
// phone (07467586751) that customer-flow-screenshots resets/drives in parallel.
const phone = "07512345678"
const otpCode = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"

const merchantEmail = "mia@old-crown-girton.test"
const merchantPassword = "NabaperksDemo1!"

type FlowStatus = {
  readonly membershipId: string | null
  readonly currentStampCount: number
  readonly latestReward: {
    readonly id: string
    readonly status: string
    readonly redeemableFrom: string | null
  } | null
}

test("a held reward is merchant-scanned and the customer page updates live", async ({
  browser,
}) => {
  // --- Setup: drive a real customer to a redeemable reward -----------------
  runDemo("reset")

  const customer = await browser.newContext()
  const customerPage = await customer.newPage()
  await customerPage.addInitScript(() => {
    window.localStorage.setItem("nabaperks:pwa-install-dismissed:v2", "1")
  })

  await joinWithFirstStamp(customerPage)

  runDemo("advance", "--stamps", "1")
  await customerPage.goto("/q/old-crown-girton")
  await addStamp(customerPage, { outcome: "stamp-added" })
  await expect(
    customerPage.getByRole("list", { name: "2 of 3 stamps earned" })
  ).toBeVisible()

  runDemo("advance", "--stamps", "2")
  await customerPage.goto("/q/old-crown-girton")
  await addStamp(customerPage, { outcome: "full-card" })
  await expect(
    customerPage.getByRole("list", { name: "3 of 3 stamps earned" })
  ).toBeVisible()

  const rewardId = rewardIdFrom(readStatus())

  // make-redeemable moves `redeemable_from` to today's UK business date so the
  // reward QR mints and the ready state renders.
  runDemo("make-redeemable")

  // --- Customer reward screen: live QR, no customer redeem control ----------
  await customerPage.goto(`/reward/${rewardId}`)

  // The ready reward gates on profile completion before exposing the QR. Fill
  // the gate the same way the shipped screenshots flow does.
  await expect(
    customerPage.getByText("A few details before this one's yours")
  ).toBeVisible()
  await customerPage.getByLabel("Full name").fill("Sam Taylor")
  await customerPage.getByLabel("Date of birth").fill("1990-01-01")
  await customerPage.getByRole("button", { name: "Save my details" }).click()

  await expect(customerPage.getByText("Ready for merchant scan.")).toBeVisible()
  await expect(customerPage.getByText("Merchant scans this QR")).toBeVisible()
  await expect(
    customerPage.getByRole("img", { name: /QR code for collecting/ })
  ).toBeVisible()

  // The only customer control opens / shows the QR — there is no customer-
  // operated redeem or collect button. The merchant scan is the sole mutation.
  await expect(
    customerPage.getByRole("button", { name: /redeem|collect reward/i })
  ).toHaveCount(0)

  // --- Mint + read the one-time scan token (distinct from reward_events.id) --
  // Loading the QR PNG in the customer context (cookie attached) mints a
  // `reward_scan_tokens` row; its id is the scan token the QR encodes.
  const qrResponse = await customerPage.request.get(
    `/reward/${rewardId}/qr.png`
  )
  expect(qrResponse.status()).toBe(200)

  const scanToken = await readLatestScanToken(rewardId)
  expect(scanToken).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  )
  // The scan token is NOT the reward id — the QR target is a separate handle.
  expect(scanToken).not.toBe(rewardId)

  // --- Merchant context: scan the token and mark the reward collected -------
  const merchant = await browser.newContext()
  const merchantPage = await merchant.newPage()
  // Dismiss the PWA install prompt — its fixed banner otherwise intercepts the
  // "Mark reward collected" button on the merchant scan page.
  await merchantPage.addInitScript(() => {
    window.localStorage.setItem("nabaperks:pwa-install-dismissed:v2", "1")
  })

  await signInMerchant(merchantPage)

  await merchantPage.goto(`/r/${scanToken}`)
  // /r/<token> validates the UUID and redirects into the merchant scan page,
  // whose route param IS the scan token.
  await merchantPage.waitForURL(
    new RegExp(`/app/rewards/scan/${escapeRegExp(scanToken)}(?:\\?|$)`)
  )
  await expect(
    merchantPage.getByRole("heading", { name: "Check and collect reward" })
  ).toBeVisible()
  const merchantScanMain = merchantPage.getByRole("main")
  const collectButton = merchantScanMain.getByRole("button", {
    name: "Mark reward collected",
  })

  await expect(
    merchantScanMain.getByText("Ready to collect", { exact: true })
  ).toBeVisible()
  await expect(collectButton).toBeVisible()

  await collectButton.click()

  // The action redirects to `?collected=1`; the page shows the collected banner.
  // Match with a regex so the literal `?` is not treated as a glob wildcard.
  await merchantPage.waitForURL(
    new RegExp(`/app/rewards/scan/${escapeRegExp(scanToken)}\\?collected=1`)
  )
  await expect(
    merchantPage.getByText("Reward collected", { exact: true })
  ).toBeVisible()

  // --- Customer page updates live (no reload) -------------------------------
  // RewardCollectionLive polls the no-store status endpoint every ~1.5s and
  // refreshes the server component once the reward reads redeemed. We do NOT
  // call reload(); the collected proof must arrive on its own.
  await expect(customerPage.getByText("Reward collected.")).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    customerPage.getByText(
      "The merchant has scanned your QR. A new stamp cycle has started."
    )
  ).toBeVisible()

  // --- Status endpoint contract: no-store + redeemed ------------------------
  // Use the customer context's request so the session cookie is attached.
  const statusResponse = await customerPage.request.get(
    `/reward/${rewardId}/status`
  )
  expect(statusResponse.status()).toBe(200)
  expect(statusResponse.headers()["cache-control"]).toContain("no-store")

  const statusBody = (await statusResponse.json()) as {
    redeemed?: boolean
    status?: string
  }
  expect(statusBody.redeemed).toBe(true)
  expect(statusBody.status).toBe("redeemed")

  await customer.close()
  await merchant.close()
})

async function joinWithFirstStamp(page: Page): Promise<void> {
  await page.goto("/q/old-crown-girton")
  await expect(
    page.getByRole("heading", { name: "Keep your card on your phone" })
  ).toBeVisible()
  await page.getByRole("link", { name: "Get today's stamp" }).click()

  await page.getByLabel("Phone number").fill(phone)
  await page.getByRole("button", { name: "Text me the code" }).click()
  await expect(
    page.getByText("Enter the verification code sent to your phone.")
  ).toBeVisible()

  await page.getByLabel("Text code").fill(otpCode)
  await page.getByRole("button", { name: "Save my card" }).click()
  await expect(page.getByText("Loyalty terms", { exact: true })).toBeVisible()

  await page.locator('input[name="loyaltyTerms"]').check()
  await page.getByRole("button", { name: "Get my first stamp" }).click()
  await page.waitForURL(/\/card\/[^/]+\?.*(stamp=issued|welcome=1)/)
  await expect(
    page.getByRole("list", { name: "1 of 3 stamps earned" })
  ).toBeVisible()
}

async function signInMerchant(page: Page): Promise<void> {
  await page.goto("/login")
  await page.locator('input[name="email"]').fill(merchantEmail)
  await page.locator('input[name="password"]').fill(merchantPassword)
  // The server-action login form renders action="" and relies on JS, so a submit
  // click before hydration is silently dropped. Retry until sign-in lands on the
  // merchant console.
  await expect(async () => {
    if (new URL(page.url()).pathname === "/login") {
      await page.getByRole("button", { name: "Log in" }).click()
    }
    await page.waitForURL(/\/app(?:[/?#]|$)/, { timeout: 4000 })
  }).toPass({ timeout: 30000 })
}

async function addStamp(
  page: Page,
  { outcome }: { readonly outcome: "stamp-added" | "full-card" }
): Promise<void> {
  await expect(
    page.getByRole("button", { name: "Add today's stamp" })
  ).toBeVisible()
  await holdStampButton(page)

  if (outcome === "stamp-added") {
    await expect(page.getByText("Stamp added.").first()).toBeVisible()
  } else {
    await expect(
      page.getByText("That's the full card.", { exact: true })
    ).toBeVisible()
  }
}

async function holdStampButton(page: Page): Promise<void> {
  const stampButton = page.getByRole("button", { name: "Add today's stamp" })
  await stampButton.evaluate(async (element) => {
    element.scrollIntoView({ block: "center", inline: "center" })

    const down = {
      bubbles: true,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    }

    element.dispatchEvent(new PointerEvent("pointerdown", down))
    await new Promise((resolve) => setTimeout(resolve, 750))
    element.dispatchEvent(
      new PointerEvent("pointerup", { ...down, buttons: 0 })
    )
  })
}

function runDemo(command: string, ...args: readonly string[]): void {
  execFileSync(
    process.execPath,
    ["scripts/customer-flow-demo.mjs", command, "--phone", phone, ...args],
    {
      stdio: "inherit",
      env: { ...process.env, CUSTOMER_DEV_OTP_CODE: otpCode },
    }
  )
}

function readStatus(): FlowStatus {
  const output = execFileSync(
    process.execPath,
    ["scripts/customer-flow-demo.mjs", "status", "--phone", phone, "--json"],
    { encoding: "utf8" }
  )
  const parsed: unknown = JSON.parse(output)

  if (!isRecord(parsed))
    throw new Error("Unexpected customer-flow status payload.")

  return {
    membershipId: nullableString(parsed.membershipId),
    currentStampCount: numberValue(parsed.currentStampCount),
    latestReward: rewardValue(parsed.latestReward),
  }
}

function rewardIdFrom(status: FlowStatus): string {
  if (!status.latestReward?.id) {
    throw new Error("Expected an unlocked reward after the third stamp.")
  }

  return status.latestReward.id
}

/**
 * Reads the newest scan token minted for the reward. Mirrors the demo harness'
 * direct-Postgres access (`postgres` package, `SUPABASE_DB_URL`), resolving the
 * connection from .env.local / .env / process.env so it matches the local stack.
 */
async function readLatestScanToken(rewardId: string): Promise<string> {
  const dbUrl = resolveDbUrl()
  if (!dbUrl) {
    throw new Error(
      "SUPABASE_DB_URL is required to read the minted reward scan token."
    )
  }

  const sql = postgres(dbUrl, {
    max: 1,
    ssl: isSupabaseHost(dbUrl) ? "require" : undefined,
  })

  try {
    const rows = await sql<{ id: string }[]>`
      select id
      from public.reward_scan_tokens
      where reward_event_id = ${rewardId}
      order by created_at desc
      limit 1
    `
    const id = rows[0]?.id
    if (!id) {
      throw new Error("No reward scan token was minted for this reward.")
    }

    return id
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function isSupabaseHost(dbUrl: string): boolean {
  try {
    const hostname = new URL(dbUrl).hostname.toLowerCase()
    return hostname === "supabase.com" || hostname.endsWith(".supabase.com")
  } catch {
    return false
  }
}

function resolveDbUrl(): string {
  const envFiles = {
    ...readEnvFile(join(process.cwd(), ".env")),
    ...readEnvFile(join(process.cwd(), ".env.local")),
    ...process.env,
  }

  return envFiles.SUPABASE_DB_URL?.trim() ?? ""
}

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {}

  const parsed: Record<string, string> = {}

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    parsed[key] = unquote(trimmed.slice(equalsIndex + 1).trim())
  }

  return parsed
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function rewardValue(value: unknown): FlowStatus["latestReward"] {
  if (!isRecord(value)) return null

  return {
    id: stringValue(value.id),
    status: stringValue(value.status),
    redeemableFrom: nullableString(value.redeemableFrom),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  if (typeof value !== "string" || !value) {
    throw new Error("Expected a non-empty string.")
  }

  return value
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function numberValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Expected a finite number.")
  }

  return value
}
