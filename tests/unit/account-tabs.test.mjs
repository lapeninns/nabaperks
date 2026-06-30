import assert from "node:assert/strict"
import { test } from "node:test"

import {
  DEFAULT_ACCOUNT_TAB,
  firstAccountSearchParamValue,
  resolveAccountOutcomeParams,
  resolveAccountTab,
} from "@/components/merchant/account/account-tabs"

test("resolveAccountTab accepts known tabs and defaults unknown values", () => {
  assert.equal(resolveAccountTab("profile"), "profile")
  assert.equal(resolveAccountTab("billing"), "billing")
  assert.equal(resolveAccountTab("support"), DEFAULT_ACCOUNT_TAB)
  assert.equal(resolveAccountTab(undefined), DEFAULT_ACCOUNT_TAB)
})

test("resolveAccountTab collapses duplicate Next search params to the first value", () => {
  assert.equal(resolveAccountTab(["billing", "profile"]), "billing")
  assert.equal(resolveAccountTab(["profile", "billing"]), "profile")
  assert.equal(resolveAccountTab(["support", "billing"]), DEFAULT_ACCOUNT_TAB)
  assert.equal(resolveAccountTab([]), DEFAULT_ACCOUNT_TAB)
})

test("firstAccountSearchParamValue returns the first entry from array params", () => {
  assert.equal(firstAccountSearchParamValue("success"), "success")
  assert.equal(firstAccountSearchParamValue(["success", "cancel"]), "success")
  assert.equal(firstAccountSearchParamValue([]), undefined)
  assert.equal(firstAccountSearchParamValue(undefined), undefined)
})

test("resolveAccountOutcomeParams keeps single checkout and portal flags", () => {
  assert.deepEqual(
    resolveAccountOutcomeParams({
      checkout: ["success", "cancelled"],
      portal: ["return", "retry"],
    }),
    { checkout: "success", portal: "return" }
  )

  assert.deepEqual(
    resolveAccountOutcomeParams({ checkout: "", portal: undefined }),
    {}
  )
})
