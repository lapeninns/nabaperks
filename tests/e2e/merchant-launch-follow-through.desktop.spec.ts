import { test } from "@playwright/test"

import { defineMerchantLaunchFollowThroughTests } from "./merchant-launch-follow-through-flow"

test.describe("merchant launch follow-through @MS-merchant-ux-launch-follow-through", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  defineMerchantLaunchFollowThroughTests()
})
