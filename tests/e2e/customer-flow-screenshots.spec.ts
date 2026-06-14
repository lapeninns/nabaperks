import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

import { expect, test, type Page } from "@playwright/test"

const phone = "07467586751"
const otpCode = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"
const outputRoot = "docs/screenshots/customer-flow"

type FlowStatus = {
  readonly membershipId: string | null
  readonly currentStampCount: number
  readonly latestReward: {
    readonly id: string
    readonly status: string
    readonly redeemableFrom: string | null
  } | null
}

test("captures the Bean & Batch QR to reward customer journey", async ({
  page,
}) => {
  runDemo("reset")
  await page.addInitScript(() => {
    window.localStorage.setItem("nabaperks:pwa-install-dismissed", "1")
  })

  await page.goto("/q/bean-test-qr")
  await expect(
    page.getByRole("heading", { name: "Keep your card on your phone" })
  ).toBeVisible()
  await capture(page, "01-join/01-join-hero.png")
  await page.getByRole("link", { name: "Get started" }).click()

  await page.getByLabel("Phone number").fill(phone)
  await capture(page, "01-join/02-phone-filled.png")
  await page.getByRole("button", { name: "Text me the code" }).click()
  await expect(
    page.getByText("Enter the verification code sent to your phone.")
  ).toBeVisible()
  await capture(page, "01-join/03-otp-sent.png")

  await page.getByLabel("Text code").fill(otpCode)
  await page.getByRole("button", { name: "Save my card" }).click()
  await expect(page.getByText("Loyalty terms", { exact: true })).toBeVisible()
  await capture(page, "01-join/04-terms.png")

  await page.locator('input[name="loyaltyTerms"]').check()
  await page.getByRole("button", { name: "Get my first stamp" }).click()
  await page.waitForURL(/\/card\/[^/]+\?.*stamp=issued/)
  await expect(page.getByText("Welcome to Bean & Batch.")).toBeVisible()
  await expect(page.getByRole("list", { name: "1 of 3 stamps earned" })).toBeVisible()
  await capture(page, "02-stamp-day-1/01-card-1-of-3.png")

  runDemo("advance", "--stamps", "1")
  await page.goto("/q/bean-test-qr")
  await expect(page.getByText("Ready to add today's stamp.")).toBeVisible()
  await capture(page, "03-stamp-day-2/01-confirm.png")
  await addStamp(page)
  await expect(page.getByRole("list", { name: "2 of 3 stamps earned" })).toBeVisible()
  await capture(page, "03-stamp-day-2/02-card-2-of-3.png")

  runDemo("advance", "--stamps", "2")
  await page.goto("/q/bean-test-qr")
  await expect(page.getByText("Ready to add today's stamp.")).toBeVisible()
  await capture(page, "04-stamp-day-3/01-confirm.png")
  await addStamp(page)
  await expect(page.getByRole("list", { name: "3 of 3 stamps earned" })).toBeVisible()
  await expect(
    page.getByText("Give it a day to breathe", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("It's yours from opening time tomorrow.", { exact: true })
  ).toBeVisible()
  await capture(page, "04-stamp-day-3/02-card-3-of-3-unlocked.png")

  const waitingStatus = readStatus()
  const rewardId = rewardIdFrom(waitingStatus)
  await page.goto(`/reward/${rewardId}`)
  await expect(
    page.getByText("Give it a day to breathe", { exact: true })
  ).toBeVisible()
  await capture(page, "05-reward-waiting/01-reward-waiting.png")

  runDemo("make-redeemable")
  await page.goto(`/reward/${rewardId}`)
  await expect(page.getByText("Ready to redeem.")).toBeVisible()
  await capture(page, "06-redeem/01-reward-ready.png")
  await page.getByRole("button", { name: "Redeem reward" }).click()
  // Redeeming lands on the reward-specific proof screen (unambiguous per reward).
  await page.waitForURL(/\/reward\/[^/]+\?redeemed=1/)
  await expect(page.getByText("Reward redeemed.")).toBeVisible()
  await capture(page, "06-redeem/02-reward-redeemed-proof.png")
})

async function addStamp(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add today's stamp" }).click()
  await page.waitForURL(/\/card\/[^/]+\?stamp=issued/)
  await expect(page.getByText("Stamp added.")).toBeVisible()
}

async function capture(page: Page, relativePath: string): Promise<void> {
  const target = join(outputRoot, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  await hideDevelopmentOverlay(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: target, fullPage: true })
}

async function hideDevelopmentOverlay(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-dev-overlay="true"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `,
  })

  await page.evaluate(() => {
    const selectors = "nextjs-portal, [data-nextjs-dev-overlay='true']"

    for (const element of document.querySelectorAll(selectors)) {
      element.setAttribute("aria-hidden", "true")

      if (element instanceof HTMLElement) {
        element.style.display = "none"
        element.style.visibility = "hidden"
      }
    }
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
    throw new Error("Expected unlocked reward after the third stamp.")
  }

  return status.latestReward.id
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
