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
