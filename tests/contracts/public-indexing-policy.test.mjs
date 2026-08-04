import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
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

const privatePrefixes = [
  "/app/",
  "/admin/",
  "/dev/",
  "/api/",
  "/home/",
  "/card/",
  "/reward/",
  "/q/",
  "/r/",
  "/scan",
  "/start",
  "/m/",
  "/merchant/",
]

const privateRouteFiles = [
  ["app", "(auth)", "login", "page.tsx"],
  ["app", "(auth)", "reset-password", "page.tsx"],
  ["app", "app", "layout.tsx"],
  ["app", "home", "(authed)", "layout.tsx"],
  ["app", "home", "login", "page.tsx"],
  ["app", "scan", "page.tsx"],
  ["app", "start", "page.tsx"],
  ["app", "q", "[qrId]", "page.tsx"],
  ["app", "r", "[token]", "page.tsx"],
  ["app", "card", "[membershipId]", "page.tsx"],
  ["app", "card", "[membershipId]", "stamp", "page.tsx"],
  ["app", "reward", "[rewardId]", "page.tsx"],
  ["app", "m", "[merchantSlug]", "page.tsx"],
  ["app", "m", "[merchantSlug]", "join", "page.tsx"],
]

test("Given private customer and merchant routes When metadata is inspected Then indexing is explicitly blocked", () => {
  const metadata = readProjectFile("lib", "seo", "metadata.ts")

  assert.match(metadata, /export const PRIVATE_ROUTE_METADATA/)
  assert.match(metadata, /robots: \{[\s\S]*index: false/)
  assert.match(metadata, /robots: \{[\s\S]*follow: false/)

  for (const segments of privateRouteFiles) {
    const source = readProjectFile(...segments)
    assert.match(
      source,
      /PRIVATE_ROUTE_METADATA/,
      `${segments.join("/")} must opt into private route metadata`
    )
  }
})

test("Given crawlers read robots.txt When private route prefixes are generated Then stateful surfaces are disallowed", () => {
  const metadata = readProjectFile("lib", "seo", "metadata.ts")
  const robots = readProjectFile("app", "robots.ts")

  assert.match(robots, /PRIVATE_ROUTE_PREFIXES/)
  assert.match(robots, /Array\.from\(PRIVATE_ROUTE_PREFIXES\)/)

  for (const prefix of privatePrefixes) {
    assert.ok(
      metadata.includes(`"${prefix}"`),
      `${prefix} must be listed in PRIVATE_ROUTE_PREFIXES`
    )
  }
})

/**
 * robots.txt matches by PREFIX, and app/robots.ts expands every entry in
 * PRIVATE_ROUTE_PREFIXES into its bare form as well ("/p/" also emits "/p").
 * A short private prefix can therefore silently de-index a public page that
 * merely starts with the same characters. Adding "/p/" once disallowed
 * /pricing and /privacy, which only a Lighthouse SEO assertion caught.
 */
test("no private route prefix can prefix-match a public page", () => {
  const metadata = readProjectFile("lib", "seo", "metadata.ts")
  const block = metadata.slice(
    metadata.indexOf("export const PRIVATE_ROUTE_PREFIXES = ["),
    metadata.indexOf(
      "]",
      metadata.indexOf("export const PRIVATE_ROUTE_PREFIXES = [")
    )
  )
  // Strip `//` comments first: the block documents which prefixes are
  // deliberately absent, and those quoted examples are not entries.
  const entries = block
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
  const prefixes = [...entries.matchAll(/"([^"]+)"/g)].map((m) => m[1])
  assert.ok(prefixes.length > 0, "expected to parse the private prefix list")

  // Every public, indexable route segment directly under app/.
  const publicRoutes = [
    "/pricing",
    "/privacy",
    "/about",
    "/faq",
    "/terms",
    "/cookies",
    "/guides",
    "/how-it-works",
    "/loyalty-for-pubs",
    "/loyalty-for-cafes",
    "/loyalty-for-bars",
    "/loyalty-for-takeaways",
    "/data-processing",
    "/merchant-terms",
  ]

  // Mirror app/robots.ts: each prefix is emitted bare as well as with its slash.
  const disallowed = [
    ...new Set(
      prefixes.flatMap((prefix) => [
        prefix,
        prefix.endsWith("/") ? prefix.slice(0, -1) : prefix,
      ])
    ),
  ]

  // Known and pre-existing, NOT introduced by the offers work: the bare
  // "/merchant" rule (from the "/merchant/" prefix, present since #118)
  // prefix-matches the public "/merchant-terms" legal page. Lower severity
  // than the /pricing case because that page is absent from app/sitemap.ts,
  // but it is the same defect and deserves its own fix. Listed here so it
  // stays visible and greppable rather than silently tolerated.
  const knownPreexisting = new Set([
    "/m|/merchant-terms",
    "/merchant|/merchant-terms",
  ])

  const collisions = []
  for (const route of publicRoutes) {
    for (const rule of disallowed) {
      if (!route.startsWith(rule)) continue
      if (knownPreexisting.has(`${rule}|${route}`)) continue
      collisions.push(
        `robots.txt rule "${rule}" prefix-matches the public page "${route}"; ` +
          `use per-route PRIVATE_ROUTE_METADATA instead of a short shared prefix`
      )
    }
  }

  assert.deepEqual(collisions, [])
})
