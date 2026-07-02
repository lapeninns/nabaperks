import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * UX production-polish consolidation backbone — structural assertions.
 *
 * Locks the fix-phase contracts minted by the consolidation lane:
 *   1. feedback surfaces are themed (sonner toast slot, alert ink border);
 *   2. state styling lives INSIDE the unlayered Wet Ink layer (aria-invalid,
 *      focus) instead of layered utilities the layer defeats;
 *   3. FormField actually wires aria-describedby/aria-invalid to its control;
 *   4. one shared pending-state recipe (SubmitButton + Spinner);
 *   5. the micro-type scale exists as named utilities with a 10px floor;
 *   6. dead tokens (--shadow-hard family) are defined;
 *   7. the token guard enforces undefined-var and sub-floor-type failures;
 *   8. the /dev/design-system catalog covers forms/feedback and console viz.
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

const globalsCss = readProjectFile("app", "globals.css")
const designMd = readProjectFile("DESIGN.md")

test("Given the sonner wrapper When toasts render Then richColors is neutralised and the .cn-toast slot is themed in globals.css", () => {
  const sonner = readProjectFile("components", "ui", "sonner.tsx")

  // The wrapper owns the toast theme: any richColors prop passed by a mount
  // point must be dropped so sonner's stock green/red palette never ships.
  assert.match(
    sonner,
    /richColors/,
    "sonner.tsx must explicitly handle (neutralise) the richColors prop"
  )
  assert.match(
    sonner,
    /richColors=\{false\}/,
    "sonner.tsx must force richColors off"
  )

  // The cn-toast hook class must exist with the Wet Ink contract: 2px ink
  // border, card surface, hard offset shadow.
  assert.match(
    globalsCss,
    /\.cn-toast[^{]*\{[^}]*border:\s*2px solid var\(--w-ink\)/,
    ".cn-toast must carry the 2px ink border"
  )
  assert.match(
    globalsCss,
    /\.cn-toast[^{]*\{[^}]*background:[^;]*var\(--card\)/,
    ".cn-toast must sit on the card surface"
  )
})

test("Given the unlayered Wet Ink layer When a control is invalid or focused Then the layer itself provides the state styling", () => {
  assert.match(
    globalsCss,
    /\[data-slot="input"\]\[aria-invalid="true"\]/,
    "unlayered layer must own the input aria-invalid border state"
  )
  assert.match(
    globalsCss,
    /\[data-slot="textarea"\]\[aria-invalid="true"\]/,
    "unlayered layer must own the textarea aria-invalid border state"
  )
  // One focus recipe: a shared .focus-ring class exists…
  assert.match(
    globalsCss,
    /\.focus-ring:focus-visible|\.focus-ring[\s\S]*?:focus-visible/,
    "a single shared .focus-ring recipe must exist"
  )
  // …and the per-component ring-alpha dialects are gone from the primitives.
  const button = readProjectFile("components", "ui", "button.tsx")
  const input = readProjectFile("components", "ui", "input.tsx")
  const textarea = readProjectFile("components", "ui", "textarea.tsx")
  for (const [name, source] of [
    ["button.tsx", button],
    ["input.tsx", input],
    ["textarea.tsx", textarea],
  ]) {
    assert.doesNotMatch(
      source,
      /focus-visible:ring-3|focus-visible:ring-\[3px\]/,
      `${name} must not carry a private focus ring dialect`
    )
  }
})

test("Given the alert slot When a bare Alert renders Then the unlayered layer provides the 2px ink border", () => {
  assert.match(
    globalsCss,
    /\[data-slot="alert"\]\s*\{[^}]*border:\s*2px solid var\(--w-ink\)/,
    "[data-slot=alert] must carry the 2px ink contract"
  )
})

test("Given production-consumed slots When themed Then progress, empty-title and sheet-title have unlayered rules", () => {
  assert.match(globalsCss, /\[data-slot="progress"\]/)
  assert.match(globalsCss, /\[data-slot="progress-indicator"\]/)
  assert.match(
    globalsCss,
    /\[data-slot="empty-title"\][^{]*\{[^}]*font-weight:\s*800/
  )
  assert.match(
    globalsCss,
    /\[data-slot="sheet-title"\][^{]*\{[^}]*font-weight:\s*800/
  )
})

test("Given FormField When it renders a single control Then aria-describedby and aria-invalid are injected", () => {
  const formField = readProjectFile("components", "forms", "form-field.tsx")
  assert.match(formField, /aria-describedby/)
  assert.match(formField, /aria-invalid/)
  assert.match(
    formField,
    /cloneElement/,
    "FormField must clone its control to inject the aria wiring"
  )
})

test("Given a server-action form When it submits Then the shared SubmitButton pending recipe exists", () => {
  const submitButton = readProjectFile(
    "components",
    "forms",
    "submit-button.tsx"
  )
  assert.match(submitButton, /useFormStatus/)
  assert.match(submitButton, /pendingLabel/)
  assert.match(
    submitButton,
    /aria-busy/,
    "pending state must be announced via aria-busy"
  )
  assert.match(
    submitButton,
    /Spinner/,
    "SubmitButton must adopt the Spinner primitive"
  )
  const formsIndex = readProjectFile("components", "forms", "index.ts")
  assert.match(formsIndex, /SubmitButton/)
})

test("Given the micro-type scale When minted Then mono-meta and mono-id utilities exist and DESIGN.md documents the 10px floor", () => {
  assert.match(globalsCss, /\.mono-meta[^{]*\{[^}]*0\.71875rem/)
  assert.match(globalsCss, /\.mono-id[^{]*\{[^}]*0\.625rem/)
  assert.match(designMd, /mono-meta/)
  assert.match(designMd, /10px (?:mono-id )?floor|10px is the system floor/i)
})

test("Given the dead shadow tokens When healed Then --shadow-hard and --shadow-hard-sm are defined as hard offsets", () => {
  assert.match(globalsCss, /--shadow-hard:\s*4px 4px 0 var\(--w-shadow-color\)/)
  assert.match(
    globalsCss,
    /--shadow-hard-sm:\s*2px 2px 0 var\(--w-shadow-color\)/
  )
})

test("Given the dashed-line tone zoo When consolidated Then --w-line-strong exists in both palettes", () => {
  const rootBlock = globalsCss.slice(
    globalsCss.indexOf(":root"),
    globalsCss.indexOf(".dark {")
  )
  const darkBlock = globalsCss.slice(globalsCss.indexOf(".dark {"))
  assert.match(rootBlock, /--w-line-strong:/)
  assert.match(darkBlock, /--w-line-strong:/)
})

test("Given the token guard When extended Then it fails on undefined var() references and sub-floor arbitrary text sizes", () => {
  const guard = readProjectFile("scripts", "check-design-tokens.mjs")
  assert.match(
    guard,
    /--shadow-hard|undefined|no definition/i,
    "guard must document the undefined-var check"
  )
  assert.match(
    guard,
    /collectVarReferences|checkUndefinedVars|undefinedVar/i,
    "guard must implement an undefined-var check"
  )
  assert.match(
    guard,
    /MIN_TEXT_PX|floor|subFloor/i,
    "guard must implement the 10px text floor check"
  )
})

test("Given the loyalty primitives When under width pressure Then StampGrid reserves readable slots and the tag has a truncation story", () => {
  const stampGrid = readProjectFile(
    "components",
    "loyalty",
    "stamp-grid.tsx"
  )
  // Row layout must guarantee a minimum readable track instead of letting
  // discs compress to ellipses.
  assert.match(
    stampGrid,
    /auto-fill|auto-fit/,
    "StampGrid row layout must wrap via auto-fill/auto-fit minmax tracks"
  )
  assert.match(
    stampGrid,
    /showCount/,
    "StampGrid must offer the reserved count label"
  )
  // Tag truncation: the badge slot and .w-tag must cap their width.
  assert.match(globalsCss, /\.w-tag[^{]*\{[^}]*max-width:\s*100%/)
  const monoTag = readProjectFile("components", "brand", "mono-tag.tsx")
  assert.match(
    monoTag,
    /truncate/,
    "MonoTag must truncate long content"
  )
})

test("Given the catalog acceptance gate When rendered Then forms/feedback and console-viz sections exist", () => {
  const catalog = readProjectFile("app", "dev", "design-system", "page.tsx")
  assert.match(catalog, /forms-feedback|Forms & feedback/i)
  assert.match(catalog, /console-viz|Console viz/i)
  // The unconsumed primitives were themed-or-removed: Tabs and InputGroup are
  // deleted until a themed adoption exists; Spinner is adopted by SubmitButton.
  assert.equal(
    existsInRepo("components/ui/tabs.tsx"),
    false,
    "unconsumed components/ui/tabs.tsx must be removed"
  )
  assert.equal(
    existsInRepo("components/ui/input-group.tsx"),
    false,
    "unconsumed components/ui/input-group.tsx must be removed"
  )
})

function existsInRepo(relativePath) {
  try {
    readFileSync(path.join(projectRoot, relativePath))
    return true
  } catch {
    return false
  }
}
