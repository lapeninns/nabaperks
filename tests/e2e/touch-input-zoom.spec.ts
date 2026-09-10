import { devices, expect, test, type Page } from "@playwright/test"

import {
  dismissPwaInstall,
  gotoHydratedPage,
  HARNESS_ROUTES,
} from "./helpers/harness"

/**
 * iOS input-zoom regression guard.
 *
 * iOS Safari zooms the page when a focused text control renders below 16px and
 * never zooms back out, stranding the member on a magnified, side-scrolling
 * form. Two things keep that from happening and this spec holds both honest:
 *
 *  1. the shared primitives ship `text-base md:text-sm`, so a phone gets 16px;
 *  2. the `@media (pointer: coarse)` floor in app/globals.css catches every
 *     touch device *above* the 768px `md` breakpoint — iPads and landscape
 *     phones — where `md:text-sm` would otherwise drop back to 14px.
 *
 * The iPhone pass proves (1). The 820px iPad pass is the only thing that proves
 * (2): at that width `md:` applies, so 14px is what you get if the floor is
 * missing. That second pass is therefore not redundant, and it must not be
 * quietly dropped — if WebKit stops reporting a coarse pointer the pass is
 * skipped with a visible annotation rather than passing on a technicality.
 *
 * This file is deliberately NOT `*.desktop.spec.ts`: playwright.config.ts gives
 * the other three projects explicit `testMatch` lists, so a plain spec runs in
 * `mobile-safari` only, which is exactly the device class at issue.
 *
 * COVERAGE, stated honestly. Of the eight wrappers fixed alongside this spec,
 * seven are reached here: auth-field (login/signup/signup-verify/reset),
 * select-field and onboarding-form-fields (onboarding), advanced-gps-checks
 * and venue-address-fields (launch?tab=venue), loyalty-card-form (launch),
 * and support's `adminSelectClasses` (pilot-note). The eighth —
 * cancellation-interview-form — renders only at /app/account/cancel, which is
 * behind merchant auth with no DB-free harness route, so nothing here guards
 * it. Adding such a route, or a source-level contract test, is the only way to
 * close that gap; do not read a green run as covering it.
 */

/** iPad portrait — comfortably above `md` (768px), still a coarse pointer. */
const IPAD_VIEWPORT = { width: 820, height: 1180 }

/** Below this, iOS Safari zooms on focus. */
const MIN_TOUCH_FONT_PX = 16

/**
 * `font-size` does not size these controls, so the globals.css floor skips
 * them on purpose and so does this guard. `hidden` never renders at all.
 */
const EXCLUDED_TYPES = [
  "hidden",
  "checkbox",
  "radio",
  "range",
  "file",
  "color",
] as const

/**
 * Routes that render at least one text control with no auth and no database.
 * The `/dev` harness routes mount the real page bodies against static
 * fixtures, which is how merchant surfaces behind a login are reachable here.
 */
const ROUTES: ReadonlyArray<{ name: string; path: string }> = [
  { name: "merchant login", path: "/login" },
  { name: "merchant signup", path: "/signup" },
  // The signup OTP field only exists on this step, and the step only renders
  // with a plausible ?email — a bare GET redirects back to /signup
  // (app/(auth)/signup/verify/page.tsx:46). No session, so no DB is needed.
  {
    name: "merchant signup OTP",
    path: "/signup/verify?email=harness%40example.com&name=Harness",
  },
  { name: "reset password", path: "/reset-password" },
  { name: "customer login", path: "/home/login" },
  { name: "harness account", path: HARNESS_ROUTES.account },
  { name: "harness onboarding", path: HARNESS_ROUTES.onboarding },
  // The only DB-free surface that mounts `adminSelectClasses`
  // (components/admin/support.tsx), alongside an Input and a Textarea.
  { name: "harness pilot note", path: HARNESS_ROUTES.pilotNote },
  // The launch hub is tabbed and defaults to `card`
  // (app/dev/app-harness/launch/page.tsx:296 resolveTab). Visiting it bare
  // covers LoyaltyCardForm's expiry select and nothing else — the venue tab,
  // which owns VenueAddressFields and AdvancedGpsChecks, has to be asked for
  // by name or those fields are never mounted and never asserted.
  { name: "harness launch (card)", path: HARNESS_ROUTES.launch },
  {
    name: "harness launch (venue)",
    path: `${HARNESS_ROUTES.launch}?tab=venue`,
  },
  // `?tab=rewards` is deliberately absent: RewardPoolForm renders only hidden
  // inputs until a draft editor is opened, so the route would assert nothing.
  // Its one editable control is a shared Textarea, already `text-base md:text-sm`.
  { name: "harness send reward", path: HARNESS_ROUTES.sendReward },
  { name: "harness invite", path: HARNESS_ROUTES.invite },
  { name: "harness announcements", path: HARNESS_ROUTES.announcements },
  { name: "harness customers", path: HARNESS_ROUTES.customers },
]

type Measurement = {
  label: string
  fontSizePx: number
}

/**
 * Every in-scope control on the page with its computed font-size.
 *
 * Controls that are currently `display: none` are measured too, not skipped: a
 * field inside a collapsed section is focusable the moment the section opens,
 * and its computed font-size is already correct to read. Skipping them is how
 * a guard like this quietly stops covering half the form.
 */
async function measureControls(page: Page): Promise<Measurement[]> {
  return page.evaluate((excluded: readonly string[]) => {
    const label = (el: Element): string => {
      const tag = el.tagName.toLowerCase()
      const type = el.getAttribute("type")
      const id = el.id
      const name = el.getAttribute("name")
      const parts = [tag]
      if (type) parts.push(`[type=${type}]`)
      if (id) parts.push(`#${id}`)
      else if (name) parts.push(`[name=${name}]`)
      return parts.join("")
    }

    const measured: { label: string; fontSizePx: number }[] = []
    for (const el of document.querySelectorAll("input, textarea, select")) {
      const type = (
        el.getAttribute("type") ?? el.tagName.toLowerCase()
      ).toLowerCase()
      if (excluded.includes(type)) continue
      measured.push({
        label: label(el),
        fontSizePx: Number.parseFloat(window.getComputedStyle(el).fontSize),
      })
    }
    return measured
  }, EXCLUDED_TYPES)
}

function assertNoZoomTriggers(
  measurements: Measurement[],
  context: string
): void {
  const undersized = measurements.filter(
    (m) => m.fontSizePx < MIN_TOUCH_FONT_PX
  )
  expect(
    undersized,
    `${context}: these controls are under ${MIN_TOUCH_FONT_PX}px, so iOS Safari zooms on focus — ` +
      undersized.map((m) => `${m.label} @ ${m.fontSizePx}px`).join(", ")
  ).toEqual([])
}

test.describe("touch input zoom", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("the mobile project really emulates a coarse pointer", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/login")

    // If this ever fails, every wide pass below has been silently skipping and
    // the globals.css floor has been going unproven — treat it as a real break
    // in the harness, not a flake. `pointer` is the one the CSS keys on;
    // `any-pointer` is asserted alongside it purely to pin the emulation.
    const pointers = await page.evaluate(() => ({
      pointer: window.matchMedia("(pointer: coarse)").matches,
      anyPointer: window.matchMedia("(any-pointer: coarse)").matches,
    }))
    expect(
      pointers,
      "WebKit emulation stopped reporting a coarse pointer; the wide half of this spec can no longer prove the touch floor"
    ).toEqual({ pointer: true, anyPointer: true })
  })

  for (const route of ROUTES) {
    test(`${route.name} keeps every text control at 16px on touch`, async ({
      page,
    }) => {
      await gotoHydratedPage(page, route.path)

      const phone = await measureControls(page)
      expect(
        phone.length,
        `${route.name} (${route.path}) rendered no text controls, so this route proves nothing — fix the route or drop it from ROUTES`
      ).toBeGreaterThan(0)
      assertNoZoomTriggers(phone, `${route.name} at the iPhone 14 viewport`)

      const coarse = await page.evaluate(
        () => window.matchMedia("(pointer: coarse)").matches
      )
      if (!coarse) {
        test.info().annotations.push({
          type: "skip",
          description:
            "WebKit emulation did not report (pointer: coarse); skipping the wide pass, which means the app/globals.css touch floor is UNPROVEN for this route.",
        })
        return
      }

      await page.setViewportSize(IPAD_VIEWPORT)

      // Above `md`, `md:text-sm` resolves to 14px, so anything still at 16px
      // here is being held up by the coarse-pointer floor and nothing else.
      await expect
        .poll(() =>
          page.evaluate(
            (width: number) =>
              window.matchMedia(`(min-width: ${width}px)`).matches,
            IPAD_VIEWPORT.width
          )
        )
        .toBe(true)

      const tablet = await measureControls(page)
      expect(
        tablet.length,
        `${route.name} lost its controls after resizing to ${IPAD_VIEWPORT.width}px`
      ).toBe(phone.length)
      assertNoZoomTriggers(
        tablet,
        `${route.name} at ${IPAD_VIEWPORT.width}×${IPAD_VIEWPORT.height} (only the globals.css coarse-pointer floor holds this up)`
      )
    })
  }
  /**
   * The floor above is so effective that it would mask a Step-1 regression:
   * re-add `text-sm` to any wrapper and both passes above still read 16px,
   * because the coarse-pointer rule overrides it. This pass removes that
   * safety net — a fine pointer below `md`, where the ONLY thing that can
   * produce 16px is the `text-base` the shared primitives ship.
   *
   * `page.emulateMedia()` cannot do this (it exposes no `pointer` option), so
   * it needs its own context. Building one inside the test is house style —
   * see tests/e2e/merchant-id-verification-flow.ts.
   */
  test("the class fixes alone hold 16px where the CSS floor cannot help", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      ...devices["iPhone 14"],
      hasTouch: false,
      isMobile: false,
      viewport: { width: 390, height: 664 },
    })

    try {
      const page = await context.newPage()
      await dismissPwaInstall(page)
      await gotoHydratedPage(page, "/login")

      const fine = await page.evaluate(() => ({
        pointer: window.matchMedia("(pointer: coarse)").matches,
        anyPointer: window.matchMedia("(any-pointer: coarse)").matches,
        aboveMd: window.matchMedia("(min-width: 768px)").matches,
      }))
      expect(
        fine,
        "this control context must be fine-pointer and below `md`, or it is not testing the classes in isolation"
      ).toEqual({ pointer: false, anyPointer: false, aboveMd: false })

      for (const route of ROUTES) {
        await gotoHydratedPage(page, route.path)
        const measured = await measureControls(page)
        expect(
          measured.length,
          `${route.name} rendered no text controls in the fine-pointer context`
        ).toBeGreaterThan(0)
        assertNoZoomTriggers(
          measured,
          `${route.name} with NO coarse-pointer floor (a wrapper has re-added a sub-16px font-size class)`
        )
      }
    } finally {
      await context.close()
    }
  })

  /**
   * The floor is a flat `1rem`, so it can shrink as well as raise. The venue
   * code field is deliberately 20px (components/customer/venue-code-form.tsx)
   * and opts out via `data-font-floor="exempt"`. Pin the exact size: a
   * `>= 16px` assertion would happily pass at the 16px the floor would impose,
   * which is the regression this guards.
   */
  test("the venue code field keeps its deliberate 20px on touch", async ({
    page,
  }) => {
    await gotoHydratedPage(
      page,
      "/dev/home-harness/stamp?mode=location-blocked"
    )

    await page.getByRole("button", { name: /add today's stamp/i }).click()

    const code = page.locator('input[name="code"]')
    await expect(code).toBeVisible()

    const fontSizePx = await code.evaluate((el) =>
      Number.parseFloat(window.getComputedStyle(el).fontSize)
    )
    expect(
      fontSizePx,
      "the coarse-pointer floor in app/globals.css has flattened the venue code field — check its data-font-floor exemption"
    ).toBe(20)
  })
})
