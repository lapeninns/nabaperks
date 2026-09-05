import assert from "node:assert/strict"
import { test } from "node:test"

import { formatMerchantCustomerIdentifier } from "@/lib/merchant/customer-identity-display"

test("database-masked scan contacts retain their merchant display and fallback", () => {
  assert.equal(
    formatMerchantCustomerIdentifier({ email: "r***@example.test" }),
    "r***@example.test"
  )
  assert.equal(
    formatMerchantCustomerIdentifier({ email: "Email hidden" }),
    "Email hidden"
  )
  assert.equal(
    formatMerchantCustomerIdentifier({ email: null, phoneLast4: "1234" }),
    "Phone ending 1234"
  )
})
