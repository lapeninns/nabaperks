#!/usr/bin/env node
/**
 * check-design-tokens — assert that DESIGN.md's documented colour tokens match
 * the live CSS custom properties in app/globals.css (the LIGHT-theme :root
 * block). DESIGN.md is the Wet Ink source of truth; globals.css is what ships.
 *
 * This is the structural guard for a real drift class: a token can be edited in
 * one place and not the other, and the divergence has already shipped a
 * WCAG-failing colour into the PWA manifest. The guard fails the build the
 * moment the doc and the stylesheet disagree.
 *
 * Dependency-free Node ESM (no YAML lib). It:
 *   1. parses the `colors:` map from DESIGN.md's YAML frontmatter (the simple
 *      `key: "value"` lines between the first two `---` fences);
 *   2. parses the FIRST `:root { ... }` block of globals.css (light theme, NOT
 *      `.dark`) into property -> value, resolving `var(--x)` references within
 *      that map (one or more levels);
 *   3. compares the mapped pairs after normalising (trim, lowercase hex,
 *      collapse whitespace inside rgba());
 *   4. on mismatch prints a table and exits 1; on full match exits 0.
 *
 * Usage: node scripts/check-design-tokens.mjs   (exit 1 if any drift)
 */
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const ROOT = process.cwd()

/**
 * DESIGN.md colour key -> globals.css custom property. DESIGN.md keys absent
 * from this map are skipped (not all documented tokens have a 1:1 CSS var). A
 * mapped CSS property that is MISSING from :root is a failure.
 */
const MAPPING = {
  paper: "--w-paper",
  "paper-deep": "--w-paper-2",
  card: "--w-card",
  ink: "--w-ink",
  "ink-soft": "--w-ink-soft",
  line: "--w-line",
  "accent-vermillion": "--w-accent",
  "on-accent": "--w-accent-ink",
  cobalt: "--w-cobalt",
  leaf: "--w-leaf",
  sun: "--w-sun",
  destructive: "--destructive",
  background: "--background",
  foreground: "--foreground",
  primary: "--primary",
  "on-primary": "--primary-foreground",
  stamp: "--stamp",
  "stamp-empty": "--stamp-empty",
  seal: "--seal",
  "reward-ready": "--reward",
  qr: "--qr",
  "qr-bg": "--qr-foreground",
}

/** Strip /* ... *\/ comments (handles multi-line) from a CSS chunk. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "")
}

/**
 * Normalise a colour value for comparison:
 *   - trim
 *   - lowercase (so hex case never matters)
 *   - collapse all whitespace inside rgba()/rgb()/hsla()/hsl() to single spaces
 *     after commas removed-of-padding (rgba( 33 , 28 ,22 ,0.18 ) -> rgba(33,28,22,0.18))
 */
function normalise(value) {
  let v = String(value).trim().toLowerCase()
  v = v.replace(/(rgba?|hsla?)\(([^)]*)\)/g, (_, fn, inner) => {
    const parts = inner
      .split(",")
      .map((p) => p.trim().replace(/\s+/g, " "))
      .join(",")
    return `${fn}(${parts})`
  })
  return v
}

/**
 * Parse the `colors:` map out of DESIGN.md's YAML frontmatter without a YAML
 * lib. Only the block between the first two `---` fences is considered; within
 * it we read the indented `key: value` lines that sit under `colors:` (a
 * two-space-indented mapping) until the next top-level (column-0) key.
 */
function parseDesignColors(md) {
  const fenceRe = /^---\s*$/m
  const first = md.search(fenceRe)
  if (first === -1) throw new Error("DESIGN.md: no opening --- frontmatter fence")
  const afterFirst = first + md.slice(first).match(fenceRe)[0].length
  const rest = md.slice(afterFirst)
  const secondRel = rest.search(fenceRe)
  if (secondRel === -1) throw new Error("DESIGN.md: no closing --- frontmatter fence")
  const frontmatter = rest.slice(0, secondRel)

  const lines = frontmatter.split("\n")
  const colors = {}
  let inColors = false
  for (const line of lines) {
    if (/^colors:\s*$/.test(line)) {
      inColors = true
      continue
    }
    if (inColors) {
      // A new top-level key (no leading whitespace) ends the colors block.
      if (/^\S/.test(line)) break
      if (!line.trim()) continue
      const m = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.+?)\s*$/)
      if (m) {
        let val = m[2].trim()
        // Strip surrounding single or double quotes.
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1)
        }
        colors[m[1]] = val
      }
    }
  }
  return colors
}

/**
 * Parse the FIRST `:root { ... }` block of globals.css into property -> raw
 * value. Comments are stripped first; `.dark { ... }` is never reached because
 * we stop at the first `:root` block's closing brace.
 */
function parseRootBlock(css) {
  const clean = stripComments(css)
  const start = clean.indexOf(":root")
  if (start === -1) throw new Error("globals.css: no :root block found")
  const open = clean.indexOf("{", start)
  if (open === -1) throw new Error("globals.css: malformed :root block (no {)")
  // Walk braces to find the matching close for THIS :root block.
  let depth = 0
  let end = -1
  for (let i = open; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) throw new Error("globals.css: unterminated :root block")
  const body = clean.slice(open + 1, end)

  const props = {}
  for (const decl of body.split(";")) {
    const m = decl.match(/^\s*(--[A-Za-z0-9_-]+)\s*:\s*([\s\S]+?)\s*$/)
    if (m) props[m[1]] = m[2].trim()
  }
  return props
}

/**
 * Resolve `var(--x)` references within the :root map, one or more levels deep,
 * e.g. --primary: var(--w-accent) -> --w-accent's value. Returns the resolved
 * value, or the literal var() expression if the target is undefined (so the
 * mismatch surfaces rather than silently passing).
 */
function resolveVar(value, props, seen = new Set()) {
  const m = String(value).trim().match(/^var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,[\s\S]*)?\)$/)
  if (!m) return { value, from: null }
  const target = m[1]
  if (seen.has(target)) return { value, from: target } // cycle guard
  seen.add(target)
  if (!(target in props)) return { value, from: target } // unresolved -> surface
  const next = resolveVar(props[target], props, seen)
  return { value: next.value, from: next.from ?? target }
}

const [md, css] = await Promise.all([
  readFile(join(ROOT, "DESIGN.md"), "utf8"),
  readFile(join(ROOT, "app/globals.css"), "utf8"),
])

const designColors = parseDesignColors(md)
const rootProps = parseRootBlock(css)

const failures = []
let checked = 0

for (const [designKey, cssProp] of Object.entries(MAPPING)) {
  if (!(designKey in designColors)) continue // skip unmapped/absent doc keys

  const designValRaw = designColors[designKey]

  if (!(cssProp in rootProps)) {
    failures.push({
      key: designKey,
      design: designValRaw,
      css: "(missing)",
      from: cssProp,
    })
    continue
  }

  const resolved = resolveVar(rootProps[cssProp], rootProps)
  const cssValRaw = resolved.value
  const resolvedFrom = resolved.from && resolved.from !== cssProp
    ? `${cssProp} -> ${resolved.from}`
    : cssProp

  checked++
  if (normalise(designValRaw) !== normalise(cssValRaw)) {
    failures.push({
      key: designKey,
      design: designValRaw,
      css: cssValRaw,
      from: resolvedFrom,
    })
  }
}

if (failures.length) {
  const headers = ["key", "DESIGN.md value", "globals.css value", "resolved-from"]
  const rows = failures.map((f) => [f.key, f.design, f.css, f.from])
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length))
  )
  const fmt = (cells) =>
    cells.map((c, i) => String(c).padEnd(widths[i])).join("  |  ")

  console.error(`✗ ${failures.length} design-token drift(s) between DESIGN.md and app/globals.css:\n`)
  console.error(`  ${fmt(headers)}`)
  console.error(`  ${widths.map((w) => "-".repeat(w)).join("--+--")}`)
  for (const r of rows) console.error(`  ${fmt(r)}`)
  console.error("")
  process.exit(1)
}

console.log(`✓ design tokens in sync: ${checked} colour token(s) match between DESIGN.md and app/globals.css`)
