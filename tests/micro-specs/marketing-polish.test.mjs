import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
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

// --- CON-P1-02 — service worker never caches error responses -----------------

test("Given cacheFirst When a fetched response is not ok Then it is returned without being cached", () => {
  // Given
  const sw = readProjectFile("public", "sw.js")
  const cacheFirstBody = sw.match(
    /async function cacheFirst\(request\) \{[\s\S]*?\n\}/
  )?.[0]

  // Then
  assert.ok(cacheFirstBody, "cacheFirst() exists in public/sw.js")
  assert.match(
    cacheFirstBody,
    /if \(response\.ok\) \{[\s\S]*?cache\.put\(/,
    "cache.put is guarded by response.ok so transient 404/500s are never cached"
  )
})

// --- MKT-P1-05 — public manifest ships customer shortcuts only ---------------

test("Given the public PWA manifest When shortcuts are listed Then no merchant or admin surface is exposed", () => {
  // Given
  const manifest = readProjectFile("app", "manifest.ts")

  // Then
  assert.equal(manifest.includes('url: "/app"'), false, "no /app shortcut")
  assert.equal(manifest.includes('url: "/admin"'), false, "no /admin shortcut")
  assert.equal(manifest.includes("Merchant console"), false)
  assert.equal(manifest.includes("Admin console"), false)
  assert.ok(manifest.includes('url: "/home"'), "customer Home shortcut kept")
  assert.ok(manifest.includes('url: "/scan"'), "customer Scan shortcut kept")
})

// --- MKT-P1-04 — offline page has a working recovery affordance --------------

test("Given the offline page When rendered Then it offers a Try again reload and keeps Open my cards as secondary", () => {
  // Given
  const page = readProjectFile("app", "offline", "page.tsx")

  // Then
  assert.ok(page.includes("Try again"), "a Try again affordance exists")
  assert.match(
    page,
    /<a href="">/,
    "Try again is a plain same-URL anchor so it works even without hydration"
  )
  assert.ok(
    page.includes('href="/home"') && page.includes("OPEN_MY_CARDS_LABEL"),
    "Open my cards remains for the reconnected case (pinned by the PWA e2e)"
  )
})

test("Given the offline page When the connection returns Then an online listener reloads it automatically", () => {
  // Given
  const autoReloadPath = path.join(projectRoot, "app", "offline", "auto-reload.tsx")

  // Then
  assert.ok(existsSync(autoReloadPath), "app/offline/auto-reload.tsx exists")
  const autoReload = readFileSync(autoReloadPath, "utf8")
  assert.ok(autoReload.startsWith('"use client"'), "auto-reload is a client component")
  assert.match(autoReload, /addEventListener\("online"/, "listens for the online event")
  assert.match(autoReload, /location\.reload\(\)/, "reloads when the network returns")

  const page = readProjectFile("app", "offline", "page.tsx")
  assert.ok(page.includes("OfflineAutoReload"), "the page mounts the auto reload")
})

test("Given the service worker install When the offline shell is captured Then CSS and fonts are pre-cached and script chunks are deliberately excluded", () => {
  // Given
  const sw = readProjectFile("public", "sw.js")

  // Then
  assert.ok(
    sw.includes('href="([^"]*\\/_next\\/static\\/css\\/[^"]+\\.css[^"]*)"'),
    "the offline shell harvest captures /_next/static css hrefs"
  )
  assert.ok(
    sw.includes("cacheShellFonts"),
    "the shell's font faces are captured from its cached CSS"
  )
  assert.ok(
    !sw.includes('src="([^"]*\\/_next\\/static\\/[^"]+\\.js[^"]*)"'),
    "script chunks are NOT harvested: hydrating the offline shell while offline arms the dev HMR reload-on-disconnect loop; the same-URL Try again anchor recovers unhydrated by design"
  )
})

// --- MKT-P1-01 — landing comparison table pins the feature column ------------

test("Given the landing comparison table When it scrolls horizontally Then the row headers stay pinned on an opaque background", () => {
  // Given
  const table = readProjectFile(
    "components",
    "marketing",
    "landing",
    "comparison-table.tsx"
  )

  // Then
  const rowHeader = table.match(/scope="row"[\s\S]{0,600}?>/)?.[0]
  assert.ok(rowHeader, "a scoped row header exists")
  assert.match(rowHeader, /sticky left-0/, "row headers are sticky left-0")
  assert.match(rowHeader, /bg-background/, "sticky headers are opaque so cells do not bleed through")
  assert.match(
    table,
    /border-separate border-spacing-0/,
    "border-separate keeps cell borders attached to sticky cells"
  )
})

// --- VMK-P1-02 — guide comparison table shares the sticky family --------------

test("Given the guide comparison table When viewed at narrow widths Then the feature column is pinned and the QR column stays reachable in context", () => {
  // Given
  const componentPath = path.join(
    projectRoot,
    "components",
    "marketing",
    "guides",
    "comparison-table.tsx"
  )

  // Then
  assert.ok(existsSync(componentPath), "components/marketing/guides/comparison-table.tsx exists")
  const table = readFileSync(componentPath, "utf8")
  assert.match(table, /sticky left-0/, "row headers are sticky left-0")
  assert.match(table, /bg-background/, "sticky headers sit on an opaque background")
  assert.match(table, /border-separate border-spacing-0/, "sticky-safe border model")

  const guidePage = readProjectFile(
    "app",
    "guides",
    "paper-vs-qr-loyalty-for-pubs",
    "page.tsx"
  )
  assert.ok(
    guidePage.includes("GuideComparisonTable"),
    "the paper-vs-qr guide uses the shared sticky table"
  )
})

// --- VMK-P1-01 — pub hub hero grammar ----------------------------------------

test("Given the pub hub hero When the stamp sentence renders Then it does not read 'every stamp is counter-verified stamps'", () => {
  // Given
  const page = readProjectFile("app", "loyalty-for-pubs", "page.tsx")

  // Then
  assert.doesNotMatch(
    page,
    /every stamp is[\s\S]{0,200}(counter-verified stamps|\{PRODUCT\.counterStamp\})/,
    "the hero sentence is grammatical (not 'every stamp is counter-verified stamps')"
  )
  assert.match(
    page,
    /every stamp is[\s\S]{0,160}counter-verified/,
    "the hero still lands the counter-verified claim"
  )

  const facts = readProjectFile("lib", "marketing", "facts.ts")
  assert.ok(
    facts.includes('counterStamp: "counter-verified stamps"'),
    "the brand term stays intact in facts.ts for other surfaces"
  )
})

// --- CON-P1-01 (marketing slice) — micro type rides the minted tokens ---------

const MICRO_ARBITRARY = /text-\[0\.(?:[0-6][0-9]*|7[0-9]*)rem\]|text-\[(?:[0-9]|1[01])(?:\.[0-9]+)?px\]/

function listTsx(dir) {
  const abs = path.join(projectRoot, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs, { recursive: true })
    .filter((file) => String(file).endsWith(".tsx"))
    .map((file) => path.join(dir, String(file)))
}

test("Given the marketing surfaces When micro type renders Then arbitrary sub-12px sizes are swept onto mono-meta and mono-id", () => {
  // Given — every marketing-lane file this phase owns.
  const files = [
    "app/page.tsx",
    "app/layout.tsx",
    "app/not-found.tsx",
    ...listTsx("app/pricing"),
    ...listTsx("app/about"),
    ...listTsx("app/start"),
    ...listTsx("app/loyalty-for-pubs"),
    ...listTsx("app/guides"),
    ...listTsx("app/offline"),
    ...listTsx("components/marketing"),
    ...listTsx("components/pwa"),
  ]

  // Then
  const offenders = []
  for (const file of files) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")
    const match = source.match(MICRO_ARBITRARY)
    if (match) offenders.push(`${file} -> ${match[0]}`)
  }
  assert.deepEqual(
    offenders,
    [],
    "no arbitrary text size below 12px in marketing files; use .mono-meta / .mono-id"
  )
})

test("Given the dead seal-break demo When the sweep lands Then the orphaned file is deleted, not tokenised", () => {
  // Given
  const deadPath = path.join(
    projectRoot,
    "components",
    "marketing",
    "landing",
    "seal-break-demo.tsx"
  )

  // Then
  assert.equal(existsSync(deadPath), false, "seal-break-demo.tsx removed (zero imports)")
})
