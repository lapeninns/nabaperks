import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

describe("app launcher (/start)", () => {
  it("routes an internal admin session to the admin console", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: { internal_admins: [{ data: { is_active: true }, error: null }] },
    })
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "user-admin" })),
    }))
    vi.doMock("@/lib/customer/session", () => ({
      getCustomerSession: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))

    const { resolveLaunchDestination } = await import("@/lib/launch/resolve")

    await expect(resolveLaunchDestination()).resolves.toBe("/admin")
  })

  it("routes a signed-in non-admin (merchant) session to the merchant console", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: { internal_admins: [{ data: null, error: null }] },
    })
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "user-merchant" })),
    }))
    vi.doMock("@/lib/customer/session", () => ({
      getCustomerSession: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))

    const { resolveLaunchDestination } = await import("@/lib/launch/resolve")

    await expect(resolveLaunchDestination()).resolves.toBe("/app")
  })

  it("routes a customer session to the home dashboard", async () => {
    vi.resetModules()
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/customer/session", () => ({
      getCustomerSession: vi.fn(async () => ({ customerId: "customer-1" })),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(),
    }))

    const { resolveLaunchDestination } = await import("@/lib/launch/resolve")

    await expect(resolveLaunchDestination()).resolves.toBe("/home")
  })

  it("prefers the staff console when both staff and customer sessions exist", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: { internal_admins: [{ data: null, error: null }] },
    })
    const getCustomerSession = vi.fn(async () => ({ customerId: "customer-1" }))
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => ({ id: "user-merchant" })),
    }))
    vi.doMock("@/lib/customer/session", () => ({ getCustomerSession }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))

    const { resolveLaunchDestination } = await import("@/lib/launch/resolve")

    await expect(resolveLaunchDestination()).resolves.toBe("/app")
    expect(getCustomerSession).not.toHaveBeenCalled()
  })

  it("returns no destination for an anonymous launch", async () => {
    vi.resetModules()
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentUser: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/customer/session", () => ({
      getCustomerSession: vi.fn(async () => null),
    }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(),
    }))

    const { resolveLaunchDestination } = await import("@/lib/launch/resolve")

    await expect(resolveLaunchDestination()).resolves.toBeNull()
  })

  it("redirects known audiences and renders a dual-door chooser otherwise", () => {
    const page = readProjectFile("app/start/page.tsx")

    expect(page).toContain("resolveLaunchDestination")
    expect(page).toContain("redirect(destination)")
    expect(page).toContain('href="/home/login"')
    expect(page).toContain('href="/login"')
    expect(page).toContain("Open my cards")
    expect(page).toContain("Merchant sign-in")
    // New visitors are pointed back to the venue QR on-ramp.
    expect(page).toContain("Scan")
  })

  it("keeps the launcher server-authoritative and never cached offline", () => {
    const serviceWorker = readProjectFile("public/sw.js")

    expect(serviceWorker).toContain('"/start"')
  })
})
