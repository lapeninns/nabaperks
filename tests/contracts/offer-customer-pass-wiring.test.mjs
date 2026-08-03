import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

/**
 * Source contract for the customer's route to a claimed discount pass.
 *
 * The rail that shows a pass shipped once as unreachable dead code: both
 * surfaces rendered it, the prop was optional with an `= []` default, and no
 * route ever fed it — so a customer who claimed an offer held an entitlement
 * with no way to open it, and nothing in the gate said a word.
 *
 * The primary fix is type-level: the props are required, so a route that omits
 * one fails `tsc`. These pins guard what a type cannot: that the required-ness
 * is not quietly relaxed back to a default, that a real loader stands behind
 * the prop, and that a pass which cannot be honoured never offers a QR.
 */

const projectRoot = process.cwd()

function readProjectFile(...segments) {
  return readFileSync(join(projectRoot, ...segments), "utf8")
}

/** JSX props are line-wrapped by the formatter, so assert on flattened text. */
function flatten(source) {
  return source.replace(/\s+/g, " ")
}

/** Every `.tsx` under `app/`, so a new surface cannot be missed by a fixed list. */
function appComponentFiles() {
  return readdirSync(join(projectRoot, "app"), { recursive: true })
    .map((entry) => String(entry))
    .filter((entry) => entry.endsWith(".tsx"))
    .map((entry) => join("app", entry))
}

/** The opening tag of every `<Name ...>` usage in a source file. */
function openingTags(source, componentName) {
  return flatten(source)
    .split(`<${componentName}`)
    .slice(1)
    .map((fragment) => fragment.slice(0, fragment.search(/\/?>/)))
}

const PASS_CONSUMERS = [
  {
    component: "CustomerCardExperience",
    props: ["offerPasses", "offerClaimNotice"],
  },
  { component: "HomeCardTile", props: ["offerPasses"] },
]

describe("contract-offer-customer-pass-wiring source contract", () => {
  it("lists a customer's live passes through the partial index built for it", () => {
    const loader = readProjectFile("lib/customer/offer-pass.ts")

    assert.match(loader, /^import "server-only"/m)
    assert.match(loader, /export async function listCustomerOfferPasses\(/)
    assert.match(
      loader,
      /export async function listCustomerOfferPassesForMembership\(/
    )
    // offer_discount_entitlements_live_idx is (customer_id, valid_to)
    // where status = 'active' — the read must match it, filter and order.
    const listBody = loader.slice(
      loader.indexOf("async function listLivePasses")
    )
    assert.match(listBody, /\.from\("offer_discount_entitlements"\)/)
    assert.match(listBody, /\.eq\("customer_id", customer\.id\)/)
    assert.match(listBody, /\.eq\("status", "active"\)/)
    assert.match(listBody, /\.order\("valid_to", \{ ascending: true \}\)/)
    assert.match(listBody, /\.limit\(MAX_CUSTOMER_OFFER_PASSES\)/)
    // A membership id arrives from the URL, so it may only ever narrow the
    // customer's own rows — never stand in for the ownership filter.
    assert.ok(
      listBody.indexOf('.eq("customer_id", customer.id)') <
        listBody.indexOf('.eq("membership_id", membershipId)'),
      "the membership filter must narrow an already customer-scoped read"
    )
    // A signed-out reader gets nothing rather than another customer's passes.
    assert.match(listBody, /if \(!customer\) return \[\]/)
  })

  it("keeps the offer props required so a route cannot omit them", () => {
    const experience = flatten(
      readProjectFile("components/customer/customer-card-experience.tsx")
    )
    const tile = flatten(
      readProjectFile("components/customer/home-card-tile.tsx")
    )

    for (const source of [experience, tile]) {
      assert.match(source, /offerPasses: readonly CustomerOfferPass\[\]/)
      assert.doesNotMatch(
        source,
        /offerPasses\?:/,
        "an optional offerPasses prop is how the rail shipped unreachable"
      )
      assert.doesNotMatch(
        source,
        /offerPasses = \[\]/,
        "a default value hides a route that never feeds the rail"
      )
    }

    assert.match(experience, /offerClaimNotice: OfferClaimNotice \| null/)
    assert.doesNotMatch(experience, /offerClaimNotice\?:/)
  })

  it("feeds every surface that renders a card or a tile", () => {
    const files = appComponentFiles()

    for (const { component, props } of PASS_CONSUMERS) {
      const usages = files.flatMap((file) =>
        openingTags(readProjectFile(file), component).map((tag) => ({
          file,
          tag,
        }))
      )

      assert.ok(
        usages.length > 0,
        `${component} must be rendered by at least one route`
      )

      for (const { file, tag } of usages) {
        for (const prop of props) {
          assert.ok(
            tag.includes(`${prop}=`),
            `${file} renders <${component}> without ${prop}`
          )
        }
      }
    }
  })

  it("reaches the pass from the card and the home rail", () => {
    const experience = flatten(
      readProjectFile("components/customer/customer-card-experience.tsx")
    )
    const home = flatten(readProjectFile("app/home/(authed)/page.tsx"))
    const card = flatten(readProjectFile("app/card/[membershipId]/page.tsx"))

    assert.match(card, /listCustomerOfferPassesForMembership\(membershipId\)/)
    assert.match(home, /listCustomerOfferPasses\(\)/)
    assert.match(home, /groupOfferPassesByMembership\(offerPasses\)/)
    // The card's own route to the code; the home tile carries a second one,
    // pinned below. Between them the chain closes from either surface.
    assert.match(experience, /href=\{`\/pass\/\$\{pass\.entitlementId\}`\}/)
  })

  it("never offers a code for a pass the venue would refuse", () => {
    const experience = flatten(
      readProjectFile("components/customer/customer-card-experience.tsx")
    )
    const tile = flatten(
      readProjectFile("components/customer/home-card-tile.tsx")
    )
    // Both surfaces now offer the code themselves, so both must gate it.
    for (const [name, source] of [
      ["customer-card-experience.tsx", experience],
      ["home-card-tile.tsx", tile],
    ]) {
      const passLinkIndex = source.indexOf("/pass/${pass.entitlementId}")
      const gateIndex = source.lastIndexOf("pass.presentable ?", passLinkIndex)

      assert.ok(
        passLinkIndex !== -1,
        `${name} must carry a route to the pass code`
      )
      assert.ok(
        gateIndex !== -1,
        `${name} must sit the pass link inside a presentable gate`
      )
      assert.ok(gateIndex < passLinkIndex, `${name} must gate before it links`)
      // `presentable` already folds the pass's own state together with whether
      // the venue can honour it, so no surface re-derives that judgement.
      assert.doesNotMatch(source, /state === "active" &&/)
    }
  })

  it("keeps a route to the pass when a redeemable reward takes over the tile", () => {
    const tile = flatten(
      readProjectFile("components/customer/home-card-tile.tsx")
    )

    // The whole tile links to the reward rather than the card as soon as a
    // stamp reward is redeemable, and every other way back — /home/rewards,
    // the redeem banner, and the venue QR through /card/<id>/stamp — lands on
    // that same reward screen. A pass chip nested inside the tile's own link
    // therefore cannot carry a link of its own, so the customer could see the
    // pass and have no way to open its code until they redeemed the reward.
    assert.ok(
      tile.includes("/reward/${card.stampRewardId}"),
      "the tile links to the reward when one is redeemable"
    )

    const outerLinkClose = tile.indexOf("</Link>")
    const passRail = tile.indexOf("offerPasses.map(")

    assert.ok(outerLinkClose !== -1, "the tile wraps the card in one link")
    assert.ok(passRail !== -1, "the tile renders the pass rail")
    assert.ok(
      passRail > outerLinkClose,
      "the pass rail must sit outside the tile's own link, or it can never carry one"
    )

    // And having left that link, the chip carries the destination itself.
    assert.ok(
      tile.includes("/pass/${pass.entitlementId}"),
      "the tile must offer its own route to the pass code"
    )
  })

  it("answers the offer outcomes the join flow redirects with", () => {
    const cardPage = flatten(
      readProjectFile("app/card/[membershipId]/page.tsx")
    )
    const joinActions = readProjectFile("app/m/[merchantSlug]/join/actions.ts")
    const experience = flatten(
      readProjectFile("components/customer/customer-card-experience.tsx")
    )

    // The redirects that exist today; each must have a reader.
    assert.match(joinActions, /\?welcome=1&offer=1/)
    assert.match(joinActions, /\?offer=claimed/)
    assert.match(joinActions, /\?membership=existing/)

    assert.match(cardPage, /offer\?: string/)
    assert.match(cardPage, /membership\?: string/)
    assert.match(
      cardPage,
      /offerClaimNotice=\{offerClaimNoticeFromParams\(query\)\}/
    )

    for (const notice of ["claimed", "already_claimed"]) {
      assert.ok(
        experience.includes(`notice === "${notice}"`),
        `the card must say something for the ${notice} outcome`
      )
    }
    assert.match(experience, /You are already a member here\./)
    assert.match(experience, /You already have this offer\./)
    assert.match(experience, /Offer added to your card\./)
    // ?membership=existing is emitted by the loyalty-invite claim as well
    // (actions.ts, the invite branch), so the already-a-member copy must not
    // claim an offer was refused.
    const memberBlock = experience.slice(
      experience.indexOf("You are already a member here.")
    )
    assert.doesNotMatch(
      memberBlock.slice(0, 200),
      /offer/i,
      "the already-a-member notice must not name a mechanism it cannot know"
    )
  })

  it("keeps the focus and mono-type rules on the surfaces it touches", () => {
    const files = [
      "components/customer/customer-card-experience.tsx",
      "components/customer/home-card-tile.tsx",
      "app/card/[membershipId]/page.tsx",
      "app/card/[membershipId]/stamp/page.tsx",
      "app/reward/[rewardId]/page.tsx",
      "app/home/(authed)/page.tsx",
    ]

    for (const file of files) {
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

  it("keeps the pure pass helpers free of server dependencies", () => {
    const view = readProjectFile("lib/customer/offer-pass-view.ts")

    assert.doesNotMatch(view, /^import /m)
    assert.match(view, /export function groupOfferPassesByMembership/)
    assert.match(view, /export function offerClaimNoticeFromParams/)
  })
})
