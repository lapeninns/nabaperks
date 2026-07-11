import { test } from "@playwright/test"

import { defineHomepageHeroHeadingOrderTests } from "./homepage-hero-heading-order-flow"

test.describe("homepage hero heading order @MS-homepage-hero-heading-order", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  defineHomepageHeroHeadingOrderTests()
})
