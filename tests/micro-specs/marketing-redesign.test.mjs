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

function readLandingSources() {
  const landingDir = path.join(
    projectRoot,
    "components",
    "marketing",
    "landing"
  )
  const landingFiles = readdirSync(landingDir)
    .filter((file) => file.endsWith(".tsx"))
    .sort()

  return [
    readProjectFile("app", "page.tsx"),
    readProjectFile("components", "layout", "marketing-layout.tsx"),
    ...landingFiles.map((file) =>
      readFileSync(path.join(landingDir, file), "utf8")
    ),
  ].join("\n")
}

test("Given compact homepage source When risky landing claims are reviewed Then rigid and misleading claims are absent", () => {
  // Given
  const source = readLandingSources()
  const bannedClaims = [
    "one honest stamp per day",
    "one honest stamp a day",
    "One stamp per business day",
    "one per UK business day",
    "One stamp a day, honest",
    "per UK business day",
    "Stamped, not tracked",
    "Mystery reward pool",
    "Mystery rewards bring people back",
    "staff-approved",
    "Staff-approved",
    "staff approval",
    "Your team approves each stamp",
    "Your team confirms the stamp",
  ]

  // When / Then
  for (const claim of bannedClaims) {
    assert.equal(source.includes(claim), false, claim)
  }
})

test("Given the root route When section composition is checked Then the compact source contract holds", () => {
  // Given
  const homepage = readProjectFile("app", "page.tsx")
  const faqSource = readProjectFile(
    "components",
    "marketing",
    "landing",
    "faq.tsx"
  )
  const sectionComponents = [
    "LandingHero",
    "ProofStrip",
    "CounterFlow",
    "VenueBenefits",
    "VenueProof",
    "TrustPricing",
    "LandingFaq",
    "FinalCta",
    "PilotProofStrip",
  ].filter((component) => homepage.includes(`<${component}`))

  // When
  const faqQuestionCount = (faqSource.match(/\n\s*q:\s*"/g) ?? []).length

  // Then
  assert.ok(sectionComponents.length <= 8, sectionComponents.join(", "))
  assert.ok(faqQuestionCount <= 5, `FAQ has ${faqQuestionCount} questions`)
})

test("Given venue proof When the landing source is checked Then all nine venues and postcodes render with production copy", () => {
  // Given
  const homepage = readProjectFile("app", "page.tsx")
  const venueProof = readProjectFile(
    "components",
    "marketing",
    "landing",
    "venue-proof.tsx"
  )
  const venueProofData = readProjectFile(
    "components",
    "marketing",
    "landing",
    "venue-proof-data.ts"
  )
  const landingWithData = `${readLandingSources()}\n${venueProofData}`
  const proofEntries = [
    ["The Prince of Wales", "MK43 8PE"],
    ["Old School House", "MK11 1JA"],
    ["Barley Mow", "PE29 1XU"],
    ["The Queen Elizabeth", "PE30 4EL"],
    ["The Railway", "PE7 1UF"],
    ["The Bell", "PE28 5UY"],
    ["Old Crown", "CB3 0QD"],
    ["The Corner House", "CB5 8JE"],
    ["White Horse", "CB25 9HP"],
  ]

  // When / Then
  assert.match(homepage, /<VenueProof \/>/)
  assert.match(venueProof, /Venue voices/)
  assert.match(venueProof, /VenueProofReviews/)
  assert.match(
    readProjectFile(
      "components",
      "marketing",
      "landing",
      "venue-proof-reviews.tsx"
    ),
    /See more/
  )
  assert.match(venueProofData, /shuffleVenueProofIndices/)
  assert.doesNotMatch(venueProof, /[Dd]raft/)
  assert.doesNotMatch(venueProof, /grid-rows-3/)

  for (const [name, postcode] of proofEntries) {
    assert.match(landingWithData, new RegExp(name))
    assert.match(landingWithData, new RegExp(postcode))
  }
})

test("Given future proof support When pilot proof is disabled Then no fake proof is shown publicly", () => {
  // Given
  const componentPath = path.join(
    projectRoot,
    "components",
    "marketing",
    "pilot-proof-strip.tsx"
  )
  assert.equal(existsSync(componentPath), true)

  const pilotProof = readFileSync(componentPath, "utf8")
  const proofStrip = readProjectFile(
    "components",
    "marketing",
    "landing",
    "proof-strip.tsx"
  )
  const landingSources = readLandingSources()

  // When / Then
  assert.match(pilotProof, /export const SHOW_PILOT_PROOF = false/)
  assert.match(proofStrip, /<PilotProofStrip \/>/)
  assert.doesNotMatch(landingSources, /pilotVenues|useCases/)
  assert.doesNotMatch(
    pilotProof,
    /5 venues testing|412 QR scans|221 stamps issued|37 repeat visits tracked/
  )
})
