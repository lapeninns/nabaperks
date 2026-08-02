import assert from "node:assert/strict"
import test from "node:test"

import { isMerchantAuthRoute } from "@/lib/pwa/app-pwa-routes"

test("merchant authentication routes suppress the install prompt", () => {
  for (const pathname of [
    "/login",
    "/signup",
    "/signup/verify",
    "/reset-password",
  ]) {
    assert.equal(isMerchantAuthRoute(pathname), true, pathname)
  }

  for (const pathname of ["/", "/app", "/home/login", "/pricing"]) {
    assert.equal(isMerchantAuthRoute(pathname), false, pathname)
  }
})
