import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

/**
 * Mobile-robustness contract for the shared route header / metric primitives in
 * `components/brand/typography.tsx`.
 *
 * The suite runs in the `node` environment (see vitest.config.ts) and UI is
 * exercised through source-structure assertions, not by rendering the React
 * tree. These tests pin the markup affordances that keep a long `PageTitle`
 * title plus a primary action wrapping cleanly at 375px, and that keep a
 * `MetricTile` value at stable dimensions when its value changes.
 */
function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function classBlockFor(source: string, after: string) {
  // Returns the className string literal that immediately follows the given
  // anchor, so assertions target the specific element rather than the whole
  // file (which would also match unrelated utility usage).
  const anchorIndex = source.indexOf(after)
  expect(anchorIndex, `expected to find anchor: ${after}`).toBeGreaterThan(-1)
  return source.slice(anchorIndex, anchorIndex + 400)
}

describe("route header primitives are robust on a 375px mobile column", () => {
  const typography = readProjectFile("components/brand/typography.tsx")

  it("lets a long PageTitle title shrink and wrap so it is not clipped at 375px", () => {
    // The title block sits in the `1fr` grid track; without `min-w-0` a grid
    // track keeps its implicit `min-width: auto` and a long merchant name such
    // as "The Old Crown Coffee House and Roastery, Girton" overflows the column.
    const titleColumn = classBlockFor(typography, "{eyebrow ? <Eyebrow>")
    expect(titleColumn).toContain("min-w-0")

    // The <h1> itself must be allowed to break long words and balance the wrap
    // instead of being forced wider than the thumb column.
    const heading = classBlockFor(typography, "<h1\n")
    expect(heading).toContain("break-words")
    expect(heading).toContain("text-balance")
    expect(heading).toContain("min-w-0")
  })

  it("keeps the PageTitle action able to wrap rather than being pushed off-screen", () => {
    // Actions live in their own flex container that is allowed to wrap so a
    // primary button (and any secondary actions) reflow below the title on
    // narrow screens instead of being clipped to the right.
    const actions = classBlockFor(typography, "{actions ? <div")
    expect(actions).toContain("flex")
    expect(actions).toContain("flex-wrap")
  })

  it("keeps a MetricTile value at stable dimensions when the value changes", () => {
    // Tabular figures stop digit-width shimmer; a reserved min-height stops the
    // tile from changing height (and shifting the row) when a value wraps or
    // swaps between short and long content.
    const value = classBlockFor(typography, "<CardTitle")
    expect(value).toContain("numeric-tabular")
    expect(value).toMatch(/min-h-/)
  })
})
