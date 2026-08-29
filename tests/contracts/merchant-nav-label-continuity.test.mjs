import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const read = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")

/**
 * 03#4 — "nav labels do not match the page titles they lead to". The finding
 * does not reproduce: every destination already names its nav item in the
 * PageTitle eyebrow or heading, so the "did I land where I tapped" loop closes
 * on arrival. Renaming the headings on top of that is a copy decision, not a
 * defect. This contract keeps the property that made the finding stale, so a
 * future eyebrow edit cannot silently reopen it.
 *
 * `/app` is the documented exception: the dashboard's heading is the venue's
 * own name, which is a stronger arrival cue than the word "Dashboard".
 */
const NAV_DESTINATIONS = {
  "/app/scan": ["app", "app", "scan", "page.tsx"],
  "/app/qr": ["app", "app", "qr", "page.tsx"],
  "/app/customers": ["app", "app", "customers", "page.tsx"],
  "/app/activity": ["app", "app", "activity", "page.tsx"],
  "/app/offers": ["app", "app", "offers", "page.tsx"],
  "/app/announcements": ["app", "app", "announcements", "page.tsx"],
  "/app/launch": ["app", "app", "launch", "page.tsx"],
}

function parseMerchantNavItems(source) {
  const start = source.indexOf("export const merchantNavItems")
  assert.ok(start > -1, "merchantNavItems must stay a literal array")
  const end = source.indexOf("satisfies readonly ShellNavItem[]", start)
  const block = source.slice(start, end)

  return [...block.matchAll(/href:\s*"([^"]+)",\s*\n\s*label:\s*"([^"]+)"/g)].map(
    ([, href, label]) => ({ href, label })
  )
}

test("every merchant nav label is named by the page it leads to", () => {
  const items = parseMerchantNavItems(read("components", "layout", "console-nav.ts"))

  // The filter below would happily pass on an empty list.
  assert.equal(items.length, 8)

  const checked = items.filter((item) => item.href !== "/app")
  assert.equal(checked.length, 7)

  for (const { href, label } of checked) {
    const segments = NAV_DESTINATIONS[href]
    assert.ok(segments, `nav item ${href} has no registered destination`)

    const page = read(...segments)
    const headings = [
      ...page.matchAll(/(?:eyebrow|title)=\{?"([^"]+)"\}?/g),
    ].map(([, value]) => value.toLowerCase())

    assert.ok(
      headings.length > 0,
      `${href} renders no literal eyebrow or title to match "${label}" against`
    )
    assert.ok(
      headings.some((heading) => heading.includes(label.toLowerCase())),
      `nav item "${label}" (${href}) is named by none of its page headings: ${headings.join(" / ")}`
    )
  }
})

test("the dashboard exception is the venue name, not a missing cue", () => {
  const page = read("app", "app", "page.tsx")

  assert.match(page, /eyebrow="Your venue"/)
  assert.match(page, /title=\{merchant\.business_name\}/)
})
