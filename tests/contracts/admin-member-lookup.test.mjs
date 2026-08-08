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

// contract-admin-member-lookup R1/R2: the memberships and privacy loaders filter and
// paginate server-side instead of hard-capping at the newest 100 rows.
test("Given the admin lookup loaders When source is inspected Then they accept lookup params and paginate with an exact count", () => {
  const data = readProjectFile("lib", "admin", "data.ts")

  assert.match(data, /export async function getAdminCustomers\(\s*lookup/)
  assert.match(
    data,
    /export async function getAdminPrivacySupportRows\(\s*lookup/
  )
  assert.match(data, /count: "exact"/)

  // Every paged admin list resolves a .range window close to its from() call;
  // no lookup-surface list keeps a fixed .limit cap.
  for (const table of [
    "customer_memberships",
    "reward_events",
    "consent_records",
  ]) {
    let cursor = data.indexOf(`from("${table}")`)
    assert.notEqual(cursor, -1, `${table} loader exists`)
    while (cursor !== -1) {
      const window = data.slice(cursor, cursor + 700)
      assert.match(
        window,
        /\.range\(/,
        `${table} loader paginates via .range()`
      )
      assert.doesNotMatch(
        window,
        /\.limit\(100\)/,
        `${table} loader no longer hard-caps at 100`
      )
      cursor = data.indexOf(`from("${table}")`, cursor + 1)
    }
  }
})

// contract-admin-member-lookup constraint: search input is validated/escaped
// server-side before query interpolation.
test("Given operator search terms When they reach the query Then they pass through the shared escaping helpers", () => {
  const data = readProjectFile("lib", "admin", "data.ts")
  const lookupQuery = readProjectFile("lib", "admin", "lookup-query.ts")

  assert.match(
    data,
    /from "\.\/lookup-query"|from "@\/lib\/admin\/lookup-query"/
  )
  assert.match(data, /contactOrIlikeFilter\(/)
  assert.match(data, /containsPattern\(/)

  assert.match(lookupQuery, /export function escapeLikePattern/)
  assert.match(lookupQuery, /replaceAll\("\\\\", "\\\\\\\\"\)/)
  assert.match(lookupQuery, /export function normaliseLookupTerm/)
})

// contract-admin-member-lookup R3: the lookup exposes no more customer personal data
// than the existing masked display.
test("Given the lookup select strings When embeds are inspected Then customer embeds stay email/phone_last4 only and panels keep masking", () => {
  const data = readProjectFile("lib", "admin", "data.ts")

  const embeds = [
    ...data.matchAll(/(?<![A-Za-z_])customers(?:!inner)?\(([^)]*)\)/g),
  ]
  assert.ok(embeds.length >= 2, "customer embeds are present")
  for (const embed of embeds) {
    const columns = embed[1]
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean)
    for (const column of columns) {
      assert.ok(
        column === "email" || column === "phone_last4",
        `customer embed only selects masked-display fields, got: ${column}`
      )
    }
  }

  const membershipsPanel = readProjectFile(
    "app",
    "admin",
    "customers",
    "customer-memberships-panel.tsx"
  )
  const privacyPanel = readProjectFile(
    "app",
    "admin",
    "privacy",
    "data-request-workflow-panel.tsx"
  )
  assert.match(membershipsPanel, /maskAdminCustomer\(/)
  assert.match(privacyPanel, /maskAdminCustomer\(/)
})

// contract-admin-member-lookup: query params drive the lookup state so results are
// linkable, on both the customers surface (R1) and the privacy surface (R6).
// Pages own the params; their lookup panels render the controls/pagination.
test("Given the customers and privacy pages When source is inspected Then query params drive lookup, pagination, and controls", () => {
  const customersPage = readProjectFile("app", "admin", "customers", "page.tsx")
  const privacyPage = readProjectFile("app", "admin", "privacy", "page.tsx")

  for (const [name, source] of [
    ["customers", customersPage],
    ["privacy", privacyPage],
  ]) {
    assert.match(source, /searchParams/, `${name} page reads searchParams`)
    assert.match(
      source,
      /parseAdminLookupParams\(/,
      `${name} page parses lookup params`
    )
    assert.match(
      source,
      /buildLookupHref\(/,
      `${name} page builds linkable pagination hrefs`
    )
  }

  const membershipsPanel = readProjectFile(
    "app",
    "admin",
    "customers",
    "customer-memberships-panel.tsx"
  )
  const privacyPanel = readProjectFile(
    "app",
    "admin",
    "privacy",
    "data-request-workflow-panel.tsx"
  )

  for (const [name, source] of [
    ["memberships", membershipsPanel],
    ["privacy workflow", privacyPanel],
  ]) {
    assert.match(
      source,
      /AdminLookupControls/,
      `${name} panel renders the lookup controls`
    )
    assert.match(
      source,
      /AdminLookupPagination/,
      `${name} panel renders pagination`
    )
  }
})

// contract-admin-member-lookup R1/R2, extended to the last two capped admin
// lists (ADM 04#6): billing was a hard newest-100 with a truncation notice,
// and referrals a hard `p_limit: 100` with no notice at all. Both now take a
// lookup and a page window.
test("Given the billing and referral readers When source is inspected Then they take a lookup, page a window, and keep no fixed cap", () => {
  const billing = readProjectFile("lib", "admin", "billing-data.ts")
  const data = readProjectFile("lib", "admin", "data.ts")

  assert.match(
    billing,
    /export async function getAdminBillingRecords\(\s*lookup/
  )
  assert.match(
    billing,
    /export async function getAdminBillingRecordTotal\(\s*lookup/
  )
  assert.match(billing, /\.range\(window\.from, window\.to\)/)
  assert.doesNotMatch(billing, /\.limit\(/)
  assert.doesNotMatch(billing, /BILLING_RECORD_LIMIT/)

  assert.match(data, /export async function getAdminReferralOps\(\s*lookup/)
  const referralReader = data.slice(
    data.indexOf("export async function getAdminReferralOps"),
    data.indexOf("function toAdminReferralOpsRow")
  )
  assert.notEqual(referralReader.length, 0)
  assert.doesNotMatch(
    referralReader,
    /p_limit: 100/,
    "the referral RPC no longer asks for a fixed newest-100"
  )
  assert.match(referralReader, /p_offset: window\.from/)
  assert.match(referralReader, /count: "exact", head: true/)
  // A fragment that resolves to no single venue must not run unfiltered.
  assert.match(referralReader, /decideVenueFilter\(/)
})

// contract-admin-member-lookup: the same query-param contract the customers and
// privacy surfaces have, on billing and referrals.
test("Given the billing and referrals pages When source is inspected Then query params drive lookup and pagination", () => {
  const billingPage = readProjectFile("app", "admin", "billing", "page.tsx")
  const referralsPage = readProjectFile("app", "admin", "referrals", "page.tsx")
  const referralsPanel = readProjectFile(
    "app",
    "admin",
    "referrals",
    "referral-ops-panel.tsx"
  )

  for (const [name, source] of [
    ["billing", billingPage],
    ["referrals", referralsPage],
  ]) {
    assert.match(source, /searchParams/, `${name} page reads searchParams`)
    assert.match(
      source,
      /parseAdminLookupParams\(/,
      `${name} page parses lookup params`
    )
    assert.match(
      source,
      /buildLookupHref\(/,
      `${name} page builds linkable pagination hrefs`
    )
  }

  for (const [name, source] of [
    ["billing", billingPage],
    ["referrals", referralsPanel],
  ]) {
    assert.match(
      source,
      /AdminLookupControls/,
      `${name} renders the lookup controls`
    )
    assert.match(source, /AdminLookupPagination/, `${name} renders pagination`)
  }
})

// contract-admin-member-lookup R2 (rows per page, ADM 04#56): `size` is one
// parsed, allowlisted value that reaches BOTH the range window and the page
// meta of every paged admin loader — a size that reaches only one of them
// produces a window and a page count that disagree.
test("Given the rows-per-page param When the admin readers page Then size drives both the range window and the page meta", () => {
  const lookupQuery = readProjectFile("lib", "admin", "lookup-query.ts")
  const data = readProjectFile("lib", "admin", "data.ts")
  const billing = readProjectFile("lib", "admin", "billing-data.ts")

  assert.match(
    lookupQuery,
    /export const ADMIN_LOOKUP_PAGE_SIZES = \[25, 50, 100\]/
  )
  assert.match(lookupQuery, /export function parseSizeParam/)
  assert.match(lookupQuery, /size: parseSizeParam\(params\?\.size\)/)

  // No paged reader may build a window without a size.
  const windows = [...data.matchAll(/const window = lookupRange\(([^)]*)\)/g)]
  assert.ok(windows.length >= 8, "every paged admin reader builds a window")
  for (const match of windows) {
    assert.match(
      match[1],
      /,\s*(lookup\.size|size)\b/,
      `lookupRange(${match[1]}) ignores the rows-per-page param`
    )
  }

  const metas = [...data.matchAll(/pageMeta\(([^)]*)\)/g)]
  assert.ok(metas.length >= 8, "every paged admin reader reports page meta")
  for (const match of metas) {
    assert.match(
      match[1],
      /,\s*(lookup\.size|size)\b/,
      `pageMeta(${match[1]}) ignores the rows-per-page param`
    )
  }

  assert.match(billing, /lookupRange\(lookup\.page \?\? 1, lookup\.size\)/)
})

// contract-admin-member-lookup R2: the paging hrefs every admin list builds
// carry `size`, or changing rows-per-page is undone by the next page press.
test("Given an admin pagination href When it is built Then it carries the rows-per-page param", () => {
  const pages = [
    ["app", "admin", "customers", "page.tsx"],
    ["app", "admin", "privacy", "page.tsx"],
    ["app", "admin", "merchants", "page.tsx"],
    ["app", "admin", "audit", "page.tsx"],
    ["app", "admin", "billing", "page.tsx"],
    ["app", "admin", "referrals", "page.tsx"],
  ]

  for (const filePath of pages) {
    const source = readProjectFile(...filePath)
    const name = filePath.join("/")
    // Only the hrefs that page: a cross-link to another route deliberately
    // does not inherit this route's rows-per-page.
    const pagingHrefs = [
      ...source.matchAll(/buildLookupHref\([^)]*?\bpage[^)]*?\)/gs),
    ]
    assert.ok(pagingHrefs.length > 0, `${name} builds a paging href`)
    for (const href of pagingHrefs) {
      assert.match(
        href[0],
        /\bsize\b/,
        `${name} builds a paging href that drops the rows-per-page param`
      )
    }
  }

  const controls = readProjectFile("components", "admin", "lookup-controls.tsx")
  // A next/form search submit rebuilds the query from its own fields.
  assert.match(controls, /name="size"/)
  assert.match(controls, /aria-label="Rows per page"/)
})

// contract-admin-member-lookup R4: a failed lookup renders an inline themed error
// state instead of detonating the whole console segment — pages catch the
// loader failure, panels render the themed inline state.
test("Given a lookup read failure When the pages render Then an inline error state is used instead of an unguarded throw", () => {
  const customersPage = readProjectFile("app", "admin", "customers", "page.tsx")
  const privacyPage = readProjectFile("app", "admin", "privacy", "page.tsx")
  const membershipsPanel = readProjectFile(
    "app",
    "admin",
    "customers",
    "customer-memberships-panel.tsx"
  )
  const privacyPanel = readProjectFile(
    "app",
    "admin",
    "privacy",
    "data-request-workflow-panel.tsx"
  )
  const controls = readProjectFile("components", "admin", "lookup-controls.tsx")

  assert.match(customersPage, /getAdminCustomers\(lookup\)\.catch\(/)
  assert.match(privacyPage, /getAdminPrivacySupportRows\(lookup\)\.catch\(/)
  assert.match(membershipsPanel, /AdminLookupErrorState/)
  assert.match(privacyPanel, /AdminLookupErrorState/)
  assert.match(controls, /export function AdminLookupErrorState/)
  assert.match(controls, /StatusBanner/)
})

// contract-admin-member-lookup R5: the admin auth gate stays in force for lookup
// URLs; the DB-free Playwright spec asserting it exists and is tagged.
test("Given the auth-gate regression spec When source is inspected Then it covers lookup URLs anonymously", () => {
  const spec = readProjectFile("tests", "e2e", "admin-lookup.spec.ts")

  assert.match(spec, /@admin-lookup/)
  assert.match(spec, /\/admin\/customers\?/)
  assert.match(spec, /\/admin\/privacy\?/)
  assert.match(spec, /venue=/)
  assert.match(spec, /page=/)
  assert.match(spec, /\/login/)
})
