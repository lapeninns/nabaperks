# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: customer-flow-screenshots.spec.ts >> captures the Bean & Batch QR to reward customer journey
- Location: tests/e2e/customer-flow-screenshots.spec.ts:21:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Stamp added.')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('Stamp added.')

```

```yaml
- main:
  - text: nabaperks Bean & Batch
  - heading "Morning Ritual Mystery Card" [level=1]
  - link "Your cards":
    - /url: /home
  - separator
  - list "3 of 3 stamps earned":
    - listitem:
      - img "Stamp 1 earned, 12 JUN": 12 JUN
    - listitem:
      - img "Stamp 2 earned, 13 JUN": 13 JUN
    - listitem:
      - img "Stamp 3 earned, 14 JUN": 14 JUN
  - region "Card complete":
    - img "Mystery reward, sealed"
    - paragraph: That's the full card.
    - paragraph: Your reward is yours from opening time on the next UK business day.
  - region "Reward":
    - text: Your reward
    - heading "Cake slice" [level=3]
    - text: Ready · 15 JUN
    - img "Reward unlocked, resting until it's ready"
    - text: Unlocked
  - alert: Give it a day to breathe It's yours from opening time tomorrow.
  - group: Card details
- navigation "Home navigation":
  - link "Home":
    - /url: /home
    - img
    - text: Home
  - link "Rewards":
    - /url: /home/rewards
    - img
    - text: Rewards
  - link "Activity":
    - /url: /home/activity
    - img
    - text: Activity
  - link "Profile":
    - /url: /home/profile
    - img
    - text: Profile
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1   | import { execFileSync } from "node:child_process"
  2   | import { mkdirSync } from "node:fs"
  3   | import { dirname, join } from "node:path"
  4   | 
  5   | import { expect, test, type Page } from "@playwright/test"
  6   | 
  7   | const phone = "07467586751"
  8   | const otpCode = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"
  9   | const outputRoot = "docs/screenshots/customer-flow"
  10  | 
  11  | type FlowStatus = {
  12  |   readonly membershipId: string | null
  13  |   readonly currentStampCount: number
  14  |   readonly latestReward: {
  15  |     readonly id: string
  16  |     readonly status: string
  17  |     readonly redeemableFrom: string | null
  18  |   } | null
  19  | }
  20  | 
  21  | test("captures the Bean & Batch QR to reward customer journey", async ({
  22  |   page,
  23  | }) => {
  24  |   runDemo("reset")
  25  |   await page.addInitScript(() => {
  26  |     window.localStorage.setItem("nabaperks:pwa-install-dismissed:v2", "1")
  27  |   })
  28  | 
  29  |   await page.goto("/q/bean-test-qr")
  30  |   await expect(
  31  |     page.getByRole("heading", { name: "Keep your card on your phone" })
  32  |   ).toBeVisible()
  33  |   await capture(page, "01-join/01-join-hero.png")
  34  |   await page.getByRole("link", { name: "Get started" }).click()
  35  | 
  36  |   await page.getByLabel("Phone number").fill(phone)
  37  |   await capture(page, "01-join/02-phone-filled.png")
  38  |   await page.getByRole("button", { name: "Text me the code" }).click()
  39  |   await expect(
  40  |     page.getByText("Enter the verification code sent to your phone.")
  41  |   ).toBeVisible()
  42  |   await capture(page, "01-join/03-otp-sent.png")
  43  | 
  44  |   await page.getByLabel("Text code").fill(otpCode)
  45  |   await page.getByRole("button", { name: "Save my card" }).click()
  46  |   await expect(page.getByText("Loyalty terms", { exact: true })).toBeVisible()
  47  |   await capture(page, "01-join/04-terms.png")
  48  | 
  49  |   await page.locator('input[name="loyaltyTerms"]').check()
  50  |   await page.getByRole("button", { name: "Get my first stamp" }).click()
  51  |   await page.waitForURL(/\/card\/[^/]+\?.*stamp=issued/)
  52  |   await expect(page.getByText("Welcome to Bean & Batch.")).toBeVisible()
  53  |   await expect(page.getByRole("list", { name: "1 of 3 stamps earned" })).toBeVisible()
  54  |   await capture(page, "02-stamp-day-1/01-card-1-of-3.png")
  55  | 
  56  |   runDemo("advance", "--stamps", "1")
  57  |   await page.goto("/q/bean-test-qr")
  58  |   await expect(page.getByText("Ready to add today's stamp.")).toBeVisible()
  59  |   await capture(page, "03-stamp-day-2/01-confirm.png")
  60  |   await addStamp(page)
  61  |   await expect(page.getByRole("list", { name: "2 of 3 stamps earned" })).toBeVisible()
  62  |   await capture(page, "03-stamp-day-2/02-card-2-of-3.png")
  63  | 
  64  |   runDemo("advance", "--stamps", "2")
  65  |   await page.goto("/q/bean-test-qr")
  66  |   await expect(page.getByText("Ready to add today's stamp.")).toBeVisible()
  67  |   await capture(page, "04-stamp-day-3/01-confirm.png")
  68  |   await addStamp(page)
  69  |   await expect(page.getByRole("list", { name: "3 of 3 stamps earned" })).toBeVisible()
  70  |   await expect(
  71  |     page.getByText("Give it a day to breathe", { exact: true })
  72  |   ).toBeVisible()
  73  |   await expect(
  74  |     page.getByText("It's yours from opening time tomorrow.", { exact: true })
  75  |   ).toBeVisible()
  76  |   await capture(page, "04-stamp-day-3/02-card-3-of-3-unlocked.png")
  77  | 
  78  |   const waitingStatus = readStatus()
  79  |   const rewardId = rewardIdFrom(waitingStatus)
  80  |   await page.goto(`/reward/${rewardId}`)
  81  |   await expect(
  82  |     page.getByText("Give it a day to breathe", { exact: true })
  83  |   ).toBeVisible()
  84  |   await capture(page, "05-reward-waiting/01-reward-waiting.png")
  85  | 
  86  |   runDemo("make-redeemable")
  87  |   await page.goto(`/reward/${rewardId}`)
  88  |   await expect(page.getByText("Ready to redeem.")).toBeVisible()
  89  |   await capture(page, "06-redeem/01-reward-ready.png")
  90  |   await page.getByRole("button", { name: "Redeem reward" }).click()
  91  |   // Redeeming lands on the reward-specific proof screen (unambiguous per reward).
  92  |   await page.waitForURL(/\/reward\/[^/]+\?redeemed=1/)
  93  |   await expect(page.getByText("Reward redeemed.")).toBeVisible()
  94  |   await capture(page, "06-redeem/02-reward-redeemed-proof.png")
  95  | })
  96  | 
  97  | async function addStamp(page: Page): Promise<void> {
  98  |   await page.getByRole("button", { name: "Add today's stamp" }).click()
  99  |   await page.waitForURL(/\/card\/[^/]+\?stamp=issued/)
> 100 |   await expect(page.getByText("Stamp added.")).toBeVisible()
      |                                                ^ Error: expect(locator).toBeVisible() failed
  101 | }
  102 | 
  103 | async function capture(page: Page, relativePath: string): Promise<void> {
  104 |   const target = join(outputRoot, relativePath)
  105 |   mkdirSync(dirname(target), { recursive: true })
  106 |   await hideDevelopmentOverlay(page)
  107 |   await page.waitForTimeout(500)
  108 |   await page.screenshot({ path: target, fullPage: true })
  109 | }
  110 | 
  111 | async function hideDevelopmentOverlay(page: Page): Promise<void> {
  112 |   await page.addStyleTag({
  113 |     content: `
  114 |       nextjs-portal,
  115 |       [data-nextjs-dev-overlay="true"] {
  116 |         display: none !important;
  117 |         visibility: hidden !important;
  118 |         opacity: 0 !important;
  119 |         pointer-events: none !important;
  120 |       }
  121 |     `,
  122 |   })
  123 | 
  124 |   await page.evaluate(() => {
  125 |     const selectors = "nextjs-portal, [data-nextjs-dev-overlay='true']"
  126 | 
  127 |     for (const element of document.querySelectorAll(selectors)) {
  128 |       element.setAttribute("aria-hidden", "true")
  129 | 
  130 |       if (element instanceof HTMLElement) {
  131 |         element.style.display = "none"
  132 |         element.style.visibility = "hidden"
  133 |       }
  134 |     }
  135 |   })
  136 | }
  137 | 
  138 | function runDemo(command: string, ...args: readonly string[]): void {
  139 |   execFileSync(
  140 |     process.execPath,
  141 |     ["scripts/customer-flow-demo.mjs", command, "--phone", phone, ...args],
  142 |     {
  143 |       stdio: "inherit",
  144 |       env: { ...process.env, CUSTOMER_DEV_OTP_CODE: otpCode },
  145 |     }
  146 |   )
  147 | }
  148 | 
  149 | function readStatus(): FlowStatus {
  150 |   const output = execFileSync(
  151 |     process.execPath,
  152 |     ["scripts/customer-flow-demo.mjs", "status", "--phone", phone, "--json"],
  153 |     { encoding: "utf8" }
  154 |   )
  155 |   const parsed: unknown = JSON.parse(output)
  156 | 
  157 |   if (!isRecord(parsed))
  158 |     throw new Error("Unexpected customer-flow status payload.")
  159 | 
  160 |   return {
  161 |     membershipId: nullableString(parsed.membershipId),
  162 |     currentStampCount: numberValue(parsed.currentStampCount),
  163 |     latestReward: rewardValue(parsed.latestReward),
  164 |   }
  165 | }
  166 | 
  167 | function rewardIdFrom(status: FlowStatus): string {
  168 |   if (!status.latestReward?.id) {
  169 |     throw new Error("Expected unlocked reward after the third stamp.")
  170 |   }
  171 | 
  172 |   return status.latestReward.id
  173 | }
  174 | 
  175 | function rewardValue(value: unknown): FlowStatus["latestReward"] {
  176 |   if (!isRecord(value)) return null
  177 | 
  178 |   return {
  179 |     id: stringValue(value.id),
  180 |     status: stringValue(value.status),
  181 |     redeemableFrom: nullableString(value.redeemableFrom),
  182 |   }
  183 | }
  184 | 
  185 | function isRecord(value: unknown): value is Record<string, unknown> {
  186 |   return typeof value === "object" && value !== null && !Array.isArray(value)
  187 | }
  188 | 
  189 | function stringValue(value: unknown): string {
  190 |   if (typeof value !== "string" || !value) {
  191 |     throw new Error("Expected a non-empty string.")
  192 |   }
  193 | 
  194 |   return value
  195 | }
  196 | 
  197 | function nullableString(value: unknown): string | null {
  198 |   return typeof value === "string" ? value : null
  199 | }
  200 | 
```