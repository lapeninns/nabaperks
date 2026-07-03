import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

const sourceRoots = ["app", "components", "lib"]
const sourceExtensions = new Set([".css", ".js", ".mjs", ".ts", ".tsx"])
const allowedAnimateTokens = new Set(["animate-spin", "animate-pulse"])
const guardToken = "motion-reduce:animate-none"
const animateUtilityPattern = /(?<![\w-])(?:motion-[\w-]+:)?animate-[\w-]+/
const animateUtilityGlobalPattern =
  /(?<![\w-])(?:motion-[\w-]+:)?animate-[\w-]+/g

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

function walkSourceFiles(root) {
  const absoluteRoot = path.join(projectRoot, root)
  const files = []

  function visit(filePath) {
    const stat = statSync(filePath)
    if (stat.isDirectory()) {
      const basename = path.basename(filePath)
      if (basename === "node_modules" || basename === ".next") return
      for (const entry of readdirSync(filePath)) {
        visit(path.join(filePath, entry))
      }
      return
    }

    if (sourceExtensions.has(path.extname(filePath))) {
      files.push(filePath)
    }
  }

  visit(absoluteRoot)
  return files
}

function sourceFiles() {
  return sourceRoots.flatMap((root) => walkSourceFiles(root))
}

function relativePath(filePath) {
  return path.relative(projectRoot, filePath)
}

function isCommentOnlyLine(line) {
  return /^\s*(\/\/|\/\*|\*)/.test(line)
}

function linesWithMatches(source, regex) {
  const matcher = new RegExp(regex.source, regex.flags.replaceAll("g", ""))

  return source
    .split("\n")
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => !isCommentOnlyLine(line) && matcher.test(line))
}

test("production code imports Motion only through the Wet Ink motion layer", () => {
  for (const filePath of sourceFiles()) {
    const relative = relativePath(filePath)
    const source = readFileSync(filePath, "utf8")
    const importsMotion =
      /from\s+["'](?:motion\/react|motion\/react-m|framer-motion)["']/.test(
        source
      )

    if (relative.startsWith("components/motion/")) continue

    assert.equal(
      importsMotion,
      false,
      `${relative} must not import raw Motion/Framer APIs`
    )
  }
})

test("removed w-* animation vocabulary stays out of source", () => {
  for (const filePath of sourceFiles()) {
    const relative = relativePath(filePath)
    const source = readFileSync(filePath, "utf8")

    assert.doesNotMatch(
      source,
      /animate-\[w-|animation:\s*w-|@keyframes\s+w-/,
      `${relative} must not resurrect w-* CSS animation vocabulary`
    )
  }
})

test("Tailwind animate utilities are limited and reduced-motion safe", () => {
  for (const filePath of sourceFiles()) {
    const relative = relativePath(filePath)
    const source = readFileSync(filePath, "utf8")
    const matches = linesWithMatches(source, animateUtilityPattern)

    for (const { line, lineNumber } of matches) {
      const tokens = line.match(animateUtilityGlobalPattern) ?? []

      for (const token of tokens) {
        if (token === guardToken) continue
        if (token.startsWith("motion-safe:")) {
          assert.ok(
            allowedAnimateTokens.has(token.replace("motion-safe:", "")),
            `${relative}:${lineNumber} uses unsupported ${token}`
          )
          continue
        }

        assert.ok(
          allowedAnimateTokens.has(token),
          `${relative}:${lineNumber} uses unsupported ${token}`
        )
        assert.match(
          line,
          /motion-reduce:animate-none/,
          `${relative}:${lineNumber} must guard ${token} with ${guardToken}`
        )
      }
    }
  }
})

test("WetInk exports stay documented in DESIGN.md", () => {
  const wetInk = readProjectFile("components", "motion", "wet-ink.tsx")
  const design = readProjectFile("DESIGN.md")
  const exports = [...wetInk.matchAll(/export function (WetInk[A-Za-z0-9]+)/g)]
    .map((match) => match[1])
    .sort()

  assert.ok(exports.length > 0, "wet-ink.tsx must export WetInk primitives")

  for (const exportName of exports) {
    assert.match(
      design,
      new RegExp(`\\b${exportName}\\b`),
      `${exportName} must be documented in DESIGN.md`
    )
  }
})
