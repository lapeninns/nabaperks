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

// --- CON-P2-04 — toasts render on the token palette ---------------------------

test("Given the root Toaster When it renders Then richColors is absent so the token palette applies", () => {
  const layout = readProjectFile("app", "layout.tsx")

  assert.equal(layout.includes("richColors"), false, "richColors dropped")
  assert.ok(layout.includes("<Toaster closeButton />"), "closeButton kept")
})

// --- MKT-P2-03 / VMK-P2-01 — comparison table marks and mobile affordance -----

test("Given the landing comparison table When 'No' marks render Then they hold non-text contrast and the sr-only text remains", () => {
  const table = readProjectFile(
    "components",
    "marketing",
    "landing",
    "comparison-table.tsx"
  )

  assert.equal(table.includes("text-muted-foreground/45"), false)
  assert.ok(table.includes("text-muted-foreground/70"), "crosses raised to /70")
  assert.ok(table.includes('{value ? "Yes" : "No"}'), "sr-only fallback kept")
})

test("Given the comparison table at narrow widths When viewed on a phone Then a compact Nabaperks wedge replaces the horizontal scroll and the table stays for md+", () => {
  const table = readProjectFile(
    "components",
    "marketing",
    "landing",
    "comparison-table.tsx"
  )
  const data = readProjectFile(
    "components",
    "marketing",
    "landing",
    "comparison-data.ts"
  )

  assert.match(
    table,
    /ComparisonMobileWedge/,
    "mobile renders the Nabaperks-first wedge"
  )
  assert.match(
    table,
    /Where wallet pass, paper and POS fall short/,
    "alternative gaps sit behind one disclosure"
  )
  assert.match(data, /comparisonGapsForColumn/, "gaps derive from the shared table data")
  assert.match(
    table,
    /md:hidden/,
    "mobile wedge hides from md up"
  )
  assert.match(
    table,
    /hidden md:block/,
    "the semantic table is desktop/tablet only"
  )
  assert.equal(
    table.includes("Swipe for wallet pass · paper · POS"),
    false,
    "the clipped-table swipe hint is gone"
  )
})

// --- MKT-P2-01 — proof strip definition list order -----------------------------

test("Given the proof strip When name/value pairs render Then dt precedes dd in DOM and flex order flips them visually", () => {
  const strip = readProjectFile(
    "components",
    "marketing",
    "landing",
    "proof-strip.tsx"
  )

  const dtIndex = strip.indexOf("<dt")
  const ddIndex = strip.indexOf("<dd")
  assert.ok(dtIndex !== -1 && ddIndex !== -1, "both dt and dd exist")
  assert.ok(dtIndex < ddIndex, "dt precedes dd in DOM order (valid HTML)")
  assert.match(strip, /<dt className="mono-meta order-2/, "label pushed below visually")
  assert.match(strip, /<dd className="order-1/, "value renders first visually")
})

// --- MKT-P2-09 — 404 recovery works for every audience -------------------------

test("Given the 404 page When recovery actions render Then the marketing home is offered and the copy is audience-neutral", () => {
  const notFound = readProjectFile("app", "not-found.tsx")

  assert.match(notFound, /<Link href="\/">Nabaperks home<\/Link>/)
  assert.ok(notFound.includes('href="/home"'), "customer path kept")
  assert.equal(
    notFound.includes("Your cards and rewards are safe"),
    false,
    "copy no longer assumes a customer audience"
  )
  assert.ok(notFound.includes('<Logo compact href="/" />'), "logo targets /")
})

// --- MKT-P2-11 — skip link -----------------------------------------------------

test("Given the marketing shell When a keyboard user lands Then a skip link targets the main landmark", () => {
  const layout = readProjectFile("components", "layout", "marketing-layout.tsx")

  assert.match(layout, /href="#main"[\s\S]{0,400}Skip to content/)
  assert.ok(layout.includes("sr-only focus:not-sr-only"), "visible only on focus")
  assert.ok(layout.includes('<main id="main">'), "main landmark carries the id")
})

// --- MKT-P2-12 — active nav state ----------------------------------------------

test("Given the marketing header nav When the current route is shown Then it carries aria-current and an active style", () => {
  const nav = readProjectFile("components", "layout", "marketing-header-nav.tsx")

  assert.ok(nav.includes("usePathname()"), "pathname drives the active state")
  assert.ok(
    nav.includes('aria-current={isActive(item.href) ? "page" : undefined}'),
    "active link is announced"
  )
  assert.match(nav, /underline decoration-ink decoration-2/, "ink underline style")
  assert.equal(
    nav.includes('className="font-heading text-lg font-extrabold"'),
    false,
    "redundant SheetTitle font-extrabold patch removed"
  )
})

// --- MKT-P2-15 — root error boundaries ------------------------------------------

test("Given a render error on a public route When the root boundary catches it Then a branded recoverable state renders", () => {
  const errorPath = path.join(projectRoot, "app", "error.tsx")
  assert.ok(existsSync(errorPath), "app/error.tsx exists")

  const boundary = readFileSync(errorPath, "utf8")
  assert.ok(boundary.startsWith('"use client"'), "boundary is a client component")
  assert.ok(boundary.includes("CustomerErrorState"), "house error surface reused")
  assert.ok(boundary.includes("reset={reset}"), "reset retry wired")
  assert.ok(boundary.includes('href: "/"'), "path back to the marketing home")
})

test("Given the root layout itself fails When global-error renders Then it owns html/body and stays dependency-light", () => {
  const globalPath = path.join(projectRoot, "app", "global-error.tsx")
  assert.ok(existsSync(globalPath), "app/global-error.tsx exists")

  const boundary = readFileSync(globalPath, "utf8")
  assert.ok(boundary.includes('<html lang="en-GB">'), "renders its own html")
  assert.ok(boundary.includes("globals.css"), "brand tokens available")
  assert.ok(boundary.includes("reset()"), "retry wired")
  assert.equal(
    boundary.includes("@/components/"),
    false,
    "no component imports in the last-resort boundary"
  )
})

// --- MKT-P2-10 — governed vocabulary on the share image --------------------------

test("Given the share image When headline and alts render Then they use the approved 'pubs, cafes and takeaways'", () => {
  const image = readProjectFile("app", "opengraph-image.tsx")
  const structured = readProjectFile("lib", "seo", "structured-data.ts")

  assert.equal(image.includes("restaurants"), false, "og image copy governed")
  assert.ok(image.includes("pubs, cafes and takeaways"))
  assert.match(
    structured,
    /alt: "Nabaperks — loyalty cards for pubs, cafes and takeaways\."/,
    "OG_IMAGE alt governed"
  )
})

// --- VMK-P2-02 — about page no longer repeats its lede ---------------------------

test("Given the about page When the story opens Then the operator lede is not repeated verbatim", () => {
  const about = readProjectFile("app", "about", "page.tsx")

  const ledeCount = about.split("Nabaperks is built and run by").length - 1
  assert.equal(
    ledeCount,
    2,
    "operator lede appears in the meta description and the PageTitle only"
  )
  assert.ok(
    about.includes('"We make a browser-based loyalty card'),
    "story now opens on the product"
  )
})

// --- MKT-P2-04 — checkout success links onward ------------------------------------

test("Given checkout success on pricing When the alert renders Then it links to merchant billing", () => {
  const alert = readProjectFile("app", "pricing", "checkout-alert.tsx")

  assert.ok(alert.includes('"/app/account?tab=billing"'), "billing link target")
  assert.ok(alert.includes("Open merchant billing"), "explicit CTA label")
})

// --- MKT-P2-06 — calculator input behaviour ----------------------------------------

test("Given the regulars calculator When a fractional field is edited on mobile Then the decimal keypad shows and clamping waits for blur", () => {
  const calc = readProjectFile(
    "components",
    "marketing",
    "landing",
    "regulars-calculator.tsx"
  )

  assert.ok(
    calc.includes('inputMode={Number.isInteger(step) ? "numeric" : "decimal"}'),
    "fractional steps get the decimal keypad"
  )
  assert.ok(calc.includes("onBlur"), "clamp commits on blur")
  assert.equal(
    calc.includes("onChange(Math.min(max, Math.max(min, next)))"),
    false,
    "keystrokes are no longer clamped inline"
  )
})

// --- ADM-P2-22 / CUS-P2-15 — distinguishable tab titles -----------------------------

test("Given the admin console When any page is open Then its tab carries a distinct Admin title", () => {
  const pages = [
    ["app/admin/page.tsx", "Admin console"],
    ["app/admin/audit/page.tsx", "Admin — Audit logs"],
    ["app/admin/billing/page.tsx", "Admin — Billing"],
    ["app/admin/customers/page.tsx", "Admin — Customers"],
    ["app/admin/fraud/page.tsx", "Admin — Fraud"],
    ["app/admin/merchants/page.tsx", "Admin — Merchants"],
    ["app/admin/pilot/page.tsx", "Admin — Pilot readiness"],
    ["app/admin/privacy/page.tsx", "Admin — Privacy support"],
  ]

  for (const [file, title] of pages) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")
    assert.ok(
      source.includes(`export const metadata = { title: "${title}" }`),
      `${file} exports the "${title}" tab title`
    )
  }
})

test("Given the customer money path When a page is open Then the tab shows a short customer title, not the B2B default", () => {
  const pages = [
    "app/q/[qrId]/page.tsx",
    "app/m/[merchantSlug]/page.tsx",
    "app/m/[merchantSlug]/join/page.tsx",
    "app/card/[membershipId]/page.tsx",
    "app/card/[membershipId]/stamp/page.tsx",
    "app/reward/[rewardId]/page.tsx",
  ]

  for (const file of pages) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")
    assert.match(
      source,
      /title: "[^"]+"/,
      `${file} sets a per-route tab title`
    )
  }
})

// --- CON-P2-06 — offline shell freshness policy --------------------------------------

test("Given the offline shell changes When a deploy ships Then the versioned cache name and bump policy are pinned", () => {
  const sw = readProjectFile("public", "sw.js")

  assert.match(
    sw,
    /\/\/ Bump on offline-shell changes so existing installs re-capture the shell\.\nconst CACHE_NAME = "nabaperks-pwa-v\d+"/,
    "the bump policy comment sits on the versioned cache name"
  )
})

// --- MKT-P2-14 — eyebrow variants ride the tokens -------------------------------------

function listTsx(dir) {
  const abs = path.join(projectRoot, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs, { recursive: true })
    .filter((file) => String(file).endsWith(".tsx"))
    .map((file) => path.join(dir, String(file)))
}

test("Given the marketing surfaces When mono micro-type renders Then no hand-rolled font-mono uppercase variant remains", () => {
  const files = [
    "app/page.tsx",
    "app/not-found.tsx",
    "components/layout/marketing-layout.tsx",
    "components/layout/marketing-header-nav.tsx",
    ...listTsx("app/pricing"),
    ...listTsx("app/about"),
    ...listTsx("app/start"),
    ...listTsx("app/loyalty-for-pubs"),
    ...listTsx("app/guides"),
    ...listTsx("app/offline"),
    ...listTsx("components/marketing"),
    ...listTsx("components/pwa"),
  ]

  const offenders = []
  for (const file of files) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")
    for (const line of source.split("\n")) {
      if (line.includes("font-mono") && line.includes("uppercase")) {
        offenders.push(`${file} -> ${line.trim().slice(0, 80)}`)
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "hand-rolled mono eyebrows are folded onto .mono-meta/.mono-id/.eyebrow"
  )
})
