import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

/**
 * Source contract for the Offers pilot allowlist operator surface.
 *
 * `admin_set_merchant_offer_campaigns` shipped granted, guarded and named in a
 * privilege test — and with nothing in the application calling it, so starting
 * the pilot meant hand-running SQL against production. A privilege test asserts
 * who MAY execute a function; it passes whether or not anything ever does.
 * These pins assert that something does, that it is the RPC rather than a
 * direct table update, that the same admin gate as every sibling action stands
 * in front of it, and that the copy tells the operator what actually happens.
 */

const projectRoot = process.cwd()

function readProjectFile(...segments) {
  return readFileSync(join(projectRoot, ...segments), "utf8")
}

/** JSX copy is line-wrapped by the formatter, so assert on flattened text. */
function flattenCopy(source) {
  return source.replace(/\s+/g, " ")
}

function blockBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle)
  const end = source.indexOf(endNeedle, start + startNeedle.length)

  if (start === -1 || end === -1) return ""
  return source.slice(start, end)
}

const ADMIN_ACTIONS = "app/admin/actions.ts"
const ALLOWLIST_PANEL = "app/admin/merchants/offer-pilot-panel.tsx"
const ALLOWLIST_READ = "lib/admin/offer-allowlist.ts"
const MERCHANTS_PAGE = "app/admin/merchants/page.tsx"

describe("contract-offer-admin-allowlist source contract", () => {
  it("exposes the allowlist toggle from the admin merchants surface", () => {
    const page = readProjectFile(MERCHANTS_PAGE)
    const panel = readProjectFile(ALLOWLIST_PANEL)

    assert.match(page, /OfferPilotPanel/)
    assert.match(page, /getOfferPilotAllowlist/)
    assert.match(panel, /setMerchantOfferCampaignsAction/)
    // The control writes the venue id and the value it is moving to, so the
    // action never has to guess which direction the operator meant.
    assert.match(panel, /name="merchantId"/)
    assert.match(panel, /name="enabled"/)
  })

  it("routes the write through the guarded RPC, never a table update", () => {
    const actions = readProjectFile(ADMIN_ACTIONS)
    const toggle = blockBetween(
      actions,
      "export async function setMerchantOfferCampaignsAction(",
      "export async function recordConsentOptOutAction("
    )

    assert.notEqual(toggle, "", "the allowlist action exists in app/admin")
    assert.match(
      toggle,
      /supabase\.rpc\(\s*"admin_set_merchant_offer_campaigns"/
    )
    assert.match(toggle, /p_merchant_id/)
    assert.match(toggle, /p_enabled/)

    // A direct write to merchants would bypass both is_internal_admin() and the
    // audit row the RPC writes for itself.
    assert.doesNotMatch(toggle, /from\("merchants"\)/)
    assert.doesNotMatch(toggle, /\.update\(/)

    // Service-role clients bypass RLS outright, so the database-side admin
    // guard would never see the caller. The action must use the operator's own
    // session, exactly like every sibling admin action.
    assert.match(toggle, /createSupabaseServerClient\(\)/)
    assert.doesNotMatch(toggle, /ServiceRole/)
  })

  it("stands the existing admin gate in front of the toggle", () => {
    const actions = readProjectFile(ADMIN_ACTIONS)
    const toggle = blockBetween(
      actions,
      "export async function setMerchantOfferCampaignsAction(",
      "export async function recordConsentOptOutAction("
    )

    assert.match(toggle, /await requireAdminAction\(\)/)
    // No bespoke gate: requireAdminAction is the shared step-up guard.
    assert.doesNotMatch(
      toggle,
      /getAdminAccess|requireAdminRead|internal_admins/
    )
  })

  it("revalidates the surface and the audit trail after a change", () => {
    const actions = readProjectFile(ADMIN_ACTIONS)
    const toggle = blockBetween(
      actions,
      "export async function setMerchantOfferCampaignsAction(",
      "export async function recordConsentOptOutAction("
    )

    assert.match(toggle, /revalidatePath\("\/admin\/merchants"\)/)
    assert.match(toggle, /revalidatePath\("\/admin\/audit"\)/)
    assert.match(toggle, /Logged to the audit trail\./)
  })

  it("says plainly what enabling and disabling do", () => {
    const panel = flattenCopy(readProjectFile(ALLOWLIST_PANEL))
    const actions = flattenCopy(readProjectFile(ADMIN_ACTIONS))

    // Enabling reveals a surface; it does not publish anything.
    assert.match(panel, /shows the Offers section to that venue's merchants/)
    assert.match(panel, /publishes nothing/)
    assert.match(actions, /nothing is published yet/)

    // Disabling hides the surface without cancelling issued passes.
    assert.match(panel, /hides the Offers section/i)
    assert.match(panel, /are not cancelled/)
    assert.match(actions, /Passes customers already hold still work\./)
  })

  it("tells the operator the feature flag is the other half of the gate", () => {
    const panel = readProjectFile(ALLOWLIST_PANEL)

    assert.match(panel, /featureFlagEnabled/)
    assert.match(panel, /NABAPERKS_FEATURE_MERCHANT_OFFER_CAMPAIGNS/)
  })

  it("reads the allowlist through the admin service-role boundary", () => {
    const read = readProjectFile(ALLOWLIST_READ)

    assert.match(read, /^import "server-only"/m)
    assert.match(read, /createAdminServiceRoleClient/)
    assert.match(read, /offer_campaigns_enabled/)
    // Reads only: the write path is the RPC, not this module.
    assert.doesNotMatch(read, /\.update\(|\.rpc\(/)
  })

  it("seeds Old Crown Girton into the pilot for local and staging", () => {
    const seed = readProjectFile("supabase/seed.sql")
    const block = blockBetween(
      seed,
      "-- Offers pilot allowlist:",
      "-- Old Crown Girton pilot venue:"
    )

    assert.notEqual(block, "", "the seed sets the pilot allowlist")
    assert.match(block, /update public\.merchants/)
    assert.match(block, /offer_campaigns_enabled/)
    assert.match(block, /old-crown-girton/)
  })

  it("keeps pilot state out of the migrations", () => {
    // A migration that flips offer_campaigns_enabled would turn the pilot on in
    // production the moment it applied, with no operator and no audit row.
    const schema = readProjectFile(
      "supabase/migrations/20260803100000_offer_campaign_schema.sql"
    )

    assert.match(schema, /add column if not exists offer_campaigns_enabled/)
    assert.doesNotMatch(schema, /old-crown-girton/)
    assert.doesNotMatch(schema, /set offer_campaigns_enabled = true/)
  })
})
