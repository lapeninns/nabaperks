import { expect, test } from "@playwright/test"

import {
  CUSTOMER_FLOW_PREVIEW_STEPS,
  customerFlowPreviewPath,
} from "../../lib/dev/customer-flow-preview"
import {
  LAUNCH_PREVIEW_STATES,
  launchPreviewPath,
} from "../../lib/dev/launch-preview"

import { expectNoAxeViolations } from "./helpers/axe"

/**
 * Registry-driven accessibility coverage (WCAG 2 A/AA) over EVERY dev-harness
 * preview state, closing the gap where a11y.spec.ts only audits a few
 * hand-picked surfaces. The preview registries are the source of truth: each
 * `CUSTOMER_FLOW_PREVIEW_STEPS` step and each `LAUNCH_PREVIEW_STATES` state
 * gets its own axe scan, so a new screen added to either registry is audited
 * automatically.
 *
 * Each test gates on the page's unique per-screen data attribute
 * (`[data-customer-flow-preview="<id>"]` / `[data-launch-preview="<id>"]`,
 * rendered by the `[step]` / `[state]` route wrappers) before scanning, rather
 * than on heading text — several steps share the same heading (e.g. the card
 * name and "Customer reward"), so the structural locator is the stable signal.
 * Reduced motion is emulated before every navigation so motion primitives
 * render their static children, matching a11y.spec.ts.
 *
 * These routes only exist in dev mode (the dev layout calls notFound() when the
 * harness gate is off); the live runner uses `next dev`, so they resolve.
 */
test.describe("dev harness accessibility registry (WCAG 2 A/AA)", () => {
  for (const step of CUSTOMER_FLOW_PREVIEW_STEPS) {
    test(`customer-flow preview "${step.id}" has no automated violations`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.goto(customerFlowPreviewPath(step.id))

      await expect(
        page.locator(`[data-customer-flow-preview="${step.id}"]`)
      ).toBeVisible()

      await expectNoAxeViolations(page, `customer-flow-preview:${step.id}`)
    })
  }

  for (const state of LAUNCH_PREVIEW_STATES) {
    test(`launch preview "${state.id}" has no automated violations`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.goto(launchPreviewPath(state.id))

      await expect(
        page.locator(`[data-launch-preview="${state.id}"]`)
      ).toBeVisible()

      await expectNoAxeViolations(page, `launch-preview:${state.id}`)
    })
  }

  test("customer-flow playbook index has no automated violations", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/dev/customer-flow")

    await expect(
      page.locator('[data-screen-label="Customer flow playbook"]').first()
    ).toBeVisible()

    await expectNoAxeViolations(page, "customer-flow-playbook")
  })

  test("design system catalog has no automated violations", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/dev/design-system")

    await expect(page.getByText("Design system catalog").first()).toBeVisible()

    await expectNoAxeViolations(page, "design-system")
  })
})
