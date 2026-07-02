import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

const projectRoot = process.cwd()

function readProjectFile(...segments) {
  return readFileSync(join(projectRoot, ...segments), "utf8")
}

function projectPath(...segments) {
  return join(projectRoot, ...segments)
}

function blockBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle)
  if (start === -1) return ""
  const end = source.indexOf(endNeedle, start + startNeedle.length)
  if (end === -1) return source.slice(start)
  return source.slice(start, end)
}

describe("MS-merchant-multi-site-spike source contract", () => {
  it("declares a current RLS/RPC Micro-Spec with the live DB gate and no migration surface", () => {
    const spec = readProjectFile("micro-specs", "merchant", "multi-site-spike.md")

    assert.match(spec, /spec_id: MS-merchant-multi-site-spike/)
    assert.match(spec, /status: (active|implemented|verified)/)
    assert.match(spec, /risk_class: rls-rpc-ledger/)
    assert.match(spec, /pnpm test:db/)
    assert.match(spec, /tests\/db\/multi-location\.test\.mjs/)
    assert.doesNotMatch(spec, /supabase\/migrations\//)
  })

  it("adds the Account locations tab and sidebar entry without changing the mobile tab bar", () => {
    const tabs = readProjectFile("components", "merchant", "account", "account-tabs.ts")
    const page = readProjectFile("app", "app", "account", "page.tsx")
    const nav = readProjectFile("components", "layout", "console-nav.ts")
    const tabBarBlock = blockBetween(
      nav,
      "export const merchantTabBarItems = [",
      "] satisfies readonly ShellNavItem[]"
    )

    assert.match(tabs, /id: "locations", label: "Locations"/)
    assert.match(page, /LocationsPanel/)
    assert.match(page, /tab === "locations"/)
    assert.match(nav, /href: "\/app\/account\?tab=locations"/)
    assert.match(nav, /label: "Locations"/)
    assert.doesNotMatch(tabBarBlock, /tab=locations/)
  })

  it("provisions a non-primary location by reusing venue validation, cloning card data, and calling existing reward/QR RPCs", () => {
    const actions = readProjectFile("app", "app", "account", "actions.ts")
    const submission = readProjectFile(
      "lib",
      "merchant",
      "venue-location-submission.ts"
    )

    assert.match(actions, /"use server"/)
    assert.match(actions, /getCurrentMerchant/)
    assert.match(actions, /parseVenueLocationSubmission/)
    assert.match(actions, /venueNameField: "locationName"/)
    assert.match(actions, /validateVenueLocationSubmission/)
    assert.match(actions, /isPrimary: false/)
    assert.match(actions, /\.from\("loyalty_cards"\)[\s\S]*\.insert/)
    assert.match(actions, /\.rpc\("upsert_reward_pool_item"/)
    assert.match(actions, /\.rpc\("create_or_get_join_qr"/)
    assert.doesNotMatch(actions, /\.rpc\("save_loyalty_card"/)

    assert.match(submission, /isPrimary\?: boolean/)
    assert.match(submission, /is_primary: options\.isPrimary \?\? true/)
    assert.match(submission, /Promise<\{ locationId\?: string; error\?: string \}>/)
    assert.match(
      submission,
      /\.insert\(payload\)[\s\S]*\.select\("id"\)[\s\S]*\.single\(\)/
    )
  })

  it("scopes dashboard query fallback by location while leaving member counts shared", () => {
    const metrics = readProjectFile("lib", "merchant", "dashboard-metrics.ts")
    const counts = readProjectFile("lib", "merchant", "dashboard-counts.ts")
    const periodCounts = readProjectFile(
      "lib",
      "merchant",
      "dashboard-period-counts.ts"
    )
    const query = readProjectFile("lib", "merchant", "dashboard-query.ts")
    const scopeIds = readProjectFile(
      "lib",
      "merchant",
      "dashboard-scope-ids.ts"
    )
    const scope = readProjectFile("lib", "merchant", "dashboard-scope.ts")
    const home = readProjectFile("app", "app", "page.tsx")
    const streams = readProjectFile(
      "components",
      "merchant",
      "dashboard-home-streams.tsx"
    )

    assert.match(scope, /SHARED_MEMBERS_CAPTION = "Members are shared across your sites"/)
    assert.match(scope, /resolveMerchantDashboardScope/)
    assert.match(metrics, /resolveMerchantDashboardScope/)
    assert.match(metrics, /scope\.mode === "merchant"[\s\S]*getMerchantDashboardMetrics/)
    assert.match(streams, /getMerchantDashboardSeries\(merchant\.id, \{ locationId \}\)/)
    assert.match(scopeIds, /loyalty_cards[\s\S]*\.eq\("location_id", locationId\)/)
    assert.match(scopeIds, /qr_codes[\s\S]*\.eq\("location_id", locationId\)/)
    assert.match(periodCounts, /stamp_events[\s\S]*\.eq\("location_id", locationId\)/)
    assert.match(periodCounts, /reward_events[\s\S]*\.in\("loyalty_card_id", \[\.\.\.cardIds\]\)/)
    assert.match(periodCounts, /product_events[\s\S]*\.in\("qr_code_id", \[\.\.\.qrCodeIds\]\)/)
    assert.match(counts, /countRepeatCustomers\(merchantId/)
    assert.match(query, /loadLocationScopeIds\(merchant\.id, scope\.locationId\)/)
    assert.match(home, /searchParams/)
    assert.match(home, /getMerchantDashboardLocations/)
    assert.match(streams, /sharedMembersCaption/)
  })

  it("authorizes private QR images by owned active join QR rather than primary location/card", () => {
    const qrCode = readProjectFile("lib", "merchant", "qr-code.ts")
    const loader = blockBetween(
      qrCode,
      "async function loadOwnedQrImageContext",
      "export async function"
    )

    assert.match(loader, /\.eq\("id", qrCodeId\)/)
    assert.match(loader, /\.eq\("merchant_id", merchant\.id\)/)
    assert.match(loader, /\.eq\("destination_type", "join"\)/)
    assert.match(loader, /\.eq\("is_active", true\)/)
    assert.match(loader, /location_id/)
    assert.match(loader, /loyalty_card_id/)
    assert.doesNotMatch(loader, /\.eq\("location_id", location\.id\)/)
    assert.doesNotMatch(loader, /\.eq\("loyalty_card_id", activeCard\.id\)/)
  })

  it("keeps the spike migration-free and registers DB-free harness proof", () => {
    const harness = readProjectFile("tests", "e2e", "helpers", "harness.ts")
    const fixtures = readProjectFile("app", "dev", "app-harness", "fixtures.ts")
    const dashboardHarness = readProjectFile(
      "app",
      "dev",
      "app-harness",
      "dashboard",
      "page.tsx"
    )
    const accountHarness = readProjectFile(
      "app",
      "dev",
      "app-harness",
      "account",
      "page.tsx"
    )

    assert.equal(
      existsSync(projectPath("supabase", "migrations", "20260701090000_multi_site_spike.sql")),
      false
    )
    assert.match(harness, /account: "\/dev\/app-harness\/account"/)
    assert.match(fixtures, /HARNESS_LOCATIONS/)
    assert.match(dashboardHarness, /DashboardLocationFilter/)
    assert.match(accountHarness, /LocationsPanelView/)
  })
})
