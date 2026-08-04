import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

/**
 * Source contract for four defects in the discount-pass flow, each of which
 * type-checked, linted and shipped:
 *
 *   1. redemptions were never attributed to the member of staff who confirmed
 *      the attestations;
 *   2. a customer could be shown, and could mint, a pass QR that the staff
 *      surface would refuse to honour, because the staff route carried a gate
 *      the customer's pass did not;
 *   3. the 'unauthorized' scan status collapsed into a 404, so the "belongs to
 *      another venue" banner was unreachable;
 *   4. a bonus-only claim told the customer about a discount pass that was
 *      never issued.
 *
 * These modules are `server-only` and reach Supabase and the session, so none
 * can be imported by a test. The behaviour is proved where it can be —
 * `tests/db/offer-pass-actor-attribution.test.mjs` for (1) — and the wiring
 * that carries it is pinned here.
 */

const projectRoot = process.cwd()

function readProjectFile(...segments) {
  return readFileSync(join(projectRoot, ...segments), "utf8")
}

/** JSX and call arguments are line-wrapped by the formatter. */
function flatten(source) {
  return source.replace(/\s+/g, " ")
}

const REDEMPTION = "lib/merchant/offer-pass-redemption.ts"
const SCAN_PAGE = "app/app/offers/scan/[passToken]/page.tsx"
const SCAN_ACTION = "app/app/offers/scan/[passToken]/actions.ts"
const PASS_LOADER = "lib/customer/offer-pass.ts"
const PASS_PAGE = "app/pass/[entitlementId]/page.tsx"
const PASS_QR_ROUTE = "app/pass/[entitlementId]/qr.png/route.ts"
const CARD_EXPERIENCE = "components/customer/customer-card-experience.tsx"
const HOME_TILE = "components/customer/home-card-tile.tsx"

const CLAIMED = 'notice === "claimed"'
const ALREADY_CLAIMED = 'notice === "already_claimed"'

describe("contract-offer-pass-redemption-guards source contract", () => {
  it("attributes a redemption to the signed-in member of staff", () => {
    const source = readProjectFile(REDEMPTION)
    const flat = flatten(source)

    assert.match(
      source,
      /import \{ getCurrentMerchant, getCurrentUser \} from "@\/lib\/auth\/session"/,
      "the boundary must read the signed-in user, not invent an auth path"
    )

    const call = flat.slice(flat.indexOf('supabase.rpc("redeem_offer_pass"'))
    const args = call.slice(0, call.indexOf("})"))

    assert.ok(
      args.includes("p_actor_user_id: user?.id ?? null"),
      "redeem_offer_pass must be told who redeemed, or redeemed_by_user_id stays null"
    )
    // The merchant id authorises; the user id attributes. Both are sent, and
    // neither stands in for the other.
    assert.ok(args.includes("p_merchant_id: merchant.id"))
  })

  it("answers an unauthorised scan before the pass-shaped checks", () => {
    const source = readProjectFile(REDEMPTION)
    const flat = flatten(source)

    // get_offer_pass_scan_context returns a foreign venue's token as the status
    // alone — no entitlement, no membership, no discount — so routing it
    // through passContext failed the required-field checks and gave a 404.
    assert.match(source, /\| \{ status: "unauthorized" \}/)
    assert.match(
      flat,
      /type MerchantOfferPassDetailStatus = Exclude< ?OfferPassScanStatus, ?"unauthorized" ?>/,
      "the pass-bearing member must not claim to carry an unauthorized row"
    )
    assert.match(
      flat,
      /function passContext\( scanToken: string, row: Record<string, unknown>, status: MerchantOfferPassDetailStatus/,
      "passContext must take only the statuses that arrive with a pass"
    )

    const early = source.indexOf('if (scanStatus === "unauthorized")')
    const delegate = source.indexOf("return passContext(")

    assert.ok(early !== -1, "the loader must handle unauthorized itself")
    assert.ok(delegate !== -1)
    assert.ok(
      early < delegate,
      "unauthorized must be answered before passContext, or it collapses to not_found"
    )
  })

  it("shows staff the other-venue banner instead of a 404", () => {
    const page = flatten(readProjectFile(SCAN_PAGE))

    const branch = page.indexOf('if (context.status === "unauthorized")')
    assert.ok(branch !== -1, "the scan page must render the unauthorized state")

    assert.doesNotMatch(
      page.slice(branch, branch + 200),
      /notFound\(\)/,
      "an unauthorised scan must not be reported as a missing page"
    )
    assert.ok(
      page.includes('offerPassScanBanner("unauthorized")'),
      "the intended banner copy must be the one staff see"
    )
    // Nothing about the other venue's member may reach this screen.
    const notice = page.slice(page.indexOf("function UnmatchedPassNotice"))
    assert.doesNotMatch(notice.slice(0, 400), /customerLabel|membershipId/)
  })

  it("presents a code exactly when staff are able to honour it", () => {
    const loader = readProjectFile(PASS_LOADER)
    const scanPage = readProjectFile(SCAN_PAGE)
    const scanAction = readProjectFile(SCAN_ACTION)

    // The customer's `presentable` must ask the same question the staff RPC
    // asks before it answers 'ready': the pass's own standing, and whether the
    // venue can honour it at all. Anything the customer side ignores becomes a
    // code minted for a till that will refuse it.
    assert.match(
      flatten(loader),
      /presentable: state === "active" && availability\.available/,
      "the customer gate must be the pass's state and the venue's availability"
    )
    assert.match(loader, /loyaltyAvailability\(\{/)
    // Withdrawing a code is never a data change: no surface may write the
    // entitlement away, so a pass comes back the moment the reason clears.
    assert.doesNotMatch(loader, /\.update\(|\.delete\(/)

    // The other half of the same invariant, and the shape of the defect this
    // pins: a gate that exists only on the staff side hands the customer a QR
    // that the scan route answers with a 404. If a kill switch is ever
    // reintroduced here, `lib/customer/offer-pass.ts` must fold it into
    // `presentable` in the same change — and this assertion must be updated to
    // check both sides rather than simply deleted.
    for (const [name, source] of [
      ["the scan page", scanPage],
      ["the confirm action", scanAction],
    ]) {
      assert.doesNotMatch(
        source,
        /loadOfferDeskContext|isOfferCampaignsEnabled/,
        `${name} must not gate redemption on something the customer pass ignores`
      )
    }
  })

  it("mints no pass code while the pass is not presentable", () => {
    const route = flatten(readProjectFile(PASS_QR_ROUTE))
    const page = flatten(readProjectFile(PASS_PAGE))

    const gate = route.indexOf("!result.pass.presentable")
    const mint = route.indexOf("mintOfferPassScanToken(")

    assert.ok(gate !== -1, "the QR route must check presentability")
    assert.ok(mint !== -1)
    assert.ok(
      gate < mint,
      "minting first and checking after leaves live bearer rows behind every probe"
    )

    const passBody = page.slice(page.indexOf("function PassBody"))
    assert.ok(passBody.includes("if (pass.presentable)"))
    assert.ok(
      passBody.includes("Not available just now"),
      "a pass with no code must say so calmly rather than show nothing"
    )
  })

  it("never promises a discount pass that was not issued", () => {
    const flat = flatten(readProjectFile(CARD_EXPERIENCE))

    // A bonus-stamps-only campaign creates no entitlement, so the claim banner
    // may only mention a pass when this card actually carries one.
    assert.match(flat, /hasDiscountPass=\{offerPasses\.length > 0\}/)
    assert.match(flat, /hasDiscountPass: boolean/)

    const start = flat.indexOf("function OfferClaimBanner")
    const banner = flat.slice(start, flat.indexOf("/**", start))

    assert.ok(banner.includes(CLAIMED), "the claimed outcome must be answered")
    assert.ok(
      banner.includes(ALREADY_CLAIMED),
      "the repeat-claim outcome must be answered"
    )

    const promises = banner.split("discount pass").slice(0, -1)
    assert.ok(
      promises.length >= 1,
      "the pass copy must survive for the case that does have a pass"
    )
    for (const before of promises) {
      assert.ok(
        before.lastIndexOf("hasDiscountPass ? ") > before.lastIndexOf(" : "),
        "every discount-pass promise must sit inside a hasDiscountPass check"
      )
    }
  })

  it("keeps the home tile free of the same promise", () => {
    const tile = flatten(readProjectFile(HOME_TILE))

    // The tile carries no claim banner at all, and its only pass copy is inside
    // the chip rendered once per real pass — so there was nothing to correct
    // here, and this pins that it stays that way.
    assert.doesNotMatch(tile, /OfferClaimBanner|offerClaimNotice/)

    assert.equal(
      tile.split("<TilePassChip").length - 1,
      1,
      "the tile must render the pass chip in exactly one place"
    )
    assert.ok(
      tile.indexOf("offerPasses.map(") < tile.indexOf("<TilePassChip"),
      "the chip must be rendered per pass, never unconditionally"
    )
    assert.ok(
      tile.indexOf("offerPasses.map(") < tile.indexOf("Discount pass"),
      "no pass copy may sit outside the per-pass chip"
    )
  })

  it("keeps the surfaces it touches inside the design rules", () => {
    for (const file of [SCAN_PAGE, PASS_PAGE, CARD_EXPERIENCE, HOME_TILE]) {
      const source = readProjectFile(file)
      assert.doesNotMatch(
        source,
        /focus-visible:ring/,
        `${file} must use .focus-ring`
      )
      assert.doesNotMatch(
        source,
        /font-mono[^\n]*uppercase[^\n]*text-\[\d+px\]/,
        `${file} must use .mono-meta / .mono-id / .eyebrow`
      )
    }
  })
})
