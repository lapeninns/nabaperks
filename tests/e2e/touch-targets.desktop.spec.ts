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
// `reducedMotion` explicitly, not just inherited from the config: the landing
// page's scroll-reveal sections rest at `transform: scale(0.98)` until they are
// revealed, which renders every 44px target inside them at 43.12px. Measured
// that exact false positive with an ad-hoc script that omitted this. With
// motion reduced the reveals are instant and geometry is honest.
test.use({ ...devices["Pixel 5"], reducedMotion: "reduce" })

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
  const offences: string[] = []

  for (const route of ROUTES) {
    const response = await page.goto(route, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    })
    expect(response?.status(), `${route} should render`).toBeLessThan(400)
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
})
