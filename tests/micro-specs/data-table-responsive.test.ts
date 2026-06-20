import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { DataTable, type DataTableColumn } from "@/components/data/data-table"

type Row = { id: string; label: string }

const ROWS: Row[] = [
  { id: "r1", label: "Old Crown Girton" },
  { id: "r2", label: "The Eagle" },
]

const COLUMNS: DataTableColumn<Row>[] = [
  { key: "label", header: "Venue", cell: (row) => row.label },
]

const CAPTION = "Admin venue readback"
const REGEX_META = /[\\^$.*+?()[\]{}|]/g

// Extract the markup of the `sm:hidden` mobile-card container, if present.
// The container is the element whose class list contains `sm:hidden`.
function hasMobileContainer(html: string) {
  return /class="[^"]*\bsm:hidden\b[^"]*"/.test(html)
}

function hasClass(html: string, utility: string) {
  const escaped = utility.replace(REGEX_META, "\\$&")
  return new RegExp(`class="[^"]*\\b${escaped}\\b[^"]*"`).test(html)
}

describe("DataTable responsive mobile-card mode", () => {
  it("renders a sm:hidden mobile-card stack AND a hidden sm:block table when mobileCard is provided", () => {
    const html = renderToStaticMarkup(
      createElement(DataTable<Row>, {
        caption: CAPTION,
        columns: COLUMNS,
        rows: ROWS,
        getRowKey: (row) => row.id,
        mobileCard: (row) =>
          createElement("p", { "data-card": row.id }, `Card: ${row.label}`),
      })
    )

    // 1a. A sm:hidden card container exists.
    expect(hasMobileContainer(html)).toBe(true)

    // 1b. Each row's card content is rendered in the card path.
    expect(html).toContain('data-card="r1"')
    expect(html).toContain("Card: Old Crown Girton")
    expect(html).toContain('data-card="r2"')
    expect(html).toContain("Card: The Eagle")

    // 1c. The semantic table is still present, in a hidden sm:block wrapper.
    expect(html).toContain("<table")
    expect(/class="[^"]*\bhidden\b[^"]*\bsm:block\b[^"]*"/.test(html)).toBe(
      true
    )

    // 1d. The accessible caption is preserved for the table.
    expect(html).toContain(CAPTION)
  })

  it("renders only the table with NO sm:hidden card container when mobileCard is omitted (backward-compatible DOM)", () => {
    const html = renderToStaticMarkup(
      createElement(DataTable<Row>, {
        caption: CAPTION,
        columns: COLUMNS,
        rows: ROWS,
        getRowKey: (row) => row.id,
      })
    )

    expect(html).toContain("<table")
    // No mobile-card container and no responsive wrappers leak into the
    // legacy rendering path.
    expect(hasMobileContainer(html)).toBe(false)
    expect(/\bhidden sm:block\b/.test(html)).toBe(false)
    // Legacy outer container class is unchanged.
    expect(html).toContain("surface-card overflow-x-auto")
  })

  it("renders the empty state (not an empty card list) when rows are empty and mobileCard + emptyState are provided", () => {
    const html = renderToStaticMarkup(
      createElement(DataTable<Row>, {
        caption: CAPTION,
        columns: COLUMNS,
        rows: [],
        getRowKey: (row) => row.id,
        emptyState: createElement(
          "p",
          { "data-empty": "true" },
          "No venues yet"
        ),
        mobileCard: (row) =>
          createElement("p", { "data-card": row.id }, `Card: ${row.label}`),
      })
    )

    expect(html).toContain('data-empty="true"')
    expect(html).toContain("No venues yet")
    // Must not render an empty/broken card list or a stray table body.
    expect(html).not.toContain("<table")
    expect(html).not.toContain("data-card=")
  })

  it("defaults to the `sm` card breakpoint (sm:hidden cards + hidden sm:block table) when cardBreakpoint is omitted", () => {
    const html = renderToStaticMarkup(
      createElement(DataTable<Row>, {
        caption: CAPTION,
        columns: COLUMNS,
        rows: ROWS,
        getRowKey: (row) => row.id,
        mobileCard: (row) =>
          createElement("p", { "data-card": row.id }, `Card: ${row.label}`),
      })
    )

    // Default keeps the original `sm` boundary.
    expect(hasClass(html, "sm:hidden")).toBe(true)
    expect(/class="[^"]*\bhidden\b[^"]*\bsm:block\b[^"]*"/.test(html)).toBe(
      true
    )
    // The `lg` boundary is not used in the default path.
    expect(hasClass(html, "lg:hidden")).toBe(false)
    expect(/class="[^"]*\bhidden\b[^"]*\blg:block\b[^"]*"/.test(html)).toBe(
      false
    )
  })

  it("uses the `lg` card breakpoint (lg:hidden cards + hidden lg:block table) when cardBreakpoint='lg'", () => {
    const html = renderToStaticMarkup(
      createElement(DataTable<Row>, {
        caption: CAPTION,
        columns: COLUMNS,
        rows: ROWS,
        getRowKey: (row) => row.id,
        cardBreakpoint: "lg",
        mobileCard: (row) =>
          createElement("p", { "data-card": row.id }, `Card: ${row.label}`),
      })
    )

    // Cards now stay through tablet; the table is reserved for `lg`+.
    expect(hasClass(html, "lg:hidden")).toBe(true)
    expect(/class="[^"]*\bhidden\b[^"]*\blg:block\b[^"]*"/.test(html)).toBe(
      true
    )
    // The `sm` boundary must not leak in when `lg` is requested.
    expect(hasClass(html, "sm:hidden")).toBe(false)
    expect(/class="[^"]*\bhidden\b[^"]*\bsm:block\b[^"]*"/.test(html)).toBe(
      false
    )
    // Card content and the semantic table are both still rendered.
    expect(html).toContain('data-card="r1"')
    expect(html).toContain("<table")
  })

  it("uses the `xl` card breakpoint (xl:hidden cards + hidden xl:block table) when cardBreakpoint='xl'", () => {
    const html = renderToStaticMarkup(
      createElement(DataTable<Row>, {
        caption: CAPTION,
        columns: COLUMNS,
        rows: ROWS,
        getRowKey: (row) => row.id,
        cardBreakpoint: "xl",
        mobileCard: (row) =>
          createElement("p", { "data-card": row.id }, `Card: ${row.label}`),
      })
    )

    expect(hasClass(html, "xl:hidden")).toBe(true)
    expect(/class="[^"]*\bhidden\b[^"]*\bxl:block\b[^"]*"/.test(html)).toBe(
      true
    )
    expect(hasClass(html, "lg:hidden")).toBe(false)
    expect(/class="[^"]*\bhidden\b[^"]*\blg:block\b[^"]*"/.test(html)).toBe(
      false
    )
    expect(html).toContain('data-card="r1"')
    expect(html).toContain("<table")
  })

  it("matches class names containing regex syntax as literal text", () => {
    const html = '<div class="sm:hidden data-[state=open]:block"></div>'

    expect(hasClass(html, "data-[state=open]:block")).toBe(true)
    expect(hasClass(html, "data-[state=closed]:block")).toBe(false)
  })
})
