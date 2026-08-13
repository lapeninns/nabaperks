import { expect, test } from "@playwright/test"

/**
 * The admin lookup bar at the widths nobody could see it (ADM 04#26,
 * NEEDS-SIGNOFF 44).
 *
 * `/admin/*` redirects to `/login`, so the audit trail's four-control sticky
 * bar — venue + an inclusive from/to pair + Search/Clear — had never been
 * looked at, at any width. It is measured here through
 * `/dev/admin-harness/audit-lookup`, which mounts the REAL
 * `AdminLookupControls` with the REAL props the audit page passes it, inside
 * the REAL `AdminShell`. Nothing is re-implemented: the shell's own width
 * chain (sidebar + SidebarInset + the px-4/sm:px-6/lg:px-8 ramp +
 * max-w-merchant) is what decides how this bar wraps, so measuring it under
 * any other container would measure a different component.
 *
 * What it found: below `md` the shell shows a `sticky top-0 z-30` header, and
 * this bar was `sticky top-0 z-20`. The bar slid UNDER the header, and
 * `document.elementFromPoint` at the centre of the venue input returned the
 * HEADER at both 390px and 767px — the one control the sticky bar exists to
 * keep reachable was neither visible nor hittable once the list scrolled.
 *
 * Anchors are code-guaranteed (`form[role="search"]`, `input[name=…]`), never
 * copy, and `document.styleSheets.length > 0` is asserted first: an unstyled
 * page has no layout and will agree with any geometry claim.
 */

const HARNESS = "/dev/admin-harness/audit-lookup"

async function openHarness(page: import("@playwright/test").Page) {
  const response = await page.goto(HARNESS, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  })
  if (response) {
    expect(response.status(), `${HARNESS} should render`).toBeLessThan(400)
  }
  await page.waitForTimeout(500)
  const styled = await page.evaluate(() => document.styleSheets.length > 0)
  expect(styled, "the harness must render with stylesheets").toBe(true)
  await expect(page.locator('form[role="search"]')).toBeVisible()
}

/** Scroll well past the panel header and report what the sticky bar does. */
async function stickyState(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    window.scrollTo(0, 1200)
    await new Promise((resolve) => setTimeout(resolve, 300))
    const form = document.querySelector('form[role="search"]')!
    const venue = document.querySelector<HTMLInputElement>(
      'input[name="venue"]'
    )!
    const header = document.querySelector("header")
    const headerVisible = Boolean(
      header && header.getBoundingClientRect().height > 0
    )
    const box = venue.getBoundingClientRect()
    const painted = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2
    )
    return {
      formTop: Math.round(form.getBoundingClientRect().top),
      headerBottom: header
        ? Math.round(header.getBoundingClientRect().bottom)
        : 0,
      headerVisible,
      venueIsPainted: painted === venue,
      paintedTag: painted ? painted.tagName : "(nothing)",
    }
  })
}

/** Anything inside the bar that reaches past its own panel. */
async function overflowingControls(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const form = document.querySelector('form[role="search"]')!
    const panel = form.closest("section")!
    const bounds = panel.getBoundingClientRect()
    return Array.from(form.querySelectorAll("*"))
      .map((element) => [element, element.getBoundingClientRect()] as const)
      .filter(
        ([, box]) =>
          box.width > 0 &&
          (box.right > bounds.right + 0.5 || box.left < bounds.left - 0.5)
      )
      .map(
        ([element, box]) =>
          `${element.tagName} ${Math.round(box.left)}..${Math.round(box.right)} outside panel ${Math.round(bounds.left)}..${Math.round(bounds.right)}`
      )
  })
}

for (const width of [1280, 1024, 768]) {
  test(`the audit lookup bar stays inside its panel and sticks to the top at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await openHarness(page)

    expect(await overflowingControls(page)).toEqual([])

    const sticky = await stickyState(page)
    // At and above `md` the shell's mobile header is `hidden`, so the bar's
    // own offset is 0 and nothing can occlude it.
    expect(sticky.headerVisible).toBe(false)
    expect(sticky.formTop).toBe(0)
    expect(
      sticky.venueIsPainted,
      `the venue input is covered by ${sticky.paintedTag}`
    ).toBe(true)
  })
}

for (const width of [767, 390]) {
  test(`the audit lookup bar clears the console header at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await openHarness(page)

    expect(await overflowingControls(page)).toEqual([])

    const sticky = await stickyState(page)
    // Below `md` the shell's own sticky header is shown. The bar must come to
    // rest against its bottom edge, not underneath it.
    expect(sticky.headerVisible).toBe(true)
    expect(sticky.headerBottom).toBeGreaterThan(0)
    expect(Math.abs(sticky.formTop - sticky.headerBottom)).toBeLessThanOrEqual(
      1
    )
    expect(
      sticky.venueIsPainted,
      `the venue input is covered by ${sticky.paintedTag}`
    ).toBe(true)
  })
}

test.describe("on a coarse pointer", () => {
  // A viewport width is not a touch device: Playwright reports `pointer: fine`
  // at any width, and the console's compact controls only grow behind
  // `[@media(pointer:coarse)]`. `hasTouch` is what changes the media state.
  test.use({ hasTouch: true, viewport: { width: 1024, height: 800 } })

  test("every control in the admin lookup and paging rows meets the 44px floor", async ({
    page,
  }) => {
    await openHarness(page)

    const coarse = await page.evaluate(
      () => window.matchMedia("(pointer: coarse)").matches
    )
    expect(coarse, "probe must run with a coarse pointer").toBe(true)

    const small = await page.evaluate(() => {
      const selector =
        "a[href],button,input:not([type=hidden]),select,summary,[role=button]"
      const panel = document
        .querySelector('form[role="search"]')!
        .closest("section")!
      return Array.from(panel.querySelectorAll(selector))
        .map((element) => [element, element.getBoundingClientRect()] as const)
        .filter(([, box]) => box.width >= 2 && box.height >= 2)
        .filter(([, box]) => box.height < 44 || box.width < 44)
        .map(
          ([element, box]) =>
            `${element.tagName} ${Math.round(box.height)}x${Math.round(box.width)} "${(element.textContent || "").trim().slice(0, 24)}"`
        )
    })

    // DESIGN.md, Layout & Spacing: "Primary tap targets >= 44px", and compact
    // sizes "grow to the 44px floor on coarse (touch) pointers". The
    // page-jump input (h-9 w-20) and the rows-per-page select (h-9 w-24) did
    // not: both measured 36px on Pixel 5 and Galaxy Tab S4 while the Go and
    // Apply buttons beside them were already 44.
    expect(small, small.join("\n")).toEqual([])
  })
})
