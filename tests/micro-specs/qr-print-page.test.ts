import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import {
  POSTER_ACCENTS,
  resolvePosterAccent,
} from "@/app/qr/print/[asset]/[qrCodeId]/poster-accent"

// Exercises the HTML print route (app/qr/print/[asset]/[qrCodeId]/page.tsx) that
// Chromium captures into the counter poster. The route narrows owned rows into a
// QrPrintContext; we mock the data layer wholesale (house style: resetModules ->
// doMock -> dynamic import) and render the returned element with
// renderToStaticMarkup, then assert on the static HTML.

type LoadOptions = {
  isActive?: boolean
  merchantId?: string
}

function buildOwnedContext({
  isActive = true,
  merchantId = "merchant-1",
}: LoadOptions) {
  return {
    merchant: { id: merchantId, business_name: "The Bell" },
    location: { id: "loc-1", name: "Main bar" },
    activeCard: {
      id: "card-1",
      card_name: "Mystery Visit Card",
      reward_name: "a mystery reward",
      stamps_required: 3,
    },
    qrCode: { id: "qr-row-1", qr_id: "qr-public", is_active: isActive },
  }
}

async function loadPosterModule(options: LoadOptions = {}) {
  const owned = buildOwnedContext(options)

  vi.resetModules()
  // Empty Headers -> no bearer token -> the route takes the owned-cookie path.
  vi.doMock("next/headers", () => ({
    headers: vi.fn(async () => new Headers()),
  }))
  vi.doMock("next/navigation", () => ({ notFound: vi.fn() }))
  vi.doMock("@/lib/env/server", () => ({
    getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://nabaperks.test" }),
  }))
  vi.doMock("@/lib/merchant/qr-code", () => ({
    getOwnedQrAssetContext: vi.fn(async () => owned),
  }))
  // poster -> poster_pdf; till-card/sticker keep their slugs. Fixed PNG bytes
  // [1,2,3] -> base64 "AQID" so the embedded data URL is deterministic and the
  // real qrcode/sharp renderers never run.
  vi.doMock("@/lib/qr/assets", () => ({
    assetKindFromSlug: (slug: string) =>
      slug === "poster"
        ? "poster_pdf"
        : slug === "till-card"
          ? "till_card_png"
          : slug === "sticker"
            ? "sticker_png"
            : null,
    renderQrCodePng: vi.fn(async () => Buffer.from([1, 2, 3])),
  }))
  vi.doMock("@/lib/qr/asset-store", () => ({
    verifyQrAssetWorkerToken: vi.fn(() => false),
    getQrAssetContextForWorker: vi.fn(async () => owned),
  }))

  return import("@/app/qr/print/[asset]/[qrCodeId]/page")
}

async function renderRoute(
  options: LoadOptions & { asset?: string; accent?: string } = {}
) {
  const mod = await loadPosterModule(options)
  const element = await mod.default({
    params: Promise.resolve({
      asset: options.asset ?? "poster",
      qrCodeId: "qr-row-1",
    }),
    searchParams: Promise.resolve(
      options.accent ? { accent: options.accent } : {}
    ),
  })
  return { mod, html: renderToStaticMarkup(element) }
}

describe("qr print poster route", () => {
  it("renders the receipt-card poster composition", async () => {
    const { html } = await renderRoute()

    // Masthead + venue badge.
    expect(html).toContain("nabaperks")
    expect(html).toContain("The Bell")
    // Headline with the sun-gold "something." tail.
    expect(html).toContain("Everyone wins")
    expect(html).toContain("something.")
    expect(html).toContain("every card wins")
    // Honey marquee + headstart + progress + how-it-works.
    expect(html).toContain("First stamp free")
    expect(html).toContain("Your first stamp is on us")
    expect(html).toContain("One of three")
    expect(html).toContain("FREE")
    expect(html).toContain("Visit twice more")
    expect(html).toContain("Break the seal")
    // QR column captions + footer.
    expect(html).toContain("Scan to claim")
    expect(html).toContain("Open your camera, point it here")
    expect(html).toContain("join.nabaperks.com")
    expect(html).toContain("One stamp per business day")
    // Kind hook preserved.
    expect(html).toContain("kind-poster_pdf")
  })

  it("personalises the poster with the venue name and reward, via DESIGN.md marks", async () => {
    const { html } = await renderRoute()
    // Venue identity (masthead badge) + reward named in the lede (matches the
    // stored SVG poster's "unlock {reward}" framing).
    expect(html).toContain("The Bell")
    expect(html).toContain("a mystery reward")
    // The "free" stamp carries the venue initials, like the live earned stamp —
    // not the ✱ disc (DESIGN.md reserves ✱ for the wordmark/marquee).
    expect(html).toContain(">TB<")
    // Stamp/seal/headstart marks render through the Hugeicons Icon wrapper (SVG),
    // not the ✱ glyph.
    expect(html).toContain("<svg")
  })

  it("embeds the route's rendered QR as a data URL, not a client generator", async () => {
    const { html } = await renderRoute()
    // Buffer.from([1,2,3]).toString("base64") === "AQID".
    expect(html).toContain("data:image/png;base64,AQID")
    expect(html).toContain('alt="Venue loyalty QR code"')
  })

  it("preserves the R15 print-colour invariants (A4 + exact backgrounds)", async () => {
    const { html } = await renderRoute()
    expect(html).toContain("print-color-adjust: exact")
    expect(html).toContain("size: A4")
    // R13: renders with the Wet Ink fonts inherited from the root layout.
    expect(html).toContain("var(--font-sans)")
    expect(html).toContain("var(--font-mono)")
  })

  it("shows the paused ribbon and overlay only when the QR is inactive", async () => {
    const active = await renderRoute({ isActive: true })
    expect(active.html).not.toContain("Not accepting scans")
    expect(active.html).not.toContain("Paused")

    const paused = await renderRoute({ isActive: false })
    expect(paused.html).toContain("Not accepting scans")
    expect(paused.html).toContain("Paused")
  })

  it("keeps the compact till-card layout (venue + reward) intact", async () => {
    const { html } = await renderRoute({ asset: "till-card" })
    expect(html).toContain("kind-till_card_png")
    expect(html).toContain("The Bell")
    expect(html).toContain("a mystery reward")
  })

  it("injects the resolved accent onto the poster root", async () => {
    const { html } = await renderRoute({ merchantId: "merchant-1" })
    const expected = resolvePosterAccent("merchant-1")
    expect(html).toContain(`--poster-accent:${expected.accent}`)
  })

  it("honours a read-only ?accent= override", async () => {
    const { html } = await renderRoute({ accent: "cobalt" })
    expect(html).toContain("--poster-accent:#2b43c8")
  })
})

describe("resolvePosterAccent", () => {
  it("exposes the five Wet Ink accent inks", () => {
    expect(Object.keys(POSTER_ACCENTS).sort()).toEqual([
      "cobalt",
      "ink",
      "leaf",
      "sun",
      "vermillion",
    ])
    for (const accent of Object.values(POSTER_ACCENTS)) {
      expect(accent.accent).toMatch(/^#[0-9a-f]{6}$/i)
      expect(accent.accentDeep).toMatch(/^#[0-9a-f]{6}$/i)
      expect(accent.accentSoft).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it("is stable per merchant and stays within the palette", () => {
    const first = resolvePosterAccent("merchant-1")
    const again = resolvePosterAccent("merchant-1")
    expect(again).toEqual(first)
    expect(POSTER_ACCENTS[first.key]).toEqual(first)
  })

  it("derives different accents across merchants", () => {
    const keys = new Set(
      ["m-a", "m-b", "m-c", "m-d", "m-e", "m-f", "m-g", "m-h"].map(
        (id) => resolvePosterAccent(id).key
      )
    )
    expect(keys.size).toBeGreaterThan(1)
  })

  it("honours a valid override case-insensitively", () => {
    expect(resolvePosterAccent("merchant-1", "cobalt").key).toBe("cobalt")
    expect(resolvePosterAccent("merchant-1", "COBALT").key).toBe("cobalt")
    expect(resolvePosterAccent("merchant-1", "cobalt").accent).toBe("#2b43c8")
  })

  it("ignores an unknown override and falls back to the merchant accent", () => {
    expect(resolvePosterAccent("merchant-1", "magenta")).toEqual(
      resolvePosterAccent("merchant-1")
    )
  })

  it("never selects the fixed sun ink from the per-merchant rotation", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `merchant-${i}`)
    const keys = ids.map((id) => resolvePosterAccent(id).key)
    expect(keys).not.toContain("sun")
    // ...but the rotation still spans the other four inks.
    expect(new Set(keys)).toEqual(
      new Set(["vermillion", "cobalt", "leaf", "ink"])
    )
  })

  it("still allows sun (and ink) via an explicit override", () => {
    expect(resolvePosterAccent("merchant-1", "sun").key).toBe("sun")
    expect(resolvePosterAccent("merchant-1", "sun").accent).toBe("#f5a623")
    expect(resolvePosterAccent("merchant-1", "ink").key).toBe("ink")
  })

  it("coerces a repeated ?accent= array to its first valid entry", () => {
    expect(resolvePosterAccent("merchant-1", ["cobalt", "sun"]).key).toBe(
      "cobalt"
    )
    // An empty array carries no override and falls back to the merchant accent.
    expect(resolvePosterAccent("merchant-1", [])).toEqual(
      resolvePosterAccent("merchant-1")
    )
  })
})
