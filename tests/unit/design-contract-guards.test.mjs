import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * Repo-wide guards for the DESIGN.md contracts that used to be prose-only.
 * The 2026-07-10 design audit found drift concentrated exactly where a
 * contract had no (or a file-subset) machine check — ~30 private focus-ring
 * dialects and ~45 hand-rolled micro eyebrows — while every machine-enforced
 * contract showed zero drift. These tests make the two worst offenders
 * repo-wide, plus a two-way export-parity check the older one-way test
 * (tests/unit/motion-vocabulary.test.mjs) could not express.
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

const sourceRoots = ["app", "components"]

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    const stat = statSync(p)
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue
      walk(p, files)
    } else if (p.endsWith(".tsx")) {
      files.push(p)
    }
  }
  return files
}

function sourceFiles() {
  return sourceRoots.flatMap((root) => walk(path.join(projectRoot, root)))
}

function relativePath(filePath) {
  return path.relative(projectRoot, filePath)
}

test("focus dialect: no per-component focus-visible:ring anywhere", () => {
  // DESIGN.md · Elevation & Depth: ONE focus recipe (.pressable/.focus-ring,
  // the unlayered 2px outline). The ring-alpha dialect this bans shipped
  // indicators as weak as 1.69:1 against the 3:1 WCAG floor.
  const offenders = []

  for (const filePath of sourceFiles()) {
    const source = readFileSync(filePath, "utf8")
    source.split("\n").forEach((line, index) => {
      if (line.includes("focus-visible:ring")) {
        offenders.push(`${relativePath(filePath)}:${index + 1}`)
      }
    })
  }

  assert.deepEqual(
    offenders,
    [],
    `focus-visible:ring-* dialect is banned — use the .focus-ring recipe (DESIGN.md · Focus):\n  ${offenders.join("\n  ")}`
  )
})

test("micro type: no hand-rolled mono eyebrow below text-xs", () => {
  // DESIGN.md · Typography: below text-xs there are exactly two sanctioned
  // utilities (.mono-id 10px, .mono-meta 11.5px). A hand-rolled combo of
  // font-mono + uppercase + an arbitrary sub-12px size re-mints the scale.
  const offenders = []
  const arbitrarySize = /text-\[(\d*\.?\d+)(px|rem)\]/g

  for (const filePath of sourceFiles()) {
    const source = readFileSync(filePath, "utf8")
    source.split("\n").forEach((line, index) => {
      if (!line.includes("font-mono") || !line.includes("uppercase")) return
      for (const m of line.matchAll(arbitrarySize)) {
        const px = m[2] === "px" ? Number(m[1]) : Number(m[1]) * 16
        if (px < 12) {
          offenders.push(
            `${relativePath(filePath)}:${index + 1} (${m[0]} ≈ ${px.toFixed(1)}px)`
          )
        }
      }
    })
  }

  assert.deepEqual(
    offenders,
    [],
    `hand-rolled micro eyebrows are banned — use .mono-id / .mono-meta and add colour at the call site (DESIGN.md · Typography):\n  ${offenders.join("\n  ")}`
  )
})

test("WetInk primitive surface matches DESIGN.md both ways", () => {
  // The older guard only checked exports → docs, so a documented primitive
  // that stopped shipping (or a rename off the WetInk prefix, like
  // StampSlamSequence) slipped through. Set equality closes both directions.
  const wetInk = readFileSync(
    path.join(projectRoot, "components", "motion", "wet-ink.tsx"),
    "utf8"
  )
  const design = readFileSync(path.join(projectRoot, "DESIGN.md"), "utf8")

  const exported = new Set(
    [...wetInk.matchAll(/export function ([A-Za-z0-9_]+)/g)].map((m) => m[1])
  )
  const documented = new Set(
    [...design.matchAll(/`(WetInk[A-Za-z0-9]+|StampSlamSequence)`/g)].map(
      (m) => m[1]
    )
  )

  assert.ok(exported.size > 0, "wet-ink.tsx must export primitives")
  assert.deepEqual(
    [...exported].sort(),
    [...documented].sort(),
    "components/motion/wet-ink.tsx exports and DESIGN.md's documented primitive list must be the same set"
  )
})
