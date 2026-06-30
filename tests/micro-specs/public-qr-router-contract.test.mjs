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

test("Given a public QR route is scanned When source is inspected Then it resolves QR server-side and handles unavailable states", () => {
  const page = readProjectFile("app", "q", "[qrId]", "page.tsx")

  assert.match(page, /const \{ qrId \} = await params/)
  assert.match(page, /resolveQrForJoin\(qrId, \{[\s\S]*scanRateLimitIdentity:/)
  assert.match(page, /rateLimitIdentityFromHeaders\(await headers\(\)\)/)
  assert.match(page, /catch \(error\) \{[\s\S]*error instanceof RateLimitError[\s\S]*return <RateLimitedQr \/>/)
  assert.match(page, /if \(!qrContext \|\| !qrContext\.available\) \{[\s\S]*return <UnavailableQr \/>/)
  assert.match(page, /getExistingMembershipForCurrentUser\(\s*qrContext\.merchant\.id\s*\)/)
})

test("Given a public QR route redirects customers When QR ids cross into URLs Then QR query values are encoded", () => {
  const page = readProjectFile("app", "q", "[qrId]", "page.tsx")

  assert.match(page, /const encodedQrId = encodeURIComponent\(qrContext\.qrId \?\? qrId\)/)
  assert.match(page, /const joinUrl = `\/m\/\$\{qrContext\.merchant\.business_slug\}\/join\?qr=\$\{encodedQrId\}`/)
  assert.match(page, /redirect\(`\/card\/\$\{membership\.id\}\/stamp\?qr=\$\{encodedQrId\}`\)/)
  assert.doesNotMatch(page, /\?qr=\$\{qrContext\.qrId\}/)
  assert.doesNotMatch(page, /stamp\?qr=\$\{qrContext\.qrId\}/)
})
