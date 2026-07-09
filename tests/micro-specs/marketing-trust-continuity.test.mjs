import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
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

function readSourceTree(relativeDirectory) {
  const root = path.join(projectRoot, relativeDirectory)
  const sources = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name)
    if (entry.isDirectory()) {
      sources.push(...readSourceTree(relativePath))
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      sources.push({ path: relativePath, source: readProjectFile(relativePath) })
    }
  }
  return sources
}

const acquisitionSources = [
  ...readSourceTree("app"),
  ...readSourceTree("components/marketing"),
  ...readSourceTree("lib/marketing"),
  { path: "lib/legal/content.ts", source: readProjectFile("lib/legal/content.ts") },
  {
    path: "lib/seo/structured-data.ts",
    source: readProjectFile("lib/seo/structured-data.ts"),
  },
  { path: "public/llms.txt", source: readProjectFile("public/llms.txt") },
]

test("@MS-marketing-trust-continuity acquisition copy contains no fraud absolutes or unsupported timing", () => {
  const banned =
    /counter-verified\s+stamps?|can(?:not|'t) be faked|fraud is designed out|stops self-stamping|about five minutes|set up in minutes|same afternoon|set up your venue this afternoon|first repeat visit inside the first week/i

  for (const file of acquisitionSources) {
    assert.doesNotMatch(file.source, banned, `${file.path} contains an unsupported claim`)
  }
})

test("@MS-marketing-trust-continuity promo has a deadline and perk but no computed scarcity", () => {
  const promo = readProjectFile("lib/marketing/promo.ts")
  const consumers = [
    readProjectFile("components/marketing/landing/hero.tsx"),
    readProjectFile("app/pricing/page.tsx"),
    readProjectFile("app/(auth)/signup/page.tsx"),
  ].join("\n")

  assert.match(promo, /deadlineLabel/)
  assert.match(promo, /print and post your first counter-poster run — free/)
  assert.doesNotMatch(
    `${promo}\n${consumers}`,
    /getMonthlySpotsRemaining|spotsRemaining|claimedThisMonth|scarcityLine|scarcityChip|monthlyCap/
  )
  assert.doesNotMatch(`${promo}\n${consumers}`, /spots? left|onboard 40/i)
})

test("@MS-marketing-trust-continuity setup and signup disclose billing and continuation price", () => {
  const facts = readProjectFile("lib/marketing/facts.ts")
  const signup = readProjectFile("app/(auth)/signup/page.tsx")

  assert.match(facts, /Five guided steps/)
  assert.match(facts, /once billing is active/i)
  assert.match(signup, /PRODUCT\.price/)
  assert.doesNotMatch(signup, /about five minutes/i)
})

test("@MS-marketing-trust-continuity public graph and copy omit unverified aggregate figures", () => {
  const publicRoutes = readSourceTree("app")
  const routeSource = publicRoutes.map((file) => file.source).join("\n")
  const structuredData = readProjectFile("lib/seo/structured-data.ts")
  const proofGate = readProjectFile(
    "components/marketing/landing/nabaperks-proof-data.ts"
  )
  const oldCrown = readProjectFile(
    "components/marketing/landing/old-crown-candidate.tsx"
  )
  const llms = readProjectFile("public/llms.txt")

  assert.match(proofGate, /SHOW_NABAPERKS_PROOF = false/)
  assert.doesNotMatch(routeSource, /PROOF_DISPLAY|counterLoyaltyIndexDataset/)
  assert.doesNotMatch(structuredData, /counterLoyaltyIndexDataset|"@type": "Dataset"/)
  assert.doesNotMatch(oldCrown, /PROOF(?:_DISPLAY)?/)
  assert.doesNotMatch(llms, /Counter-Loyalty Index|46\.8%|1,842|812 customers/i)
})

test("@MS-marketing-trust-continuity claim and JSON-LD guards reject regression", () => {
  const claimsGuard = readProjectFile("scripts/check-banned-claims.mjs")
  const jsonldGuard = readProjectFile("scripts/check-jsonld.mjs")

  assert.match(claimsGuard, /counter-verified/i)
  assert.match(claimsGuard, /fraud is designed out/i)
  assert.match(claimsGuard, /spots? left/i)
  assert.doesNotMatch(jsonldGuard, /missing Dataset|Counter-Loyalty Index/)
})
