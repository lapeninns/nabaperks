import { test } from "@playwright/test"

import { defineMerchantLaunchFollowThroughTests } from "./merchant-launch-follow-through-flow"

test.describe("merchant launch follow-through", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  defineMerchantLaunchFollowThroughTests()
})
