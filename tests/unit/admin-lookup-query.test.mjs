import assert from "node:assert/strict"
import { test } from "node:test"

import {
  ADMIN_LOOKUP_PAGE_SIZE,
  ADMIN_LOOKUP_PAGE_SIZES,
  buildLookupHref,
  contactOrIlikeFilter,
  containsPattern,
  decideVenueFilter,
  escapeLikePattern,
  lookupRange,
  nextPage,
  normaliseLookupTerm,
  pageMeta,
  parseAdminLookupParams,
  parseAdminSortParams,
  parsePageParam,
  parseSizeParam,
  previousPage,
  resolveAdminSort,
} from "@/lib/admin/lookup-query"

test("normaliseLookupTerm trims, collapses whitespace, and strips control characters", () => {
  assert.equal(normaliseLookupTerm("  Red   Lion  "), "Red Lion")
  assert.equal(normaliseLookupTerm("jo\u0000hn\u001f"), "jo hn")
  assert.equal(normaliseLookupTerm("a\tb\nc"), "a b c")
})

test("normaliseLookupTerm returns undefined for empty or non-string input", () => {
  assert.equal(normaliseLookupTerm(undefined), undefined)
  assert.equal(normaliseLookupTerm(""), undefined)
  assert.equal(normaliseLookupTerm("   "), undefined)
  assert.equal(normaliseLookupTerm([]), undefined)
})

test("normaliseLookupTerm takes the first entry of repeated params and caps length", () => {
  assert.equal(normaliseLookupTerm(["The Crown", "other"]), "The Crown")
  const long = "a".repeat(200)
  assert.equal(normaliseLookupTerm(long)?.length, 64)
})

test("parsePageParam defaults to 1 for missing or junk values", () => {
  assert.equal(parsePageParam(undefined), 1)
  assert.equal(parsePageParam(""), 1)
  assert.equal(parsePageParam("abc"), 1)
  assert.equal(parsePageParam("-4"), 1)
  assert.equal(parsePageParam("0"), 1)
  assert.equal(parsePageParam("2.5"), 1)
})

test("parsePageParam parses positive integers and clamps the upper bound", () => {
  assert.equal(parsePageParam("2"), 2)
  assert.equal(parsePageParam(["7", "9"]), 7)
  assert.equal(parsePageParam("999999"), 999)
})

test("parseAdminLookupParams maps venue, contact, page, and rows-per-page from search params", () => {
  assert.deepEqual(
    parseAdminLookupParams({
      venue: " The  Crown ",
      contact: "jo",
      page: "3",
      size: "50",
    }),
    { venue: "The Crown", contact: "jo", page: 3, size: 50 }
  )
  assert.deepEqual(parseAdminLookupParams(undefined), {
    venue: undefined,
    contact: undefined,
    page: 1,
    size: ADMIN_LOOKUP_PAGE_SIZE,
  })
})

test("parseSizeParam accepts only the offered page sizes", () => {
  for (const size of ADMIN_LOOKUP_PAGE_SIZES) {
    assert.equal(parseSizeParam(String(size)), size)
  }
  assert.equal(parseSizeParam(["100", "25"]), 100)
})

test("parseSizeParam falls back to the default instead of clamping an off-list size", () => {
  // `size` becomes a .range() window on a service-role read, so an
  // operator-typed 5000 must not be honoured — and must not be clamped to the
  // largest offered size either, which would still be a URL-chosen budget.
  for (const junk of [
    undefined,
    "",
    "abc",
    "-1",
    "0",
    "26",
    "99",
    "1000",
    "5000",
    "50.5",
  ]) {
    assert.equal(parseSizeParam(junk), ADMIN_LOOKUP_PAGE_SIZE, `size=${junk}`)
  }
})

test("escapeLikePattern escapes LIKE wildcards and backslashes", () => {
  assert.equal(escapeLikePattern("100%_done\\"), "100\\%\\_done\\\\")
  assert.equal(containsPattern("jo"), "%jo%")
  assert.equal(containsPattern("50%"), "%50\\%%")
})

test("contactOrIlikeFilter quotes the pattern so PostgREST reserved characters are inert", () => {
  assert.equal(
    contactOrIlikeFilter("jo"),
    'email.ilike."%jo%",phone_last4.ilike."%jo%"'
  )
  // A term with a comma, quote, and wildcard must stay a single quoted value.
  const filter = contactOrIlikeFilter('a,b"c%')
  assert.equal(
    filter,
    'email.ilike."%a,b\\"c\\\\%%",phone_last4.ilike."%a,b\\"c\\\\%%"'
  )
})

test("lookupRange returns a zero-based inclusive window per page", () => {
  assert.deepEqual(lookupRange(1), { from: 0, to: ADMIN_LOOKUP_PAGE_SIZE - 1 })
  assert.deepEqual(lookupRange(3), {
    from: ADMIN_LOOKUP_PAGE_SIZE * 2,
    to: ADMIN_LOOKUP_PAGE_SIZE * 3 - 1,
  })
  assert.deepEqual(lookupRange(2, 10), { from: 10, to: 19 })
})

test("pageMeta reports totals and page counts without a zero page count", () => {
  assert.deepEqual(pageMeta(0, 1), {
    total: 0,
    page: 1,
    pageCount: 1,
    pageSize: ADMIN_LOOKUP_PAGE_SIZE,
  })
  assert.deepEqual(pageMeta(101, 2), {
    total: 101,
    page: 2,
    pageCount: 5,
    pageSize: ADMIN_LOOKUP_PAGE_SIZE,
  })
  assert.equal(pageMeta(25, 1).pageCount, 1)
  assert.equal(pageMeta(26, 1).pageCount, 2)
})

test("previousPage and nextPage stay inside the reachable window", () => {
  assert.equal(previousPage(pageMeta(101, 1)), null)
  assert.equal(previousPage(pageMeta(101, 3)), 2)
  assert.equal(nextPage(pageMeta(101, 5)), null)
  assert.equal(nextPage(pageMeta(101, 4)), 5)
  // A requested page beyond the end still routes back into range.
  assert.equal(previousPage(pageMeta(101, 9)), 5)
  assert.equal(nextPage(pageMeta(101, 9)), null)
})

test("decideVenueFilter pushes a single match down and refuses to guess otherwise", () => {
  assert.deepEqual(decideVenueFilter(undefined, []), { kind: "unfiltered" })
  assert.deepEqual(decideVenueFilter("crown", [{ id: "venue-1" }]), {
    kind: "single",
    venueId: "venue-1",
  })
  assert.deepEqual(
    decideVenueFilter("the", [{ id: "venue-1" }, { id: "venue-2" }]),
    { kind: "ambiguous" }
  )
})

test("decideVenueFilter treats a fragment that matches no venue as an empty result, never as unfiltered", () => {
  // The referral reader takes one venue id; answering "no match" with a null
  // id would run the query unfiltered and present every referral on the
  // platform as that venue's.
  assert.deepEqual(decideVenueFilter("zzz", []), { kind: "none" })
  assert.notEqual(decideVenueFilter("zzz", []).kind, "unfiltered")
})

test("buildLookupHref keeps the default rows-per-page implicit and carries any other", () => {
  assert.equal(
    buildLookupHref("/admin/merchants", {
      page: 1,
      size: ADMIN_LOOKUP_PAGE_SIZE,
    }),
    "/admin/merchants"
  )
  assert.equal(
    buildLookupHref("/admin/merchants", { page: 2, size: 100 }),
    "/admin/merchants?page=2&size=100"
  )
})

test("buildLookupHref serialises only meaningful params and keeps page 1 implicit", () => {
  assert.equal(
    buildLookupHref("/admin/customers", { page: 1 }),
    "/admin/customers"
  )
  assert.equal(
    buildLookupHref("/admin/customers", {
      venue: "Red Lion",
      contact: undefined,
      page: 2,
    }),
    "/admin/customers?venue=Red+Lion&page=2"
  )
  assert.equal(
    buildLookupHref("/admin/privacy", {
      contact: "07700",
      page: 1,
      consentPage: 4,
    }),
    "/admin/privacy?contact=07700&consentPage=4"
  )
  assert.equal(
    buildLookupHref("/admin/customers", {
      venue: "a&b=c",
      page: 3,
      rewardsPage: 1,
    }),
    "/admin/customers?venue=a%26b%3Dc&page=3"
  )
})

test("parseAdminSortParams accepts only allowlisted sort tokens", () => {
  const allowed = ["severity", "when"]

  assert.deepEqual(parseAdminSortParams({ sort: "severity" }, allowed), {
    key: "severity",
    direction: "desc",
  })
  assert.deepEqual(
    parseAdminSortParams({ sort: "when", dir: "asc" }, allowed),
    { key: "when", direction: "asc" }
  )
  // A column name that is real in the database but not on the allowlist is
  // still an operator-controlled ORDER BY on a service-role read.
  for (const junk of [
    "created_at",
    "metadata",
    "id",
    "severity;drop",
    "",
    undefined,
  ]) {
    assert.deepEqual(
      parseAdminSortParams({ sort: junk }, allowed),
      { key: null, direction: "desc" },
      `sort=${String(junk)} must fall back to the default order`
    )
  }
})

test("parseAdminSortParams reports no direction without a column", () => {
  // `?dir=asc` alone is not a sort; reporting it would let a caller build
  // links that look like they change the order and do not.
  assert.deepEqual(parseAdminSortParams({ dir: "asc" }, ["when"]), {
    key: null,
    direction: "desc",
  })
})

test("resolveAdminSort maps a token to a column and inverts a ranked one", () => {
  const columns = {
    when: { column: "created_at" },
    severity: { column: "severity_rank", inverted: true },
  }

  assert.equal(resolveAdminSort(undefined, columns), null)
  assert.equal(resolveAdminSort({ key: null, direction: "desc" }, columns), null)
  assert.equal(
    resolveAdminSort({ key: "unknown", direction: "desc" }, columns),
    null
  )

  assert.deepEqual(resolveAdminSort({ key: "when", direction: "desc" }, columns), {
    column: "created_at",
    ascending: false,
  })
  assert.deepEqual(resolveAdminSort({ key: "when", direction: "asc" }, columns), {
    column: "created_at",
    ascending: true,
  })

  // The inversion that matters: severity_rank 1 is `high`, so "most severe
  // first" (desc) is ascending rank. Without it, an operator asking for the
  // worst flags first would be shown the mildest.
  assert.deepEqual(
    resolveAdminSort({ key: "severity", direction: "desc" }, columns),
    { column: "severity_rank", ascending: true }
  )
  assert.deepEqual(
    resolveAdminSort({ key: "severity", direction: "asc" }, columns),
    { column: "severity_rank", ascending: false }
  )
})
