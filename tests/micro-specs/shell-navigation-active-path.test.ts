import { describe, expect, it } from "vitest"

import {
  isActivePath,
  merchantNavItems,
  adminNavItems,
} from "@/components/layout"

describe("console sidebar navigation active-path resolution", () => {
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
    expect(isActivePath("/app", "/app")).toBe(true)
    expect(isActivePath("/app/customers", "/app")).toBe(false)

    expect(isActivePath("/admin", "/admin")).toBe(true)
    expect(isActivePath("/admin/customers", "/admin")).toBe(false)
  })

  it("uses prefix matching for nested routes", () => {
    expect(isActivePath("/app/customers", "/app/customers")).toBe(true)
    expect(isActivePath("/app/customers/123", "/app/customers")).toBe(true)
    expect(isActivePath("/app/activity", "/app/customers")).toBe(false)
  })
})
