import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isActiveNavItem,
  isActivePath,
  merchantNavItems,
  merchantTabItems,
  parseNavHref,
  resolveMerchantTab,
} from "@/components/layout/console-nav"

test("parseNavHref splits the tab query off an account href", () => {
  assert.deepEqual(parseNavHref("/app/account?tab=billing"), {
    path: "/app/account",
    tab: "billing",
  })
  assert.deepEqual(parseNavHref("/app/activity"), {
    path: "/app/activity",
    tab: null,
  })
})

test("isActivePath treats the console roots as exact and sections as prefixes", () => {
  assert.equal(isActivePath("/app", "/app"), true)
  assert.equal(isActivePath("/app/qr", "/app"), false)
  assert.equal(isActivePath("/app/qr/poster/window", "/app/qr"), true)
  assert.equal(isActivePath("/app/qrx", "/app/qr"), false)
})

test("the tab bar has exactly the four counter-first destinations in order", () => {
  assert.deepEqual(
    merchantTabItems.map((item) => [item.tab, item.href, item.label]),
    [
      ["counter", "/app", "Counter"],
      ["activity", "/app/activity", "Activity"],
      ["numbers", "/app/numbers", "Numbers"],
      ["more", "/app/more", "More"],
    ]
  )
  for (const item of merchantTabItems) {
    assert.ok(item.icon, `${item.label} tab has a glyph`)
  }
})

test("every rail destination resolves to a tab, so More never orphans a route", () => {
  for (const item of merchantNavItems) {
    assert.notEqual(
      resolveMerchantTab(item.href, null),
      null,
      `${item.href} belongs to a tab`
    )
  }
})

test("bare /app is Counter, and only without a ?tab", () => {
  assert.equal(resolveMerchantTab("/app", null), "counter")
  assert.equal(isActiveNavItem("/app", null, "/app"), true)
  assert.equal(isActiveNavItem("/app", "billing", "/app"), false)
  assert.equal(resolveMerchantTab("/app/", null), null)
})

test("scan and reward collection routes light the Activity tab", () => {
  for (const path of [
    "/app/activity",
    "/app/activity/anything",
    "/app/scan",
    "/app/scan/abc",
    "/app/rewards",
    "/app/rewards/xyz/collect",
  ]) {
    assert.equal(resolveMerchantTab(path, null), "activity", path)
  }
})

test("numbers and its metric details light the Numbers tab", () => {
  assert.equal(resolveMerchantTab("/app/numbers", null), "numbers")
  assert.equal(resolveMerchantTab("/app/numbers/stamps", null), "numbers")
  assert.equal(resolveMerchantTab("/app/numbersx", null), null)
})

test("configure-once destinations light the More tab", () => {
  for (const [path, tab] of [
    ["/app/more", null],
    ["/app/qr", null],
    ["/app/qr/poster/window", null],
    ["/app/customers", null],
    ["/app/customers/invite", null],
    ["/app/customers/send-reward", null],
    ["/app/offers", null],
    ["/app/offers/new", null],
    ["/app/announcements", null],
    ["/app/launch", null],
    ["/app/launch", "qr"],
    ["/app/account", "profile"],
    ["/app/account", "billing"],
    ["/app/account", null],
  ]) {
    assert.equal(resolveMerchantTab(path, tab), "more", `${path} ${tab}`)
  }
})

test("the rail keeps highlighting the destination itself rather than More", () => {
  assert.equal(isActiveNavItem("/app/qr", null, "/app/qr"), true)
  assert.equal(isActiveNavItem("/app/qr", null, "/app"), false)
  assert.equal(isActiveNavItem("/app/qr", null, "/app/activity"), false)
  assert.equal(
    isActiveNavItem("/app/account", "billing", "/app/account?tab=billing"),
    true
  )
  assert.equal(
    isActiveNavItem("/app/account", "billing", "/app/account?tab=profile"),
    false
  )
  assert.equal(
    isActiveNavItem("/app/account", null, "/app/account?tab=profile"),
    true,
    "profile is the default account tab"
  )
})

test("routes outside the console shell claim no tab", () => {
  for (const path of [
    "/app/onboarding",
    "/app/onboarding/location",
    "/home",
    "/admin",
  ]) {
    assert.equal(resolveMerchantTab(path, null), null, path)
  }
})

test("resolveMerchantTab ignores a query string or hash on the path", () => {
  assert.equal(resolveMerchantTab("/app/activity?filter=qr", null), "activity")
  assert.equal(resolveMerchantTab("/app/numbers#today", null), "numbers")
})

test("admin root keeps its exact-match rule regardless of the merchant tab guard", () => {
  assert.equal(isActiveNavItem("/admin", null, "/admin"), true)
  assert.equal(isActiveNavItem("/admin", "x", "/admin"), true)
  assert.equal(isActiveNavItem("/admin/pilot", null, "/admin"), false)
})
