import { expect, test } from "@playwright/test"

const FUNNEL_PATH = "/api/analytics/funnel"

test.describe("root analytics non-OK response handling", () => {
  test.use({
    serviceWorkers: "block",
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  })

  test("a 503 analytics response settles without delaying the root page", async ({
    page,
  }, testInfo) => {
    const startedAt = Date.now()
    const timeline: Array<{ atMs: number; kind: string; detail?: string }> = []
    const add = (kind: string, detail?: string) => {
      timeline.push({ atMs: Date.now() - startedAt, kind, detail })
    }
    const pageErrors: string[] = []
    const unexpectedConsoleErrors: string[] = []
    let analyticsStatus: number | null = null
    let settledAt: number | null = null

    page.on("response", (response) => {
      if (new URL(response.url()).pathname !== FUNNEL_PATH) return
      analyticsStatus = response.status()
      add("analytics-response", String(response.status()))
    })
    page.on("requestfinished", (request) => {
      if (new URL(request.url()).pathname !== FUNNEL_PATH) return
      settledAt = Date.now() - startedAt
      add("analytics-requestfinished")
    })
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).pathname !== FUNNEL_PATH) return
      settledAt = Date.now() - startedAt
      add("analytics-requestfailed", request.failure()?.errorText)
    })
    page.on("pageerror", (error) => pageErrors.push(error.message))
    page.on("console", (message) => {
      if (message.type() !== "error") return
      if (message.text().includes("server responded with a status of 503"))
        return
      unexpectedConsoleErrors.push(message.text())
    })

    const root = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(root?.status()).toBe(200)
    await expect.poll(() => analyticsStatus, { timeout: 5_000 }).toBe(503)
    await expect.poll(() => settledAt, { timeout: 5_000 }).not.toBeNull()
    await page.waitForLoadState("networkidle", { timeout: 5_000 })
    await expect(page.locator("main")).toBeVisible()
    expect(pageErrors).toEqual([])
    expect(unexpectedConsoleErrors).toEqual([])

    await page.screenshot({
      path: testInfo.outputPath("root-analytics-503-settled.png"),
      fullPage: true,
    })
    await testInfo.attach("analytics-lifecycle", {
      body: JSON.stringify(timeline),
      contentType: "application/json",
    })
  })
})
