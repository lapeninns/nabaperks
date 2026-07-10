import assert from "node:assert/strict"
import { test } from "node:test"

import {
  merchantLoginHref,
  merchantPasswordResetHref,
  merchantPasswordResetVerifyHref,
  merchantSignupHref,
  merchantSignupVerifyHref,
} from "@/lib/navigation/merchant-auth-hrefs"
import {
  safeMerchantNextPath,
  safeNextPath,
} from "@/lib/navigation/safe-next-path"

test("rejects protocol-relative and external redirect targets", () => {
  assert.equal(safeNextPath("//evil.example/path"), "/home")
  assert.equal(safeMerchantNextPath("https://evil.example/path"), "/app")
})

test("rejects embedded control and whitespace redirect bypasses", () => {
  for (const payload of [
    "/\t/evil.example",
    "/\r/evil.example",
    "/\n/evil.example",
    "/ /evil.example",
    "/\u0000/evil.example",
  ]) {
    assert.equal(safeNextPath(payload), "/home", payload)
    assert.equal(safeMerchantNextPath(payload), "/app", payload)
  }
})

test("preserves safe same-origin paths including search and hash", () => {
  assert.equal(
    safeNextPath("/home/rewards?tab=active#ready"),
    "/home/rewards?tab=active#ready"
  )
  assert.equal(
    safeMerchantNextPath("/app/launch?tab=qr#poster"),
    "/app/launch?tab=qr#poster"
  )
})

test("blocks auth-loop redirects", () => {
  assert.equal(safeNextPath("/home/login?next=/home"), "/home")
  assert.equal(safeNextPath("/home/login#sign-in"), "/home")
  assert.equal(safeNextPath("/home/session/reset#code"), "/home")
  assert.equal(safeMerchantNextPath("/signup?next=/app"), "/app")
  assert.equal(safeMerchantNextPath("/login#sign-in"), "/app")
  assert.equal(safeMerchantNextPath("/signup#create-account"), "/app")
  assert.equal(safeMerchantNextPath("/reset-password#code"), "/app")
  assert.equal(safeMerchantNextPath("/auth/confirm#callback"), "/app")
  assert.equal(safeMerchantNextPath("/signup/verify?next=/app"), "/app")
  assert.equal(safeMerchantNextPath("/reset-password?next=/app"), "/app")
  assert.equal(safeMerchantNextPath("/auth/confirm?next=/app"), "/app")
})

test("builds merchant signup verification hrefs with optional context", () => {
  assert.equal(
    merchantSignupVerifyHref({
      email: "new@venue.test",
      name: "Asha Patel",
      next: "/app/onboarding?step=venue",
    }),
    "/signup/verify?email=new%40venue.test&name=Asha+Patel&next=%2Fapp%2Fonboarding%3Fstep%3Dvenue"
  )
})

test("merchant auth hrefs preserve safe context and encode it once", () => {
  assert.equal(
    merchantSignupHref({
      email: "new@venue.test",
      name: "Asha Patel",
      next: "/app/onboarding?step=venue",
    }),
    "/signup?email=new%40venue.test&name=Asha+Patel&next=%2Fapp%2Fonboarding%3Fstep%3Dvenue"
  )
  assert.equal(
    merchantLoginHref({
      email: "owner@venue.test",
      error: "verification",
      next: "/app/launch?tab=rewards",
    }),
    "/login?email=owner%40venue.test&error=verification&next=%2Fapp%2Flaunch%3Ftab%3Drewards"
  )
  assert.equal(
    merchantPasswordResetHref({
      email: "owner@venue.test",
      next: "/app/account?tab=billing",
    }),
    "/reset-password?email=owner%40venue.test&next=%2Fapp%2Faccount%3Ftab%3Dbilling"
  )
  assert.equal(
    merchantPasswordResetVerifyHref({
      email: "owner@venue.test",
      next: "/app/onboarding",
    }),
    "/reset-password?email=owner%40venue.test&next=%2Fapp%2Fonboarding&stage=verify"
  )
})

test("merchant auth hrefs replace hostile next values with safe fallbacks", () => {
  assert.equal(
    merchantSignupVerifyHref({
      email: "new@venue.test",
      next: "https://evil.example/steal",
    }),
    "/signup/verify?email=new%40venue.test&next=%2Fapp%2Fonboarding"
  )
  assert.equal(
    merchantLoginHref({ next: "//evil.example/steal" }),
    "/login?next=%2Fapp"
  )
})
