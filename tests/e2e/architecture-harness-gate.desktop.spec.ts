import { test } from "@playwright/test"

import {
  ARCHITECTURE_HARNESS_SURFACES,
  expectArchitectureHarnessSurface,
} from "./helpers/architecture-gate"
import { dismissPwaInstall } from "./helpers/harness"

test.describe("architecture remediation harness gate — desktop", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  for (const surface of ARCHITECTURE_HARNESS_SURFACES) {
    test(`drives the remediated ${surface.name} surface through the desktop viewport`, async ({
      page,
    }) => {
      await expectArchitectureHarnessSurface(page, surface)
    })
  }
})
