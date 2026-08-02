import { test } from "@playwright/test"

import { defineDeliveryAnchoredPilotTests } from "./delivery-anchored-pilot-flow"

test.describe("delivery-anchored pilot", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  defineDeliveryAnchoredPilotTests()
})
