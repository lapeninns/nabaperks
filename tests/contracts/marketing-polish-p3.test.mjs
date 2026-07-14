import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

// --- MKT-P3-23 / MKT-P3-24 — crawler honesty ----------------------------------

test("Given the sitemap When URLs are listed Then no build-time lastModified misreports freshness", () => {
  const sitemap = readProjectFile("app", "sitemap.ts")

  assert.equal(sitemap.includes("lastModified"), false, "lastModified omitted")
  assert.ok(sitemap.includes("changeFrequency"), "hints kept")
})

test("Given robots.txt When private prefixes are disallowed Then bare paths are covered alongside trailing-slash forms", () => {
  const robots = readProjectFile("app", "robots.ts")

  assert.match(
    robots,
    /flatMap\(\(prefix\) => \[\s*prefix,\s*prefix\.endsWith\("\/"\) \? prefix\.slice\(0, -1\) : prefix,?\s*\]\)/,
    "both forms emitted from PRIVATE_ROUTE_PREFIXES"
  )
})

// --- MKT-P3-16/17/18 + VMK-P3-14 — system pages share one card ------------------

test("Given the offline page When it renders Then EmptyState is the single card and the route is noindexed with a clean title", () => {
  const page = readProjectFile("app", "offline", "page.tsx")

  assert.ok(page.includes("PRIVATE_ROUTE_METADATA"), "robots noindex applied")
  assert.match(page, /title: "Offline"/, "single-brand tab title")
  assert.equal(page.includes("Offline - Nabaperks"), false)
  assert.ok(
    page.includes('<section className="w-full max-w-md">'),
    "no outer card wrapper — EmptyState is the card"
  )
  assert.equal(
    page.includes("border-2 border-ink bg-card"),
    false,
    "double card-in-card removed"
  )
  // Phase C recovery affordances stay pinned.
  assert.ok(page.includes('<a href="">Try again</a>'))
  assert.ok(page.includes('href="/home"'))
})

test("Given the 404 page When the tab renders Then it is titled Page not found", () => {
  const page = readProjectFile("app", "not-found.tsx")

  assert.ok(
    page.includes('export const metadata = { title: "Page not found" }')
  )
})

// --- MKT-P3-01 / MKT-P3-21 — share card and chrome colour ------------------------

test("Given the homepage When shared Then it uses the large twitter card with the OG image", () => {
  const page = readProjectFile("app", "page.tsx")

  assert.ok(page.includes('card: "summary_large_image"'))
  assert.equal(page.includes('card: "summary",'), false)
  assert.match(page, /twitter: \{[\s\S]{0,240}images: \[OG_IMAGE\]/)
})

test("Given dark mode When the browser paints its chrome Then themeColor matches the dark paper", () => {
  const layout = readProjectFile("app", "layout.tsx")

  assert.match(
    layout,
    /\{ media: "\(prefers-color-scheme: dark\)", color: "#1b1712" \}/,
    "dark chrome uses the dark --w-paper"
  )
})

// --- CON-P3-01 / CON-P3-02 — token-true colours -----------------------------------

test("Given the OG image and QR mock When colours render Then they are token values, not off-brand literals", () => {
  const og = readProjectFile("app", "opengraph-image.tsx")
  const qr = readProjectFile(
    "components",
    "marketing",
    "landing",
    "venue-qr.tsx"
  )

  assert.equal(og.includes("#3b342b"), false, "off-brand grey removed")
  assert.ok(og.includes("#4f473d"), "ink-soft literal (Satori) in place")
  assert.ok(qr.includes('fill="var(--qr)"'), "QR path rides the --qr token")
  assert.equal(qr.includes("#111111"), false)
})

// --- CON-P3-06 — one radius spelling ----------------------------------------------

test("Given the marketing card surfaces When radii render Then no hardcoded rounded-[10px] duplicates the token", () => {
  const files = [
    ["components", "marketing", "landing", "sample-card-rows.tsx"],
    ["app", "pricing", "page.tsx"],
  ]

  for (const segments of files) {
    const source = readProjectFile(...segments)
    assert.equal(
      source.includes("rounded-[10px]"),
      false,
      `${segments.join("/")} uses rounded-lg, not the literal`
    )
  }
})

// --- MKT-P3-04 / MKT-P3-27 mechanical — jump-nav ------------------------------------

test("Given the jump nav When mobile and desktop variants are checked Then disclosure replaces chip hunt and chips ride the token dialects", () => {
  const nav = readProjectFile(
    "components",
    "marketing",
    "landing",
    "jump-nav.tsx"
  )

  assert.match(
    nav,
    /<details className="group[\s\S]*sm:hidden/,
    "mobile uses a native details disclosure instead of horizontal chip hunt"
  )
  assert.match(
    nav,
    /hidden gap-2 sm:flex sm:flex-wrap/,
    "chip bar is sm+ only and wraps in place"
  )
  assert.ok(nav.includes("focus-ring"), "focus dialect is .focus-ring")
  assert.equal(
    nav.includes("focus-visible:ring-3"),
    false,
    "banned dialect gone"
  )
  assert.ok(nav.includes("border-line"), "resting border uses the line token")
  assert.equal(nav.includes("border-ink/15"), false)
  assert.ok(
    nav.includes("rounded-full"),
    "chip shape is a named circle exception"
  )
})

// --- MKT-P3-05 — dead code stays dead -----------------------------------------------

test("Given the dead story-loop hook When the sweep lands Then the file is deleted", () => {
  const deadPath = path.join(
    projectRoot,
    "components",
    "marketing",
    "use-lost-card-story-loop.ts"
  )

  assert.equal(
    existsSync(deadPath),
    false,
    "use-lost-card-story-loop.ts removed"
  )
})

// --- MKT-P3-10 / MKT-P3-12 — hub and guide wayfinding ---------------------------------

test("Given the pub hub and guide spokes When the header renders Then a Log in path exists and the guide breadcrumb is a real trail", () => {
  const hub = readProjectFile("app", "loyalty-for-pubs", "page.tsx")
  const guide = readProjectFile(
    "components",
    "marketing",
    "guides",
    "guide-page.tsx"
  )

  assert.ok(hub.includes('{ href: "/login", label: "Log in" }'))
  assert.ok(guide.includes('{ href: "/login", label: "Log in" }'))
  assert.ok(
    guide.includes('aria-current="page"'),
    "current guide marked in the trail"
  )
  assert.match(guide, /Home\s*<\/Link>/, "trail starts at Home")
})

// --- MKT-P3-26 — install prompt on the start URL ---------------------------------------

test("Given the manifest start_url When the app is installable Then the prompt is not suppressed there and the roundel glyph matches the Logo", () => {
  const pwa = readProjectFile("components", "pwa", "app-pwa.tsx")

  assert.ok(
    pwa.includes('(surface === "marketing" && pathname !== "/start")'),
    "marketing suppression carves out /start"
  )
  assert.ok(pwa.includes("✱"), "brand asterisk glyph")
})

// --- MKT-P3-03 — dead utility gone -------------------------------------------------------

test("Given the hero CTAs When sizes render Then the inert mobileCtaClass no longer exists", () => {
  const hero = readProjectFile("components", "marketing", "landing", "hero.tsx")

  assert.equal(hero.includes("mobileCtaClass"), false)
})

// --- VMK-P3-05 / VMK-P3-12 — one tick colour for checklists -------------------------------

test("Given plan and hero checklists When ticks render Then they are reward green on both routes", () => {
  const pricing = readProjectFile("app", "pricing", "page.tsx")
  const hub = readProjectFile("app", "loyalty-for-pubs", "page.tsx")

  assert.ok(pricing.includes('className="mt-0.5 shrink-0 text-reward"'))
  assert.ok(hub.includes('className="mt-0.5 shrink-0 text-reward"'))
  assert.equal(
    pricing.includes('className="mt-0.5 shrink-0 text-primary"'),
    false
  )
  assert.equal(hub.includes('className="mt-0.5 shrink-0 text-primary"'), false)
})
