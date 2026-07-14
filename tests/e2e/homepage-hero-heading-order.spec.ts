import { test } from "@playwright/test"

import { defineHomepageHeroHeadingOrderTests } from "./homepage-hero-heading-order-flow"

test.describe("homepage hero heading order", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  defineHomepageHeroHeadingOrderTests()
})
