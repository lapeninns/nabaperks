import assert from "node:assert/strict"
import { test } from "node:test"

import {
  ADMIN_LOOKUP_PAGE_SIZE,
  buildLookupHref,
  contactOrIlikeFilter,
  containsPattern,
  escapeLikePattern,
  lookupRange,
  nextPage,
  normaliseLookupTerm,
  pageMeta,
  parseAdminLookupParams,
  parsePageParam,
  previousPage,
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

test("parseAdminLookupParams maps venue, contact, and page from search params", () => {
  assert.deepEqual(
    parseAdminLookupParams({ venue: " The  Crown ", contact: "jo", page: "3" }),
    { venue: "The Crown", contact: "jo", page: 3 }
  )
  assert.deepEqual(parseAdminLookupParams(undefined), {
    venue: undefined,
    contact: undefined,
    page: 1,
  })
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

test("buildLookupHref serialises only meaningful params and keeps page 1 implicit", () => {
  assert.equal(buildLookupHref("/admin/customers", { page: 1 }), "/admin/customers")
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
