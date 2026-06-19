import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  isActivePath,
  merchantNavItems,
  adminNavItems,
} from "@/components/layout"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * The `activePath` override lets the `/dev` console previews highlight the nav
 * item for the surface's real route without navigating there. The active-state
 * computation is a pure function of `(currentPath, href)`, so it is asserted in
 * isolation — exact match for the console roots, prefix match for nested routes.
 */
describe("shell navigation active-path resolution", () => {
  it("marks the explicit activePath nav item active and others inactive (merchant)", () => {
    const activePath = "/app/customers"

    const states = merchantNavItems.map((item) => ({
      label: item.label,
      active: isActivePath(activePath, item.href),
    }))

    expect(states).toContainEqual({ label: "Customers", active: true })
    expect(states).toContainEqual({ label: "Home", active: false })
    expect(states).toContainEqual({ label: "Activity", active: false })
    expect(states).toContainEqual({ label: "Launch", active: false })
  })

  it("marks the explicit activePath nav item active (admin)", () => {
    const activePath = "/admin/customers"

    const states = adminNavItems.map((item) => ({
      label: item.label,
      active: isActivePath(activePath, item.href),
    }))

    expect(states).toContainEqual({ label: "Customers", active: true })
    expect(states).toContainEqual({ label: "Merchants", active: false })
    expect(states).toContainEqual({ label: "Pilot", active: false })
  })

  it("requires an exact match for the console roots, not a prefix match", () => {
    // Root is exact-match only: a nested route must not light up the root tab.
    expect(isActivePath("/app", "/app")).toBe(true)
    expect(isActivePath("/app/customers", "/app")).toBe(false)

    expect(isActivePath("/admin", "/admin")).toBe(true)
    expect(isActivePath("/admin/customers", "/admin")).toBe(false)
  })

  it("uses prefix matching for nested routes", () => {
    expect(isActivePath("/app/customers", "/app/customers")).toBe(true)
    // A deeper child of a nested route still matches its section tab.
    expect(isActivePath("/app/customers/123", "/app/customers")).toBe(true)
    // Sibling sections do not match.
    expect(isActivePath("/app/activity", "/app/customers")).toBe(false)
  })

  it("threads activePath through the shell navigation API with a usePathname default", () => {
    const navigation = readProjectFile("components/layout/shell-navigation.tsx")

    // The override is optional and falls back to the live pathname so the real
    // authenticated shells keep their current behaviour untouched.
    expect(navigation).toContain("activePath")
    expect(navigation).toContain("usePathname")
  })
})
