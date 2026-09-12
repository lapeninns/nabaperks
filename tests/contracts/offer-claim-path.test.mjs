import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

/**
 * Source contract for the public offer claim path: the poster landing, the
 * action that opens the join flow, and the join branch that consumes the
 * handoff.
 *
 * Everything pinned here is invisible until it is already wrong for a real
 * customer — a kill switch that only half works, a room refused by a limit meant
 * for one phone, a stale cookie that wins a race, and a handoff thrown away
 * before the answer was settled. None of them shows up as a failing render.
 */

const projectRoot = process.cwd()

function readProjectFile(...segments) {
  return readFileSync(join(projectRoot, ...segments), "utf8")
}

function flattenCopy(source) {
  return source.replace(/\s+/g, " ")
}

/** Comment prose, with the line markers dropped so wrapping is invisible. */
function flattenProse(source) {
  return source.replace(/^[ \t]*(\/\/|\*)[ \t]?/gm, "").replace(/\s+/g, " ")
}

const LANDING = "app/offer/[token]/page.tsx"
const LANDING_ACTION = "app/offer/[token]/actions.ts"
const JOIN_ACTIONS = "app/m/[merchantSlug]/join/actions.ts"
const HANDOFF = "lib/offers/claim-handoff.ts"

describe("contract-offer-claim-path source contract", () => {
  /**
   * A1 (the public claim path had no global feature-flag check) has been
   * OVERTAKEN, not fixed. A concurrent change on this branch removed the kill
   * switch outright — the `merchant_offer_campaigns` flag is gone from
   * the feature-flag configuration, `lib/offers/access.ts` and
   * `lib/merchant/offer-access.ts` are deleted, and
   * `supabase/migrations/20260804120000_offer_campaigns_always_on.sql` drops
   * `merchants.offer_campaigns_enabled` and the allowlist test inside
   * `get_offer_claim_context`, `claim_offer_campaign` and
   * `record_offer_campaign_open`, stating the decision as "no pilot list and no
   * kill switch". There is therefore no switch left for this path to re-check,
   * and a pin on one would be permanently red. If a kill switch ever returns,
   * the public claim path — the landing render, `startOfferClaimAction` and
   * `claimOfferCampaignIfPresent` — has to honour it at all three entry points,
   * because each is its own HTTP entry point.
   */
  it("keeps no dangling reference to the removed access gate", () => {
    for (const file of [LANDING, LANDING_ACTION, JOIN_ACTIONS]) {
      const source = readProjectFile(file)
      assert.doesNotMatch(source, /@\/lib\/offers\/access/, file)
      assert.doesNotMatch(source, /isOfferCampaignsEnabled/, file)
    }
  })

  it("rate limits the poster landing per device as well as per address", () => {
    const landing = readProjectFile(LANDING)

    // A campaign link is scanned by a room sharing one address, so a per-address
    // allowance sized for one phone refuses the traffic the poster is for.
    assert.match(landing, /const OFFER_LANDING_DEVICE_LIMIT = 30/)
    assert.match(landing, /const OFFER_LANDING_ADDRESS_LIMIT = 600/)
    assert.match(landing, /const OFFER_LANDING_WINDOW_MS = 15 \* 60 \* 1000/)

    // The per-device identity reuses the signed device cookie the proxy already
    // mints on this route; nothing here invents a second device identity.
    assert.match(landing, /from "@\/lib\/security\/rate-limit-core"/)
    assert.match(landing, /requestHeaders\.get\(CUSTOMER_DEVICE_HEADER\)/)
    assert.match(
      landing,
      /key: `offer:device:\$\{customerRateLimitIdentityFromHeaders\(requestHeaders\)\}`/
    )
    assert.match(
      landing,
      /key: `offer:ip:\$\{rateLimitIdentityFromHeaders\(requestHeaders\)\}`/
    )

    // Both buckets are enforced, and the narrow one first so a single device
    // cannot spend the room's allowance on its way to being cut off.
    const limiter = landing.slice(
      landing.indexOf("const OFFER_LANDING_WINDOW_MS"),
      landing.indexOf("export default async function OfferClaimPage")
    )
    assert.equal(
      limiter.match(/await enforceRateLimit\(\{/g)?.length,
      2,
      "both buckets must be enforced"
    )

    // And the render goes through it — the whole file holds exactly the two
    // enforcement calls above, so no route can quietly fall back to one bucket.
    const render = landing.slice(
      landing.indexOf("export default async function OfferClaimPage")
    )
    assert.match(
      render,
      /await enforceOfferLandingRateLimit\(await headers\(\)\)/
    )
    assert.equal(
      landing.match(/enforceRateLimit\(\{/g)?.length,
      2,
      "the landing must not enforce a bucket outside the shared limiter"
    )
    assert.ok(
      limiter.indexOf("offer:device:") < limiter.indexOf("offer:ip:"),
      "the per-device bucket must be enforced first"
    )

    // The reasoning is recorded where the numbers are, so neither can be changed
    // without meeting the argument for the other.
    const reasoning = flattenProse(limiter)
    assert.match(reasoning, /guest Wi-Fi, or a mobile carrier's NAT/)
    assert.match(reasoning, /no device cookie on its very first request/)
    assert.match(reasoning, /256-bit HMAC digest/)

    // Still limited, and still answered with the calm state.
    assert.match(landing, /RateLimitError/)
    assert.match(flattenCopy(landing), /Too many attempts from here\./)
  })

  it("runs the most recently started claim handoff first", () => {
    const join = readProjectFile(JOIN_ACTIONS)
    const handoff = readProjectFile(HANDOFF)

    // The order is decided from the cookies' own absolute expiries, not from the
    // order the two branches happen to be written in.
    assert.match(join, /from "@\/lib\/offers\/claim-handoff"/)
    assert.match(
      join,
      /const \[firstHandoff, secondHandoff\] = claimHandoffOrder\(\{/
    )
    assert.match(
      join,
      /await Promise\.all\(\[\s*readInviteCookie\(\),\s*readOfferCookie\(\),?\s*\]\)/
    )
    assert.match(join, /await claimHandoff\[firstHandoff\]\(\)/)
    assert.match(join, /await claimHandoff\[secondHandoff\]\(\)/)

    // A cookie for another venue must not influence the order.
    assert.match(join, /inviteCookie\?\.merchantSlug === merchantSlug/)
    assert.match(join, /offerCookie\?\.merchantSlug === merchantSlug/)

    // Neither branch may be called unconditionally ahead of the resolved order.
    const dispatch = join.slice(
      join.indexOf("const [inviteCookie, offerCookie]"),
      join.indexOf("const supabase = createSupabaseServiceRoleClient()")
    )
    assert.equal(
      dispatch.match(/await claimLoyaltyInviteIfPresent\(/g),
      null,
      "the invitation branch must run through the resolved order"
    )
    assert.equal(
      dispatch.match(/await claimOfferCampaignIfPresent\(/g),
      null,
      "the offer branch must run through the resolved order"
    )

    // Why, next to the code that does it.
    assert.match(
      flattenProse(join),
      /an offer is only ever for someone who is not already a member/
    )
    assert.match(flattenProse(handoff), /the later expiry is the later start/)
  })

  it("spends the offer handoff only on a settled outcome", () => {
    const join = readProjectFile(JOIN_ACTIONS)
    const branch = join.slice(
      join.indexOf("async function claimOfferCampaignIfPresent"),
      join.indexOf("export async function joinRewardsAction")
    )

    // Exactly one clear, and it comes after the finality test.
    assert.equal(
      branch.match(/await clearOfferCookie\(\)/g)?.length,
      1,
      "the offer handoff must be cleared in exactly one place"
    )
    assert.ok(
      branch.indexOf("isFinalOfferClaimOutcome(status)") <
        branch.indexOf("await clearOfferCookie()"),
      "finality must be decided before the handoff is spent"
    )

    // A transport failure returns before the clear, so the retry the message
    // invites still carries the offer.
    const transport = branch.slice(
      branch.indexOf("if (error) {"),
      branch.indexOf("const row =")
    )
    assert.match(transport, /return \{/)
    assert.doesNotMatch(transport, /clearOfferCookie/)

    // The retryable database answers do the same.
    assert.ok(
      branch.indexOf(
        'status === "card_too_short" || status === "unavailable"'
      ) < branch.indexOf("await clearOfferCookie()"),
      "a retryable outcome must return before the handoff is spent"
    )

    // An unrecognised or missing status refuses rather than falling through to
    // an ordinary join, which would spend the one membership the customer has.
    assert.match(branch, /if \(!isFinalOfferClaimOutcome\(status\)\) \{/)
    assert.match(branch, /typeof row\?\.status === "string"/)
    assert.match(flattenProse(branch), /a status this build does not recognise/)
  })

  it("keeps the claim-handoff decisions pure and provable", () => {
    const handoff = readProjectFile(HANDOFF)

    // No client, no request, no cookie — so a unit test can prove both rules.
    assert.doesNotMatch(handoff, /^import /m)
    assert.doesNotMatch(handoff, /@\/lib\/supabase/)
    assert.doesNotMatch(handoff, /next\/headers/)

    assert.match(handoff, /export function claimHandoffOrder\(/)
    assert.match(handoff, /export function isFinalOfferClaimOutcome\(/)
    assert.match(handoff, /export const FINAL_OFFER_CLAIM_STATUSES = \[/)
  })

  it("keeps the claim path free of banned utilities", () => {
    for (const file of [LANDING, LANDING_ACTION, JOIN_ACTIONS, HANDOFF]) {
      const source = readProjectFile(file)
      assert.ok(!source.includes("focus-visible:" + "ring"), file)
      assert.doesNotMatch(source, /\bTODO(?!\(#)/, file)
      assert.doesNotMatch(source, /\bFIXME\b/, file)
      assert.doesNotMatch(source, /: any\b/, file)
    }
  })
})
