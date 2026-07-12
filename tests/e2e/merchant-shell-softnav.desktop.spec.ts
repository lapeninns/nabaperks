import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test, type Page } from "@playwright/test"
import postgres from "postgres"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * Regression: the merchant `/app` shell lives in a single shared layout that the
 * App Router preserves across soft (client-side) navigations. When the shell's
 * variant was computed server-side from the request path, it went stale on soft
 * nav. The shell now derives its variant from `usePathname()`, which updates on
 * every navigation. These tests exercise real in-app links (soft nav), which is
 * the only way to reproduce the bug — a hard reload always re-renders correctly.
 */

const DEFAULT_SEED_MERCHANT_EMAIL = "mia@old-crown-girton.test"
const SEED_MERCHANT_PASSWORD = "NabaperksDemo1!"
const SEED_MERCHANT_SLUG = "old-crown-girton"
const LOCAL_DB_HOSTS = new Set(["127.0.0.1", "localhost"])

const fullShellControl = (page: Page) =>
  page.getByRole("button", { name: "Toggle navigation" }).first()
const setupAccountLink = (page: Page) =>
  page.getByRole("link", { name: "Account profile" })
const sidebarNav = (page: Page) =>
  page.getByRole("navigation", { name: "Merchant navigation" })

async function signIn(
  page: Page,
  next: string,
  rateLimitNonce: string
): Promise<void> {
  const email = await currentSeedMerchantEmail()

  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": localLoopbackIp(rateLimitNonce),
  })
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(SEED_MERCHANT_PASSWORD)
  await page.getByRole("button", { name: "Log in" }).click()
}

let seedMerchantEmail: Promise<string> | undefined

function currentSeedMerchantEmail(): Promise<string> {
  seedMerchantEmail ??= loadSeedMerchantEmail()
  return seedMerchantEmail
}

async function loadSeedMerchantEmail(): Promise<string> {
  const dbUrl = localDbUrl()
  if (!dbUrl) return DEFAULT_SEED_MERCHANT_EMAIL

  const sql = postgres(dbUrl, {
    idle_timeout: 5,
    max: 1,
  })

  try {
    const rows = await sql<readonly { readonly email: string }[]>`
      select users.email
      from public.merchants merchants
      join auth.users users on users.id = merchants.owner_user_id
      where merchants.business_slug = ${SEED_MERCHANT_SLUG}
      limit 1`

    return rows.at(0)?.email ?? DEFAULT_SEED_MERCHANT_EMAIL
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function localDbUrl(): string | undefined {
  const rawUrl =
    process.env.SUPABASE_DB_URL?.trim() ||
    readEnvValue(".env.local", "SUPABASE_DB_URL") ||
    readEnvValue(".env", "SUPABASE_DB_URL")
  if (!rawUrl) return undefined

  try {
    const dbUrl = new URL(rawUrl)
    if (dbUrl.protocol !== "postgres:" && dbUrl.protocol !== "postgresql:") {
      return undefined
    }
    return LOCAL_DB_HOSTS.has(dbUrl.hostname) ? rawUrl : undefined
  } catch {
    return undefined
  }
}

function readEnvValue(fileName: string, key: string): string | undefined {
  const path = join(process.cwd(), fileName)
  if (!existsSync(path)) return undefined

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex === -1) continue
    if (trimmed.slice(0, equalsIndex).trim() !== key) continue

    const value = trimmed.slice(equalsIndex + 1).trim()
    return value.replace(/^['"]|['"]$/g, "")
  }

  return undefined
}

function localLoopbackIp(nonce: string): string {
  const first = Number.parseInt(nonce.slice(0, 2), 16) || 1
  const second = Number.parseInt(nonce.slice(2, 4), 16) || 1
  return `127.${first}.${second}.1`
}

test.describe("merchant shell variant survives client-side navigation", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      process.env.ADMIN_LIVE_DB_E2E !== "1" || !localDbUrl(),
      "Set ADMIN_LIVE_DB_E2E=1 with disposable local Supabase to run merchant soft-navigation proof"
    )
    await dismissPwaInstall(page)
  })

  test("full -> launch: sidebar stays when navigating to /app/launch", async ({
    page,
  }) => {
    await signIn(page, "/app", "a101")
    await page.waitForURL((url) => url.pathname === "/app")
    await expect(fullShellControl(page)).toBeVisible()
    await expect(setupAccountLink(page)).toHaveCount(0)

    // Soft navigation via the in-app sidebar "Setup" link (no full reload).
    await sidebarNav(page).getByRole("link", { name: "Setup" }).click()
    await page.waitForURL((url) => url.pathname === "/app/launch")

    await expect(fullShellControl(page)).toBeVisible()
    await expect(setupAccountLink(page)).toHaveCount(0)
  })

  test("launch -> full: sidebar stays when navigating back to /app", async ({
    page,
  }) => {
    await signIn(page, "/app/launch", "b202")
    await page.waitForURL((url) => url.pathname === "/app/launch")
    await expect(fullShellControl(page)).toBeVisible()
    await expect(setupAccountLink(page)).toHaveCount(0)

    await sidebarNav(page).getByRole("link", { name: "Dashboard" }).click()
    await page.waitForURL((url) => url.pathname === "/app")

    await expect(fullShellControl(page)).toBeVisible()
    await expect(setupAccountLink(page)).toHaveCount(0)
  })
})
