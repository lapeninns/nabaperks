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

test("Given the public merchant preview has no QR context When CTA copy renders Then it promises joining rather than a same-day stamp", () => {
  const preview = readProjectFile("app", "m", "[merchantSlug]", "page.tsx")

  assert.match(preview, /buildCustomerJoinHref\(merchantSlug/)
  assert.match(preview, /referralCode: ref/)
  assert.match(preview, />\s*Join rewards\s*<\/Link>/)
  assert.match(preview, /<CustomerReceipt[\s\S]*\bcompact\b/)
  // The journey preview uses the same non-compact treatment as the q-valid
  // welcome step (production-polish VCU-P2-02/03): reward patch inline with
  // the stamps at every width, venue initials on earned stamps.
  assert.match(preview, /<StampJourneyPreview[\s\S]{0,200}venueName=/)
  assert.doesNotMatch(preview, /<StampJourneyPreview[\s\S]{0,200}\bcompact\b/)
  assert.doesNotMatch(preview, /Get today's stamp/)
})

test("Given the compact stamp journey renders on phone width When source is inspected Then its reward chip can wrap", () => {
  const preview = readProjectFile(
    "components",
    "loyalty",
    "stamp-journey-preview.tsx"
  )

  assert.match(preview, /grid-cols-3/)
  assert.match(preview, /min-\[420px\]:\[grid-template-columns:repeat/)
})

test("Given public merchant preview is a conversion route When PWA install copy is mounted Then it does not cover the join CTA", () => {
  const pwa = readProjectFile("components", "pwa", "app-pwa.tsx")

  assert.match(pwa, /pathname\.startsWith\("\/m\/"\)/)
  assert.match(pwa, /surface === "marketing"/)
})

test("Given a returning QR customer verifies When navigation resolves Then the customer chooses the stamp explicitly", () => {
  const redirect = readProjectFile(
    "lib",
    "customer",
    "returning-qr-redirect.ts"
  )

  assert.match(redirect, /\/card\/\$\{membership\.id\}\/stamp\?qr=/)
  assert.doesNotMatch(redirect, /issueSelfServiceStamp|stamp_issued/)
})
