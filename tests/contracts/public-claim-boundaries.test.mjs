import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

const readSource = (path) => readFileSync(join(process.cwd(), path), "utf8")

test("Given every public claim entry point When source is inspected Then the shared ceiling precedes hash or resolver effects", () => {
  const cases = [
    [
      "app/claim/[token]/page.tsx",
      "parsePublicClaimToken(token)",
      "createHash(",
    ],
    [
      "lib/loyalty-invites/claim-context.ts",
      "parsePublicClaimToken(token)",
      "hashInviteToken(parsed.value)",
    ],
    [
      "lib/offers/claim-context.ts",
      "parsePublicClaimToken(token)",
      "hashOfferToken(parsed.value)",
    ],
    [
      "app/invite/[token]/actions.ts",
      "parsePublicClaimToken(token)",
      "resolveInviteClaimContext(parsed.value)",
    ],
    [
      "app/offer/[token]/actions.ts",
      "parsePublicClaimToken(token)",
      "resolveOfferClaimContext(parsed.value)",
    ],
  ]

  for (const [path, boundary, effect] of cases) {
    const source = readSource(path)
    assert.ok(source.indexOf(boundary) >= 0, `${path} must parse the token`)
    assert.ok(
      source.indexOf(boundary) < source.indexOf(effect),
      `${path} must enforce the ceiling before its effect`
    )
  }
})

test("Given the shared public claim parser When source is inspected Then one application ceiling owns all callers", () => {
  const parser = readSource("lib/security/public-claim-token.ts")
  assert.match(parser, /MAX_PUBLIC_CLAIM_TOKEN_LENGTH = 512/)
  assert.match(parser, /value\.length > MAX_PUBLIC_CLAIM_TOKEN_LENGTH/)
})
