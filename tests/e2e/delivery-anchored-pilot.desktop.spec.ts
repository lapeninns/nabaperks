import { test } from "@playwright/test"

import { defineDeliveryAnchoredPilotTests } from "./delivery-anchored-pilot-flow"

test.describe("delivery-anchored pilot", () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  defineDeliveryAnchoredPilotTests()
})
