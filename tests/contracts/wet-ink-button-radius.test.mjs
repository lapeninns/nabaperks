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
 * DESIGN.md "Shapes": "**10px radius** (`--radius`) on buttons, inputs, cards,
 * and keys"; "**Full circles are reserved for the stamp family**". DESIGN.md
 * "Buttons": "2px ink border, 10px radius, weight 700, hard 3px offset
 * shadow." DESIGN.md "Brand & Style" records v1 Honey & Ink — the pill-shape
 * system — as "fully superseded".
 *
 * `buttonVariants`' base string shipped `rounded-full`. On a real `<Button>`
 * that is dead: the unlayered `[data-slot="button"]` rules sit outside every
 * `@layer` and so beat the layered utility, exactly as DESIGN.md "Components ·
 * Layer precedence" says they do. It is NOT dead where `buttonVariants` is
 * exported and applied to a plain element that carries no `data-slot` —
 * `app/m/[merchantSlug]/page.tsx` dresses the venue "View reward terms" sheet
 * trigger that way. Measured against `pnpm build && PORT=3301 pnpm start`,
 * with `document.styleSheets.length > 0` and `main#main` asserted first, the
 * one class string rendered:
 *
 *   plain element    border-radius 3.3554432e+07px   border-width 0px
 *   + data-slot      border-radius 10px              border-width 2px
 *
 * So the base string is the only radius that reaches an unslotted consumer,
 * and it disagreed with the layer by 33 million pixels. This pins the two
 * sides to the same 10px so a `buttonVariants` consumer cannot silently render
 * a v1 pill again.
 */
test("buttonVariants' base radius is the 10px --radius, never a full pill", () => {
  const button = read("components", "ui", "button.tsx")

  const base = button.slice(
    button.indexOf("const buttonVariants = cva("),
    button.indexOf("{\n    variants:")
  )

  // A slice that missed would make every assertion below vacuous.
  assert.ok(
    base.includes("pressable inline-flex"),
    `expected the cva base string, got ${base.length} chars`
  )

  assert.ok(
    !/\brounded-full\b/.test(base),
    "buttonVariants' base declares rounded-full — a v1 pill that reaches every unslotted consumer"
  )
  assert.match(base, /\brounded-lg\b/)
})

test("the button base radius and the Wet Ink layer name the same token", () => {
  const globals = read("app", "globals.css")

  // `rounded-lg` resolves to --radius-lg, and --radius-lg is --radius (10px).
  assert.match(globals, /--radius-lg:\s*var\(--radius\);/)
  assert.match(globals, /--radius:\s*10px;/)

  // Every button variant is given that radius by the unlayered layer: the
  // three-way :not() base rule plus the ghost/link and destructive rules.
  const layerRadii = [
    ...globals.matchAll(
      /\[data-slot="button"\][^{]*\{[^}]*border-radius:\s*([^;]+);/g
    ),
  ].map(([, value]) => value.trim())

  assert.ok(
    layerRadii.length >= 3,
    `expected the button layer rules, got ${layerRadii.length}`
  )
  assert.deepEqual([...new Set(layerRadii)], ["var(--radius-lg)"])
})

/**
 * The general form of the same defect, and the reason it survived review: a
 * shape or elevation utility dropped on a themed primitive looks intentional
 * and does nothing. DESIGN.md "Components": "A utility such as `rounded-full`
 * or `shadow-lg` dropped on a themed primitive will therefore not override it."
 *
 * Scanned in the primitives' OWN files, where such a class is baked into every
 * instance rather than chosen per call site.
 */
test("no components/ui primitive bakes rounded-full into a themed slot", () => {
  const themed = [
    "button.tsx",
    "card.tsx",
    "input.tsx",
    "textarea.tsx",
    "badge.tsx",
    "alert.tsx",
    "progress.tsx",
  ]

  // The fix documents itself beside the class string, so it quotes the banned
  // token. Scanning raw source would make the explanation its own offender —
  // the same reason `wet-ink-opaque-chrome` strips comments before scanning.
  const stripComments = (source) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")

  const offenders = themed.filter((file) =>
    /\brounded-full\b/.test(stripComments(read("components", "ui", file)))
  )

  assert.deepEqual(offenders, [])
})
