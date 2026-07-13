import { test } from "@playwright/test"

import {
  expectArchitectureHarnessSurfaces,
  warmArchitectureHarnessRoutes,
} from "./helpers/architecture-gate"
import { dismissPwaInstall } from "./helpers/harness"

test.describe("architecture remediation harness gate — desktop", () => {
  test.beforeAll(async ({ request }) => {
    await warmArchitectureHarnessRoutes(request)
  })

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("drives remediated merchant surfaces through the desktop viewport", async ({
    page,
  }) => {
    await expectArchitectureHarnessSurfaces(page)
  })
})
