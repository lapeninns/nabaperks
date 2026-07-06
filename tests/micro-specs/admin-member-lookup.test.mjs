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

// MS-admin-member-lookup R1/R2: the memberships and privacy loaders filter and
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

// MS-admin-member-lookup constraint: search input is validated/escaped
// server-side before query interpolation.
test("Given operator search terms When they reach the query Then they pass through the shared escaping helpers", () => {
  const data = readProjectFile("lib", "admin", "data.ts")
  const lookupQuery = readProjectFile("lib", "admin", "lookup-query.ts")

  assert.match(data, /from "\.\/lookup-query"|from "@\/lib\/admin\/lookup-query"/)
  assert.match(data, /contactOrIlikeFilter\(/)
  assert.match(data, /containsPattern\(/)

  assert.match(lookupQuery, /export function escapeLikePattern/)
  assert.match(lookupQuery, /replaceAll\("\\\\", "\\\\\\\\"\)/)
  assert.match(lookupQuery, /export function normaliseLookupTerm/)
})

// MS-admin-member-lookup R3: the lookup exposes no more customer personal data
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

// MS-admin-member-lookup: query params drive the lookup state so results are
// linkable, on both the customers surface (R1) and the privacy surface (R6).
// Pages own the params; their lookup panels render the controls/pagination.
test("Given the customers and privacy pages When source is inspected Then query params drive lookup, pagination, and controls", () => {
  const customersPage = readProjectFile(
    "app",
    "admin",
    "customers",
    "page.tsx"
  )
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

// MS-admin-member-lookup R4: a failed lookup renders an inline themed error
// state instead of detonating the whole console segment — pages catch the
// loader failure, panels render the themed inline state.
test("Given a lookup read failure When the pages render Then an inline error state is used instead of an unguarded throw", () => {
  const customersPage = readProjectFile(
    "app",
    "admin",
    "customers",
    "page.tsx"
  )
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
  const controls = readProjectFile(
    "components",
    "admin",
    "lookup-controls.tsx"
  )

  assert.match(customersPage, /getAdminCustomers\(lookup\)\.catch\(/)
  assert.match(privacyPage, /getAdminPrivacySupportRows\(lookup\)\.catch\(/)
  assert.match(membershipsPanel, /AdminLookupErrorState/)
  assert.match(privacyPanel, /AdminLookupErrorState/)
  assert.match(controls, /export function AdminLookupErrorState/)
  assert.match(controls, /StatusBanner/)
})

// MS-admin-member-lookup R5: the admin auth gate stays in force for lookup
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
