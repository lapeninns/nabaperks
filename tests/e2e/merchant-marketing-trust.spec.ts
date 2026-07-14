import { test } from "@playwright/test"

import { defineMerchantMarketingTrustTests } from "./helpers/merchant-marketing-trust"

test.describe("merchant marketing trust", () => {
  defineMerchantMarketingTrustTests()
})
