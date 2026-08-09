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
 * 03#16, defect (b) — held closed rather than left to drift again.
 *
 * The audit's Critical was that the members list hand-rolls a second responsive
 * renderer, and its second complaint was that the two renderers "have already
 * drifted — the mobile card exposes 'Open scanner' + 'Send reward' only when
 * SELECTED, the desktop row always shows Scan/Send". That drift was closed by
 * 03#17 (the Reward cell is the `MonoTag` alone; both actions moved into the
 * selected-member bar), but nothing stopped it returning, and drift is the
 * whole reason a second renderer is a defect rather than a preference.
 *
 * The migration the audit recommended does not remove the second tree —
 * `DataTable`'s own `mobileCard` path renders BOTH and hides one with CSS
 * (`CARD_BREAKPOINT_CLASSES`) — so the drift risk is what is actually
 * actionable here. This pins it.
 */
const TABLE = "components/merchant/customer-readback-table.tsx"

/** The source of `buildColumns`, i.e. the desktop renderer's cells only. */
function desktopColumns(source) {
  const start = source.indexOf("function buildColumns(")
  assert.ok(start > 0, "buildColumns not found")
  const end = source.indexOf("// ─── Main export", start)
  assert.ok(end > start, "end of the column builder not found")
  return source.slice(start, end)
}

/** The source of the phone card renderer. */
function mobileCard(source) {
  const start = source.indexOf("function CustomerMobileCard(")
  assert.ok(start > 0, "CustomerMobileCard not found")
  const end = source.indexOf("// ─── Mobile list", start)
  assert.ok(end > start, "end of the mobile card not found")
  return source.slice(start, end)
}

test("the desktop row keeps no per-row action; the Reward cell is the tag alone", () => {
  const columns = desktopColumns(read(TABLE))

  // A per-row link is exactly what 03#17 removed: it put ~128px and two
  // competing CTAs on every redeemable row.
  assert.doesNotMatch(columns, /\/app\/customers\/send-reward/)
  assert.doesNotMatch(columns, /"\/app\/scan"/)
  assert.doesNotMatch(columns, /<Button/)
  assert.doesNotMatch(columns, /<Link/)

  // And the cell that used to carry them still renders the status tag.
  assert.match(columns, /key: "reward"[\s\S]*?<MonoTag/)
})

test("both renderers gate Scan and Send on selection, not on breakpoint", () => {
  const source = read(TABLE)
  const card = mobileCard(source)

  // The card exposes both actions, and only while the row is selected.
  assert.match(card, /isSelected \? \([\s\S]*?\/app\/scan[\s\S]*?\) : null/)
  assert.match(
    card,
    /isSelected \? \([\s\S]*?\/app\/customers\/send-reward[\s\S]*?\) : null/
  )

  // The desktop equivalent is the selected-member bar, which is likewise
  // conditional on a selection and lives outside the column builder.
  const bar = source.slice(source.indexOf("selected ? (", source.indexOf("return (")))
  assert.match(bar, /\/app\/scan/)
  assert.match(bar, /\/app\/customers\/send-reward/)
})

/**
 * The bespoke `lg` split is a documented deviation, not an oversight, and the
 * comment carrying that documentation has been deleted by a refactor before.
 * DESIGN.md's "Console data tables & record cards" section says the sanctioned
 * switches are `sm` and `xl` and that "The old `lg` escape hatch is pruned", so
 * a reader arriving at this file must find the reason in the file.
 */
test("the bespoke lg split states why it is not DataTable's mobileCard", () => {
  const source = read(TABLE)

  assert.match(source, /<div className="lg:hidden">/)
  assert.match(source, /<div className="hidden min-w-0 lg:block">/)
  assert.match(source, /bespoke lg split/)
  assert.match(source, /DataTable's shared contract only supports sm and xl/)
})

/**
 * The claim the decline rests on, asserted against the shared component rather
 * than trusted: `DataTable`'s responsive path renders both trees, and its one
 * mitigation for that (the progressive card reveal) is switched OFF for exactly
 * the callers that need keyboard-operable rows — which this table does. So
 * migrating would render the same 100 records per 50-row page the audit
 * counted. If either fact ever changes, 03#16 is worth reopening and this test
 * is the thing that says so.
 */
test("DataTable's mobileCard renders both trees and skips its reveal for interactive rows", () => {
  const dataTable = read("components", "data", "data-table.tsx")

  assert.match(
    dataTable,
    /sm:\s*\{\s*cards:\s*"sm:hidden",\s*table:\s*"hidden sm:block"\s*\}/
  )
  assert.match(
    dataTable,
    /xl:\s*\{\s*cards:\s*"xl:hidden",\s*table:\s*"hidden xl:block"\s*\}/
  )
  assert.match(dataTable, /cardBreakpoint\?:\s*"sm"\s*\|\s*"xl"/)

  // Both branches are unconditional siblings — CSS, not a render decision.
  const responsive = dataTable.slice(dataTable.indexOf("const breakpoint ="))
  assert.match(responsive, /className=\{breakpoint\.cards\}/)
  assert.match(responsive, /className=\{breakpoint\.table\}/)

  // The reveal is skipped when the caller supplies row interaction.
  assert.match(responsive, /!onRowClick &&\s*!getRowProps/)

  // ...which this table does, for WCAG 2.1.1 keyboard operability.
  const members = read(TABLE)
  assert.match(members, /onRowClick=\{\(row\) => handleSelect\(row\.id\)\}/)
  assert.match(members, /getRowProps=\{\(row\) => \(\{/)
})
