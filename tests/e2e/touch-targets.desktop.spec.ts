import { expect, test, devices } from "@playwright/test"

/**
 * Touch-target floor guard.
 *
 * This exists because a sweep found six controls under 44px that no audit
 * finding, lint rule or contract test mentioned — including two standalone
 * navigation links at 20px, half the required target.
 *
 * It runs under a real device profile, NOT just a narrow viewport. Playwright's
 * default chromium context reports `pointer: fine` at any width, and this
 * codebase puts its floors behind `[@media(pointer:coarse)]:min-h-11`. Measured
 * without touch emulation, every `Button size="sm"` in the product looks like a
 * 36px defect and none of them are. The first version of this sweep reported 23
 * routes of failures and every one was wrong.
 */
// Geometry here depends on reduced motion, which the ROOT config guarantees via
// `use.contextOptions.reducedMotion: "reduce"`. Do not try to restate it here:
// playwright.config.ts documents that `contextOptions` wins over the
// `reducedMotion` test option, so a file-level `test.use({ reducedMotion })` is
// a silent no-op — I wrote one, and it was also a type error.
//
// It matters because the landing page's scroll-reveal sections rest at
// `transform: scale(0.98)` until revealed, which renders every 44px target
// inside them at 43.12px. An ad-hoc script without reduced motion reported
// exactly that false positive.
test.use({ ...devices["Pixel 5"] })

const ROUTES = [
  "/",
  "/pricing",
  "/loyalty-for-pubs",
  "/login",
  "/dev/app-harness/dashboard",
  "/dev/app-harness/account",
  "/dev/app-harness/launch",
  "/dev/app-harness/offers",
  "/dev/home-harness/home",
  // The admin console, which nothing had ever swept: /admin/* redirects to
  // /login, so its controls were measured for the first time through these
  // harnesses. Both routes carried real offences — a 36px page-jump input and
  // a 36px rows-per-page select in the shared paginator, and a 15px sortable
  // table header — on Pixel 5 AND on two tablet profiles.
  "/dev/admin-harness/audit-lookup",
  "/dev/app-harness/trial/admin-table-sort",
]

/**
 * Known, checked exceptions. Each is a decision or a false positive that was
 * verified individually — not a list of things to get round to.
 */
const ALLOWED = [
  // Documented in marketing-layout.tsx (05#47): WCAG 2.5.8's applicable floor
  // is 24px, these are low-frequency links, and 13 of them at 44px would add
  // ~572px of footer to every public page.
  "footer",
  // The <input> is 20x20 but its <label> is a clickable 66x333, so the actual
  // target is compliant. Verified in a browser.
  "input[type=checkbox]",
  // The design-system catalogue's own specimens of xs/sm controls. Exhibits.
  "/dev/design-system",
]

test("no touch target below 44px on core routes", async ({ page }) => {
  // Eleven routes, two sweeps, against a webpack dev server that may be cold.
  // A cold compile of /login alone spent 120s in `page.goto` and the sweep died
  // on the 180s default — a TIMEOUT, not a violation. `test.slow()` triples the
  // budget rather than trimming routes: a sweep that does not finish proves
  // nothing, and dropping a route to fit the clock would be measuring less
  // while appearing to pass. Warm: 18.5s and 22.5s. Cold: 2.2m and 2.3m.
  test.slow()
  await sweep(page)
})

/**
 * The same sweep on a TABLET-sized coarse pointer.
 *
 * A phone profile is not the only touch device the console meets: the admin
 * shell keeps its sidebar expanded at tablet widths, so its content column is
 * ~448px at 768px and ~664px at 712px, and the controls that wrap there are
 * not the ones that wrap on a 393px phone. Playwright reports `pointer: fine`
 * at any viewport width, so this needs a device profile too — a wide viewport
 * alone would silently measure the fine-pointer geometry and pass.
 */
test.describe("on a tablet-sized coarse pointer", () => {
  // The device descriptor minus `defaultBrowserType`: Playwright refuses a
  // `use({ defaultBrowserType })` inside a describe because it would force a
  // new worker, and the browser is the project's business anyway. Everything
  // that decides the measurement — viewport, `hasTouch`, `isMobile`, scale —
  // is kept.
  const tablet = { ...devices["Galaxy Tab S4"] }
  delete (tablet as { defaultBrowserType?: string }).defaultBrowserType
  test.use(tablet)

  test("no touch target below 44px on core routes", async ({ page }) => {
    // Eleven routes, two sweeps, against a webpack dev server that may be cold.
    // A cold compile of /login alone spent 120s in `page.goto` and the sweep died
    // on the 180s default — a TIMEOUT, not a violation. `test.slow()` triples the
    // budget rather than trimming routes: a sweep that does not finish proves
    // nothing, and dropping a route to fit the clock would be measuring less
    // while appearing to pass. Warm: 18.5s and 22.5s. Cold: 2.2m and 2.3m.
    test.slow()
    await sweep(page)
  })
})

async function sweep(page: import("@playwright/test").Page) {
  const offences: string[] = []

  for (const route of ROUTES) {
    const response = await page.goto(route, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    })
    // `page.goto` resolves to null for a same-document navigation, and under a
    // saturated worker pool that happens often enough to matter. Asserting on
    // `response?.status()` then throws "received value must be a number" — my
    // own guard failing for a reason that has nothing to do with what it
    // guards. Check the status when there is one, and otherwise check the
    // thing actually cared about: that a document rendered.
    if (response) {
      expect(response.status(), `${route} should render`).toBeLessThan(400)
    } else {
      const rendered = await page.evaluate(
        () =>
          document.readyState !== "loading" &&
          document.body.childElementCount > 0
      )
      expect(rendered, `${route} should render (no response object)`).toBe(true)
    }
    await page.waitForTimeout(800)

    const coarse = await page.evaluate(
      () => window.matchMedia("(pointer: coarse)").matches
    )
    // Fail loudly rather than quietly measuring the wrong media state.
    expect(coarse, "probe must run with a coarse pointer").toBe(true)

    const small = await page.evaluate(() => {
      const selector =
        "a[href],button,input:not([type=hidden]),select,summary,[role=button]"
      const out: { desc: string; h: number; w: number }[] = []
      for (const el of Array.from(document.querySelectorAll(selector))) {
        const rect = el.getBoundingClientRect()
        if (rect.width < 2 || rect.height < 2) continue
        if (el.closest("footer")) continue
        if (
          el.matches("input[type=checkbox]") ||
          el.matches("input[type=radio]")
        )
          continue
        // WCAG exempts a link inline in a sentence.
        if (el.tagName === "A" && el.closest("p")) continue
        if (rect.height >= 44 && rect.width >= 44) continue
        out.push({
          desc:
            el.tagName +
            " " +
            (el.textContent || "").trim().slice(0, 30) +
            " ." +
            String((el as HTMLElement).className || "").slice(0, 40),
          h: Math.round(rect.height),
          w: Math.round(rect.width),
        })
      }
      return out
    })

    for (const item of small) {
      if (ALLOWED.some((pattern) => item.desc.includes(pattern))) continue
      // The brand logo mark is 44x36 by design.
      if (item.desc.includes("Nabaperks") && item.h >= 44) continue
      offences.push(`${route} :: ${item.h}x${item.w} :: ${item.desc}`)
    }
  }

  expect(offences, offences.join("\n")).toEqual([])
}
