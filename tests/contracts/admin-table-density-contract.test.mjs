import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

/**
 * The admin console's table-density mechanism (UI audit ADM 04#60).
 *
 * 04#60 asked for four things on the admin tables: sorting, `aria-sort`, a
 * sticky header, and a per-column visibility toggle for the wide ones. The
 * first two shipped. This file pins the answer to the FOURTH, because
 * `DESIGN.md` already settled it and nothing in the tree said so.
 *
 * `DESIGN.md` / "Console data tables & record cards":
 *
 *   "`cardBreakpoint` has two sanctioned switches: `sm` for compact,
 *    short-row tables and `xl` for admin consoles. The admin norm is `xl`, so
 *    dense support records stay as stacked `AdminRecordCard` rows through
 *    tablet widths and switch to the semantic table at desktop width. The old
 *    `lg` escape hatch is pruned."
 *
 * and:
 *
 *   "This responsive pair is shared by 7+ admin tables — customers,
 *    merchants, fraud, billing, audit, pilot, and privacy — which is why the
 *    mobile renderer and the record card are one abstraction rather than
 *    per-page markup."
 *
 * So "seven columns do not fit" is a solved problem with a NAMED owner: below
 * `xl` the row becomes an `AdminRecordCard` that prints every column as a
 * stacked label/value pair. A per-column visibility toggle would be a second,
 * per-table mechanism for the same problem — the "per-page markup" the
 * contract exists to prevent — and it hides data the record card shows.
 *
 * The assertions below are therefore the mechanism, not the styling: every
 * admin table opts in, none of them re-opens the pruned `lg` switch, and the
 * record card keeps the stacked-field API that makes the toggle unnecessary.
 */

/** Every `.tsx` file under a directory, recursively. */
function tsxFilesUnder(...segments) {
  const root = path.join(projectRoot, ...segments)
  const found = []

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (entry.endsWith(".tsx")) found.push(full)
    }
  }

  walk(root)
  return found.sort()
}

/**
 * The source of every `<DataTable` element in a file, each sliced to its own
 * props. Sliced on the NEXT `<DataTable` (or end of file) rather than on a
 * closing token, so a call site cannot borrow the prop of the one after it.
 */
function dataTableCallSites(source) {
  const starts = []
  for (
    let at = source.indexOf("<DataTable");
    at !== -1;
    at = source.indexOf("<DataTable", at + 1)
  ) {
    starts.push(at)
  }

  return starts.map((start, index) =>
    source.slice(start, starts[index + 1] ?? source.length)
  )
}

const adminTables = tsxFilesUnder("app", "admin").flatMap((file) => {
  const relative = path.relative(projectRoot, file)
  return dataTableCallSites(readFileSync(file, "utf8")).map((source, index) => ({
    label: `${relative} (DataTable #${index + 1})`,
    source,
  }))
})

// A census guard. If this file is ever pointed at a tree with no admin tables
// in it, every assertion below passes vacuously and the pin means nothing.
test("Given the admin console When its tables are enumerated Then the density contract has call sites to bind", () => {
  assert.ok(
    adminTables.length >= 11,
    `expected the 11 known admin DataTables, found ${adminTables.length}`
  )
})

// DESIGN.md, "Console data tables & record cards": the admin norm is `xl`.
// Without this, a new admin table silently defaults to `sm` and its dense
// seven-column row is a horizontal scroll from 640px up — which is the state
// that made 04#60 ask for a column toggle in the first place.
test("Given each admin DataTable When its props are read Then it opts into the xl card breakpoint", () => {
  for (const { label, source } of adminTables) {
    const breakpoint = /cardBreakpoint="([a-z]+)"/.exec(source)

    assert.ok(breakpoint, `${label} must declare cardBreakpoint`)
    assert.equal(
      breakpoint[1],
      "xl",
      `${label} must use the admin norm cardBreakpoint="xl"`
    )
  }
})

// The half that makes a column toggle unnecessary: below `xl` the row is an
// AdminRecordCard, which prints EVERY column as a stacked label/value pair.
// `cardBreakpoint` without `mobileCard` is inert — DataTable renders the plain
// table either way — so the two are asserted together on purpose.
test("Given each admin DataTable When its props are read Then it supplies the record-card renderer", () => {
  for (const { label, source } of adminTables) {
    assert.match(
      source,
      /mobileCard=\{/,
      `${label} must supply mobileCard; cardBreakpoint alone renders nothing`
    )
  }
})

// "The old `lg` escape hatch is pruned." Pinned as an absence so the pruning
// survives: a third breakpoint is a third density story.
test("Given the DataTable primitive When its breakpoints are read Then only the two sanctioned switches exist", () => {
  const primitive = readFileSync(
    path.join(projectRoot, "components", "data", "data-table.tsx"),
    "utf8"
  )

  const breakpointType = /cardBreakpoint\??:\s*([^\n]+)/.exec(primitive)
  assert.ok(breakpointType, "DataTable declares a cardBreakpoint prop")
  assert.doesNotMatch(
    breakpointType[1],
    /"lg"/,
    'the pruned `lg` escape hatch must not return'
  )
})

// The record card's stacked-field API is the thing a column toggle would
// duplicate. If `fields` ever stops being the way a row prints its columns,
// the argument for declining the toggle stops holding and this should fail.
test("Given AdminRecordCard When its API is read Then rows still print their columns as stacked fields", () => {
  const recordCard = readFileSync(
    path.join(projectRoot, "components", "admin", "record-card.tsx"),
    "utf8"
  )

  assert.match(
    recordCard,
    /fields/,
    "AdminRecordCard mirrors the desktop columns through `fields`"
  )
})
