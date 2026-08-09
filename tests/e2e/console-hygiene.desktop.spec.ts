import { expect, test } from "@playwright/test"

/**
 * A console-hygiene guard.
 *
 * This exists because a duplicate React key sat in `/dev/design-system` for the
 * whole redesign campaign — `RADIUS_TOKENS` listed `rounded-lg` twice, so the
 * radius catalogue under-documented its own scale — and no audit finding, lint
 * rule or contract test caught it. The browser had been saying so on every
 * render; nobody was reading.
 *
 * Deliberately `domcontentloaded` plus a short settle, not `networkidle`: in dev
 * the HMR socket and first-visit compilation make `networkidle` time out on
 * healthy pages. Seven routes "failed" that way on the first sweep and all seven
 * were fine (HTTP 200, correct h1, clean console).
 */
const ROUTES = [
  "/",
  "/pricing",
  "/how-it-works",
  "/faq",
  "/loyalty-for-pubs",
  "/dev/design-system",
  "/dev/home-harness/home",
  "/dev/app-harness/dashboard",
  "/dev/app-harness/states",
]

/** Dev-server noise, not application defects. */
const IGNORED = ["preloaded using link preload", "Download the React DevTools"]

test("no console errors or warnings on core routes", async ({ page }) => {
  const offences: string[] = []

  page.on("console", (message) => {
    const type = message.type()
    if (type !== "error" && type !== "warning") return
    const text = message.text()
    if (IGNORED.some((pattern) => text.includes(pattern))) return
    offences.push(`${page.url()} :: ${type} :: ${text.slice(0, 200)}`)
  })
  page.on("pageerror", (error) => {
    offences.push(
      `${page.url()} :: pageerror :: ${error.message.slice(0, 200)}`
    )
  })

  for (const route of ROUTES) {
    const response = await page.goto(route, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    })
    expect(response?.status(), `${route} should render`).toBeLessThan(400)
    await page.waitForTimeout(1500)
  }

  expect(offences, offences.join("\n")).toEqual([])
})
