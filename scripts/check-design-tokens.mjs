#!/usr/bin/env node
/**
 * check-design-tokens — three structural guards over the Wet Ink system:
 *
 * CHECK 1 (original): DESIGN.md's documented colour tokens match the live CSS
 * custom properties in app/globals.css (the LIGHT-theme :root block).
 * DESIGN.md is the Wet Ink source of truth; globals.css is what ships. This
 * drift class has already shipped a WCAG-failing colour into the PWA manifest.
 *
 * CHECK 2: no `var(--x)` reference in app/, components/ or lib/ points at a
 * custom property with no definition anywhere (the `--shadow-hard` class of
 * bug — an undefined var renders as NOTHING, silently). Definitions are
 * collected from every scanned .css file plus TS/TSX style-object keys,
 * Tailwind arbitrary-property syntax (`[--x:…]`), `style.setProperty` calls,
 * and next/font `variable:` configs. References that carry a var() fallback
 * are exempt (they degrade by construction).
 *
 * CHECK 3: no arbitrary Tailwind text size below the 10px mono-id floor
 * (`text-[0.55rem]` and friends — DESIGN.md Typography). Files still being
 * swept by their owning fix lanes sit on a temporary exception list below;
 * remove each entry as that lane lands.
 *
 * Dependency-free Node ESM. Exits 1 if any check fails.
 *
 * Usage: node scripts/check-design-tokens.mjs
 */
import { readFile } from "node:fs/promises"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = process.cwd()

/** Minimum legible print size — the DESIGN.md mono-id floor, in px. */
const MIN_TEXT_PX = 10

/**
 * Sub-floor arbitrary sizes that pre-date the floor, owned by other fix
 * lanes. Remove entries as those lanes sweep their files; new violations in
 * any other file fail immediately.
 */
const SUBFLOOR_EXCEPTIONS = new Set([
  // marketing lane
  "components/marketing/landing/comparison-table.tsx",
  "components/marketing/landing/sample-loyalty-card.tsx",
  "components/marketing/landing/seal-break-demo.tsx", // dead code, slated for deletion
  "components/marketing/landing/venue-proof-reviews.tsx",
  "components/marketing/pilot-proof-strip.tsx",
  // merchant lane
  "components/merchant/customer-readback-table.tsx",
  "components/merchant/launch-readiness-panel.tsx",
  "components/merchant/loyalty-card-form.tsx",
])

/**
 * Custom-property prefixes owned by frameworks/runtimes rather than the repo
 * stylesheet: Tailwind internals and Radix runtime measurements.
 */
const RUNTIME_VAR_PREFIXES = [/^--tw-/, /^--radix-/]

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
  "line-strong": "--w-line-strong",
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

let failed = false

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
  failed = true
} else {
  console.log(`✓ design tokens in sync: ${checked} colour token(s) match between DESIGN.md and app/globals.css`)
}

/* ------------------------------------------------------------------ */
/* CHECK 2 — undefined var(--…) references                             */
/* ------------------------------------------------------------------ */

/** Recursively list source files under app/, components/ and lib/. */
function listSourceFiles() {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx|ts|css)$/.test(entry)) files.push(p)
    }
  }
  for (const root of ["app", "components", "lib"]) walk(join(ROOT, root))
  return files
}

/** Every custom property DEFINED somewhere the browser will see it. */
function collectVarDefinitions(files) {
  const defs = new Set()
  for (const file of files) {
    const src = readFileSync(file, "utf8")
    if (file.endsWith(".css")) {
      for (const m of src.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) defs.add(m[1])
    } else {
      // style-object keys: { "--stamp-rot": "-6deg" }
      for (const m of src.matchAll(/["'`](--[A-Za-z0-9_-]+)["'`]\s*:/g))
        defs.add(m[1])
      // next/font: variable: "--font-bricolage-grotesque"
      for (const m of src.matchAll(/variable:\s*["'](--[A-Za-z0-9_-]+)["']/g))
        defs.add(m[1])
      // Tailwind arbitrary properties: [--poster-frame-max:640px]
      for (const m of src.matchAll(/\[(--[A-Za-z0-9_-]+):/g)) defs.add(m[1])
      // Imperative writes: style.setProperty("--poster-chrome-offset", …)
      for (const m of src.matchAll(
        /setProperty\(\s*["'`](--[A-Za-z0-9_-]+)["'`]/g
      ))
        defs.add(m[1])
    }
  }
  return defs
}

/** Every fallback-less var(--…) READ in source, with its referencing files. */
function collectVarReferences(files) {
  const refs = new Map()
  for (const file of files) {
    const src = readFileSync(file, "utf8")
    for (const m of src.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])/g)) {
      if (m[2] === ",") continue // has a fallback — degrades by construction
      if (!refs.has(m[1])) refs.set(m[1], new Set())
      refs.get(m[1]).add(relative(ROOT, file))
    }
  }
  return refs
}

function checkUndefinedVars(files) {
  const defs = collectVarDefinitions(files)
  const refs = collectVarReferences(files)
  const undefinedVars = []
  for (const [name, where] of refs) {
    if (defs.has(name)) continue
    if (RUNTIME_VAR_PREFIXES.some((re) => re.test(name))) continue
    undefinedVars.push({ name, where: [...where] })
  }
  return { undefinedVars, referenced: refs.size }
}

const sourceFiles = listSourceFiles()
const { undefinedVars, referenced } = checkUndefinedVars(sourceFiles)

if (undefinedVars.length) {
  console.error(
    `✗ ${undefinedVars.length} custom propert(y|ies) referenced without any definition (the --shadow-hard bug class):\n`
  )
  for (const { name, where } of undefinedVars) {
    console.error(`  ${name}`)
    for (const file of where) console.error(`    ${file}`)
  }
  console.error(
    "\n  Define the token in app/globals.css (or the owning style object), or migrate the consumers.\n"
  )
  failed = true
} else {
  console.log(
    `✓ custom properties resolvable: ${referenced} var(--…) name(s) referenced, all defined`
  )
}

/* ------------------------------------------------------------------ */
/* CHECK 3 — arbitrary text sizes below the 10px mono-id floor         */
/* ------------------------------------------------------------------ */

function checkSubFloorText(files) {
  const subFloor = []
  for (const file of files) {
    if (!file.endsWith(".tsx")) continue
    const rel = relative(ROOT, file)
    const src = readFileSync(file, "utf8")
    for (const m of src.matchAll(/text-\[(\d*\.?\d+)(px|rem)\]/g)) {
      const px = m[2] === "px" ? Number(m[1]) : Number(m[1]) * 16
      if (px >= MIN_TEXT_PX) continue
      if (SUBFLOOR_EXCEPTIONS.has(rel)) continue
      subFloor.push({ file: rel, token: m[0], px })
    }
  }
  return subFloor
}

const subFloor = checkSubFloorText(sourceFiles)

if (subFloor.length) {
  console.error(
    `✗ ${subFloor.length} arbitrary text size(s) below the ${MIN_TEXT_PX}px mono-id floor:\n`
  )
  for (const { file, token, px } of subFloor) {
    console.error(`  ${token} (${px.toFixed(1)}px)  ${file}`)
  }
  console.error(
    "\n  Use .mono-id (10px) / .mono-meta (11.5px) from app/globals.css instead of sub-floor arbitrary sizes.\n"
  )
  failed = true
} else {
  console.log(
    `✓ micro-type floor held: no arbitrary text size below ${MIN_TEXT_PX}px outside the lane exception list (${SUBFLOOR_EXCEPTIONS.size} legacy files)`
  )
}

if (failed) process.exit(1)
