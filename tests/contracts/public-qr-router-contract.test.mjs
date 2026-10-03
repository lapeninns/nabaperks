import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { scan } from "../support/public-qr-page.mjs"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Given a public QR route is scanned When source is inspected Then it resolves QR server-side and handles unavailable states", async () => {
  const page = readProjectFile("app", "q", "[qrId]", "page.tsx")

  assert.match(page, /export const dynamic = "force-dynamic"/)
  assert.match(page, /const \{ qrId \} = await params/)
  assert.match(page, /resolveQrForJoin\(qrId, \{[\s\S]*scanRateLimitIdentity:/)
  assert.match(page, /const requestHeaders = await headers\(\)/)
  assert.match(
    page,
    /customerRateLimitIdentityFromHeaders\(\s*requestHeaders\s*\)/
  )
  assert.match(
    page,
    /isRateLimited: \(error\) => error instanceof RateLimitError/
  )
  assert.match(page, /lookupMembership: getExistingMembershipForCurrentUser/)
  for (const scenario of [
    { resolve: async () => null, expected: /This QR isn't working/ },
    {
      resolve: async () => ({
        available: false,
        qrPaused: false,
        merchant: { id: "merchant-1" },
      }),
      expected: /This QR isn't working/,
    },
    {
      resolve: async () => ({
        available: false,
        qrPaused: true,
        merchant: { id: "merchant-1" },
      }),
      expected: /Customer scans are paused/,
    },
    {
      resolve: async () => null,
      rateLimited: true,
      expected: /Too many scans just now/,
    },
    {
      resolve: async () => {
        throw new TypeError("dependency unavailable")
      },
      expected: /We couldn't load this card/,
    },
  ]) {
    let membershipLookups = 0
    const answer = await scan({
      resolve: scenario.resolve,
      rateLimited: scenario.rateLimited,
      membership: async () => {
        membershipLookups += 1
        return null
      },
    })

    assert.match(answer.text, scenario.expected)
    assert.equal(answer.redirect, undefined)
    assert.equal(membershipLookups, 0)
  }
})

test("Given a public QR route redirects customers When QR ids cross into URLs Then QR query values are encoded", () => {
  const page = readProjectFile("app", "q", "[qrId]", "page.tsx")

  assert.match(
    page,
    /const encodedQrId = encodeURIComponent\(qrContext\.qrId \?\? qrId\)/
  )
  assert.match(
    page,
    /buildCustomerJoinHref\(qrContext\.merchant\.business_slug, \{[\s\S]*qrId: qrContext\.qrId \?\? qrId,[\s\S]*referralCode: ref,[\s\S]*step: "welcome"/
  )
  // A returning member is rendered in place (no 302); the canonical stamp
  // address is applied client-side and must carry the encoded id.
  assert.match(
    page,
    /<CanonicalUrl href=\{`\/card\/\$\{membership\.id\}\/stamp\?qr=\$\{encodedQrId\}`\} \/>/
  )
  assert.doesNotMatch(
    page,
    /redirect\(`\/card\/\$\{membership\.id\}\/stamp/,
    "a member's scan must not pay for a second server render via redirect"
  )
  assert.doesNotMatch(page, /\?qr=\$\{qrContext\.qrId\}/)
  assert.doesNotMatch(page, /stamp\?qr=\$\{qrContext\.qrId\}/)
})
