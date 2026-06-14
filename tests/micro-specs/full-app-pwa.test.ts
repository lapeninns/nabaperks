import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import manifest from "@/app/manifest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

describe("full-app PWA", () => {
  it("exposes install metadata for the whole Nabaperks app", () => {
    const appManifest = manifest()

    expect(appManifest.name).toBe("Nabaperks")
    expect(appManifest.short_name).toBe("Nabaperks")
    expect(appManifest.start_url).toBe("/")
    expect(appManifest.scope).toBe("/")
    expect(appManifest.display).toBe("standalone")
    expect(appManifest.background_color).toBe("#f6f1e6")
    expect(appManifest.theme_color).toBe("#e8430f")

    expect(appManifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/nabaperks-icon-192.png",
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/icons/nabaperks-icon-512.png",
          sizes: "512x512",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/icons/nabaperks-maskable-512.png",
          purpose: "maskable",
        }),
      ])
    )

    expect(appManifest.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Customer wallet", url: "/wallet" }),
        expect.objectContaining({ name: "Merchant console", url: "/app" }),
        expect.objectContaining({ name: "Admin console", url: "/admin" }),
      ])
    )
  })

  it("wires root metadata, viewport theme color, and the app-wide PWA bootstrap", () => {
    const layout = readProjectFile("app/layout.tsx")
    const pwaBootstrap = readProjectFile("components/pwa/app-pwa.tsx")

    expect(layout).toContain("export const viewport")
    expect(layout).toContain("themeColor")
    expect(layout).toContain("appleWebApp")
    expect(layout).toContain("AppPwa")
    expect(layout).toContain("<AppPwa />")
    expect(pwaBootstrap).toContain("hasMounted")
    expect(pwaBootstrap).toContain("setHasMounted(true)")
    expect(pwaBootstrap).toContain("if (!hasMounted")
  })

  it("keeps the service worker online-first and away from offline mutations", () => {
    const serviceWorkerPath = "public/sw.js"

    expect(existsSync(serviceWorkerPath)).toBe(true)

    const serviceWorker = readProjectFile(serviceWorkerPath)

    expect(serviceWorker).toContain("NETWORK_ONLY_PREFIXES")
    expect(serviceWorker).toContain("/offline")
    expect(serviceWorker).toContain("event.request.mode === \"navigate\"")
    expect(serviceWorker).not.toContain('addEventListener("sync"')
    expect(serviceWorker).not.toContain('addEventListener("periodicsync"')
    expect(serviceWorker).not.toContain("backgroundSync")
    expect(serviceWorker).not.toContain("workbox-background-sync")

    for (const pathPrefix of [
      "/api",
      "/app",
      "/admin",
      "/card",
      "/reward",
      "/q",
      "/m",
      "/wallet",
    ]) {
      expect(serviceWorker, pathPrefix).toContain(`"${pathPrefix}"`)
    }
  })

  it("serves explicit offline copy for server-authoritative loyalty state", () => {
    const offlinePage = readProjectFile("app/offline/page.tsx")

    expect(offlinePage).toContain("You're offline")
    expect(offlinePage).toContain("Cards, stamps, rewards, merchant tools, and admin tools need a connection")
    expect(offlinePage).toContain("server")
  })

  it("ships generated app icon assets", () => {
    for (const iconPath of [
      "public/icons/nabaperks-icon-192.png",
      "public/icons/nabaperks-icon-512.png",
      "public/icons/nabaperks-maskable-192.png",
      "public/icons/nabaperks-maskable-512.png",
    ]) {
      expect(existsSync(iconPath), iconPath).toBe(true)
    }
  })
})
