import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

/**
 * Source contract for four review findings on the Offers feature, all of the
 * same family: a control that exists on screen or in a comment but not in the
 * code path that matters.
 *
 *   * the merchant desk's claim and welcome-stamp totals were assembled from a
 *     PostgREST collection read that `max_rows = 1000` silently truncates;
 *   * a failed offer-claim erasure was ignored, so a GDPR deletion reported
 *     success it had not achieved;
 *   * a failed subject-access companion read was emitted as "this customer has
 *     no offer data", which is an incomplete disclosure with no warning;
 *   * the publish acknowledgement was an HTML `required` checkbox that no
 *     server code ever read, and the management panel published without one.
 *
 * None of these is visible in a passing render, and three of them cannot be
 * reached at all without a live database, so they are pinned here in the source
 * tier where the behaviour is decided. The DB tier proves the totals RPC itself
 * (tests/db/offer-campaign-metrics.test.mjs).
 */

const projectRoot = process.cwd()

function readProjectFile(...segments) {
  return readFileSync(join(projectRoot, ...segments), "utf8")
}

/** JSX and argument lists are line-wrapped by the formatter. */
function flatten(source) {
  return source.replace(/\s+/g, " ")
}

describe("merchant desk totals are counted by the database", () => {
  const deskModule = readProjectFile("lib", "merchant", "offer-campaigns.ts")
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260804103000_offer_campaign_metrics_aggregate.sql"
  )

  it("reads one row of totals from the aggregate RPC", () => {
    assert.match(
      flatten(deskModule),
      /supabase\.rpc\("offer_campaign_metrics", \{ p_campaign_id: campaignId, \}\)/
    )
  })

  it("never counts claim rows fetched through PostgREST", () => {
    // The exact shape of the defect: a collection read of the claims ledger,
    // whose length and summed column were then presented as exact totals.
    // `max_rows` caps that response at 1000 rows and says nothing about it.
    assert.equal(deskModule.includes('.from("offer_campaign_claims")'), false)
    assert.equal(deskModule.includes("claimRows"), false)
    assert.equal(
      deskModule.includes('.from("offer_campaign_open_counts")'),
      false
    )
    assert.equal(deskModule.includes('.from("offer_redemptions")'), false)
    assert.equal(
      deskModule.includes('.from("offer_discount_entitlements")'),
      false
    )
  })

  it("says why, so the read is not re-inlined by the next hand", () => {
    assert.match(deskModule, /max_rows = 1000/)
  })

  it("aggregates all five totals in SQL", () => {
    for (const total of [
      "link_opens",
      "claims",
      "bonus_stamps_issued",
      "active_passes",
      "pass_redemptions",
    ]) {
      assert.ok(
        migration.includes(total),
        `${total} must be computed in the migration`
      )
    }
    assert.match(migration, /count\(\*\)::bigint/)
    assert.match(
      migration,
      /coalesce\(sum\(claims\.bonus_stamps_awarded\), 0\)/
    )
  })

  it("contains the new function to service_role", () => {
    assert.match(
      flatten(migration),
      /revoke all on function public\.offer_campaign_metrics\(uuid\) from public, anon, authenticated;/
    )
    assert.match(
      flatten(migration),
      /grant execute on function public\.offer_campaign_metrics\(uuid\) to service_role;/
    )
    assert.match(migration, /notify pgrst, 'reload schema';/)
  })
})

describe("an admin data request never reports work it did not do", () => {
  const actions = flatten(readProjectFile("app", "admin", "actions.ts"))

  const COMPANIONS = [
    "admin_erase_loyalty_invitations_for_customer",
    "admin_erase_offer_claims_for_customer",
    "loyalty_invitations_export_for_customer",
    "offer_claims_export_for_customer",
  ]

  it("destructures an error from every companion RPC", () => {
    for (const rpc of COMPANIONS) {
      assert.match(
        actions,
        new RegExp(`error: \\w+ \\} = await supabase\\.rpc\\( "${rpc}"`),
        `${rpc} must surface its own error`
      )
    }
  })

  it("aborts a deletion before it is logged as handled", () => {
    // Both erasures run in their own transaction, separate from
    // admin_log_data_request. If one fails and the log still runs, the console
    // says the subject's data is gone while their pass scan tokens and
    // redeemable discount passes are still there.
    const eraseIndex = actions.indexOf("admin_erase_offer_claims_for_customer")
    const guardIndex = actions.indexOf("if (offerEraseFailure) return")
    const logIndex = actions.indexOf('"admin_log_data_request"')

    assert.ok(eraseIndex > 0 && guardIndex > eraseIndex)
    assert.ok(
      guardIndex < logIndex,
      "the erasure guard must return before the request is logged"
    )
    assert.match(actions, /if \(inviteEraseFailure\) return inviteEraseFailure/)
  })

  it("withholds an incomplete subject-access export", () => {
    assert.match(
      actions,
      /rpcFailure\( invitationsError \?\? offerClaimsError,/
    )
    assert.match(actions, /if \(exportFailure\) return exportFailure/)

    // The failure must be checked BEFORE the payload is assembled, or an
    // absent read still ships as an empty object.
    const guardIndex = actions.indexOf(
      "if (exportFailure) return exportFailure"
    )
    const payloadIndex = actions.indexOf("offer_campaigns: offerClaims")
    assert.ok(guardIndex > 0 && guardIndex < payloadIndex)
  })
})

describe("publishing an offer requires a server-checked acknowledgement", () => {
  const actions = flatten(readProjectFile("app", "app", "offers", "actions.ts"))
  const form = readProjectFile(
    "components",
    "merchant",
    "offer-campaign-form.tsx"
  )
  const panel = readProjectFile(
    "components",
    "merchant",
    "offer-campaign-panel.tsx"
  )

  it("refuses a publish that does not carry the acknowledgement", () => {
    assert.match(
      actions,
      /if \(textValue\(formData, "acknowledgement"\) !== PUBLISH_ACKNOWLEDGEMENT\) \{/
    )
    assert.match(actions, /error=not_acknowledged/)
  })

  it("checks it before the campaign is published, not after", () => {
    const guardIndex = actions.indexOf('textValue(formData, "acknowledgement")')
    const rpcIndex = actions.indexOf('supabase.rpc("publish_offer_campaign"')

    assert.ok(guardIndex > 0 && rpcIndex > 0)
    assert.ok(
      guardIndex < rpcIndex,
      "the acknowledgement must gate the RPC, not follow it"
    )
  })

  it("carries the acknowledgement from every surface that publishes", () => {
    for (const [label, source] of [
      ["the creator's review step", form],
      ["the management panel", panel],
    ]) {
      const fields = flatten(source)
      assert.match(
        fields,
        /name="acknowledgement" value="terms-locked" required/,
        `${label} must post the value the server checks`
      )
      assert.match(
        fields,
        /I understand these terms are locked once published/,
        `${label} must say what is being acknowledged`
      )
    }
  })

  it("has copy for the refusal in the console's closed notice set", () => {
    assert.match(actions, /\| "not_acknowledged"/)
    assert.match(flatten(panel), /not_acknowledged: "Confirm you understand/)
  })
})
