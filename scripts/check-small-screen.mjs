#!/usr/bin/env node
/**
 * Small-screen containment check — PRODUCTION BUILD ONLY.
 *
 * A 320px defect on /loyalty-for-pubs cut the right edge off 65 elements and
 * every existing check was blind to it:
 *
 *   - the app shell is `overflow-x-clip`, so the page never grows a scrollbar
 *     and `documentElement.scrollWidth` stays exactly 320. The usual "no
 *     horizontal overflow" assertion cannot fail here.
 *   - `next dev --webpack`, which is what the Playwright harness runs, does not
 *     reproduce it. I wrote the e2e guard first, sabotaged the fix, and it
 *     passed twice against a freshly started dev server. So it lives here
 *     instead, against a built artefact, rather than shipping as an e2e spec
 *     that cannot fail.
 *
 * Usage — needs a production server already running:
 *
 *     pnpm build && PORT=3130 pnpm start &
 *     node scripts/check-small-screen.mjs
 *
 * Measured with this method: 65 elements past the viewport before the `min-w-0`
 * fix, 6 after. The residual 6 are three guide links (li + a) whose boxes end
 * at 329px while a Range measurement puts their rendered TEXT at 302px — the
 * dashed bottom rule overhangs, not content.
 */
import { chromium } from "@playwright/test"

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3130"
const WIDTH = 320
const ROUTES = [
  ["/", 0],
  ["/pricing", 0],
  ["/how-it-works", 0],
  ["/faq", 0],
  ["/loyalty-for-pubs", 6],
  ["/guides/best-loyalty-ideas-for-pubs", 0],
]

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: WIDTH, height: 812 })

const failures = []

for (const [route, budget] of ROUTES) {
  const response = await page.goto(BASE + route, { waitUntil: "load" })
  if (!response || response.status() >= 400) {
    failures.push(
      `${route}: HTTP ${response ? response.status() : "no response"}`
    )
    continue
  }
  await page.waitForTimeout(900)

  // Precondition. An unstyled page has no layout and cannot overflow, which is
  // exactly how I first "disproved" this defect — the control had rendered
  // with no CSS at all and reported zero.
  const styled = await page.evaluate(() => document.styleSheets.length > 0)
  if (!styled) {
    failures.push(
      `${route}: rendered with no stylesheets — measurement invalid`
    )
    continue
  }

  const past = await page.evaluate((viewportWidth) => {
    const out = []
    for (const el of document.querySelectorAll("h1,h2,h3,p,a,button,li")) {
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.right <= viewportWidth + 1) continue
      let parent = el.parentElement
      let inScroller = false
      while (parent) {
        const overflowX = getComputedStyle(parent).overflowX
        if (overflowX === "auto" || overflowX === "scroll") {
          inScroller = true
          break
        }
        parent = parent.parentElement
      }
      if (inScroller) continue
      out.push(
        `${el.tagName} right=${Math.round(box.right)} "${(el.textContent || "").trim().slice(0, 30)}"`
      )
    }
    return out
  }, WIDTH)

  if (past.length > budget) {
    failures.push(
      `${route}: ${past.length} elements past ${WIDTH}px (budget ${budget})\n    ` +
        past.slice(0, 6).join("\n    ")
    )
  }
}

await browser.close()

if (failures.length) {
  console.error(`✗ Small-screen containment failed at ${WIDTH}px:\n`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}

console.log(
  `✓ No content past the viewport at ${WIDTH}px (${ROUTES.length} routes)`
)
