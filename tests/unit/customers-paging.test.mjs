import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  CUSTOMERS_PAGE_SIZE,
  buildCustomersPagination,
  resolveCustomersPageForLeadingCount,
  resolveCustomersPageRequest,
} from "@/lib/merchant/customers-paging"

describe("resolveCustomersPageRequest", () => {
  it("defaults to page 1 / offset 0 with no param", () => {
    assert.deepEqual(resolveCustomersPageRequest(undefined), {
      page: 1,
      offset: 0,
    })
  })

  it("resolves a valid page into a 0-based offset", () => {
    assert.deepEqual(resolveCustomersPageRequest("3"), {
      page: 3,
      offset: 2 * CUSTOMERS_PAGE_SIZE,
    })
  })

  it("takes the first value of a repeated param", () => {
    assert.deepEqual(resolveCustomersPageRequest(["2", "9"]), {
      page: 2,
      offset: CUSTOMERS_PAGE_SIZE,
    })
  })
})

describe("resolveCustomersPageRequest — mangled input", () => {
  for (const bad of ["0", "-1", "1.5", "abc", "", "007x", "1e3"]) {
    it(`resolves ${JSON.stringify(bad)} to page 1`, () => {
      assert.deepEqual(resolveCustomersPageRequest(bad), {
        page: 1,
        offset: 0,
      })
    })
  }

  it("honours a custom page size", () => {
    assert.deepEqual(resolveCustomersPageRequest("4", 25), {
      page: 4,
      offset: 75,
    })
  })
})

describe("buildCustomersPagination", () => {
  it("is a single page at or below the page size", () => {
    assert.deepEqual(buildCustomersPagination(1, CUSTOMERS_PAGE_SIZE), {
      page: 1,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
      rangeStart: 1,
      rangeEnd: CUSTOMERS_PAGE_SIZE,
    })
  })

  it("splits beyond-cap totals into pages with an honest row range", () => {
    const total = CUSTOMERS_PAGE_SIZE * 3 + 10
    assert.deepEqual(buildCustomersPagination(2, total), {
      page: 2,
      totalPages: 4,
      hasPrev: true,
      hasNext: true,
      rangeStart: CUSTOMERS_PAGE_SIZE + 1,
      rangeEnd: CUSTOMERS_PAGE_SIZE * 2,
    })
    assert.deepEqual(buildCustomersPagination(4, total).rangeEnd, total)
    assert.equal(buildCustomersPagination(4, total).hasNext, false)
  })

  it("keeps zero members coherent (one empty page, 0-0 range)", () => {
    assert.deepEqual(buildCustomersPagination(1, 0), {
      page: 1,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
      rangeStart: 0,
      rangeEnd: 0,
    })
  })

  it("renders a beyond-the-end page as empty but navigable back", () => {
    const total = CUSTOMERS_PAGE_SIZE * 3 + 10
    const beyond = buildCustomersPagination(9, total)
    assert.equal(beyond.totalPages, 4)
    assert.equal(beyond.hasPrev, true)
    assert.equal(beyond.hasNext, false)
    assert.equal(beyond.rangeStart, 0)
    assert.equal(beyond.rangeEnd, 0)
  })

  it("honours a custom page size", () => {
    const page = buildCustomersPagination(2, 30, 10)
    assert.equal(page.totalPages, 3)
    assert.deepEqual([page.rangeStart, page.rangeEnd], [11, 20])
  })
})

describe("resolveCustomersPageForLeadingCount", () => {
  it("keeps the newest member on page 1", () => {
    assert.equal(resolveCustomersPageForLeadingCount(0), 1)
  })

  it("moves a deep-linked member to the page containing its stable rank", () => {
    assert.equal(
      resolveCustomersPageForLeadingCount(CUSTOMERS_PAGE_SIZE),
      2
    )
    assert.equal(
      resolveCustomersPageForLeadingCount(CUSTOMERS_PAGE_SIZE * 6 + 4),
      7
    )
  })

  it("normalises invalid counts and honours a custom page size", () => {
    assert.equal(resolveCustomersPageForLeadingCount(-5), 1)
    assert.equal(resolveCustomersPageForLeadingCount(Number.NaN), 1)
    assert.equal(resolveCustomersPageForLeadingCount(25, 10), 3)
  })
})
