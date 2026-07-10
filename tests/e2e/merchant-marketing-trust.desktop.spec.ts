import { test } from "@playwright/test"

import { defineMerchantMarketingTrustTests } from "./helpers/merchant-marketing-trust"

test.describe("@MS-marketing-trust-continuity", () => {
  defineMerchantMarketingTrustTests()
})
