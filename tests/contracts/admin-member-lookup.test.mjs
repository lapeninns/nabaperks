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


// contract-admin-member-lookup R1/R2, extended to the fraud queue (ADM 04#6) —
// the last capped admin list, and the one that could not simply copy the
// pattern. It stayed a hard newest-100 because `severity` is a text column
// whose alphabetical order (high, low, medium) is not its severity order, so
// the reader ranked its single window IN MEMORY. Paging that would rank each
// page independently: a high-severity flag on page 3 below a low one on page 1.
test("Given the fraud queue When source is inspected Then it ranks severity in SQL, pages a window, and keeps no fixed cap", () => {
  const data = readProjectFile("lib", "admin", "data.ts")

  const reader = data.slice(
    data.indexOf("export async function getAdminFraudFlags"),
    data.indexOf("export type AdminRedemptionFailure")
  )
  assert.notEqual(reader.length, 0, "the fraud flag reader exists")

  // Ordered by the generated rank column FIRST, recency second, in SQL.
  const rankOrder = reader.indexOf('.order("severity_rank"')
  const recencyOrder = reader.indexOf('.order("created_at"')
  assert.notEqual(rankOrder, -1, "the fraud queue orders by severity_rank")
  assert.ok(
    rankOrder < recencyOrder,
    "severity_rank is the primary sort key, recency the tiebreak"
  )
  assert.match(reader, /\.range\(window\.from, window\.to\)/)
  assert.match(reader, /count: "exact"/)
  assert.doesNotMatch(reader, /\.limit\(/)
  // The in-memory rank is what a paged read may not do.
  assert.doesNotMatch(
    reader,
    /\.sort\(/,
    "a paged fraud queue must not re-rank its own page in memory"
  )
  assert.doesNotMatch(
    data,
    /FRAUD_SEVERITY_RANK/,
    "the severity rank has one home, the database column"
  )

  const failures = data.slice(
    data.indexOf("export async function getAdminRedemptionFailures"),
    data.indexOf("/** Bucket counts for the fraud queue tabs")
  )
  assert.notEqual(failures.length, 0, "the redemption failure reader exists")
  assert.match(failures, /\.range\(window\.from, window\.to\)/)
  assert.doesNotMatch(failures, /\.limit\(/)
})

// contract-admin-member-lookup: `severity_rank` is a GENERATED column, not a
// written one, and its arms are in severity order. A plain rank column that a
// writer keeps in sync would silently drift; the ordering the queue depends on
// has to be a property of the row, not of the code that inserted it.
test("Given the severity rank migration When the SQL is read Then the column is generated and ranks high above medium above low", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260809100000_fraud_flag_severity_rank.sql"
  )

  assert.match(migration, /add column if not exists severity_rank smallint/)
  assert.match(migration, /generated always as \(/)
  assert.match(migration, /\)\s*stored;/)

  const arms = [...migration.matchAll(/when '(high|medium|low)' then (\d+)/g)]
  assert.equal(arms.length, 3, "every checked severity is ranked")
  const ranks = Object.fromEntries(
    arms.map((arm) => [arm[1], Number(arm[2])])
  )
  assert.ok(
    ranks.high < ranks.medium && ranks.medium < ranks.low,
    `rank arms are not in severity order: ${JSON.stringify(ranks)}`
  )
  // An unrecognised severity must sort last, not silently rank as high — the
  // check constraint can be widened later.
  assert.match(migration, /else (\d+)\s*\n?\s*end/)
  const fallback = Number(/else (\d+)/.exec(migration)?.[1])
  assert.ok(
    fallback > ranks.low,
    "an unrecognised severity must sort after every known one"
  )
  // Ordering that has no index is a sequential scan on a triage queue.
  assert.match(migration, /create index if not exists\s+fraud_flags_severity_rank_created_at_idx/)
})

// contract-admin-member-lookup: the fraud surface takes the same query-param
// lookup contract as the other admin lists, on both of its list views.
test("Given the fraud page When source is inspected Then query params drive lookup and pagination on both views", () => {
  const page = readProjectFile("app", "admin", "fraud", "page.tsx")
  const flagsPanel = readProjectFile(
    "app",
    "admin",
    "fraud",
    "fraud-flags-panel.tsx"
  )
  const failuresPanel = readProjectFile(
    "app",
    "admin",
    "fraud",
    "redemption-failures-panel.tsx"
  )

  assert.match(page, /parseAdminLookupParams\(/)
  assert.match(page, /buildLookupHref\(/)
  // The paging href has to carry the active view, or paging the failures list
  // silently returns the operator to the open-flag queue.
  const pagingHrefs = [
    ...page.matchAll(/buildLookupHref\([^)]*?\bpage[^)]*?\)/gs),
  ]
  assert.ok(pagingHrefs.length > 0, "the fraud page builds a paging href")
  for (const href of pagingHrefs) {
    assert.match(href[0], /\bqueue\b/, "a fraud paging href drops the view")
    assert.match(href[0], /\bsize\b/, "a fraud paging href drops rows-per-page")
    assert.match(href[0], /\bvenue\b/, "a fraud paging href drops the search")
  }

  for (const [name, source] of [
    ["fraud flags", flagsPanel],
    ["redemption failures", failuresPanel],
  ]) {
    assert.match(
      source,
      /AdminLookupControls/,
      `${name} renders the lookup controls`
    )
    assert.match(source, /AdminLookupPagination/, `${name} renders pagination`)
  }

  // The tab count must be a server-side count, not the length of the window
  // that happens to be loaded.
  assert.doesNotMatch(
    page,
    /count: \w+\.(rows|failures)\.length/,
    "a queue tab count must not be the length of a loaded page"
  )
})

// contract-admin-member-lookup, 04#26: an audit trail without a date bound only
// answers "what happened most recently". The bound is inclusive at BOTH ends —
// `created_at` is a timestamp, so an `lte` against the `to` date would compare
// with midnight and silently drop the day the operator asked for.
test("Given an audit date range When the trail is read Then both bounds are applied and the upper one stays inclusive", () => {
  const data = readProjectFile("lib", "admin", "data.ts")
  const lookupQuery = readProjectFile("lib", "admin", "lookup-query.ts")
  const page = readProjectFile("app", "admin", "audit", "page.tsx")
  const controls = readProjectFile("components", "admin", "lookup-controls.tsx")

  const reader = data.slice(
    data.indexOf("export async function getAdminAuditPage"),
    data.indexOf("export async function getAdminAuditLogs")
  )
  assert.notEqual(reader.length, 0, "the audit reader exists")
  assert.match(reader, /\.gte\("created_at", lookup\.from\)/)
  assert.match(reader, /\.lt\("created_at", exclusiveDayAfter\(lookup\.to\)\)/)
  assert.doesNotMatch(
    reader,
    /\.lte\("created_at"/,
    "an inclusive `to` date compared with lte drops the day it names"
  )

  // The bound reaches PostgREST as a timestamp filter, so it is validated as a
  // real calendar date rather than merely shaped like one.
  assert.match(lookupQuery, /export function parseDateParam/)
  assert.match(lookupQuery, /toISOString\(\)\.slice\(0, 10\) === raw/)
  assert.match(lookupQuery, /export function orderedDateRange/)

  assert.match(controls, /readonly withDateRange\?: boolean/)
  assert.match(controls, /type="date"\s*\n\s*name="from"/)
  assert.match(controls, /type="date"\s*\n\s*name="to"/)
  assert.match(page, /withDateRange/)

  // The range has to survive paging and sorting, or the operator loses the
  // week they were looking at on the first Next press.
  const pagingHrefs = [
    ...page.matchAll(/buildLookupHref\([^)]*?\bpage[^)]*?\)/gs),
  ]
  assert.ok(pagingHrefs.length > 0, "the audit page builds a paging href")
  for (const href of pagingHrefs) {
    assert.match(href[0], /\bfrom\b/, "a paging href drops the date range")
    assert.match(href[0], /\bto\b/, "a paging href drops the date range")
  }
})
