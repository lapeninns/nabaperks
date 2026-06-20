import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import {
  MERCHANT_ADMIN_PREVIEW_SCREENS,
  MERCHANT_ADMIN_PREVIEW_SURFACES,
  isMerchantAdminPreviewSurfaceId,
  merchantAdminPreviewSurface,
  merchantAdminPreviewVariant,
  previewPath,
} from "@/lib/dev/merchant-admin-preview"

const routeSource = readFileSync(
  fileURLToPath(
    new URL(
      "../../app/dev/merchant-admin-preview/[surface]/page.tsx",
      import.meta.url
    )
  ),
  "utf8"
)

describe("merchant + admin console preview harness", () => {
  it("registers a routable surface for every console screen and redirect", () => {
    expect(MERCHANT_ADMIN_PREVIEW_SURFACES.length).toBeGreaterThanOrEqual(18)

    for (const surface of MERCHANT_ADMIN_PREVIEW_SURFACES) {
      expect(isMerchantAdminPreviewSurfaceId(surface.id)).toBe(true)
      expect(previewPath(surface.id)).toBe(
        `/dev/merchant-admin-preview/${surface.id}`
      )
      expect(
        surface.console === "merchant" || surface.console === "admin"
      ).toBe(true)
      expect(surface.route.startsWith("/")).toBe(true)
      expect(surface.screenLabel.length).toBeGreaterThan(0)
      expect(merchantAdminPreviewSurface(surface.id)).toBe(surface)

      if (surface.kind === "redirect") {
        expect(surface.redirectsTo).toBeTruthy()
        expect(surface.redirectsTo?.startsWith("/")).toBe(true)
      } else {
        expect(surface.kind).toBe("screen")
        expect(surface.screenshot).toMatch(/\.png$/)
      }
    }
  })

  it("exposes the screen-only surfaces with screenshot evidence paths", () => {
    expect(MERCHANT_ADMIN_PREVIEW_SCREENS.length).toBeGreaterThan(0)

    for (const screen of MERCHANT_ADMIN_PREVIEW_SCREENS) {
      expect(screen.kind).toBe("screen")
      expect(screen.screenshot).toMatch(/\.png$/)
      expect(screen.screenshot).toMatch(/^(merchant|admin)\//)
    }

    const merchantScreens = MERCHANT_ADMIN_PREVIEW_SCREENS.filter(
      (screen) => screen.console === "merchant"
    )
    const adminScreens = MERCHANT_ADMIN_PREVIEW_SCREENS.filter(
      (screen) => screen.console === "admin"
    )

    expect(merchantScreens.length).toBeGreaterThanOrEqual(1)
    expect(adminScreens.length).toBeGreaterThanOrEqual(1)
  })

  it("covers the exact known console surface ids", () => {
    const ids = MERCHANT_ADMIN_PREVIEW_SURFACES.map((surface) => surface.id)

    for (const expected of [
      "merchant-dashboard",
      "merchant-account",
      "merchant-activity",
      "merchant-customers",
      "merchant-launch",
      "merchant-onboarding",
      "merchant-reward-scan",
      "merchant-billing",
      "merchant-settings",
      "merchant-profile",
      "admin-hub",
      "admin-pilot",
      "admin-merchants",
      "admin-customers",
      "admin-billing",
      "admin-privacy",
      "admin-fraud",
      "admin-audit",
    ]) {
      expect(ids).toContain(expected)
    }
  })

  it("rejects unknown surface ids", () => {
    expect(isMerchantAdminPreviewSurfaceId("not-a-surface")).toBe(false)
    expect(() =>
      merchantAdminPreviewSurface(
        "not-a-surface" as (typeof MERCHANT_ADMIN_PREVIEW_SURFACES)[number]["id"]
      )
    ).toThrow()
  })

  it("guards the dynamic route with a notFound() slug check", () => {
    expect(routeSource).toContain("notFound()")
    expect(routeSource).toContain("isMerchantAdminPreviewSurfaceId")
    expect(routeSource).toContain("await params")
  })

  it("registers the mobile-first state-coverage surfaces (empty/loading/error)", () => {
    const ids = MERCHANT_ADMIN_PREVIEW_SCREENS.map((screen) => screen.id)

    // Empty-data variants for the data-heavy redesigned surfaces.
    for (const expected of [
      "merchant-customers-empty",
      "merchant-activity-empty",
      "admin-customers-empty",
      "admin-fraud-empty",
      "admin-merchants-empty",
    ] as const) {
      expect(ids).toContain(expected)
      expect(
        merchantAdminPreviewVariant(merchantAdminPreviewSurface(expected))
      ).toBe("empty")
    }

    // At least one merchant + one admin loading-skeleton surface.
    for (const expected of [
      "merchant-dashboard-loading",
      "admin-customers-loading",
    ] as const) {
      expect(ids).toContain(expected)
      expect(
        merchantAdminPreviewVariant(merchantAdminPreviewSurface(expected))
      ).toBe("loading")
    }

    // Merchant + admin error-boundary surfaces.
    for (const expected of ["merchant-error", "admin-error"] as const) {
      expect(ids).toContain(expected)
      expect(
        merchantAdminPreviewVariant(merchantAdminPreviewSurface(expected))
      ).toBe("error")
    }
  })

  it("keeps populated surfaces variant-free so their preview is unchanged", () => {
    // The happy-path screens omit `variant` (it defaults to "populated"); only
    // the state-coverage surfaces carry an explicit non-populated variant.
    for (const surface of MERCHANT_ADMIN_PREVIEW_SCREENS) {
      const isStateSurface =
        merchantAdminPreviewVariant(surface) !== "populated"
      const hasStateSuffix = /-(empty|loading|error)$/.test(surface.id)
      expect(isStateSurface).toBe(hasStateSuffix)
    }
  })
})
