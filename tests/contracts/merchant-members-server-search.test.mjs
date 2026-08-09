import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const read = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")

/**
 * 03#18. Members search and the status pills ran in the browser over one
 * CUSTOMERS_PAGE_SIZE window, so both were silently wrong past page one and the
 * list carried a prose apology for it. They now resolve in the database. These
 * assertions pin the three properties that made that safe to do.
 */
test("members search runs server-side over the masked view only", () => {
  const view = read("lib", "merchant", "customers-view.ts")
  const filter = read("lib", "merchant", "customers-filter.ts")

  // The search reads the masked VIEW, never the base customers table: its
  // `email` column is already `a***@domain` and `phone_last4` is the surviving
  // contact fragment, so the ILIKE matches exactly what the merchant sees.
  assert.match(view, /\.from\("customers_masked"\)/)
  assert.doesNotMatch(view, /\.from\("customers"\)/)

  // Only the two masked columns are searchable.
  assert.match(filter, /email\.ilike\.\$\{quoted\},phone_last4\.ilike\.\$\{quoted\}/)

  // Operator input cannot become a LIKE wildcard or split the or() logic tree.
  assert.match(filter, /export function escapeLikePattern/)
  assert.match(filter, /export function quotePostgrestValue/)
  assert.match(filter, /quotePostgrestValue\(containsPattern\(term\)\)/)
})

test("members filtering is a membership predicate, not a badge reimplementation", () => {
  const view = read("lib", "merchant", "customers-view.ts")

  // Rows are still badged by the one TypeScript derivation.
  assert.match(view, /enrichMerchantMemberships/)
  assert.doesNotMatch(view, /deriveMerchantCustomerRewardBadge\(/)

  // The filter and the badge share their London day boundaries.
  assert.match(view, /resolveCustomerFilterBoundaries/)

  // An empty match set must never fall through to an unfiltered read.
  assert.match(view, /const noMatches =/)
  assert.match(view, /matchedMembers: 0/)
})

test("the members list no longer apologises for page-scoped search", () => {
  const table = read("components", "merchant", "customer-readback-table.tsx")
  const page = read("app", "app", "customers", "page.tsx")

  assert.doesNotMatch(table, /cover this page only/)
  // The narrowing lives in the URL, so it survives refresh, Back and a shared
  // link, and the dashboard can deep-link into it.
  assert.match(page, /parseCustomerFilterParam/)
  assert.match(page, /parseCustomerSearchParam/)
  assert.match(table, /buildCustomersHref/)
  // Paging must carry the narrowing, or page 2 silently drops the filter.
  assert.match(table, /buildCustomersHref\(\{ page, filter, query, basePath \}\)/)
})

test("the dashboard's Do next counts agree with the members pills", () => {
  const view = read("lib", "merchant", "customers-view.ts")
  const streams = read("components", "merchant", "dashboard-home-streams.tsx")

  // 03#13: the counts come from the same helpers the members list uses, so a
  // "4 rewards ready" row cannot lead to a page showing three.
  assert.match(view, /export async function getMerchantNextActionCounts/)
  assert.match(streams, /getMerchantNextActionCounts/)
  assert.match(streams, /MerchantNextActions/)
})
