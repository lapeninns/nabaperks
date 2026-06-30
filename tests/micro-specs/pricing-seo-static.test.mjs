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

test("Given pricing is a public acquisition route When source contracts are inspected Then metadata and checkout state avoid page searchParams", () => {
  // Given
  const page = readProjectFile("app", "pricing", "page.tsx")
  const checkoutAlert = readProjectFile("app", "pricing", "checkout-alert.tsx")

  // When / Then
  assert.match(page, /import type \{ Metadata \} from "next"/)
  assert.match(page, /export const metadata: Metadata = \{/)
  assert.match(page, /alternates: \{ canonical: ROUTES\.pricing \}/)
  assert.match(page, /images: \[OG_IMAGE\]/)
  assert.match(page, /const pricingGraph = marketingPageGraph\(/)
  assert.match(page, /"@type": "Offer"/)
  assert.match(page, /"@type": "FAQPage"/)
  assert.match(
    page,
    /<Suspense fallback=\{null\}>[\s\S]*<PricingCheckoutAlert \/>[\s\S]*<\/Suspense>/
  )
  assert.match(page, /<JsonLd id="ld-pricing" data=\{pricingGraph\} \/>/)
  assert.doesNotMatch(page, /searchParams/)
  assert.doesNotMatch(page, /async function PricingPage/)

  assert.match(checkoutAlert, /"use client"/)
  assert.match(checkoutAlert, /useSearchParams/)
  assert.match(checkoutAlert, /checkout === "success"/)
  assert.match(checkoutAlert, /checkout === "cancelled"/)
})
