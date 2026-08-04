import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

/**
 * Source contract for the merchant Offers surface (/app/offers).
 *
 * These pins guard the properties that are invisible at runtime until they are
 * already wrong: the route wiring must stay consistent, the only link a
 * merchant is ever shown must be one the customer landing page would accept,
 * the campaign QR bytes must never be cached, and no tile may report a number
 * this feature does not record.
 */

const projectRoot = process.cwd()

function readProjectFile(...segments) {
  return readFileSync(join(projectRoot, ...segments), "utf8")
}

/**
 * The migration that defines a given SQL function, found by content rather than
 * by filename: a later migration may redefine it, and the pin should follow the
 * definition instead of a date stamp.
 */
function readMigrationDefining(functionName) {
  const directory = join(projectRoot, "supabase", "migrations")
  const needle = `function public.${functionName}(`

  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(directory, name), "utf8"))
    .filter((sql) => sql.includes(needle))
    .join("\n")
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

/**
 * The customer's offer landing screen, defined once. Step three of the merchant
 * creator and the public /offer/[token] route both render it, so it is a merchant
 * surface file as well as a customer one.
 */
const CUSTOMER_LANDING_COMPONENT = "components/customer/offer-claim-landing.tsx"

const OFFER_LANDING_ROUTE = "app/offer/[token]/page.tsx"

const OFFER_BENEFIT_PREVIEW =
  "components/merchant/offers/offer-benefit-preview.tsx"

const OFFER_SURFACE_FILES = [
  "app/app/offers/page.tsx",
  "app/app/offers/actions.ts",
  "app/app/offers/new/page.tsx",
  "app/app/offers/[campaignId]/qr/page.tsx",
  "app/app/offers/[campaignId]/qr.png/route.ts",
  "components/merchant/offer-campaign-form.tsx",
  "components/merchant/offer-campaign-panel.tsx",
  "components/merchant/offers/offer-benefit-preview.tsx",
  "components/merchant/offers/offer-rules-summary.tsx",
  CUSTOMER_LANDING_COMPONENT,
]

describe("contract-offer-campaign-ui source contract", () => {
  it("adds sidebar and home entry points for the offers route", () => {
    const nav = readProjectFile("components/layout/console-nav.ts")
    const homeActions = readProjectFile(
      "components/merchant/dashboard-header-actions.tsx"
    )
    const navBlock = blockBetween(
      nav,
      "export const merchantNavItems = [",
      "] satisfies readonly ShellNavItem[]"
    )

    assert.match(nav, /DiscountTag01Icon/)
    assert.match(navBlock, /href: "\/app\/offers"/)
    assert.match(navBlock, /label: "Offers"/)
    assert.match(homeActions, /href="\/app\/offers"/)
  })

  it("offers every merchant the section, with no rollout switch left to read", () => {
    const nav = readProjectFile("components/layout/console-nav.ts")
    const shell = readProjectFile("components/layout/merchant-app-shell.tsx")
    const homeActions = readProjectFile(
      "components/merchant/dashboard-header-actions.tsx"
    )
    const layout = readProjectFile("app/app/layout.tsx")
    const dashboard = readProjectFile("app/app/page.tsx")

    // Offers is an ordinary merchant section: the sidebar renders the registered
    // list as it stands, and neither entry point takes a switch to decide by.
    assert.match(shell, /items=\{merchantNavItems\}/)
    for (const source of [nav, shell, homeActions, layout, dashboard]) {
      assert.doesNotMatch(source, /offersEnabled/)
      assert.doesNotMatch(source, /merchantNavItemsFor/)
    }
  })

  it("keeps every offers route on its merchant session and onboarding redirect", () => {
    const routes = [
      "app/app/offers/page.tsx",
      "app/app/offers/new/page.tsx",
      "app/app/offers/[campaignId]/qr/page.tsx",
    ]

    for (const route of routes) {
      const source = readProjectFile(route)
      assert.match(source, /export const dynamic = "force-dynamic"/, route)
      assert.match(source, /getCurrentMerchant\(\)/, route)
      assert.match(source, /redirect\("\/app\/onboarding"\)/, route)
    }
  })

  it("keeps the staff pass-scan surface on its own session guard", () => {
    const scan = readProjectFile("app/app/offers/scan/[passToken]/page.tsx")
    const copy = flattenCopy(scan)

    assert.match(scan, /export const dynamic = "force-dynamic"/)
    assert.match(scan, /getCurrentMerchant\(\)/)

    // Pausing or ending a campaign stops new claims and leaves passes already
    // issued redeemable — the surface says so where staff can read it.
    assert.match(copy, /does NOT cancel passes/)
  })

  it("proves the merchant session on every mutation, not the rendering page", () => {
    const actions = readProjectFile("app/app/offers/actions.ts")
    const gate = blockBetween(
      actions,
      "async function requireOfferDesk",
      "// ─── Draft"
    )

    assert.match(actions, /"use server"/)
    assert.match(gate, /getCurrentMerchant\(\)/)
    assert.match(gate, /code: "sign_in"/)
    // No rollout switch survives anywhere on the mutation path.
    assert.doesNotMatch(actions, /isOfferCampaignsEnabled/)
    assert.doesNotMatch(actions, /not_enabled/)
  })

  it("dispatches all six intents from one server action", () => {
    const actions = readProjectFile("app/app/offers/actions.ts")

    assert.match(actions, /export async function offerCampaignFormAction\(/)
    const dispatch = blockBetween(
      actions,
      "export async function offerCampaignFormAction",
      "// ─── Gate"
    )
    for (const intent of ["publish", "pause", "resume", "end", "rotate"]) {
      assert.match(dispatch, new RegExp(`intent === "${intent}"`), intent)
    }
    // `draft` is the fallthrough, and is the only intent that returns state.
    assert.match(dispatch, /return draftCampaign\(gate, formData\)/)
    assert.match(dispatch, /intent === "draft"/)

    assert.match(actions, /create_offer_campaign_draft/)
    assert.match(actions, /publish_offer_campaign/)
    assert.match(actions, /pause_offer_campaign/)
    assert.match(actions, /resume_offer_campaign/)
    assert.match(actions, /end_offer_campaign/)
    assert.match(actions, /rotate_offer_campaign_token/)
    // returnTo is user-controllable and is never reflected into a redirect.
    assert.match(
      actions,
      /resolveOfferReturnBase\(formData\.get\("returnTo"\)\)/
    )
  })

  it("carries lifecycle results as codes, never as reflected text", () => {
    const actions = readProjectFile("app/app/offers/actions.ts")
    const panel = readProjectFile(
      "components/merchant/offer-campaign-panel.tsx"
    )

    // Nothing derived from a database message or a form value is ever placed in
    // the query string, so an edited URL cannot plant a sentence in the console.
    assert.doesNotMatch(actions, /error=\$\{encodeURIComponent/)
    assert.match(actions, /export type OfferNoticeCode/)
    assert.match(actions, /export type OfferNoticeFlag/)
    assert.match(actions, /function lifecycleCode\(/)

    assert.match(panel, /export function OfferActionNotice\(/)
    assert.match(panel, /const ERROR_COPY: Record<OfferNoticeCode, string>/)
    assert.match(
      panel,
      /isNoticeCode\(error\) \? ERROR_COPY\[error\] : ERROR_COPY\.generic/
    )
  })

  it("shows a claim link only through resolveOfferClaimLink", () => {
    const image = readProjectFile("app/app/offers/[campaignId]/qr.png/route.ts")

    assert.match(image, /resolveOfferClaimLink\(\{/)
    assert.match(image, /claimTokenHash: campaign\.claim_token_hash/)
    assert.match(
      image,
      /claimTokenCiphertext: campaign\.claim_token_ciphertext/
    )

    // A campaign whose link cannot be recovered renders nothing at all.
    assert.match(
      blockBetween(image, "if (!claimToken)", "const claimUrl"),
      /notAvailable\(\)/
    )

    // No surface derives a display link for itself.
    for (const file of OFFER_SURFACE_FILES) {
      assert.doesNotMatch(readProjectFile(file), /offerClaimToken\(/, file)
    }
  })

  it("treats the campaign QR bytes as bearer material", () => {
    const image = readProjectFile("app/app/offers/[campaignId]/qr.png/route.ts")

    assert.match(image, /export const runtime = "nodejs"/)
    assert.match(image, /"Cache-Control": "private, no-store"/)
    assert.match(image, /renderQrCodePng\(/)
    // Ownership comes from the merchant's own session, not from the path.
    assert.match(image, /\.eq\("merchant_id", merchant\.id\)/)
  })

  it("renders all five campaign statuses plus the empty state", () => {
    const panel = readProjectFile(
      "components/merchant/offer-campaign-panel.tsx"
    )
    const page = readProjectFile("app/app/offers/page.tsx")
    const statusTag = blockBetween(panel, "const STATUS_TAG", "export type")

    for (const status of ["draft", "scheduled", "live", "paused", "ended"]) {
      assert.match(statusTag, new RegExp(`${status}: \\{`), status)
    }

    assert.match(page, /OffersEmptyState/)
    assert.match(page, /OFFER_BENEFIT_PRESETS/)
    // Ended campaigns are history, never a management panel.
    assert.match(page, /\.eq\("status", "ended"\)/)
    assert.match(flattenCopy(page), /Ended offers are read-only/)
  })

  it("states what pausing, ending and rotating do to passes already issued", () => {
    const panel = flattenCopy(
      readProjectFile("components/merchant/offer-campaign-panel.tsx")
    )

    assert.match(panel, /Passes already issued keep working/)
    assert.match(panel, /stay redeemable until their end date/)
    assert.match(panel, /ending the offer does not cancel them/)
    assert.match(panel, /invalidates the current one immediately/)
    assert.match(panel, /reprint them before you rotate/)
  })

  it("reports only signals this feature records", () => {
    const panel = readProjectFile(
      "components/merchant/offer-campaign-panel.tsx"
    )
    const metrics = blockBetween(
      panel,
      "function CampaignMetrics",
      "// ─── Post-action notice"
    )

    for (const label of [
      "Link opened",
      "Claimed",
      "Welcome stamps",
      "Passes in date",
      "Pass redemptions",
    ]) {
      assert.match(metrics, new RegExp(`label="${label}"`), label)
    }

    // Every tile must read a field of OfferCampaignMetrics, and every field must
    // be a total the database counted over a real ledger — no tile may be
    // computed, defaulted or guessed on the way to the screen.
    const reader = readProjectFile("lib/merchant/offer-campaigns.ts")
    const aggregate = readMigrationDefining("offer_campaign_metrics")

    assert.match(reader, /\.rpc\("offer_campaign_metrics"/)
    for (const [field, column, table] of [
      ["linkOpens", "link_opens", "offer_campaign_open_counts"],
      ["claims", "claims", "offer_campaign_claims"],
      ["bonusStampsIssued", "bonus_stamps_issued", "offer_campaign_claims"],
      ["activePasses", "active_passes", "offer_discount_entitlements"],
      ["passRedemptions", "pass_redemptions", "offer_redemptions"],
    ]) {
      assert.match(metrics, new RegExp(`metrics\\.${field}\\b`), field)
      assert.match(reader, new RegExp(`totals\\.${column}\\b`), field)
      assert.match(aggregate, new RegExp(`from public\\.${table}\\b`), table)
    }
  })

  it("records the link-open signal it reports, off the render path", () => {
    const migration = readProjectFile(
      "supabase/migrations/20260803101000_offer_campaign_open_signal.sql"
    )
    const claimContext = readProjectFile("lib/offers/claim-context.ts")
    const landing = readProjectFile("app/offer/[token]/page.tsx")

    // A counter rolled up per campaign per day, not a row per view: the landing
    // page is a public, poster-printed link whose intended traffic is a surge.
    assert.match(
      migration,
      /create table public\.offer_campaign_open_counts \(/
    )
    assert.match(
      migration,
      /primary key \(campaign_id, opened_on\)/,
      "one row per campaign per day is what bounds the write"
    )
    assert.match(
      migration,
      /alter table public\.offer_campaign_open_counts enable row level security;/
    )
    assert.match(
      migration,
      /alter table public\.offer_campaign_open_counts force row level security;/
    )
    assert.match(
      migration,
      /revoke all on function public\.record_offer_campaign_open\(text\)\s*\n\s*from public, anon, authenticated;/
    )
    assert.match(
      migration,
      /grant execute on function public\.record_offer_campaign_open\(text\)/
    )
    assert.match(migration, /notify pgrst, 'reload schema';\s*$/)
    // The recorder re-decides claimability itself, so an open can never be
    // attributed to a paused, unopened, finished or rotated link.
    assert.match(migration, /v\.status not in \('scheduled', 'live'\)/)

    // Written after the response, never during the render, and never fatal.
    assert.match(landing, /import \{ after \} from "next\/server"/)
    assert.match(
      landing,
      /after\(\(\) => recordOfferCampaignOpen\(context\.claimTokenHash\)\)/
    )
    assert.match(claimContext, /record_offer_campaign_open/)

    // The tile's own words, not a footnote: this counts page loads, and a
    // refresh or a link preview is one of them.
    const panelCopy = flattenCopy(
      readProjectFile("components/merchant/offer-campaign-panel.tsx")
    )
    assert.match(panelCopy, /count page loads, not people/)
    assert.match(panelCopy, /Read it as interest, not as visitors\./)
    assert.doesNotMatch(panelCopy, /not link opens/)
  })

  it("collects a campaign name and customer description and carries them end to end", () => {
    const migration = readProjectFile(
      "supabase/migrations/20260803100600_offer_campaign_identity.sql"
    )
    const core = readProjectFile("lib/offers/campaign-core.ts")
    const fields = readProjectFile("lib/merchant/offer-campaign-fields.ts")
    const form = readProjectFile("components/merchant/offer-campaign-form.tsx")
    const actions = readProjectFile("app/app/offers/actions.ts")
    const summary = readProjectFile(
      "components/merchant/offers/offer-rules-summary.tsx"
    )
    const landing = readProjectFile("app/offer/[token]/page.tsx")
    const claimContext = readProjectFile("lib/offers/claim-context.ts")

    // Stored, bounded, and released only to a claimable campaign.
    assert.match(migration, /add column if not exists name text/)
    assert.match(
      migration,
      /add column if not exists customer_description text/
    )
    assert.match(migration, /char_length\(name\) <= 60/)
    assert.match(migration, /char_length\(customer_description\) <= 160/)
    // A changed argument list and a changed return type both need a drop first.
    assert.match(
      migration,
      /drop function if exists public\.create_offer_campaign_draft\(/
    )
    assert.match(
      migration,
      /drop function if exists public\.get_offer_claim_context\(text\)/
    )
    assert.match(migration, /notify pgrst, 'reload schema';\s*$/)
    for (const rpc of [
      "create_offer_campaign_draft",
      "get_offer_claim_context",
    ]) {
      assert.match(
        migration,
        new RegExp(`revoke all on function public\\.${rpc}\\(`),
        rpc
      )
      assert.match(
        migration,
        new RegExp(`grant execute on function public\\.${rpc}\\(`),
        rpc
      )
    }

    // Bounded in the same two places, and the numbers agree with the CHECKs.
    assert.match(core, /OFFER_CAMPAIGN_NAME_MAX_LENGTH = 60/)
    assert.match(core, /OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH = 160/)

    // Collected in step two, sent to the RPC, read back on review.
    assert.match(fields, /name: textField\(form, "name"\)/)
    assert.match(
      fields,
      /customerDescription: textField\(form, "customerDescription"\)/
    )
    assert.match(form, /name="name"/)
    assert.match(form, /name="customerDescription"/)
    assert.match(actions, /p_name: draft\.name/)
    assert.match(actions, /p_customer_description: draft\.customerDescription/)
    assert.match(summary, /label: "Name", value: name/)

    // Shown to the customer, as text. Nothing in this feature renders merchant
    // copy as markup.
    assert.match(
      claimContext,
      /campaignName: rpcStringField\(row, "campaign_name"\)/
    )
    assert.match(landing, /\{context\.customerDescription\}/)
    assert.match(landing, /campaignName=\{context\.campaignName\}/)
    for (const source of [form, summary, landing]) {
      assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
    }
  })

  it("reads RPC rows through one shared narrowing helper", () => {
    const reader = readProjectFile("lib/offers/rpc-rows.ts")

    assert.match(reader, /export function firstRpcRecord\(/)
    assert.match(reader, /export function rpcStringField\(/)
    // The helper stays pure, so a unit test can import it without a client.
    assert.doesNotMatch(reader, /^import "server-only"/m)
    assert.doesNotMatch(reader, /@\/lib\/supabase/)

    for (const file of [
      "app/app/offers/actions.ts",
      "lib/offers/claim-context.ts",
      "lib/offers/pass-tokens.ts",
      "lib/merchant/offer-pass-redemption.ts",
    ]) {
      const source = readProjectFile(file)
      assert.match(source, /from "@\/lib\/offers\/rpc-rows"/, file)
      assert.doesNotMatch(source, /function firstRecord\(/, file)
      assert.doesNotMatch(source, /function stringField\(/, file)
      assert.doesNotMatch(source, /function numberField\(/, file)
      assert.doesNotMatch(source, /function isRecord\(/, file)
    }
  })

  it("keeps the no-stacking rule out of the merchant's hands", () => {
    const form = readProjectFile("components/merchant/offer-campaign-form.tsx")
    const summary = readProjectFile(
      "components/merchant/offers/offer-rules-summary.tsx"
    )

    assert.match(form, /OFFER_NO_STACKING_TERM/)
    assert.match(summary, /OFFER_NO_STACKING_TERM/)
    assert.match(flattenCopy(form), /It cannot be edited or removed/)
    assert.match(flattenCopy(summary), /cannot be removed/)
    // No input, textarea or select ever binds it.
    assert.doesNotMatch(form, /name="noStacking"/)
    assert.doesNotMatch(form, /name="extraTerms"[^>]*disabled/)
  })

  it("offers no edit path once a campaign is published", () => {
    const panel = readProjectFile(
      "components/merchant/offer-campaign-panel.tsx"
    )
    const form = readProjectFile("components/merchant/offer-campaign-form.tsx")

    assert.doesNotMatch(panel, /value="edit"/)
    assert.doesNotMatch(panel, /intent" value="draft"/)
    const copy = flattenCopy(form)
    assert.match(copy, /locked once published/)
    assert.match(copy, /only customers who are not already members can claim/)
    assert.match(copy, /confidential link/)
  })

  it("drives the creator from ?step= and previews the customer's own view", () => {
    const page = readProjectFile("app/app/offers/new/page.tsx")
    const form = readProjectFile("components/merchant/offer-campaign-form.tsx")

    assert.match(
      page,
      /searchParams: Promise<\{ step\?: string \| string\[\] \}>/
    )
    assert.match(page, /"benefits",\s*"rules",\s*"review",/)
    assert.match(page, /<OfferCampaignForm/)
    assert.match(form, /OFFERS_NEW_PATH\}\?step=\$\{currentStep\}/)
    assert.match(form, /<OfferBenefitPreview/)
    assert.match(form, /<OfferRulesSummary/)
  })

  it("renders the review preview and the customer landing from ONE component", () => {
    const shared = readProjectFile(CUSTOMER_LANDING_COMPONENT)
    const landing = readProjectFile(OFFER_LANDING_ROUTE)
    const preview = readProjectFile(OFFER_BENEFIT_PREVIEW)

    // Step three claims to show "the exact customer landing page". A second
    // rendering of that screen would drift the moment either side was edited and
    // nothing in the gate would notice, so both surfaces mount the same one.
    for (const [file, source] of [
      [OFFER_LANDING_ROUTE, landing],
      [OFFER_BENEFIT_PREVIEW, preview],
    ]) {
      assert.match(
        source,
        /from "@\/components\/customer\/offer-claim-landing"/,
        file
      )
      assert.match(source, /<OfferClaimLanding/, file)
    }

    // The promise, the stamp row and the discount face are defined there and
    // only there — the stamp row through the real StampGrid at the venue's real
    // card length, the face through the shared OfferPass the customer keeps.
    assert.match(shared, /<StampGrid/)
    assert.match(shared, /<OfferPass/)
    assert.match(shared, /total=\{stampsRequired\}/)
    for (const [file, source] of [
      [OFFER_LANDING_ROUTE, landing],
      [OFFER_BENEFIT_PREVIEW, preview],
    ]) {
      assert.doesNotMatch(source, /<StampGrid/, file)
      assert.doesNotMatch(source, /<OfferPass\b/, file)
      assert.doesNotMatch(source, /function benefitLines\(/, file)
    }

    // Presentational only. It is rendered inside a client component by the
    // creator, so it must never be the layer that reads or writes anything.
    assert.doesNotMatch(shared, /@\/lib\/supabase/)
    assert.doesNotMatch(shared, /"use server"/)
    assert.doesNotMatch(shared, /startOfferClaimAction/)

    // The card length is data, never a default: an unreadable card hides the
    // stamp row rather than drawing a length nobody set.
    assert.match(landing, /stampsRequired=\{card\.stampsRequired\}/)
    assert.match(
      landing,
      /const unknown = \{ stampsRequired: 0, rewardName: null \}/
    )
  })

  it("gives the merchant preview no way to claim the offer", () => {
    const preview = readProjectFile(OFFER_BENEFIT_PREVIEW)
    const landing = readProjectFile(OFFER_LANDING_ROUTE)

    // Only the surface a customer reaches carries the real form and the action.
    assert.match(
      landing,
      /claimAction=\{\s*<form action=\{startOfferClaimAction\}/
    )

    // The review step supplies a switched-off stand-in with the customer's own
    // label, and no form at all, so a merchant cannot claim their own offer from
    // the screen that is only meant to show them what it looks like.
    assert.match(preview, /claimAction=\{\s*<Button[^>]*\bdisabled\b[^>]*>/)
    assert.doesNotMatch(preview, /<form/)
    assert.doesNotMatch(preview, /<SubmitButton/)
    assert.match(flattenCopy(preview), /claim button is switched off here/)
    assert.match(flattenCopy(preview), /Preview<\/MonoTag>/)
  })

  it("renders both offer skeletons from a real Suspense boundary", () => {
    const skeletons = readProjectFile(
      "components/merchant/loading-skeletons.tsx"
    )
    const hub = readProjectFile("app/app/offers/page.tsx")
    const scan = readProjectFile("app/app/offers/scan/[passToken]/page.tsx")

    // A skeleton nobody renders is dead weight that no gate catches, so the
    // pin is on the fallback, not on the export text.
    assert.match(hub, /<Suspense fallback=\{<OfferCampaignPanelSkeleton \/>\}>/)
    assert.match(
      scan,
      /<Suspense fallback=\{<OfferPassScanContentSkeleton \/>\}>/
    )
    for (const route of [hub, scan]) {
      assert.match(route, /from "@\/components\/merchant\/loading-skeletons"/)
    }

    // And exactly one definition of each: no route may keep a private copy.
    assert.match(skeletons, /export function OfferCampaignPanelSkeleton\(\)/)
    assert.match(skeletons, /export function OfferPassScanContentSkeleton\(\)/)
    assert.doesNotMatch(scan, /function PassScanSkeleton\(/)

    for (const kept of [
      "MerchantPageTitleSkeleton",
      "DashboardQrCardSkeleton",
      "MerchantDashboardMetricsSkeleton",
      "MerchantCompactActivitySkeleton",
      "ActivityFeedSkeleton",
      "MerchantCustomersTableSkeleton",
      "LaunchPanelSkeleton",
      "AccountProfilePanelSkeleton",
      "AccountBillingPanelSkeleton",
      "RewardScanContentSkeleton",
    ]) {
      assert.match(skeletons, new RegExp(`export function ${kept}`), kept)
    }
  })

  it("keeps components free of server Supabase clients and banned utilities", () => {
    const components = OFFER_SURFACE_FILES.filter((file) =>
      file.startsWith("components/")
    )

    for (const file of components) {
      const source = readProjectFile(file)
      assert.doesNotMatch(source, /@\/lib\/supabase\/server/, file)
    }

    for (const file of OFFER_SURFACE_FILES) {
      const source = readProjectFile(file)
      assert.ok(!source.includes("focus-visible:" + "ring"), file)
      assert.doesNotMatch(source, /\bTODO(?!\(#)/, file)
      assert.doesNotMatch(source, /\bFIXME\b/, file)
    }
  })
})
